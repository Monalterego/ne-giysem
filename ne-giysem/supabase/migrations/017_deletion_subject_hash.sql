-- ============================================================
-- 017_deletion_subject_hash
-- deletion_log'a kullanıcı kimliğinin geri döndürülemeyen özeti (subject_hash) eklenir.
--
-- Amaç: veritabanı bir yedekten geri yüklenirse, yedek tarihinden SONRA silinmiş hesaplar
-- yedekle birlikte geri gelir. subject_hash ile bu hesaplar bulunup yeniden silinir
-- (saklama-imha-politikasi.md → "Yedekten geri yükleme prosedürü").
--
-- subject_hash = hex(HMAC-SHA256(anahtar = DELETION_LOG_PEPPER, mesaj = user_id::text))
--   • user_id küçük harfli kanonik uuid metni (auth.users.id::text).
--   • Pepper yalnızca Supabase edge function secret'ı (DELETION_LOG_PEPPER); repoda,
--     kodda, veritabanında YOK. Pepper olmadan özetten kimlik bulunamaz ve bir uuid'in
--     özeti hesaplanamaz.
--   • Yazan: functions/delete-account (Web Crypto HMAC). Pepper secret'ı yoksa NULL yazılır
--     ve ops_events'e 'deletion_pepper_missing' düşer (silme yine yapılır).
--   • Pepper DEĞİŞTİRİLMEMELİ: değişirse eski satırlar yeni pepper'la eşleşmez. Kaybolursa
--     geri yükleme eşleştirmesi yapılamaz → pepper ayrıca parola yöneticisinde saklanır.
--
-- purge_restored_deleted_accounts(p_pepper) — yalnızca service_role:
--   subject_hash'i deletion_log'da bulunan hesapları siler:
--     auth.users (cascade ile public tablolar) + auth.users geri yüklenmemiş olsa bile
--     public tablolardaki satırlar (yedek yalnızca public şemayı içeriyorsa).
--   Storage dosyaları yedeklenmediği için geri gelmez; storage.objects meta verisi geri
--   yüklendiyse ilgili <uid>/ satırları da silinir (dosya zaten yoktur).
--   p_pepper parametre olarak verilir (veritabanında tutulmaz). SQL Editor'a yazmak yerine
--   service_role ile RPC olarak çağrılması önerilir (sorgu geçmişine düşmesin).
--
-- Önkoşul: 014–016. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.deletion_log
  add column if not exists subject_hash text;

alter table public.deletion_log
  drop constraint if exists deletion_log_subject_hash_format;
alter table public.deletion_log
  add constraint deletion_log_subject_hash_format
  check (subject_hash is null or subject_hash ~ '^[0-9a-f]{64}$');

create index if not exists idx_deletion_log_subject_hash
  on public.deletion_log (subject_hash)
  where subject_hash is not null;

-- ─── purge_restored_deleted_accounts ─────────────────────────────────────────
create or replace function public.purge_restored_deleted_accounts(p_pepper text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ids     uuid[];
  v_auth    int := 0;
  v_public  int := 0;
  v_objects int := 0;
  v_n       int;
begin
  if p_pepper is null or length(p_pepper) < 16 then
    raise exception 'pepper-required' using errcode = '22023';
  end if;

  -- Geri yüklenmiş hesaplar: auth.users ve profiles'taki kimliklerden, özeti silme kaydında olanlar
  select coalesce(array_agg(distinct uid), '{}') into v_ids
    from (
      select id as uid from auth.users
      union
      select id from public.profiles
    ) candidates
   where encode(extensions.hmac(uid::text, p_pepper, 'sha256'), 'hex')
         in (select subject_hash from deletion_log where subject_hash is not null);

  if array_length(v_ids, 1) is null then
    return jsonb_build_object('matched', 0, 'auth_users', 0, 'public_rows', 0, 'storage_objects', 0);
  end if;

  -- auth.users → profiles, wardrobe_items, combos, consent_events, ... cascade
  delete from auth.users where id = any (v_ids);
  get diagnostics v_auth = row_count;

  -- auth.users yedekte yoksa cascade çalışmaz → public tablolar doğrudan
  delete from public.style_profiles  where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.wardrobe_items  where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.combos          where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.favorite_combos where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.entitlements    where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.consent_events  where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.tryon_renders   where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.api_usage       where user_id = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;
  delete from public.profiles        where id      = any (v_ids); get diagnostics v_n = row_count; v_public := v_public + v_n;

  -- Storage meta verisi geri yüklendiyse (dosyaların kendisi yedeklenmez)
  delete from storage.objects
   where bucket_id in ('avatars', 'wardrobe-items', 'mannequin-cache')
     and (storage.foldername(name))[1] = any (select unnest(v_ids)::text);
  get diagnostics v_objects = row_count;

  return jsonb_build_object(
    'matched', array_length(v_ids, 1), 'auth_users', v_auth,
    'public_rows', v_public, 'storage_objects', v_objects
  );
end;
$$;

revoke execute on function public.purge_restored_deleted_accounts(text) from public, anon, authenticated;
grant  execute on function public.purge_restored_deleted_accounts(text) to service_role;

commit;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'deletion_log' and column_name = 'subject_hash';
-- select count(*) filter (where subject_hash is not null) as hashli, count(*) from public.deletion_log;
--   (delete-account deploy edildikten sonraki silmelerde hashli artmalı)
--
-- ─── Geri yükleme sonrası çağrı (service_role ile RPC; pepper ortam değişkeninden) ──
-- curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/purge_restored_deleted_accounts" \
--   -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json" \
--   -d "{\"p_pepper\": \"$DELETION_LOG_PEPPER\"}"

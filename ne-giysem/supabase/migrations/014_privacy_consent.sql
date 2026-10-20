-- ============================================================
-- 014_privacy_consent
-- Gizlilik uyumu — rıza kayıtları, silme kaydı, saklama süresi temizliği.
--
-- 1) consent_events — yalnız ekleme (append-only) rıza geçmişi.
--    • kind: 'notice_shown'   aydınlatma metni gösterildi ("Okudum")
--            'ai_processing'  kıyafet/ürün fotoğrafının Poof + Anthropic'e gönderilmesi
--            'tryon_photo'    profil fotoğrafının FASHN'a gönderilmesi (açık rıza)
--            'tryon_physical' fiziksel bilgilerin manken üretimi için FASHN'a gönderilmesi (açık rıza)
--    • Bir kind'ın güncel durumu = o kind'ın EN SON satırı (en büyük id).
--      id identity → aynı transaction'daki iki satırda bile sıra kesin (created_at eşit olabilir).
--    • İstemci yalnızca kendi satırını INSERT eder; UPDATE / DELETE yok (grant + policy yok).
--      created_at / id istemciden yazılamaz (kolon bazlı INSERT grant'ı).
--    • text_version: istemcideki CONSENT_VERSIONS (src/constants/consent.ts).
--    • profiles.sensitive_consent_at KORUNUR (011) — istemci aynası olarak yazmaya devam eder,
--      ama karar artık consent_events'ten okunur.
--    • Mevcut kullanıcılar için GERİYE DÖNÜK rıza satırı YAZILMAZ: eski tek rıza iki ayrı
--      açık rızayı kapsamıyordu → ConsentGate mevcut verilere göre gerekenleri yeniden sorar.
--    • Silme: auth.users ON DELETE CASCADE (delete-account ile gider).
--
-- 2) consent_granted(user, kind) — proxy'ler (service_role) için karar fonksiyonu.
--    my_consents() — istemcinin kendi güncel durumları (kind → {granted, text_version, created_at}).
--
-- 3) deletion_log — hesap silme kaydı. Kullanıcı kimliği / e-posta YOK.
--    delete-account başarıyla bitince yazar. Yalnızca service_role.
--    source: 'app' (Profil → Hesabımı Sil), 'under18' (AgeGate), 'email' (destek
--    e-postasıyla gelen talep — panelden silinip bu tabloya elle eklenir).
--
-- 4) Saklama: purge_retention() — api_usage 13 aydan, ops_events 12 aydan eski satırlar.
--    pg_cron varsa günlük 03:17 UTC iş olarak planlanır (dosyanın sonundaki ayrı blok).
--
-- Önkoşul: 006, 007, 011, 013. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── consent_events ──────────────────────────────────────────────────────────
create table if not exists public.consent_events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null
               check (kind in ('notice_shown', 'ai_processing', 'tryon_photo', 'tryon_physical')),
  granted      boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 64),
  created_at   timestamptz not null default now()
);

create index if not exists idx_consent_events_user_kind
  on public.consent_events (user_id, kind, id desc);

alter table public.consent_events enable row level security;

-- Default privileges anon/authenticated'a ALL veriyor → geri al, sonra açıkça ver
revoke all on table public.consent_events from anon, authenticated;
grant select on table public.consent_events to authenticated;
grant insert (user_id, kind, granted, text_version) on table public.consent_events to authenticated;
grant all on table public.consent_events to service_role;

drop policy if exists "consent_events: kendi satırını oku" on public.consent_events;
create policy "consent_events: kendi satırını oku"
  on public.consent_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "consent_events: kendi satırını ekle" on public.consent_events;
create policy "consent_events: kendi satırını ekle"
  on public.consent_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);
-- UPDATE / DELETE policy'si YOK → geçmiş değiştirilemez

-- ─── consent_granted (service_role) ──────────────────────────────────────────
-- Kayıt yoksa false (izin verilmemiş sayılır).
create or replace function public.consent_granted(p_user uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select granted
       from consent_events
      where user_id = p_user and kind = p_kind
      order by id desc
      limit 1),
    false
  );
$$;

-- ─── my_consents (istemci) ───────────────────────────────────────────────────
-- { "ai_processing": {"granted": true, "text_version": "...", "created_at": "..."}, ... }
-- Hiç kaydı olmayan kind anahtarı dönmez (= henüz sorulmadı).
create or replace function public.my_consents()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(kind, jsonb_build_object(
      'granted',      granted,
      'text_version', text_version,
      'created_at',   created_at
    )),
    '{}'::jsonb
  )
  from (
    select distinct on (kind) kind, granted, text_version, created_at
      from consent_events
     where user_id = auth.uid()
     order by kind, id desc
  ) latest;
$$;

-- ─── deletion_log ────────────────────────────────────────────────────────────
create table if not exists public.deletion_log (
  id              uuid primary key default gen_random_uuid(),
  deleted_at      timestamptz not null default now(),
  source          text not null check (source in ('app', 'email', 'under18')),
  categories      jsonb not null default '[]'::jsonb,   -- silinen veri türleri, örn. ["wardrobe_items","avatar"]
  revenuecat_ok   boolean,                              -- null: denenmedi
  apple_revoke_ok boolean                               -- null: Apple hesabı değil / kod yok
);

alter table public.deletion_log enable row level security;
-- Policy YOK: yalnızca service_role
revoke all on table public.deletion_log from anon, authenticated;
grant all on table public.deletion_log to service_role;

-- ─── purge_retention ─────────────────────────────────────────────────────────
-- api_usage.day bir tarih (Supabase'de UTC current_date) → 13 ay öncesinden eski günler.
-- Döner: {"api_usage": n, "ops_events": m} (cron.job_run_details'te görünür).
create or replace function public.purge_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage int;
  v_ops   int;
begin
  delete from api_usage  where day        < (current_date - interval '13 months')::date;
  get diagnostics v_usage = row_count;

  delete from ops_events where created_at < now() - interval '12 months';
  get diagnostics v_ops = row_count;

  return jsonb_build_object('api_usage', v_usage, 'ops_events', v_ops);
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
revoke execute on function public.consent_granted(uuid, text) from public, anon, authenticated;
revoke execute on function public.my_consents()               from public, anon, authenticated;
revoke execute on function public.purge_retention()           from public, anon, authenticated;

grant execute on function public.consent_granted(uuid, text) to service_role;
grant execute on function public.my_consents()               to authenticated;
grant execute on function public.purge_retention()           to service_role;

commit;

-- ─── pg_cron: günlük saklama temizliği ───────────────────────────────────────
-- Ayrı blok: pg_cron yoksa yukarıdaki her şey yine uygulanmış olur.
-- Supabase'de pg_cron Dashboard → Database → Extensions (ya da Integrations → Cron)
-- üzerinden de açılabilir. cron.schedule aynı adla çağrılınca mevcut işi günceller.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron bu veritabanında yok — purge_retention() elle ya da harici zamanlayıcıyla çalıştırılmalı';
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.schedule(
    'sestina_retention_purge',
    '17 3 * * *',                          -- her gün 03:17 UTC
    'select public.purge_retention()'
  );
  raise notice 'pg_cron işi planlandı: sestina_retention_purge';
end
$$;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select name, installed_version from pg_available_extensions where name = 'pg_cron';
-- select jobid, jobname, schedule, command, active from cron.job where jobname = 'sestina_retention_purge';
-- select * from cron.job_run_details order by start_time desc limit 5;   -- ilk çalıştırmadan sonra
-- select public.purge_retention();                                       -- elle bir kez dene
--
-- select grantee, privilege_type, column_name from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'consent_events' and grantee = 'authenticated';
-- Beklenen: SELECT (tüm kolonlar) + INSERT yalnızca user_id, kind, granted, text_version.
--
-- select policyname, cmd from pg_policies where tablename in ('consent_events', 'deletion_log');
-- Beklenen: consent_events → SELECT + INSERT; deletion_log → hiç policy yok.
--
-- ─── TEST: rıza durumu (SQL Editor, '<uid>' = auth.users.id) ─────────────────
-- insert into public.consent_events (user_id, kind, granted, text_version)
-- values ('<uid>', 'ai_processing', false, 'manual-test');
-- select public.consent_granted('<uid>', 'ai_processing');   -- false → proxy'ler 403
-- insert into public.consent_events (user_id, kind, granted, text_version)
-- values ('<uid>', 'ai_processing', true, 'manual-test');
-- select public.consent_granted('<uid>', 'ai_processing');   -- true
--
-- ─── Elle silme kaydı (e-postayla gelen talep, panelden silindikten sonra) ──
-- insert into public.deletion_log (source, categories, revenuecat_ok, apple_revoke_ok)
-- values ('email', '["account"]'::jsonb, null, null);

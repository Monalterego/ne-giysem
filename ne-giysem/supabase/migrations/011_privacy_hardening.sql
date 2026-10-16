-- ============================================================
-- 011_privacy_hardening
-- • profiles.age_confirmed_at     — "18 yaşından büyüğüm" onayı (tüm giriş yolları)
-- • profiles.sensitive_consent_at — fiziksel profil / avatar için açık rıza
--   (geri çekilince NULL). İkisi de istemcinin kendi beyanı → kolon bazlı
--   UPDATE grant'ına eklenir (006'daki listeye ek; diğerleri değişmez).
-- • storage.objects DELETE: kullanıcı kendi <uid>/ klasöründeki dosyaları silebilsin
--   (kıyafet silme, avatar kaldırma, rıza geri çekme). Mevcut policy'ler
--   SELECT/INSERT/UPDATE; DELETE yoksa storage remove() hatasız ama SİLMEDEN döner.
--
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists age_confirmed_at     timestamptz,
  add column if not exists sensitive_consent_at timestamptz;

grant update (age_confirmed_at, sensitive_consent_at) on public.profiles to authenticated;

-- Kendi klasöründeki dosyayı silme — yol biçimi <uid>/<dosya> (storageUrls.ts)
drop policy if exists "sestina_owner_delete" on storage.objects;
create policy "sestina_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'wardrobe-items', 'mannequin-cache')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- ─── Doğrulama ───────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'profiles'
--    and column_name in ('age_confirmed_at', 'sensitive_consent_at');
--
-- select policyname, cmd, roles, qual from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' order by cmd;
-- (Daha önce elle eklenmiş bir DELETE policy'si varsa ikisi OR'lanır — zararsız.)

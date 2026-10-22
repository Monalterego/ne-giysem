-- ============================================================
-- ⚠️ 019_storage_limits BU DOSYAYI GEÇERSİZ KILAR. 019 uygulandıktan sonra 018'i tekrar
--    ÇALIŞTIRMA: bucket sınırlarını kaldırır ve iki bucket'ın policy rolünü public'e döndürür.
--    Bu dosya 22.10.2026 ölçümünün (019 öncesi) kaydı olarak duruyor.
-- ============================================================
-- 018_storage_policies_snapshot
-- Panelden elle oluşturulmuş storage bucket ayarlarını ve storage.objects policy'lerini
-- repoya alır. Kaynak: 22.10.2026 ölçümü (storage.buckets + pg_policies, schemaname = storage).
--
-- DAVRANIŞ DEĞİŞMEZ: her policy, ölçülen adı, komutu, rolü, USING ve WITH CHECK ifadesiyle
-- birebir yeniden oluşturulur (drop if exists + create). Bucket ayarları ölçülen değerlere
-- eşitlenir. Bilinen zayıflıklar bilerek DÜZELTİLMEDİ — aşağıdaki "Notlar".
--
-- Varsayım: ölçüm çıktısında 'permissive' kolonu yoktu; Supabase varsayılanı PERMISSIVE.
-- Çalıştırmadan önce doğrula:
--   select policyname, permissive from pg_policies where schemaname = 'storage' and tablename = 'objects';
--   (hepsi PERMISSIVE olmalı; değilse bu dosyayı ÇALIŞTIRMA)
--
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── Bucket'lar (ölçüm: public, file_size_limit, allowed_mime_types) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',         'avatars',         false, null, null),
  ('mannequin-cache', 'mannequin-cache', false, null, null),
  ('moodboards',      'moodboards',      true,  null, null),   -- statik içerik, kullanıcı verisi yok (010)
  ('wardrobe-items',  'wardrobe-items',  false, null, null)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── avatars (rol: authenticated) ────────────────────────────────────────────
drop policy if exists "Avatar sahibi okuyabilir" on storage.objects;
create policy "Avatar sahibi okuyabilir"
  on storage.objects for select to authenticated
  using ((bucket_id = 'avatars') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Avatar sahibi yukleyebilir" on storage.objects;
create policy "Avatar sahibi yukleyebilir"
  on storage.objects for insert to authenticated
  with check ((bucket_id = 'avatars') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Avatar sahibi guncelleyebilir" on storage.objects;
create policy "Avatar sahibi guncelleyebilir"
  on storage.objects for update to authenticated
  using      ((bucket_id = 'avatars') and ((auth.uid())::text = (storage.foldername(name))[1]))
  with check ((bucket_id = 'avatars') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- ─── wardrobe-items (rol: public — ölçüldüğü gibi) ───────────────────────────
drop policy if exists "Kullanici kendi dosyalarini okuyabilir" on storage.objects;
create policy "Kullanici kendi dosyalarini okuyabilir"
  on storage.objects for select to public
  using ((bucket_id = 'wardrobe-items') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Kullanici kendi dosyalarini yukleyebilir" on storage.objects;
create policy "Kullanici kendi dosyalarini yukleyebilir"
  on storage.objects for insert to public
  with check ((bucket_id = 'wardrobe-items') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- ─── mannequin-cache (rol: public — ölçüldüğü gibi) ──────────────────────────
drop policy if exists "Manken kendi dosyasini okuyabilir" on storage.objects;
create policy "Manken kendi dosyasini okuyabilir"
  on storage.objects for select to public
  using ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Manken kendi dosyasini yukleyebilir" on storage.objects;
create policy "Manken kendi dosyasini yukleyebilir"
  on storage.objects for insert to public
  with check ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- WITH CHECK ölçümde null → UPDATE'te USING ifadesi yeni satıra da uygulanır (Postgres davranışı)
drop policy if exists "Manken kendi dosyasini guncelleyebilir" on storage.objects;
create policy "Manken kendi dosyasini guncelleyebilir"
  on storage.objects for update to public
  using ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- ─── Silme (011 ile aynı; burada da tek yerde dursun) ─────────────────────────
drop policy if exists "sestina_owner_delete" on storage.objects;
create policy "sestina_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'wardrobe-items', 'mannequin-cache')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- ─── Doğrulama ───────────────────────────────────────────────────────────────
-- select policyname, cmd, roles, permissive, qual, with_check from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' order by policyname;
--   → 9 policy, ölçümle aynı ifadeler
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
--
-- ─── Notlar: fark edilen zayıflıklar (bu dosyada düzeltilmedi; 1 ve 2 → 019) ─
-- 1) Dosya boyutu ve MIME türü sınırı yok (file_size_limit / allowed_mime_types null).
--    Oturum açmış bir kullanıcı kendi <uid>/ klasörüne istemciyi atlayarak her türden ve
--    boyutta dosya yükleyebilir (ör. çalıştırılabilir dosya, çok büyük dosya → depolama
--    maliyeti / kötüye kullanım). Uygulama yalnızca JPEG/PNG yükler.
--    Öneri: private bucket'lara allowed_mime_types = {image/jpeg,image/png} ve
--    file_size_limit (ör. 5 MB) — uygulama yüklemeleriyle test edildikten sonra.
-- 2) wardrobe-items ve mannequin-cache policy'leri 'public' rolüne tanımlı (avatars
--    'authenticated'). anon için auth.uid() null → koşul her zaman false; erişim açığı
--    yok, ama tutarlılık için 'authenticated'a daraltılabilir.
-- 3) wardrobe-items'ta UPDATE policy'si yok. Uygulama upsert: true ile yüklüyor; yeni yol
--    (uuid) olduğu için şu an sorun değil, aynı yola yeniden yükleme reddedilir.
-- 4) moodboards public bucket ve hiç policy'si yok: herkes bilinen yolu okuyabilir
--    (public URL), listeleme/yükleme kapalı. Kullanıcı verisi konmadığı sürece uygun.

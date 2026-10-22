-- ============================================================
-- 019_storage_limits
-- 018'de belgelenen iki zayıflığı kapatır (moodboards'a dokunulmaz):
--   1) avatars, wardrobe-items, mannequin-cache:
--        allowed_mime_types = {image/jpeg, image/png, image/webp}
--        file_size_limit    = 10 MB (10 * 1024 * 1024 = 10485760 bayt)
--   2) wardrobe-items ve mannequin-cache policy'leri: rol public → authenticated.
--      Koşullar (USING / WITH CHECK) 018'dekiyle birebir aynı.
--
-- 018'i GEÇERSİZ KILAR: 018, 22.10.2026 ölçümünün anlık görüntüsüdür (sınırsız bucket,
-- public rol). 019'dan sonra 018 TEKRAR ÇALIŞTIRILMAMALI — eski hâle döndürür.
--
-- Uygulamadaki yüklemelerle uyum (kod taraması, 1ae49a9+ / 681d3cd):
--   bucket          | yer                                   | contentType | en büyük olası boyut
--   wardrobe-items  | UploadDetailScreen.tsx:251 (görsel)   | image/jpeg  | 1000 px JPEG q0.9 ≈ <1 MB; küçültme başarısızsa ≤ ~1,5 MB (base64 ≤ 2.000.000, imageNormalize)
--   wardrobe-items  | UploadDetailScreen.tsx:270 (önizleme) | image/jpeg  | 400 px JPEG q0.8 ≈ <100 KB
--   avatars         | ProfilePhotoScreen.tsx:118            | image/jpeg  | genişlik 1200 px JPEG q0.9 ≈ 0,3–1,5 MB (yükseklik sınırsız; aşırı uzun panoramada büyür)
--   mannequin-cache | CombosScreen.tsx:738 (base manken)    | image/png   | FASHN model-create çıktısı, 2:3 — birkaç MB [FASHN çıktısına bağlı]
--   mannequin-cache | CombosScreen.tsx:762 (try-on sonucu)  | image/jpeg  | FASHN çıktısı: tryon-v1.6 jpeg; tryon-max "1k" [FASHN çıktısına bağlı]
-- Sunucu (edge function) tarafında depoya yükleme yok. Supabase MIME kontrolünü yüklemedeki
-- Content-Type başlığına göre yapar; tüm noktalar jpeg ya da png bildiriyor → izinli.
--
-- Önkoşul: 018. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── Bucket sınırları ────────────────────────────────────────────────────────
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit    = 10485760
 where id in ('avatars', 'wardrobe-items', 'mannequin-cache');

-- ─── wardrobe-items: public → authenticated ─────────────────────────────────
drop policy if exists "Kullanici kendi dosyalarini okuyabilir" on storage.objects;
create policy "Kullanici kendi dosyalarini okuyabilir"
  on storage.objects for select to authenticated
  using ((bucket_id = 'wardrobe-items') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Kullanici kendi dosyalarini yukleyebilir" on storage.objects;
create policy "Kullanici kendi dosyalarini yukleyebilir"
  on storage.objects for insert to authenticated
  with check ((bucket_id = 'wardrobe-items') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- ─── mannequin-cache: public → authenticated ────────────────────────────────
drop policy if exists "Manken kendi dosyasini okuyabilir" on storage.objects;
create policy "Manken kendi dosyasini okuyabilir"
  on storage.objects for select to authenticated
  using ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

drop policy if exists "Manken kendi dosyasini yukleyebilir" on storage.objects;
create policy "Manken kendi dosyasini yukleyebilir"
  on storage.objects for insert to authenticated
  with check ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

-- WITH CHECK yok (018 ile aynı) → UPDATE'te USING yeni satıra da uygulanır
drop policy if exists "Manken kendi dosyasini guncelleyebilir" on storage.objects;
create policy "Manken kendi dosyasini guncelleyebilir"
  on storage.objects for update to authenticated
  using ((bucket_id = 'mannequin-cache') and ((auth.uid())::text = (storage.foldername(name))[1]));

commit;

-- ─── Doğrulama ───────────────────────────────────────────────────────────────
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
--   → avatars / mannequin-cache / wardrobe-items: 10485760, {image/jpeg,image/png,image/webp}
--   → moodboards: değişmedi (public, null, null)
-- select policyname, cmd, roles from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' order by policyname;
--   → 9 policy; hepsi {authenticated}
--
-- ─── Cihaz testi (019 sonrası) ───────────────────────────────────────────────
-- kıyafet ekle (AI açık + kapalı), profil fotoğrafı yükle/değiştir, sanal deneme
-- (fotoğrafla ve yapay mankenle, ilk manken üretimi dahil). Hata görülürse geri alma:
--   update storage.buckets set allowed_mime_types = null, file_size_limit = null
--    where id in ('avatars','wardrobe-items','mannequin-cache');

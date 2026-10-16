-- ============================================================
-- 010_private_buckets
-- avatars, wardrobe-items, mannequin-cache → private. moodboards public KALIR
-- (statik içerik, kullanıcı verisi değil).
--
-- EN SON çalıştırılır: OTA yayında + 009 çalışmış + yol testleri geçmiş olmalı.
-- Bundan sonra /object/public/... URL'leri 400 döner; görseller yalnızca
-- imzalı URL (createSignedUrl(s)) ile açılır. Storage RLS (sahibine kısıtlı
-- SELECT/INSERT/UPDATE) imzalamayı sahibine izin veriyor.
--
-- Geri alma (sorun çıkarsa): aynı sorgu public = true ile.
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

update storage.buckets
   set public = false
 where id in ('avatars', 'wardrobe-items', 'mannequin-cache');

-- Doğrulama:
-- select id, public from storage.buckets order by id;
-- beklenen: avatars f, mannequin-cache f, moodboards t, wardrobe-items f

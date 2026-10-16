-- ============================================================
-- 009_storage_paths
-- Görsel kolonlarında tam public URL yerine bucket içi YOL (<uid>/<dosya>).
--
-- Önkoşul: istemci OTA'sı yayında olmalı (storageUrls.ts hem tam URL hem yol okur).
-- Eski paket yolu URL sanıp görsel gösteremez — OTA yaygınlaşmadan çalıştırma.
--
-- • avatar_url'deki ?v=<zaman> sürümü KORUNUR: expo-image cacheKey'i ve try-on
--   cache anahtarı (CombosScreen modelVersion) bundan türüyor; silinirse daha önce
--   üretilmiş try-on'lar cache'ten gelmez, kota yeniden düşer.
-- • mannequin_url FASHN CDN'indeyse (72 saatte silinir) NULL — istemci gerekirse
--   mankeni yeniden üretir.
--
-- Tekrar çalıştırılabilir: yalnızca öneki taşıyan satırlara dokunur.
-- Elle çalıştırılır (SQL Editor).
-- ============================================================

begin;

-- ─── wardrobe_items → wardrobe-items bucket'ı ───────────────────────────────
update public.wardrobe_items
   set image_url = substr(image_url, length('https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/') + 1)
 where image_url like 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/%';

update public.wardrobe_items
   set processed_image_url = substr(processed_image_url, length('https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/') + 1)
 where processed_image_url like 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/%';

update public.wardrobe_items
   set thumb_url = substr(thumb_url, length('https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/') + 1)
 where thumb_url like 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/%';

-- ─── profiles.avatar_url → avatars bucket'ı (?v= korunur) ───────────────────
update public.profiles
   set avatar_url = substr(avatar_url, length('https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/avatars/') + 1)
 where avatar_url like 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/avatars/%';

-- ─── profiles.mannequin_url → mannequin-cache bucket'ı; FASHN CDN → NULL ─────
update public.profiles
   set mannequin_url = substr(mannequin_url, length('https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/mannequin-cache/') + 1)
 where mannequin_url like 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/mannequin-cache/%';

update public.profiles
   set mannequin_url = null
 where mannequin_url like 'https://cdn.fashn.ai/%';

commit;

-- ─── Doğrulama (ayrı çalıştır; hepsi 0 beklenir) ─────────────────────────────
-- Hâlâ http ile başlayan değer = beklenmeyen biçim → elle incele, tahminle silme.
--
-- select 'image_url'           as col, count(*) from public.wardrobe_items where image_url           like 'http%'
-- union all
-- select 'processed_image_url',        count(*) from public.wardrobe_items where processed_image_url like 'http%'
-- union all
-- select 'thumb_url',                  count(*) from public.wardrobe_items where thumb_url           like 'http%'
-- union all
-- select 'avatar_url',                 count(*) from public.profiles       where avatar_url          like 'http%'
-- union all
-- select 'mannequin_url',              count(*) from public.profiles       where mannequin_url       like 'http%';

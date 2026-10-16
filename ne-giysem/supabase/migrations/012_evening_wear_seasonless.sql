-- ============================================================
-- 012_evening_wear_seasonless
-- Abiye/gece parçaları mevsimsizdir: signals'ında "evening_wear" olan
-- wardrobe_items satırlarında season → '[]'.
--
-- Bugüne kadar vision her parçaya kumaştan tahminle mevsim yazıyordu (kadife abiye
-- → ["kis"]); seasonFit aktif mevsim listede yoksa −0.25 ceza veriyordu. Yeni
-- kayıtlarda visionAnalysis.ts bunu zaten boş bırakıyor; bu migration eski satırlar için.
--
-- signals biçimi (schema/public_2026-10-15.sql: jsonb DEFAULT '[]'): istemci string
-- dizisi yazar (["evening_wear","satin"]). useWardrobeStore.parseJsonArray ayrıca
-- çift kodlanmış JSON metnini (jsonb string skaler) da okuyor → iki biçim de kapsanır.
--
-- Etkilenecek satır sayısı (önce bunu çalıştır):
--
--   select count(*)
--     from public.wardrobe_items
--    where season is distinct from '[]'::jsonb
--      and (
--            (jsonb_typeof(signals) = 'array'  and signals ? 'evening_wear')
--         or (jsonb_typeof(signals) = 'string' and (signals #>> '{}') like '%"evening_wear"%')
--      );
--
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir: zaten '[]' olanlara dokunmaz.
-- ============================================================

begin;

update public.wardrobe_items
   set season = '[]'::jsonb
 where season is distinct from '[]'::jsonb
   and (
         (jsonb_typeof(signals) = 'array'  and signals ? 'evening_wear')
      or (jsonb_typeof(signals) = 'string' and (signals #>> '{}') like '%"evening_wear"%')
   );

commit;

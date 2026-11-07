-- ============================================================
-- 023_drop_start_scan
-- Adım 15 (H5): "Uyar mı?" hakkı artık anthropic-proxy'de (022 scan_jobs).
-- İstemci RPC'si start_scan 022'den beri saymıyor; yeni bundle onu çağırmıyor.
--
-- ⚠️ SIRA: OTA (H4) yayınlanıp test ve demo hesapları yeni bundle'a geçtikten SONRA.
-- Eski bundle start_scan'i çağırırsa RPC hatası alır; spendScan hatada sonucu
-- engellemiyordu (premiumGate, H4 öncesi) → kırılma olmaz.
--
-- Önkoşul: 022. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

revoke execute on function public.start_scan() from public, anon, authenticated;
drop function if exists public.start_scan();

commit;

-- ─── Yıllık ürünler (H5, mağazada deneme tanımlandıktan sonra; ayrı çalıştır) ─────────
-- Yıllık plan kurulum ayı (150 stüdyo görseli, ilk ücretli günden) için ürün kimlikleri.
-- Kimlik entitlements.product_id'de göründüğü gibi (Android 'urun:baseplan' olabilir):
--   select distinct product_id, store, period_type from public.entitlements;
-- insert into public.annual_products (product_id, note) values
--   ('<app_store_yillik_urun_id>', 'App Store yıllık (7 gün deneme)'),
--   ('<play_yillik_urun_id>',      'Play yıllık (7 gün deneme)')
-- on conflict do nothing;
--
-- ─── GERİ ALMA ───────────────────────────────────────────────────────────────
-- 022_hard_paywall_trial.sql'deki start_scan bloğunu ve grant satırını yeniden çalıştır.

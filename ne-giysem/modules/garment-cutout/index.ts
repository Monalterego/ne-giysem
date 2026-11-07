// Cihaz üstü kıyafet kesimi (adım 8-10, G2). Görsel cihazdan çıkmaz.
//   iOS 17+  : Vision VNGenerateForegroundInstanceMaskRequest
//   Android  : ML Kit Subject Segmentation (beta; model Google Play hizmetlerinden iner)
// Çıktı her zaman beyaz zemin JPEG (dolap ve kombin kartı JPEG kullanıyor).
import Native from './src/GarmentCutoutModule';
import type { CutoutResult, CutoutSupport } from './src/GarmentCutout.types';

export * from './src/GarmentCutout.types';

/** Bu cihazda kesim yapılabilir mi? Hata vermez. */
export async function cutoutSupport(): Promise<CutoutSupport> {
  if (!Native) return { supported: false, reason: 'no-module' };
  try {
    return await Native.isSupported();
  } catch (err) {
    console.warn('[garment-cutout] isSupported hata:', err);
    return { supported: false, reason: 'error' };
  }
}

/**
 * Kıyafeti arka plandan ayırıp beyaz zemine koyar. Özne bulunamazsa null.
 * Hata fırlatır (code: CutoutErrorCode) — çağıran "olduğu gibi kaydet"e düşer.
 */
export async function cutoutGarment(uri: string): Promise<CutoutResult | null> {
  if (!Native) return null;
  return Native.cutout(uri);
}

/** Saydam PNG'yi (örn. packshot çıktısı) beyaz zemin JPEG'e çevirir. */
export async function flattenOnWhite(uri: string): Promise<CutoutResult> {
  if (!Native) throw new Error('garment-cutout: native modül yok');
  return Native.flattenOnWhite(uri);
}

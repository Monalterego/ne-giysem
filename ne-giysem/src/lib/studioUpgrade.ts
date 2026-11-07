import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { deleteTryOnCacheForItems, deleteWardrobeFiles } from './privacyActions';
import { base64Decode } from '../utils/base64';
import type { WardrobeItem } from '../types';
import type { Usage } from '../store/usePlanStore';

// ─── "Stüdyo kalitesine yükselt" (adım 8-10, G6) ─────────────────────────────
// Cihaz kesimiyle ya da olduğu gibi kaydedilmiş parçayı kullanıcı seçip packshot'a
// yükseltir. Otomatik yükseltme yok. Kota sunucuda (garment-image, item_id ile).

/** Yükseltilebilir mi? Packshot'lı ve eski (Poof dönemi, image_source yok) parçalar hariç */
export function isUpgradeEligible(item: WardrobeItem): boolean {
  return item.imageSource === 'device_cutout' || item.imageSource === 'original';
}

/** Kalan packshot hakkı; bilinmiyorsa null, sınırsızsa Infinity */
export function packshotRemaining(usage: Usage | null): number | null {
  const p = usage?.packshot;
  if (!p) return null;
  if (p.limit === null) return Infinity;
  return Math.max(0, p.limit - p.used);
}

async function shrinkJpeg(base64: string, width: number, compress: number): Promise<string | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      `data:image/jpeg;base64,${base64}`,
      [{ resize: { width } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return out.base64 ?? null;
  } catch {
    return null;
  }
}

/**
 * Onaylanan packshot'ı kaydeder: yeni <uid>/<id>_s.jpg (1000px) + _s_thumb.jpg (400px),
 * satırı günceller, eski dosyaları ve eski görselle üretilmiş try-on'ları siler.
 * Döner: güncellenmiş parça. DB yazılamazsa yeni dosyalar silinir ve fırlatır.
 */
export async function applyStudioUpgrade(
  uid: string, item: WardrobeItem, packshotBase64: string,
): Promise<WardrobeItem> {
  const basePath  = `${uid}/${item.id}_s`;
  const imagePath = `${basePath}.jpg`;

  // Yükleme ekranıyla aynı boyutlar (UploadDetailScreen)
  const full = (await shrinkJpeg(packshotBase64, 1000, 0.9)) ?? packshotBase64;
  const { error: upErr } = await supabase.storage
    .from('wardrobe-items')
    .upload(imagePath, base64Decode(full), { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error(upErr.message);

  let thumbPath: string | null = null;
  const thumb = await shrinkJpeg(packshotBase64, 400, 0.8);
  if (thumb) {
    const { error: thumbErr } = await supabase.storage
      .from('wardrobe-items')
      .upload(`${basePath}_thumb.jpg`, base64Decode(thumb), { contentType: 'image/jpeg', upsert: true });
    if (!thumbErr) thumbPath = `${basePath}_thumb.jpg`;
  }

  const { error: dbErr } = await supabase
    .from('wardrobe_items')
    .update({
      image_url:           imagePath,
      processed_image_url: imagePath,
      thumb_url:           thumbPath,
      image_source:        'packshot',
    })
    .eq('id', item.id)
    .eq('user_id', uid);
  if (dbErr) {
    await deleteWardrobeFiles(uid, [imagePath, thumbPath]);
    throw new Error(dbErr.message);
  }

  // Eski görsel dosyaları (yeni yollarla çakışmayanlar) ve eski görselle üretilmiş try-on'lar
  const fresh = new Set([imagePath, thumbPath]);
  const stale = [item.originalImageUrl, item.processedImageUrl, item.thumbUrl].filter((v) => v && !fresh.has(v));
  await deleteWardrobeFiles(uid, stale);
  await deleteTryOnCacheForItems(uid, [item.id]);

  return {
    ...item,
    originalImageUrl:  imagePath,
    processedImageUrl: imagePath,
    thumbUrl:          thumbPath ?? undefined,
    imageSource:       'packshot',
  };
}

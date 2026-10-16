import { supabase } from './supabase';
import { toStoragePath } from './storageUrls';
import type { PrivateBucket } from './storageUrls';

// ─── Kullanıcı verisini storage'dan da silen işlemler ────────────────────────
// DB satırını silmek dosyayı silmez (storage cascade yok). Silme izni:
// 011_privacy_hardening.sql → storage.objects DELETE, yalnızca kendi <uid>/ klasörü.
// Storage hataları akışı durdurmaz (DB işlemi esas); loglanır.

const BASE_MANNEQUIN = 'base_mannequin.png';

/** remove() RLS'e takılırsa hata DÖNMEZ, sadece silmez → silinen sayısını kontrol et */
async function removeFiles(bucket: PrivateBucket, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) console.warn(`[privacy] ${bucket} silinemedi:`, error.message);
    else if ((data?.length ?? 0) < batch.length) {
      console.warn(`[privacy] ${bucket}: ${batch.length} dosyadan ${data?.length ?? 0} silindi (DELETE policy? / zaten yok)`);
    }
  }
}

/** Kullanıcının mannequin-cache klasöründeki dosya adları (sayfalı) */
async function listMannequinCache(uid: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await supabase.storage
      .from('mannequin-cache')
      .list(uid, { limit: 1000, offset });
    if (error) { console.warn('[privacy] mannequin-cache listelenemedi:', error.message); break; }
    for (const f of data ?? []) names.push(f.name);
    if (!data || data.length < 1000) break;
  }
  return names;
}

/**
 * Silinen dolap parçalarının dosyaları: görsel + işlenmiş + thumbnail, ve adında
 * parça id'si geçen try-on sonuçları. Try-on adı: <uid>/<imza>_<sürüm>.jpg,
 * imza = giyilebilir parça id'leri sıralı, '_' ile birleşik (virtualModel
 * comboSignatureForCache) → id dosya adında aynen geçer.
 */
export async function deleteWardrobeItemFiles(
  uid: string,
  items: { id: string; originalImageUrl?: string; processedImageUrl?: string; thumbUrl?: string }[],
): Promise<void> {
  if (!items.length) return;

  const paths = items
    .flatMap((i) => [i.originalImageUrl, i.processedImageUrl, i.thumbUrl])
    .map((v) => toStoragePath('wardrobe-items', v))
    .filter((p): p is string => !!p && p.startsWith(`${uid}/`));
  await removeFiles('wardrobe-items', paths);

  const names = await listMannequinCache(uid);
  const tryOns = names
    .filter((n) => n !== BASE_MANNEQUIN && items.some((i) => n.includes(i.id)))
    .map((n) => `${uid}/${n}`);
  await removeFiles('mannequin-cache', tryOns);
}

/**
 * Avatarı kaldır: dosya + avatar_url = null + avatarla üretilmiş olabilecek tüm
 * try-on sonuçları. includeBaseMannequin: fiziksel profilden üretilen yapay manken
 * de silinsin mi (rıza geri çekmede evet; yalnız avatar kaldırmada hayır).
 */
export async function removeAvatarAndTryOns(
  uid: string,
  avatarRef: string | null | undefined,
  opts: { includeBaseMannequin?: boolean } = {},
): Promise<void> {
  const avatarPath = toStoragePath('avatars', avatarRef) ?? `${uid}/avatar.jpg`;
  if (avatarPath.startsWith(`${uid}/`)) await removeFiles('avatars', [avatarPath]);

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
  if (error) throw error;

  const names = await listMannequinCache(uid);
  const toDelete = names
    .filter((n) => opts.includeBaseMannequin || n !== BASE_MANNEQUIN)
    .map((n) => `${uid}/${n}`);
  await removeFiles('mannequin-cache', toDelete);
}

/**
 * Hassas veri rızasını geri çek: fiziksel profil alanları NULL, avatar ve tüm
 * try-on/manken dosyaları silinir, sensitive_consent_at NULL.
 * Yapay manken de silinir: fiziksel profilden (ten, vücut, saç) üretildiği için
 * geri çekilen veriden türemiş sayılır.
 */
export async function withdrawSensitiveConsent(uid: string, avatarRef: string | null | undefined): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      height: null, weight: null, age: null,
      body_type: null, skin_tone: null,
      hair_color: null, hair_length: null, hair_type: null,
      mannequin_url: null,
      sensitive_consent_at: null,
    })
    .eq('id', uid);
  if (error) throw error;

  await removeAvatarAndTryOns(uid, avatarRef, { includeBaseMannequin: true });
}

/** Rıza kaydı (ilk fiziksel profil kaydı / ilk avatar yüklemesi öncesi) */
export async function recordSensitiveConsent(uid: string): Promise<string> {
  const at = new Date().toISOString();
  const { error } = await supabase.from('profiles').update({ sensitive_consent_at: at }).eq('id', uid);
  if (error) throw error;
  return at;
}

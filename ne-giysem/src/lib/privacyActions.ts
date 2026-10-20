import { Share } from 'react-native';
import { supabase } from './supabase';
import { toStoragePath } from './storageUrls';
import type { PrivateBucket } from './storageUrls';
import { callEdge, edgeError } from './edgeFunctions';
import { useConsentStore, isGranted } from '../store/useConsentStore';
import { useUserStore } from '../store/useUserStore';
import { TRYON_CONSENT_KINDS } from '../constants/consent';
import type { TryOnConsentKind } from '../constants/consent';

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
 * Avatarı kaldır: dosya + avatar_url = null + avatarla üretilmiş try-on sonuçları.
 * Yapay manken (base_mannequin.png) ve mankenle üretilenler (`_m.jpg`) fotoğraftan
 * türemediği için kalır — onlar fiziksel bilgi rızasına bağlı (removePhysicalData).
 */
export async function removeAvatarAndTryOns(
  uid: string,
  avatarRef: string | null | undefined,
): Promise<void> {
  const avatarPath = toStoragePath('avatars', avatarRef) ?? `${uid}/avatar.jpg`;
  if (avatarPath.startsWith(`${uid}/`)) await removeFiles('avatars', [avatarPath]);

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
  if (error) throw error;

  const names = await listMannequinCache(uid);
  const toDelete = names
    .filter((n) => n !== BASE_MANNEQUIN && !n.endsWith('_m.jpg'))
    .map((n) => `${uid}/${n}`);
  await removeFiles('mannequin-cache', toDelete);
}

/**
 * Fiziksel profil verisini sil: alanlar + mannequin_url NULL; yapay manken ve onunla
 * üretilen try-on'lar (ad sonu `_m.jpg` — CombosScreen modelVersion 'm') silinir.
 * Avatar ve avatarla üretilen try-on'lar KALIR.
 */
async function removePhysicalData(uid: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      height: null, weight: null, age: null,
      body_type: null, skin_tone: null,
      hair_color: null, hair_length: null, hair_type: null,
      mannequin_url: null,
    })
    .eq('id', uid);
  if (error) throw error;

  const names = await listMannequinCache(uid);
  const toDelete = names
    .filter((n) => n === BASE_MANNEQUIN || n.endsWith('_m.jpg'))
    .map((n) => `${uid}/${n}`);
  await removeFiles('mannequin-cache', toDelete);
}

/**
 * profiles.sensitive_consent_at aynası (011) — karar consent_events'ten okunur, kolon
 * yalnızca geriye dönük uyumluluk için: iki sanal deneme rızasından biri verildiyse
 * zaman, ikisi de yoksa NULL.
 */
async function mirrorSensitiveConsent(uid: string): Promise<void> {
  const { records } = useConsentStore.getState();
  const any = TRYON_CONSENT_KINDS.some((k) => isGranted(records, k));
  const at = any ? new Date().toISOString() : null;
  const { error } = await supabase.from('profiles').update({ sensitive_consent_at: at }).eq('id', uid);
  if (error) console.warn('[privacy] sensitive_consent_at aynası yazılamadı:', error.message);
  else useUserStore.getState().setConsents({ sensitiveConsentAt: at });
}

/** Sanal deneme açık rızaları — her biri ayrı satır (consent_events) */
export async function grantTryOnConsents(uid: string, kinds: TryOnConsentKind[]): Promise<void> {
  const { record } = useConsentStore.getState();
  for (const k of kinds) await record(uid, k, true);
  await mirrorSensitiveConsent(uid);
}

/**
 * Bir sanal deneme rızasını geri çek. Önce geri çekme kaydı (işleme hemen durur),
 * sonra o rızaya bağlı veriler silinir:
 *   tryon_photo    → fotoğraf + onunla üretilen try-on'lar (fiziksel bilgiler kalır)
 *   tryon_physical → fiziksel bilgiler + yapay manken + mankenle üretilen try-on'lar
 */
export async function withdrawTryOnConsent(
  uid: string, kind: TryOnConsentKind, avatarRef: string | null | undefined,
): Promise<void> {
  await useConsentStore.getState().record(uid, kind, false);

  if (kind === 'tryon_photo') {
    await removeAvatarAndTryOns(uid, avatarRef);
    useUserStore.getState().setAvatarUrl(null);
  } else {
    await removePhysicalData(uid);
    useUserStore.getState().clearPhysicalData();
  }
  await mirrorSensitiveConsent(uid);
}

/**
 * Yapay zekâ ile fotoğraf işleme izni (Poof + Anthropic). Geri çekmek mevcut veriyi
 * SİLMEZ: dolap kalır, yeni yüklemeler elle devam eder, "Uyar mı?" kapanır.
 */
export async function setAiProcessingConsent(uid: string, granted: boolean): Promise<void> {
  await useConsentStore.getState().record(uid, 'ai_processing', granted);
}

/** Aydınlatma metni okundu ("Okudum") */
export async function acknowledgeNotice(uid: string): Promise<void> {
  await useConsentStore.getState().record(uid, 'notice_shown', true);
}

/**
 * Verilerimi indir: export-my-data JSON'u paylaş menüsüyle. Fotoğraflar 1 saatlik
 * imzalı link olarak JSON'un içinde (files). Günlük 3 sınırı sunucuda (429).
 */
export async function exportMyData(): Promise<'shared' | 'dismissed'> {
  const res = await callEdge('export-my-data', {});
  if (!res.ok) throw await edgeError(res);
  const data = await res.json();
  const text = JSON.stringify(data, null, 2);
  const result = await Share.share({ message: text, title: 'sestina-data.json' });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

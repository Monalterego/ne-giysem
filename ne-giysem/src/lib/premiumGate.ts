import { Alert } from 'react-native';
import { supabase } from './supabase';
import { restore } from './purchases';
import { usePlanStore, premiumExpired } from '../store/usePlanStore';
import type { Usage } from '../store/usePlanStore';
import { openPaywall } from '../navigation/navigationRef';
import { t } from '../i18n';

// ─── İstemci ön kontrolleri (hak HARCAMAZ) ───────────────────────────────────
// Kaynak get_usage. Okunamazsa (ağ / 013 yok) engellemez — sınırı sunucu uygular
// (wardrobe trigger'ı, fashn-proxy). Engellenirse paywall açılır ve false döner.

/** "Ekle" → yüklemeye başlamadan önce: dolap limiti dolu mu? */
export async function guardWardrobeAdd(): Promise<boolean> {
  const usage = await usePlanStore.getState().refresh();
  const w = usage?.wardrobe;
  if (w && w.limit !== null && w.used >= w.limit) {
    openPaywall('wardrobe');
    return false;
  }
  return true;
}

/** "Uyar mı?" taraması başlamadan önce: bu ayki hak kaldı mı? */
export async function guardScan(): Promise<boolean> {
  const usage = await usePlanStore.getState().refresh();
  const s = usage?.scan;
  if (s && s.limit !== null && s.used >= s.limit) {
    openPaywall('scan');
    return false;
  }
  return true;
}

/**
 * Tarama hakkını HARCA — Poof + vision başarıyla bittikten sonra, sonucu göstermeden
 * hemen önce. false → sonucu gösterme; çağıran ekranı kapatıp openPaywall('scan') açar.
 * RPC hatasında (ağ / 013 yok) sonucu engellemez: tarama zaten yapıldı, kullanıcı
 * suçsuz; değiştirilmiş istemci riski kabul edildi (günlük tavanlar var).
 */
export async function spendScan(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('start_scan');
    if (error) {
      console.warn('[scan] start_scan:', error.message);
      return true;
    }
    usePlanStore.getState().refresh();
    return !(data && (data as { allowed?: boolean }).allowed === false);
  } catch (e) {
    console.warn('[scan] start_scan exception:', e);
    return true;
  }
}

// ─── Dolap limiti metinleri (başlık, banner, paywall gerekçesi) ──────────────
// Sayı ve sınır get_usage'tan; limit üstündeki kullanıcıya "103/50" gösterilmez.

/** Başlık: limit altında/eşit "23/50", üstünde "103 parça · ücretsiz sınır 50". Premium/okunamadı → null */
export function wardrobeCountLabel(usage: Usage | null): string | null {
  const w = usage?.wardrobe;
  if (!w || w.limit === null) return null;
  return w.used > w.limit
    ? t('premium.wardrobeOverCount', { count: w.used, limit: w.limit })
    : t('premium.wardrobeCount', { used: w.used, limit: w.limit });
}

/** Ekleme kilitliyken açıklama (banner + paywall). Limit dolu değilse / okunamadıysa null */
export function wardrobeLimitMessage(usage: Usage | null): string | null {
  const w = usage?.wardrobe;
  if (!w || w.limit === null || w.used < w.limit) return null;
  const body = t('premium.wardrobeLimitBody', { count: w.used, limit: w.limit });
  return premiumExpired(usage) ? `${t('premium.wardrobeExpiredPrefix')} ${body}` : body;
}

// ─── Geri yükleme (Paywall + Profil) ─────────────────────────────────────────

/** Mağazadan geri yükle → sunucu senkronu → get_usage; sonucu kullanıcıya bildirir. */
export async function restoreWithFeedback(): Promise<void> {
  const outcome = await restore();
  if (outcome === 'unavailable') { Alert.alert(t('premium.unavailable')); return; }
  if (outcome === 'network')     { Alert.alert(t('combos.errorTitle'), t('premium.network')); return; }
  if (outcome === 'error')       { Alert.alert(t('combos.errorTitle'), t('premium.restoreFailed')); return; }

  const usage = await usePlanStore.getState().syncAfterPurchase();
  if (usage?.plan === 'premium')  Alert.alert(t('premium.restoredTitle'), t('premium.restored'));
  else if (outcome === 'restored') Alert.alert(t('premium.syncDelayed'));   // mağazada var, sunucu henüz yazmadı
  else Alert.alert(t('premium.nothingToRestore'));
}

// ─── Tarih biçimleri ──────────────────────────────────────────────────────────

/** Limit sıfırlama anı Istanbul ay başıdır (UTC+3, yaz saati yok) → Istanbul takvim günü */
export function formatIstanbulDay(iso: string | null | undefined): string | null {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts + 3 * 60 * 60 * 1000);
  return `${d.getUTCDate()} ${t(`calendar.m${d.getUTCMonth()}`)} ${d.getUTCFullYear()}`;
}

/** Abonelik yenilenme / bitiş tarihi — cihazın yerel günü. 'infinity' → null (süresiz) */
export function formatLocalDay(iso: string | null | undefined): string | null {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  return `${d.getDate()} ${t(`calendar.m${d.getMonth()}`)} ${d.getFullYear()}`;
}

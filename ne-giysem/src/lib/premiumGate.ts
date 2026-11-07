import { Alert } from 'react-native';
import { restore } from './purchases';
import { usePlanStore, hasAccess, remaining } from '../store/usePlanStore';
import type { Quota, Usage } from '../store/usePlanStore';
import { EdgeError } from './edgeFunctions';
import { t } from '../i18n';

// ─── Hard paywall (Adım 15) ──────────────────────────────────────────────────
// Ücretsiz plan yok. Erişim (deneme / abonelik) yoksa RootNavigator yalnızca paywall'u
// gösterir. Uygulama açıkken erişim biterse sunucu 403 'subscription-required'
// (edge) ya da P0001 'subscription-required' (dolap trigger'ı) döner → plan tazelenir,
// gate kendiliğinden açılır. Hak sınırları sunucuda; istemci yalnızca gösterir.

/** Sunucu "abonelik gerekli" dedi mi (edge 403 ya da DB trigger mesajı) */
export function isSubscriptionRequired(err: unknown): boolean {
  if (err instanceof EdgeError) return err.code === 'subscription-required';
  const m = (err as { message?: string } | null)?.message ?? '';
  return m.includes('subscription-required');
}

/** Erişim bitmiş → plan tazelenir, RootNavigator gate'e geçer */
export function onSubscriptionRequired(): void {
  usePlanStore.getState().refresh();
}

// ─── 15a: kalan hak göstergesi ────────────────────────────────────────────────
// Sayılar get_usage'tan (açık rezervasyonlar kullanılmış sayılır → red ile tutarlı).

export type QuotaKind = 'tryon' | 'scan' | 'packshot';

/** "Bu ay 3 / 5 sanal deneme hakkın kaldı" vb. Sınırsız / bilinmiyor / erişim yok → null */
export function quotaLabel(kind: QuotaKind, q: Quota | undefined | null): string | null {
  const left = remaining(q);
  if (!q || left === null || left === Infinity || q.window === 'none') return null;
  const params = { left, limit: q.limit };
  if (q.window === 'trial') return t(`quota.${kind}Trial`, params);
  if (q.window === 'setup') return t('quota.packshotSetup', params);
  return t(`quota.${kind}Monthly`, params);
}

/** Hak bittiğinde açıklama: premium → yenilenme tarihi; deneme → deneme sonu / abonelik başı */
export function quotaExhaustedMessage(q: Quota | undefined | null, usage: Usage | null): string {
  if (q?.window === 'trial') {
    const date = formatLocalDay(usage?.trial?.ends_at ?? usage?.access_expires_at);
    if (!date) return t('quota.trialExhaustedNoDate');
    return usage?.will_renew === false
      ? t('quota.trialExhaustedCancelled', { date })
      : t('quota.trialExhausted', { date });
  }
  const date = formatIstanbulDay(q?.reset_at);
  return date ? t('quota.renewsOn', { date }) : t('quota.exhaustedNoDate');
}

// ─── Geri yükleme (Paywall + Profil) ─────────────────────────────────────────

/** Mağazadan geri yükle → sunucu senkronu → get_usage; sonucu kullanıcıya bildirir. */
export async function restoreWithFeedback(): Promise<void> {
  const outcome = await restore();
  if (outcome === 'unavailable') { Alert.alert(t('premium.unavailable')); return; }
  if (outcome === 'network')     { Alert.alert(t('combos.errorTitle'), t('premium.network')); return; }
  if (outcome === 'error')       { Alert.alert(t('combos.errorTitle'), t('premium.restoreFailed')); return; }

  const usage = await usePlanStore.getState().syncAfterPurchase();
  if (usage && hasAccess(usage.plan)) Alert.alert(t('premium.restoredTitle'), t('premium.restored'));
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

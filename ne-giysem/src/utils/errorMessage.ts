import { t } from '../i18n';
import { EdgeError } from '../lib/edgeFunctions';
import { ImagePrepError } from './imageNormalize';

/** Ham hata → kullanıcı dostu mesaj. Teknik detay ASLA kullanıcıya gösterilmez. */
export function friendlyError(err: unknown): string {
  // Kendi edge function'larımızın kodları — üst servis eşleştirmelerinden ÖNCE
  if (err instanceof EdgeError) {
    if (err.status === 401) return t('errors.sessionExpired');
    if (err.status === 426) return t('errors.updateRequired');
    if (err.code === 'daily-limit') return t('errors.dailyLimit');
    if (err.code === 'ai-consent-required') return t('errors.aiConsentRequired');
    if (err.code === 'consent-required') return t('errors.tryOnConsentRequired');
    if (err.code === 'consent-version-outdated') return t('errors.consentOutdated');
    if (err.code === 'quota-exceeded') return t('combos.limitReached');
    if (err.code === 'run-budget-exceeded') return t('combos.tryOnBusy');
    if (err.code === 'image-too-large') return t('errors.imageTooLarge');
  }

  // Yükleme öncesi görsel hazırlama (utils/imageNormalize)
  if (err instanceof ImagePrepError) {
    return err.reason === 'too-large' ? t('errors.imageTooLarge') : t('errors.imageProcessFailed');
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');
  const m = raw.toLowerCase();

  // Ağ / bağlantı
  if (m.includes('network') || m.includes('fetch failed') || m.includes('timeout') ||
      m.includes('bağlantı') || m.includes('connection'))
    return t('errors.networkFailed');

  // FASHN: kredi bitti / rate limit → kullanıcıya "yoğunluk" de (fatura durumumuz onu ilgilendirmez)
  if (m.includes('outofcredits') || m.includes('rate limit') || m.includes('429'))
    return t('combos.tryOnBusy');

  // FASHN: manken pozu tespit edilemedi
  if (isModelImageError(err))
    return t('combos.tryOnPoseFailed');

  // Format reddi — yalnızca açık format kodları (415/422) ya da "unsupported" mesajı.
  // Mesajda sağlayıcı adı (Poof) geçmesi format hatası DEĞİLDİR: proxy her üst servis
  // hatasını "Poof error <status>" diye sarıyor (kredi, kota, 5xx dahil)
  const formatStatus = err instanceof EdgeError && (err.status === 415 || err.status === 422);
  if (formatStatus || (!(err instanceof EdgeError) && m.includes('unsupported')))
    return t('errors.imageFormatUnsupported');

  // Boyut
  if (m.includes('too large') || m.includes('payload') || m.includes('413'))
    return t('errors.imageTooLarge');

  return t('errors.genericRetry');
}

/** Manken görselinin bozuk olduğunu gösteren hata mı? (cache temizlemek için) */
export function isModelImageError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return m.includes('poseerror') || m.includes('body pose') || m.includes('detect body');
}

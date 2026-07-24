import { t } from '../i18n';

/** Ham hata → kullanıcı dostu mesaj. Teknik detay ASLA kullanıcıya gösterilmez. */
export function friendlyError(err: unknown): string {
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
  if (m.includes('body pose') || m.includes('detect body'))
    return t('combos.tryOnPoseFailed');

  // Arka plan silme: format reddi
  if (m.includes('poof') || m.includes('422') || m.includes('unsupported'))
    return t('errors.imageFormatUnsupported');

  // Boyut
  if (m.includes('too large') || m.includes('payload') || m.includes('413'))
    return t('errors.imageTooLarge');

  return t('errors.genericRetry');
}

/** Manken görselinin bozuk olduğunu gösteren hata mı? (cache temizlemek için) */
export function isModelImageError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return m.includes('body pose') || m.includes('detect body');
}

import { getLocale } from '../i18n';

/**
 * Dile duyarlı büyük harf. Türkçede i→İ, ı→I. textTransform: 'uppercase' yerine bunu kullan —
 * iOS'ta textTransform Türkçe kurala uymuyor ("Aktif" → "AKTIF").
 * toLocaleUpperCase('tr-TR') yerine elle: Hermes'in Intl desteğine güvenmiyoruz,
 * bu yöntem her ortamda aynı sonucu verir. ı → I zaten toUpperCase ile doğru.
 */
export function upper(s: string): string {
  if ((getLocale() ?? '').startsWith('tr')) return s.replace(/i/g, 'İ').toUpperCase();
  return s.toUpperCase();
}

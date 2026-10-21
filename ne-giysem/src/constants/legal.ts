import { Linking } from 'react-native';
import { getLocale } from '../i18n';

// Yasal sayfalar — arayüz diline göre. Tek kaynak: paywall, rıza modalı, Profil,
// Gizlilik ve izinler, giriş/kayıt hepsi buradan.
const BASE = 'https://sestinaapp.com';

export type LegalDoc = 'privacy' | 'terms' | 'notice' | 'consent' | 'requests';

// doc → [TR yolu, EN yolu]
const PATHS: Record<LegalDoc, [string, string]> = {
  privacy:  ['gizlilik',   'privacy'],
  terms:    ['kosullar',   'terms'],
  notice:   ['aydinlatma', 'notice'],     // aydınlatma metni
  consent:  ['acik-riza',  'consent'],    // açık rıza metni
  requests: ['basvuru',    'requests'],   // ilgili kişi başvurusu (KVKK md. 11)
};

export function legalUrl(doc: LegalDoc): string {
  const [tr, en] = PATHS[doc];
  return `${BASE}/${getLocale() === 'tr' ? tr : en}`;
}

/** Harici tarayıcıda aç (projede uygulama içi tarayıcı paketi yok) */
export function openLegal(doc: LegalDoc): void {
  Linking.openURL(legalUrl(doc)).catch((e) => console.warn('[legal] açılamadı:', e));
}

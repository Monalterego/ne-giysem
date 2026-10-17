import { Linking } from 'react-native';
import { getLocale } from '../i18n';

// Yasal sayfalar — arayüz diline göre (TR: /gizlilik, /kosullar · EN: /privacy, /terms).
// Tek kaynak: paywall, rıza modalı, Profil, giriş/kayıt hepsi buradan.
const BASE = 'https://sestinaapp.com';

export type LegalDoc = 'privacy' | 'terms';

export function legalUrl(doc: LegalDoc): string {
  const tr = getLocale() === 'tr';
  if (doc === 'privacy') return `${BASE}/${tr ? 'gizlilik' : 'privacy'}`;
  return `${BASE}/${tr ? 'kosullar' : 'terms'}`;
}

/** Harici tarayıcıda aç (projede uygulama içi tarayıcı paketi yok) */
export function openLegal(doc: LegalDoc): void {
  Linking.openURL(legalUrl(doc)).catch((e) => console.warn('[legal] açılamadı:', e));
}

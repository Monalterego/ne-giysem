import { Platform } from 'react-native';

// RevenueCat entitlement identifier — sunucu (_shared/revenuecat.ts) ile AYNI olmalı
export const ENTITLEMENT_ID = 'sestina_premium';

export const TERMS_URL   = 'https://sestinaapp.com/kosullar';
export const PRIVACY_URL = 'https://sestinaapp.com/gizlilik';

const ANDROID_PACKAGE = 'com.monalterego.sestina';

/** Mağazanın abonelik yönetim sayfası (iptal / plan değiştirme buradan yapılır). */
export function manageSubscriptionUrl(): string {
  return Platform.OS === 'android'
    ? `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`
    : 'https://apps.apple.com/account/subscriptions';
}

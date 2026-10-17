import { Platform } from 'react-native';

// RevenueCat entitlement identifier — sunucu (_shared/revenuecat.ts) ile AYNI olmalı
export const ENTITLEMENT_ID = 'sestina_premium';

// Kullanım Koşulları / Gizlilik linkleri dile bağlı → constants/legal.ts

const ANDROID_PACKAGE = 'com.monalterego.sestina';

/** Mağazanın abonelik yönetim sayfası (iptal / plan değiştirme buradan yapılır). */
export function manageSubscriptionUrl(): string {
  return Platform.OS === 'android'
    ? `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`
    : 'https://apps.apple.com/account/subscriptions';
}

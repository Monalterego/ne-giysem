import { Alert, Linking } from 'react-native';
import { supabase } from './supabase';
import { clearLocalSession } from './session';
import { deleteAccount } from './socialAuth';
import { manageSubscriptionUrl } from '../constants/premium';
import { t } from '../i18n';

// ─── Hesap işlemleri — Profil ve paywall (gate) ortak ────────────────────────
// Hard paywall Profil'i kapatıyor; çıkış, verilerimi indir ve hesabı sil gate'te de
// bulunmalı (Apple 5.1.1(v), KVKK m. 11). Verilerimi indir: privacyActions.exportMyData.

/** Çıkış: sunucu oturumu kapanmasa da yerel temizlik yapılır */
export function signOut(): void {
  supabase.auth.signOut()
    .catch((err) => console.warn('[account] signOut exception:', err))
    .finally(clearLocalSession);
}

/**
 * Hesap silme onayı → silme. Otomatik yenilenen abonelik hesap silmeyle iptal OLMAZ
 * (mağaza faturalamaya devam eder) → önce mağaza yönetimi önerilir.
 * setBusy: silme sürerken ekranı kilitlemek için.
 */
export function confirmDeleteAccount(willRenew: boolean, setBusy: (busy: boolean) => void): void {
  const run = async () => {
    setBusy(true);
    try {
      const r = await deleteAccount();
      if (r === 'cancelled') return;   // Apple ekranında vazgeçti — sessizce kapat
      // Önce Alert, sonra temizlik: logout() ekranı söker; RootNavigator onboarding'e geçer
      Alert.alert(t('profile.deleteAccountDone'));
      clearLocalSession();
    } catch (err) {
      console.warn('[account] deleteAccount failed:', err);
      Alert.alert(t('combos.errorTitle'), t('profile.deleteAccountError'));
    } finally {
      setBusy(false);
    }
  };

  if (willRenew) {
    Alert.alert(
      t('profile.deleteAccountTitle'),
      `${t('profile.deleteAccountBody')}\n\n${t('premium.deleteSubscriptionWarning')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('premium.manage'), onPress: () => Linking.openURL(manageSubscriptionUrl()) },
        { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: run },
      ],
    );
    return;
  }
  Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: run },
  ]);
}

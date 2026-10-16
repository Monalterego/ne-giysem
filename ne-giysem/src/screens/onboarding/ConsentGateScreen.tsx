import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { recordSensitiveConsent, withdrawSensitiveConsent } from '../../lib/privacyActions';
import SensitiveConsentModal from '../../components/SensitiveConsentModal';
import { colors } from '../../constants/theme';
import { t } from '../../i18n';

/**
 * Mevcut kullanıcılardan rıza: rıza kaydı yokken hassas veri (fiziksel profil ya
 * da avatar) zaten varsa RootNavigator, AgeGate'ten hemen sonra bunu bir kez gösterir.
 * Kabul → sensitive_consent_at = now. Red → "Rızamı geri çek" akışı (veriler
 * silinir), sonra uygulamaya devam. Her iki durumda koşul kalkar, kapı kapanır.
 */
export default function ConsentGateScreen() {
  const user               = useUserStore((s: UserState) => s.user);
  const setConsents        = useUserStore((s: UserState) => s.setConsents);
  const clearSensitiveData = useUserStore((s: UserState) => s.clearSensitiveData);
  const [busy, setBusy]    = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const at = await recordSensitiveConsent(user.id);
      setConsents({ sensitiveConsentAt: at });
    } catch {
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setBusy(false);
    }
  };

  // Red silme demek — yanlışlıkla basılmasın diye onay iste
  const handleDecline = () => {
    if (!user) return;
    Alert.alert(t('profile.withdrawConsentTitle'), t('profile.withdrawConsentBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consent.declineConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await withdrawSensitiveConsent(user.id, user.avatarUrl);
            clearSensitiveData();   // koşul kalkar → RootNavigator devam eder
          } catch (err) {
            console.warn('[ConsentGate] red akışı başarısız:', err);
            Alert.alert(t('combos.errorTitle'), t('profile.withdrawConsentError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fill} />
      <SensitiveConsentModal
        visible
        saving={busy}
        intro={t('consent.existingIntro')}
        cancelLabel={t('consent.decline')}
        onAccept={handleAccept}
        onCancel={handleDecline}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
});

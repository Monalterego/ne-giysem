import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { useConsentStore, requiredTryOnConsents, needsNoticeUpdate } from '../../store/useConsentStore';
import type { TryOnConsentKind } from '../../constants/consent';
import { grantTryOnConsents, withdrawTryOnConsent } from '../../lib/privacyActions';
import SensitiveConsentModal from '../../components/SensitiveConsentModal';
import { colors } from '../../constants/theme';
import { t } from '../../i18n';

/**
 * Mevcut kullanıcılardan rıza: elinde fotoğraf ve/veya fiziksel bilgi olup ilgili açık
 * rızası consent_events'te olmayan kullanıcıya RootNavigator, AgeGate'ten hemen sonra
 * bunu gösterir. YALNIZCA eksik rızalar sorulur (requiredTryOnConsents).
 * İşaretlenen → rıza kaydı. İşaretlenmeyen → onaydan sonra o rızaya bağlı veri silinir
 * (geri çekme kaydıyla). Her durumda koşul kalkar, kapı kapanır.
 *
 * Rızaları geçerli ama aydınlatmanın güncel ana sürümünü (CONSENT_VERSIONS.notice_shown)
 * okumamış kullanıcıya yalnızca "Aydınlatma metni güncellendi" adımı gösterilir; rızalar
 * yeniden sorulmaz. "Okudum" → notice_shown güncel sürümle yazılır, kapı kalkar.
 */
export default function ConsentGateScreen() {
  const user     = useUserStore((s: UserState) => s.user);
  const records  = useConsentStore((s) => s.records);
  const required = requiredTryOnConsents(user, records);
  // Eksik rıza yoksa ama aydınlatmanın güncel ana sürümü okunmadıysa: yalnız "Okudum" adımı
  const noticeOnly = required.length === 0 && needsNoticeUpdate(records);
  const [busy, setBusy] = useState(false);

  const run = async (granted: TryOnConsentKind[], declined: TryOnConsentKind[]) => {
    if (!user) return;
    setBusy(true);
    try {
      if (granted.length) await grantTryOnConsents(user.id, granted);
      for (const k of declined) await withdrawTryOnConsent(user.id, k, user.avatarUrl);
      // koşul kalkar → RootNavigator devam eder
    } catch (err) {
      console.warn('[ConsentGate] kaydedilemedi:', err);
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setBusy(false);
    }
  };

  // Reddedilen rızanın verisi silinir — yanlışlıkla basılmasın diye onay iste
  const confirmAndRun = (granted: TryOnConsentKind[]) => {
    const declined = required.filter((k) => !granted.includes(k));
    if (!declined.length) { run(granted, []); return; }
    const body = declined
      .map((k) => (k === 'tryon_photo' ? t('privacy.photoWithdrawEffect') : t('privacy.physicalWithdrawEffect')))
      .join('\n\n');
    Alert.alert(t('consent.declineTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('consent.declineConfirm'), style: 'destructive', onPress: () => run(granted, declined) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fill} />
      <SensitiveConsentModal
        visible={required.length > 0 || noticeOnly}
        noticeOnly={noticeOnly}
        kinds={required}
        saving={busy}
        intro={t('consent.existingIntro')}
        cancelLabel={t('consent.decline')}
        onSubmit={confirmAndRun}
        onCancel={() => confirmAndRun([])}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
});

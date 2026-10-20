import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { setAiProcessingConsent } from '../../lib/privacyActions';
import { resolveAiConsent } from '../../lib/aiConsent';
import type { AiConsentResult } from '../../lib/aiConsent';
import { openLegal } from '../../constants/legal';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { t } from '../../i18n';
import { upper } from '../../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'AiConsent'>;

/**
 * Yapay zekâ ile fotoğraf işleme izni (Apple 5.1.2(i)) — ilk kıyafet eklemeden ve
 * ilk "Uyar mı?" taramasından önce, ayrı tam ekran. Hangi veri, hangi sağlayıcıya,
 * neden; reddedilince ne olur. Karar consent_events'e 'ai_processing' olarak yazılır.
 */
export default function AiConsentScreen({ navigation }: Props) {
  const user = useUserStore((s) => s.user);
  const [busy, setBusy] = useState<'grant' | 'decline' | null>(null);
  const decided = useRef(false);

  // Karar verilmeden kapanırsa (Android geri tuşu vb.) bekleyen işlem iptal olsun
  useEffect(() => () => { if (!decided.current) resolveAiConsent('dismissed'); }, []);

  const finish = (result: AiConsentResult) => {
    decided.current = true;
    resolveAiConsent(result);
    if (navigation.canGoBack()) navigation.goBack();
  };

  const decide = async (granted: boolean) => {
    if (!user) return;
    setBusy(granted ? 'grant' : 'decline');
    try {
      await setAiProcessingConsent(user.id, granted);
      finish(granted ? 'granted' : 'declined');
    } catch (err) {
      console.warn('[AiConsent] kaydedilemedi:', err);
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setBusy(null);
    }
  };

  const Provider = ({ name, purpose }: { name: string; purpose: string }) => (
    <View style={styles.provider}>
      <Text style={styles.providerName}>{name}</Text>
      <Text style={styles.sectionBody}>{purpose}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{upper(t('aiConsent.eyebrow'))}</Text>
        <Text style={styles.title}>{t('aiConsent.title')}</Text>
        <Text style={styles.intro}>{t('aiConsent.intro')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiConsent.whatTitle')}</Text>
          <Text style={styles.sectionBody}>{t('aiConsent.whatBody')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiConsent.whoTitle')}</Text>
          <Provider name={t('aiConsent.poofName')}      purpose={t('aiConsent.poofPurpose')} />
          <Provider name={t('aiConsent.anthropicName')} purpose={t('aiConsent.anthropicPurpose')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiConsent.trainingTitle')}</Text>
          <Text style={styles.sectionBody}>{t('aiConsent.trainingBody')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiConsent.declineTitle')}</Text>
          <Text style={styles.sectionBody}>{t('aiConsent.declineBody')}</Text>
        </View>

        <TouchableOpacity onPress={() => openLegal('privacy')} activeOpacity={0.7}>
          <Text style={styles.link}>{t('consent.policyLink')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, busy !== null && styles.disabled]}
          onPress={() => decide(true)}
          disabled={busy !== null}
          activeOpacity={0.85}
        >
          {busy === 'grant'
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>{t('aiConsent.allow')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, busy !== null && styles.disabled]}
          onPress={() => decide(false)}
          disabled={busy !== null}
          activeOpacity={0.7}
        >
          {busy === 'decline'
            ? <ActivityIndicator color={colors.text} />
            : <Text style={styles.secondaryBtnText}>{t('aiConsent.notNow')}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPaddingH, paddingTop: spacing.xl, gap: spacing.md },
  eyebrow: { ...typography.label, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.text },
  intro: { ...typography.body, color: colors.textSecondary },
  section: { gap: spacing.xs, marginTop: spacing.sm },
  sectionTitle: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.text },
  sectionBody: { ...typography.bodySmall, color: colors.textSecondary },
  provider: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  providerName: { ...typography.bodySmall, fontFamily: fonts.bodyBold, color: colors.text },
  link: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline', marginTop: spacing.sm },
  actions: {
    padding: layout.screenPaddingH,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    height: 52, borderRadius: radius.sm, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodyBold, color: colors.white },
  secondaryBtn: {
    height: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { ...typography.body, fontFamily: fonts.bodyMedium, color: colors.text },
  disabled: { opacity: 0.4 },
});

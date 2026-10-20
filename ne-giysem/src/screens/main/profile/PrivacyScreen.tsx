import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../navigation/types';
import { useUserStore } from '../../../store/useUserStore';
import { useConsentStore } from '../../../store/useConsentStore';
import type { ConsentRecord } from '../../../store/useConsentStore';
import type { TryOnConsentKind } from '../../../constants/consent';
import { grantTryOnConsents, setAiProcessingConsent, withdrawTryOnConsent } from '../../../lib/privacyActions';
import { openAiConsent } from '../../../lib/aiConsent';
import { formatLocalDay } from '../../../lib/premiumGate';
import { openLegal } from '../../../constants/legal';
import SensitiveConsentModal from '../../../components/SensitiveConsentModal';
import { colors, fonts, typography, spacing, radius, layout } from '../../../constants/theme';
import { t } from '../../../i18n';
import SubScreenHeader from './SubScreenHeader';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfilePrivacy'>;
type Kind = 'ai_processing' | TryOnConsentKind;

// Her izin: başlık, ne olduğu, geri çekince ne olduğu (i18n anahtarları)
const META: Record<Kind, { title: string; body: string; effect: string }> = {
  ai_processing:  { title: 'privacy.aiTitle',       body: 'privacy.aiBody',       effect: 'privacy.aiWithdrawEffect' },
  tryon_photo:    { title: 'privacy.photoTitle',    body: 'privacy.photoBody',    effect: 'privacy.photoWithdrawEffect' },
  tryon_physical: { title: 'privacy.physicalTitle', body: 'privacy.physicalBody', effect: 'privacy.physicalWithdrawEffect' },
};
const ORDER: Kind[] = ['ai_processing', 'tryon_photo', 'tryon_physical'];

function statusText(rec: ConsentRecord | undefined): string {
  if (!rec) return t('privacy.statusNotAsked');
  const day = formatLocalDay(rec.at);
  if (rec.granted) return day ? t('privacy.statusGrantedOn', { date: day }) : t('privacy.statusGranted');
  return day ? t('privacy.statusDeniedOn', { date: day }) : t('privacy.statusDenied');
}

/**
 * Gizlilik ve izinler — üç izin ayrı ayrı: güncel durum (consent_events'in son satırı),
 * ne işe yaradığı, geri çekince ne olduğu; ver / geri çek. Eski "Rızamı geri çek"
 * burada iki ayrı sanal deneme rızasına bölündü.
 */
export default function PrivacyScreen({ navigation }: Props) {
  const user    = useUserStore((s) => s.user);
  const loaded  = useConsentStore((s) => s.loaded);
  const records = useConsentStore((s) => s.records);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [askKind, setAskKind] = useState<TryOnConsentKind | null>(null);

  useEffect(() => { useConsentStore.getState().refresh(); }, []);

  if (!user) return null;

  const withdraw = (kind: Kind) => {
    Alert.alert(t('privacy.withdrawTitle'), t(META[kind].effect), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('privacy.withdraw'),
        style: 'destructive',
        onPress: async () => {
          setBusy(kind);
          try {
            if (kind === 'ai_processing') await setAiProcessingConsent(user.id, false);
            else await withdrawTryOnConsent(user.id, kind, user.avatarUrl);
            Alert.alert(t('privacy.withdrawDone'));
          } catch (err) {
            console.warn('[Privacy] withdraw:', err);
            Alert.alert(t('combos.errorTitle'), t('profile.withdrawConsentError'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const grant = (kind: Kind) => {
    if (kind === 'ai_processing') { openAiConsent(); return; }
    setAskKind(kind);
  };

  const handleTryOnSubmit = async (granted: TryOnConsentKind[]) => {
    setBusy(askKind);
    try {
      await grantTryOnConsents(user.id, granted);
      setAskKind(null);
    } catch {
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SubScreenHeader title={t('privacy.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('privacy.intro')}</Text>

        {!loaded ? (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        ) : ORDER.map((kind) => {
          const rec = records[kind];
          const granted = rec?.granted === true;
          return (
            <View key={kind} style={styles.card}>
              <Text style={styles.cardTitle}>{t(META[kind].title)}</Text>
              <Text style={[styles.status, granted && styles.statusOn]}>{statusText(rec)}</Text>
              <Text style={styles.body}>{t(META[kind].body)}</Text>
              <Text style={styles.effect}>{t(META[kind].effect)}</Text>
              <TouchableOpacity
                style={granted ? styles.outlineBtn : styles.primaryBtn}
                onPress={() => (granted ? withdraw(kind) : grant(kind))}
                disabled={busy !== null}
                activeOpacity={0.85}
              >
                {busy === kind
                  ? <ActivityIndicator color={granted ? colors.text : colors.white} />
                  : (
                    <Text style={granted ? styles.outlineBtnText : styles.primaryBtnText}>
                      {granted ? t('privacy.withdraw') : t('privacy.grant')}
                    </Text>
                  )}
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity onPress={() => openLegal('privacy')} activeOpacity={0.7}>
          <Text style={styles.link}>{t('consent.policyLink')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <SensitiveConsentModal
        visible={askKind !== null}
        kinds={askKind ? [askKind] : []}
        saving={busy !== null}
        onSubmit={handleTryOnSubmit}
        onCancel={() => setAskKind(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPaddingH, paddingBottom: spacing.xl, gap: spacing.md },
  intro: { ...typography.body, color: colors.textSecondary },
  loader: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { ...typography.h3, color: colors.text },
  status: { ...typography.bodySmall, fontFamily: fonts.bodyMedium, color: colors.textSecondary },
  statusOn: { color: colors.success },
  body: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  effect: { ...typography.bodySmall, color: colors.text },
  primaryBtn: {
    height: 44, borderRadius: radius.md, backgroundColor: colors.text,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
  outlineBtn: {
    height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.text,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  outlineBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.text },
  link: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline', marginTop: spacing.sm },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../navigation/types';
import { useUserStore } from '../../../store/useUserStore';
import { colors, fonts, typography, spacing, radius, layout } from '../../../constants/theme';
import { t } from '../../../i18n';
import SubScreenHeader from './SubScreenHeader';
import { useStyleEntries } from './useStyleEntries';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileStyle'>;

/** Stil DNA detayı + yeniden belirle (Profil'den taşındı) */
export default function StyleDnaScreen({ navigation }: Props) {
  const user                      = useUserStore((s) => s.user);
  const setOnboarded              = useUserStore((s) => s.setOnboarded);
  const setTargetOnboardingScreen = useUserStore((s) => s.setTargetOnboardingScreen);
  const { entries, loading }      = useStyleEntries(user?.id);

  // Stil akışı onboarding navigator'ında — oraya geçiş
  const goStyleFlow = () => {
    setTargetOnboardingScreen('StyleChoice');
    setOnboarded(false);
  };

  const confirmChange = () => {
    Alert.alert(t('profile.changeStyle'), t('profile.changeStyleConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.done'), onPress: goStyleFlow },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SubScreenHeader title={t('profile.styleDnaTitle')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.textTertiary} style={styles.loader} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('profile.noStyleProfile')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goStyleFlow} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('profile.setStyle')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {entries.map((entry, i) => (
              <View key={entry.name}>
                <View style={styles.row}>
                  <Text style={styles.name}>{entry.name}</Text>
                  <Text style={styles.weight}>{entry.weight}%</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${entry.weight}%` }]} />
                </View>
                {i < entries.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
            <TouchableOpacity style={styles.changeBtn} onPress={confirmChange} activeOpacity={0.7}>
              <Text style={styles.changeText}>{t('profile.changeStyle')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPaddingH, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },
  empty: { gap: spacing.md },
  muted: { ...typography.body, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  name: { ...typography.body, fontFamily: fonts.bodyMedium, color: colors.text },
  weight: { ...typography.body, fontFamily: fonts.bodyBold, color: colors.text },
  progressBg: { height: 2, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: colors.text, borderRadius: radius.full },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
  changeBtn: { marginTop: spacing.xl, minHeight: 44, alignSelf: 'center', justifyContent: 'center' },
  changeText: { ...typography.bodySmall, color: colors.textSecondary },
});

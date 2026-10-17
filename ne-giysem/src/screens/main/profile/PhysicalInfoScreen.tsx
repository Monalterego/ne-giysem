import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../navigation/types';
import { supabase } from '../../../lib/supabase';
import { useUserStore } from '../../../store/useUserStore';
import type { User } from '../../../types';
import { colors, fonts, typography, spacing, radius, layout } from '../../../constants/theme';
import { t } from '../../../i18n';
import SubScreenHeader from './SubScreenHeader';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfilePhysical'>;

/** "Profil var" = herhangi bir alan dolu (alanlar tek tek boş bırakılabiliyor) */
export function hasPhysicalProfile(u: User | null | undefined): boolean {
  if (!u) return false;
  return [u.height, u.weight, u.age, u.bodyType, u.skinTone, u.hairColor, u.hairLength, u.hairType]
    .some((v) => v != null);
}

/** Fiziki profil store'da yoksa Supabase'den çek ve store'a yaz (Profil + bu ekran) */
export function useEnsurePhysicalProfile(): void {
  const user               = useUserStore((s) => s.user);
  const setPhysicalProfile = useUserStore((s) => s.setPhysicalProfile);
  const hasPhys = hasPhysicalProfile(user);

  useEffect(() => {
    if (!user || hasPhys) return;
    supabase
      .from('profiles')
      .select('height, weight, age, body_type, skin_tone, hair_color, hair_length, hair_type')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && [data.height, data.weight, data.age, data.body_type, data.skin_tone,
                     data.hair_color, data.hair_length, data.hair_type].some((v) => v != null)) {
          setPhysicalProfile({
            height:     data.height      ?? undefined,
            weight:     data.weight      ?? undefined,
            age:        data.age         ?? undefined,
            bodyType:   data.body_type   ?? undefined,
            skinTone:   data.skin_tone   ?? undefined,
            hairColor:  data.hair_color  ?? undefined,
            hairLength: data.hair_length ?? undefined,
            hairType:   data.hair_type   ?? undefined,
          });
        }
      });
  }, [user?.id]);
}

/** Fiziksel bilgiler + düzenle (Profil'den taşındı) */
export default function PhysicalInfoScreen({ navigation }: Props) {
  const user                      = useUserStore((s) => s.user);
  const setOnboarded              = useUserStore((s) => s.setOnboarded);
  const setTargetOnboardingScreen = useUserStore((s) => s.setTargetOnboardingScreen);
  const hasPhys = hasPhysicalProfile(user);
  useEnsurePhysicalProfile();

  // Düzenleme akışı onboarding'deki PhysicalProfile ekranı
  const goEdit = () => {
    setTargetOnboardingScreen('PhysicalProfile');
    setOnboarded(false);
  };

  const rows = [
    { label: t('profile.heightLabel'),     value: user?.height     ? `${user.height} cm` : null },
    { label: t('profile.weightLabel'),     value: user?.weight     ? `${user.weight} kg` : null },
    { label: t('profile.ageLabel'),        value: user?.age        ? `${user.age}`       : null },
    { label: t('profile.bodyTypeLabel'),   value: user?.bodyType   ? t(`bodyType.${user.bodyType}`)     : null },
    { label: t('profile.skinToneLabel'),   value: user?.skinTone   ? t(`skinTone.${user.skinTone}`)     : null },
    { label: t('profile.hairColorLabel'),  value: user?.hairColor  ? t(`hairColor.${user.hairColor}`)   : null },
    { label: t('profile.hairLengthLabel'), value: user?.hairLength ? t(`hairLength.${user.hairLength}`) : null },
    { label: t('profile.hairTypeLabel'),   value: user?.hairType   ? t(`hairType.${user.hairType}`)     : null },
  ].filter((r): r is { label: string; value: string } => r.value !== null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SubScreenHeader title={t('profile.physicalTitle')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {hasPhys ? (
          <>
            <View style={styles.list}>
              {rows.map(({ label, value }) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={goEdit} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('profile.physicalIncomplete')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goEdit} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('profile.completeProfile')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPaddingH, paddingBottom: spacing.xl },
  list: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { ...typography.bodySmall, color: colors.textSecondary },
  value: { ...typography.body, color: colors.text },
  empty: { gap: spacing.md },
  muted: { ...typography.body, color: colors.textSecondary },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
});

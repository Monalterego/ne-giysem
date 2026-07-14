import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { useUserStore } from '../../store/useUserStore';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleChoice'>;

export default function StyleChoiceScreen({ navigation }: Props) {
  const locale = useUserStore((s) => s.locale);

  // Component içinde — dil değişince etiketler güncellenir (route çevrilmez)
  const PATHS = useMemo(() => [
    { num: '01', title: t('style.path1Title'), description: t('style.path1Desc'), route: 'StyleSelect' as const },
    { num: '02', title: t('style.path2Title'), description: t('style.path2Desc'), route: 'StyleQuiz' as const },
    { num: '03', title: t('style.path3Title'), description: t('style.path3Desc'), route: 'StyleExplore' as const },
  ], [locale]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('style.choiceTitle')}</Text>
          <Text style={styles.subtitle}>{t('style.choiceSubtitle')}</Text>
        </View>

        {PATHS.map((path) => (
          <TouchableOpacity
            key={path.num}
            style={styles.card}
            onPress={() => navigation.navigate(path.route)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardNum}>{path.num}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{path.title}</Text>
              <Text style={styles.cardDesc}>{path.description}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>
          {t('style.allPathsSame')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Başlık
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Kart
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.md,
    ...shadows.subtle,
  },
  cardNum: {
    ...typography.h3,
    fontFamily: fonts.heading,
    color: colors.textTertiary,
    width: 28,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs - 2,
  },
  cardTitle: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Alt not
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

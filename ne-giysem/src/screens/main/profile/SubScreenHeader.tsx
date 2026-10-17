import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts, typography, spacing, layout } from '../../../constants/theme';
import { t } from '../../../i18n';

/** Profil alt ekranları ortak başlığı — StoreResult'taki "← başlık" deseni */
export default function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('combos.back')}
      >
        <Text style={styles.back}>{t('auth.backArrow')}</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH - spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // 44x44 dokunma alanı
  backBtn: { minWidth: 60, height: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  back: { ...typography.body, fontFamily: fonts.bodyMedium, color: colors.textSecondary },
  title: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  side: { width: 60 },
});

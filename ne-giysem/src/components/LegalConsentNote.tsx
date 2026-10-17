import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../constants/theme';
import { openLegal } from '../constants/legal';
import { t } from '../i18n';

/**
 * Giriş / kayıt butonlarının altı: "Devam ederek Kullanım Koşulları'nı ve Gizlilik
 * Politikası'nı kabul etmiş olursun." — iki link de arayüz diline göre.
 * E-posta, Apple ve Google yollarının hepsi aynı ekranda → tek not hepsini kapsar.
 */
export default function LegalConsentNote() {
  return (
    <Text style={styles.note}>
      {t('legal.consentPrefix')}
      <Text style={styles.link} onPress={() => openLegal('terms')} accessibilityRole="link">
        {t('legal.termsInline')}
      </Text>
      {t('legal.consentMiddle')}
      <Text style={styles.link} onPress={() => openLegal('privacy')} accessibilityRole="link">
        {t('legal.privacyInline')}
      </Text>
      {t('legal.consentSuffix')}
    </Text>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 12 },
  link: { color: colors.text, textDecorationLine: 'underline' },
});

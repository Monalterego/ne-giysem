import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, typography, spacing, radius, layout } from '../constants/theme';
import { t } from '../i18n';

export const PRIVACY_URL = 'https://sestinaapp.com/gizlilik';

/**
 * Hassas veri açık rızası — fiziksel profil ilk kez kaydedilmeden ve avatar ilk
 * kez yüklenmeden önce. Ne toplandığı, ne için, kime gittiği + politika linki.
 * Onay kutusu işaretlenmeden "Kabul ediyorum" basılamaz.
 */
export default function SensitiveConsentModal({
  visible,
  saving,
  onAccept,
  onCancel,
  intro,
  cancelLabel,
}: {
  visible: boolean;
  saving?: boolean;
  onAccept: () => void;
  onCancel: () => void;
  /** Mevcut kullanıcı kapısında farklı giriş metni */
  intro?: string;
  /** Kapıda 'Vazgeç' yerine 'Kabul etmiyorum' (red → veriler silinir) */
  cancelLabel?: string;
}) {
  const [checked, setChecked] = useState(false);
  // Her açılışta işaretsiz başla
  useEffect(() => { if (visible) setChecked(false); }, [visible]);

  const Section = ({ title, body }: { title: string; body: string }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t('consent.title')}</Text>
            <Text style={styles.intro}>{intro ?? t('consent.intro')}</Text>

            <Section title={t('consent.whatTitle')} body={t('consent.whatBody')} />
            <Section title={t('consent.whyTitle')}  body={t('consent.whyBody')} />
            <Section title={t('consent.whoTitle')}  body={t('consent.whoBody')} />
            <Section title={t('consent.controlTitle')} body={t('consent.controlBody')} />

            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
              <Text style={styles.link}>{t('consent.policyLink')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setChecked((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked && <Feather name="check" size={14} color={colors.white} />}
              </View>
              <Text style={styles.checkText}>{t('consent.checkbox')}</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, (!checked || saving) && styles.disabled]}
              onPress={onAccept}
              disabled={!checked || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.primaryBtnText}>{t('consent.accept')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7} disabled={saving}>
              <Text style={styles.cancelText}>{cancelLabel ?? t('consent.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },   // diğer modallarla aynı (PhotoGuideModal)
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: { padding: layout.screenPaddingH, gap: spacing.md },
  title: { ...typography.h2, color: colors.text },
  intro: { ...typography.body, color: colors.textSecondary },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.text },
  sectionBody: { ...typography.bodySmall, color: colors.textSecondary },
  link: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.black, borderColor: colors.black },
  checkText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  actions: {
    padding: layout.screenPaddingH,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    height: 48, borderRadius: radius.sm, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodyBold, color: colors.white },
  cancelBtn: { alignSelf: 'center', paddingVertical: spacing.sm },
  cancelText: { ...typography.bodySmall, color: colors.textSecondary },
});

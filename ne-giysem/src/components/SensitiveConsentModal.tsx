import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { openLegal } from '../constants/legal';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, typography, spacing, radius, layout } from '../constants/theme';
import type { TryOnConsentKind } from '../constants/consent';
import { useUserStore } from '../store/useUserStore';
import { useConsentStore, noticeRead } from '../store/useConsentStore';
import { acknowledgeNotice } from '../lib/privacyActions';
import { t } from '../i18n';
import { upper } from '../utils/text';

const CHECKBOX_TEXT: Record<TryOnConsentKind, string> = {
  tryon_photo:    'consent.photoCheckbox',
  tryon_physical: 'consent.physicalCheckbox',
};

/**
 * Sanal deneme — aydınlatma ile açık rıza AYRI:
 *   • Üstte "Aydınlatma": onay kutusu yok; "Okudum" → consent_events 'notice_shown'.
 *   • Altta açık rıza(lar): her biri ayrı onay kutusu — (a) profil fotoğrafı → FASHN,
 *     (b) fiziksel bilgiler → manken üretimi için FASHN. Yalnızca `kinds` sorulur;
 *     kullanıcı yalnızca birine rıza verebilir.
 * "Onaylıyorum" aydınlatma okunmadan ve en az bir kutu işaretlenmeden basılamaz.
 * Rıza kaydını çağıran yapar (onSubmit işaretlenenleri verir).
 */
export default function SensitiveConsentModal({
  visible,
  kinds,
  saving,
  onSubmit,
  onCancel,
  intro,
  cancelLabel,
}: {
  visible: boolean;
  /** Bu akışın gerektirdiği açık rızalar (1 ya da 2) */
  kinds: TryOnConsentKind[];
  saving?: boolean;
  onSubmit: (granted: TryOnConsentKind[]) => void;
  onCancel: () => void;
  /** Mevcut kullanıcı kapısında farklı giriş metni */
  intro?: string;
  /** Kapıda 'Vazgeç' yerine 'Kabul etmiyorum' (red → ilgili veriler silinir) */
  cancelLabel?: string;
}) {
  const uid       = useUserStore((s) => s.user?.id);
  const read      = useConsentStore((s) => noticeRead(s.records));
  const [checked, setChecked] = useState<Partial<Record<TryOnConsentKind, boolean>>>({});
  const [ackBusy, setAckBusy] = useState(false);
  // Alt sayfa: butonlar ev göstergesinin (home indicator) altında kalmasın
  const insets = useSafeAreaInsets();
  // Her açılışta işaretsiz başla
  useEffect(() => { if (visible) setChecked({}); }, [visible]);

  const granted = kinds.filter((k) => checked[k]);
  const canSubmit = read && granted.length > 0 && !saving;

  const handleAcknowledge = async () => {
    if (!uid) return;
    setAckBusy(true);
    try {
      await acknowledgeNotice(uid);
    } catch (err) {
      console.warn('[SensitiveConsent] notice_shown kaydedilemedi:', err);
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setAckBusy(false);
    }
  };

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

            {/* ── Aydınlatma — bilgilendirme, onay kutusu YOK ── */}
            <Text style={styles.blockLabel}>{upper(t('consent.noticeLabel'))}</Text>
            <Section title={t('consent.whatTitle')}    body={t('consent.whatBody')} />
            <Section title={t('consent.whyTitle')}     body={t('consent.whyBody')} />
            <Section title={t('consent.whoTitle')}     body={t('consent.whoBody')} />
            <Section title={t('consent.controlTitle')} body={t('consent.controlBody')} />
            <Section title={t('consent.rightsTitle')}  body={t('consent.rightsBody')} />

            <TouchableOpacity onPress={() => openLegal('privacy')} activeOpacity={0.7}>
              <Text style={styles.link}>{t('consent.policyLink')}</Text>
            </TouchableOpacity>

            {read ? (
              <View style={styles.readRow}>
                <Feather name="check" size={14} color={colors.text} />
                <Text style={styles.readText}>{t('consent.noticeRead')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.ackBtn}
                onPress={handleAcknowledge}
                disabled={ackBusy}
                activeOpacity={0.8}
              >
                {ackBusy
                  ? <ActivityIndicator color={colors.text} />
                  : <Text style={styles.ackBtnText}>{t('consent.noticeAck')}</Text>}
              </TouchableOpacity>
            )}

            {/* ── Açık rıza — her biri ayrı kutu ── */}
            <Text style={[styles.blockLabel, styles.blockLabelSpaced]}>{upper(t('consent.explicitLabel'))}</Text>
            <Text style={styles.sectionBody}>
              {kinds.length > 1 ? t('consent.explicitIntroMany') : t('consent.explicitIntroOne')}
            </Text>
            {kinds.map((k) => {
              const on = !!checked[k];
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.checkRow, !read && styles.disabled]}
                  onPress={() => setChecked((c) => ({ ...c, [k]: !c[k] }))}
                  disabled={!read}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !read }}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Feather name="check" size={14} color={colors.white} />}
                  </View>
                  <Text style={styles.checkText}>{t(CHECKBOX_TEXT[k])}</Text>
                </TouchableOpacity>
              );
            })}
            {!read && <Text style={styles.hint}>{t('consent.readFirst')}</Text>}
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: spacing.lg + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.disabled]}
              onPress={() => onSubmit(granted)}
              disabled={!canSubmit}
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
    maxHeight: '88%',   // üstte çentik payı: sayfa ekranın %12'sinden aşağıda başlar
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: { padding: layout.screenPaddingH, gap: spacing.md },
  title: { ...typography.h2, color: colors.text },
  intro: { ...typography.body, color: colors.textSecondary },
  blockLabel: { ...typography.label, color: colors.textSecondary },
  blockLabelSpaced: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.text },
  sectionBody: { ...typography.bodySmall, color: colors.textSecondary },
  link: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline' },
  ackBtn: {
    height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.text,
    alignItems: 'center', justifyContent: 'center',
  },
  ackBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.text },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  readText: { ...typography.bodySmall, color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.black, borderColor: colors.black },
  checkText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  hint: { ...typography.caption, color: colors.textTertiary },
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

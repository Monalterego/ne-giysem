import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, typography, spacing, radius } from '../constants/theme';
import { t } from '../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  dos: string[];      // yapılacaklar (çevrilmiş metinler)
  donts: string[];    // yapılmayacaklar
};

/**
 * Fotoğraf çekim rehberi — hem avatar (sanal deneme) hem kıyafet yüklemede kullanılır.
 * Görsel yerine ikon + metin: metinli görsel her dil için ayrı asset gerektirirdi.
 */
export default function PhotoGuideModal({ visible, onClose, title, intro, dos, donts }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.intro}>{intro}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {dos.map((line, i) => (
              <View key={`d${i}`} style={styles.row}>
                <View style={styles.iconOk}>
                  <Feather name="check" size={13} color={colors.white} />
                </View>
                <Text style={styles.rowText}>{line}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            {donts.map((line, i) => (
              <View key={`x${i}`} style={styles.row}>
                <View style={styles.iconNo}>
                  <Feather name="x" size={13} color={colors.white} />
                </View>
                <Text style={[styles.rowText, styles.rowTextMuted]}>{line}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>{t('common.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  iconOk: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  iconNo: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  rowTextMuted: {
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  btn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});

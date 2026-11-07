import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { requestPackshot } from '../lib/garmentImage';
import { applyStudioUpgrade } from '../lib/studioUpgrade';
import { displayUrl } from '../lib/storageUrls';
import { useUserStore } from '../store/useUserStore';
import { usePlanStore } from '../store/usePlanStore';
import type { WardrobeItem } from '../types';
import { colors, fonts, typography, spacing, radius, layout } from '../constants/theme';
import { t } from '../i18n';

type Props = {
  /** null → kapalı */
  item: WardrobeItem | null;
  onClose: () => void;
  onUpgraded: (item: WardrobeItem) => void;
};

/**
 * "Stüdyo kalitesine yükselt": seçilen parça için packshot üretilir (garment-image,
 * item_id), mevcut görselle yan yana gösterilir. Onay → yeni görsel; ret → değişiklik
 * yok (kredi harcandı, hak düşer — metinde söylenir).
 */
export default function StudioUpgradeModal({ item, onClose, onUpgraded }: Props) {
  const user = useUserStore((s) => s.user);
  const [phase, setPhase] = useState<'working' | 'compare' | 'saving'>('working');
  const [packshot, setPackshot] = useState<string | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setPhase('working');
    setPackshot(null);
    setCurrentUri(null);

    displayUrl('wardrobe-items', item.processedImageUrl).then((u) => { if (!cancelled) setCurrentUri(u); });
    requestPackshot({ itemId: item.id }).then((out) => {
      if (cancelled) return;
      usePlanStore.getState().refresh();   // kalan hak (öneri kartı)
      if (out.kind === 'ok') {
        setPackshot(out.base64);
        setPhase('compare');
        return;
      }
      onClose();
      const msg = out.kind === 'quota' ? t('wardrobe.upgradeQuota') : t('upload.packshotFailedNote');
      // iOS: RN Modal kapanırken Alert açılamaz → kapanışı bekle
      setTimeout(() => Alert.alert(t('wardrobe.upgradeTitle'), msg), 350);
    });
    return () => { cancelled = true; };
    // Yalnızca yeni parça açılınca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const confirm = async () => {
    if (!item || !packshot || !user) return;
    setPhase('saving');
    try {
      onUpgraded(await applyStudioUpgrade(user.id, item, packshot));
      onClose();
    } catch (err) {
      console.warn('[studioUpgrade] kaydedilemedi:', err);
      setPhase('compare');
      Alert.alert(t('combos.errorTitle'), t('wardrobe.upgradeSaveFailed'));
    }
  };

  return (
    <Modal visible={item !== null} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('wardrobe.upgradeTitle')}</Text>

          {phase === 'working' ? (
            <View style={styles.working}>
              <ActivityIndicator color={colors.text} size="large" />
              <Text style={styles.body}>{t('upload.preparingStudio')}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.body}>{t('upload.compareBody')}</Text>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <View style={styles.imageWrap}>
                    {currentUri && <Image source={{ uri: currentUri }} style={styles.image} contentFit="contain" />}
                  </View>
                  <Text style={styles.label}>{t('wardrobe.upgradeCurrent')}</Text>
                </View>
                <View style={styles.compareCol}>
                  <View style={styles.imageWrap}>
                    {packshot && (
                      <Image source={{ uri: `data:image/jpeg;base64,${packshot}` }} style={styles.image} contentFit="contain" />
                    )}
                  </View>
                  <Text style={styles.label}>{t('upload.compareStudio')}</Text>
                </View>
              </View>
              <Text style={styles.note}>{t('wardrobe.upgradeKeepNote')}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, phase === 'saving' && styles.disabled]}
                onPress={confirm}
                disabled={phase === 'saving'}
                activeOpacity={0.85}
              >
                {phase === 'saving'
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.primaryBtnText}>{t('wardrobe.upgradeUse')}</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={phase === 'saving'}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>
              {phase === 'working' ? t('common.cancel') : t('wardrobe.upgradeKeep')}
            </Text>
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
    paddingHorizontal: layout.screenPaddingH,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  working: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  compareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 220,
  },
  compareCol: {
    flex: 1,
    gap: spacing.xs,
  },
  imageWrap: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    textAlign: 'center',
  },
  note: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  disabled: {
    opacity: 0.6,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

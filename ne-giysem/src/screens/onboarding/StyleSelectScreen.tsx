import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { STYLE_GROUPS, STYLE_DATA_MAP, styleDescOf, groupLabelOf } from '../../constants/styles';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleSelect'>;

// ─── Slider sabitleri ─────────────────────────────────────────────────────────

const MIN_WEIGHT  = 5;

// ─── Ağırlık yardımcıları ─────────────────────────────────────────────────────

function equalWeights(names: string[]): StyleEntry[] {
  if (names.length === 0) return [];
  const base = Math.floor(100 / names.length);
  const rem  = 100 - base * names.length;
  return names.map((name, i) => ({ name, weight: i === 0 ? base + rem : base }));
}

function redistributeWeights(
  entries: StyleEntry[],
  changedName: string,
  rawValue: number,
): StyleEntry[] {
  const others = entries.filter((e) => e.name !== changedName);
  if (others.length === 0) return entries;

  const maxVal      = 100 - others.length * MIN_WEIGHT;
  const newVal      = Math.max(MIN_WEIGHT, Math.min(maxVal, rawValue));
  const remaining   = 100 - newVal;
  const othersTotal = others.reduce((sum, e) => sum + e.weight, 0);

  let newOthers: StyleEntry[];
  if (othersTotal === 0) {
    const base = Math.floor(remaining / others.length);
    const rem  = remaining - base * others.length;
    newOthers  = others.map((e, i) => ({ ...e, weight: base + (i === 0 ? rem : 0) }));
  } else {
    newOthers = others.map((e) => ({
      ...e,
      weight: Math.max(MIN_WEIGHT, Math.round((e.weight * remaining) / othersTotal)),
    }));
    const othersSum = newOthers.reduce((sum, e) => sum + e.weight, 0);
    const diff = remaining - othersSum;
    if (diff !== 0) {
      newOthers[0] = { ...newOthers[0], weight: Math.max(MIN_WEIGHT, newOthers[0].weight + diff) };
    }
  }

  return entries.map((e) => {
    if (e.name === changedName) return { ...e, weight: newVal };
    return newOthers.find((o) => o.name === e.name)!;
  });
}

// ─── StyleCard bileşeni ───────────────────────────────────────────────────────

function StyleCard({
  name,
  isSelected,
  canRemove,
  weight,
  showWeight,
  onPress,
}: {
  name: string;
  isSelected: boolean;
  canRemove: boolean;
  weight: number;
  showWeight: boolean;
  onPress: () => void;
}) {
  const data = STYLE_DATA_MAP[name];
  if (!data) return null;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {/* Renk paleti daireleri */}
      <View style={styles.paletteRow}>
        {data.palette.map((hex, i) => (
          <View
            key={hex}
            style={[
              styles.colorDot,
              { backgroundColor: hex },
              i > 0 && styles.colorDotOverlap,
            ]}
          />
        ))}
      </View>

      {/* İsim + açıklama */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
        <Text style={styles.cardDesc} numberOfLines={1}>{styleDescOf(data.name)}</Text>
      </View>

      {/* Seçim badge — kaldırılabilirse ✕ göster (görsel ipucu) */}
      {isSelected && (
        <View style={[styles.checkBadge, canRemove && styles.checkBadgeRemovable]}>
          <Text style={styles.checkBadgeText}>
            {showWeight ? `${weight}%` : (canRemove ? '✕' : '✓')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StyleSelectScreen({ navigation }: Props) {
  // Geri butonu — SafeAreaView'un hemen içinde, ScrollView'dan önce
  const [entries, setEntries] = useState<StyleEntry[]>([]);

  const toggle = (styleName: string) => {
    setEntries((prev) => {
      const isSelected = prev.some((e) => e.name === styleName);
      if (isSelected) {
        if (prev.length <= 1) return prev;
        return equalWeights(prev.filter((e) => e.name !== styleName).map((e) => e.name));
      }
      return equalWeights([...prev.map((e) => e.name), styleName]);
    });
  };

  const handleSliderChange = (name: string, rawValue: number) => {
    setEntries((prev) => redistributeWeights(prev, name, rawValue));
  };

  const handleContinue = () => {
    if (entries.length === 0) return;
    navigation.navigate('StyleResult', { selectedStyles: entries });
  };

  const showWeightPct = entries.length >= 2;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.badge}>{t('style.selectBadge')}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('style.selectTitle')}</Text>
          {entries.length > 0 && (
            <TouchableOpacity onPress={() => setEntries([])} activeOpacity={0.7}>
              <Text style={styles.resetLink}>{t('style.selectReset')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.subtitle}>
          {t('style.selectSubtitle')}
        </Text>

        {/* Ağırlık slider — 2+ stil seçilince (liste üstünde, kaydırmadan görünsün) */}
        {entries.length >= 2 && (
          <View style={styles.weightBox}>
            <Text style={styles.weightTitle}>{t('style.weightTitle')}</Text>
            {entries.map((entry) => (
              <View key={entry.name} style={styles.sliderRow}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>{entry.name}</Text>
                  <Text style={styles.sliderPct}>{entry.weight}%</Text>
                </View>
                <Slider
                  style={styles.sliderContainer}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={entry.weight}
                  onValueChange={(v) => handleSliderChange(entry.name, Math.round(v))}
                  minimumTrackTintColor={colors.black}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.black}
                />
              </View>
            ))}
          </View>
        )}

        {STYLE_GROUPS.map((group) => (
          <View key={group.groupName} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupName}>{groupLabelOf(group.groupName)}</Text>
            </View>
            {group.styles.map((style) => {
              const entry      = entries.find((e) => e.name === style.name);
              const isSelected = !!entry;
              return (
                <StyleCard
                  key={style.name}
                  name={style.name}
                  isSelected={isSelected}
                  canRemove={isSelected && entries.length > 1}
                  weight={entry?.weight ?? 0}
                  showWeight={showWeightPct && isSelected}
                  onPress={() => toggle(style.name)}
                />
              );
            })}
          </View>
        ))}

      </ScrollView>

      {/* Footer — sabit buton */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, entries.length === 0 && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={entries.length === 0}
        >
          <Text style={[styles.primaryBtnText, entries.length === 0 && styles.primaryBtnTextDisabled]}>
            {entries.length === 0
              ? t('style.selectAtLeastOne')
              : t('style.continueWithCount', { count: entries.length })}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  backBtn: {
    paddingTop: spacing.lg,
    paddingLeft: spacing.md,
    alignSelf: 'flex-start',
  },
  container: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },

  // Başlık
  badge: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  resetLink: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 19,
  },

  // Gruplar
  group: {
    marginBottom: spacing.xl,
  },
  groupHeader: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  groupName: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Stil kartı
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 3,
    marginBottom: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cardSelected: {
    borderColor: colors.text,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },

  // Renk daireleri
  paletteRow: {
    flexDirection: 'row',
    width: 44,
    flexShrink: 0,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  colorDotOverlap: {
    marginLeft: -5,
  },

  // Metin
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Seçim badge
  checkBadge: {
    backgroundColor: colors.text,
    borderRadius: radius.xs,
    minWidth: 32,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs - 1,
    alignItems: 'center',
  },
  checkBadgeRemovable: {
    backgroundColor: colors.textSecondary,   // nötr — ✕ ikonu kaldırılabilirliği gösterir
  },
  checkBadgeText: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Ağırlık kutusu
  weightBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  weightTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sliderRow: {
    marginBottom: spacing.md,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sliderLabel: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  sliderPct: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    minWidth: 36,
    textAlign: 'right',
  },

  // Native slider (@react-native-community/slider)
  sliderContainer: {
    width: '100%',
    height: 40,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: colors.surface,
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  primaryBtnTextDisabled: {
    color: colors.textTertiary,
  },
});

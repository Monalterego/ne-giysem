import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';
import { STYLE_GROUPS, STYLE_DATA_MAP } from '../../constants/styles';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleSelect'>;

// ─── Slider sabitleri ─────────────────────────────────────────────────────────

const MIN_WEIGHT  = 5;
const THUMB       = 20;
const TRACK_H     = 6;
const CONTAINER_H = 36;
const TRACK_TOP   = (CONTAINER_H - TRACK_H) / 2;
const THUMB_TOP   = (CONTAINER_H - THUMB)   / 2;

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

  const maxVal   = 100 - others.length * MIN_WEIGHT;
  const newVal   = Math.max(MIN_WEIGHT, Math.min(maxVal, rawValue));
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

// ─── WeightSlider bileşeni ────────────────────────────────────────────────────

function WeightSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(300);
  const trackWidthRef = useRef(300);
  const onChangeRef   = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, trackWidthRef.current));
        onChangeRef.current(Math.round((x / trackWidthRef.current) * 100));
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, trackWidthRef.current));
        onChangeRef.current(Math.round((x / trackWidthRef.current) * 100));
      },
    }),
  ).current;

  const fillWidth = (value / 100) * trackWidth;
  const thumbLeft = fillWidth - THUMB / 2;

  return (
    <View
      style={styles.sliderContainer}
      onLayout={(e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        setTrackWidth(w);
        trackWidthRef.current = w;
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.sliderRail} />
      <View style={[styles.sliderFill, { width: fillWidth }]} />
      <View style={[styles.sliderThumb, { left: thumbLeft }]} />
    </View>
  );
}

// ─── StyleCard bileşeni ───────────────────────────────────────────────────────

function StyleCard({
  name,
  isSelected,
  weight,
  showWeight,
  onPress,
}: {
  name: string;
  isSelected: boolean;
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
        <Text style={[styles.cardName, isSelected && styles.cardNameSelected]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={1}>
          {data.turkishDesc}
        </Text>
      </View>

      {/* Emoji */}
      <Text style={styles.cardEmoji}>{data.emoji}</Text>

      {/* Seçim göstergesi */}
      {isSelected && (
        <View style={styles.checkBadge}>
          {showWeight ? (
            <Text style={styles.checkBadgeText}>{weight}%</Text>
          ) : (
            <Text style={styles.checkBadgeText}>✓</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StyleSelectScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<StyleEntry[]>([]);

  const toggle = (styleName: string) => {
    setEntries((prev) => {
      const isSelected = prev.some((e) => e.name === styleName);
      if (isSelected) {
        if (prev.length <= 1) return prev; // en az 1 seçili kalmalı
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

  const selectedNames = new Set(entries.map((e) => e.name));
  const showWeightPct = entries.length >= 2;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.badge}>YOL A</Text>
        <Text style={styles.title}>Tarzını Seç</Text>
        <Text style={styles.subtitle}>
          Birden fazla seçebilirsin — ağırlıkları ayarlayabilirsin
        </Text>

        {/* Grup ve kart listesi */}
        {STYLE_GROUPS.map((group) => (
          <View key={group.groupName} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupEmoji}>{group.groupEmoji}</Text>
              <Text style={styles.groupName}>{group.groupName}</Text>
            </View>
            {group.styles.map((style) => {
              const entry      = entries.find((e) => e.name === style.name);
              const isSelected = !!entry;
              return (
                <StyleCard
                  key={style.name}
                  name={style.name}
                  isSelected={isSelected}
                  weight={entry?.weight ?? 0}
                  showWeight={showWeightPct && isSelected}
                  onPress={() => toggle(style.name)}
                />
              );
            })}
          </View>
        ))}

        {/* Ağırlık slider — 2+ stil seçilince */}
        {entries.length >= 2 && (
          <View style={styles.weightBox}>
            <Text style={styles.weightTitle}>AĞIRLIK DAĞILIMI</Text>
            {entries.map((entry) => {
              const data = STYLE_DATA_MAP[entry.name];
              return (
                <View key={entry.name} style={styles.sliderRow}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>
                      {data?.emoji ?? ''} {entry.name}
                    </Text>
                    <Text style={styles.sliderPct}>{entry.weight}%</Text>
                  </View>
                  <WeightSlider
                    value={entry.weight}
                    onChange={(v) => handleSliderChange(entry.name, v)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer — sabit buton */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, entries.length === 0 && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={entries.length === 0}
        >
          <Text style={styles.primaryBtnText}>
            {entries.length === 0
              ? 'En az 1 stil seç'
              : `Devam Et (${entries.length} stil) →`}
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
  container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 120,
  },
  badge: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    marginBottom: 28,
    lineHeight: 19,
  },

  // ── Gruplar ──
  group: {
    marginBottom: 28,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  groupEmoji: {
    fontSize: 18,
  },
  groupName: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // ── Stil kartı ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cardSelected: {
    borderColor: colors.primary,
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
    width: 18,
    height: 18,
    borderRadius: 9,
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
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  cardNameSelected: {
    color: colors.primary,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },

  // Emoji
  cardEmoji: {
    fontSize: 22,
    flexShrink: 0,
  },

  // Seçim badge
  checkBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
  },
  checkBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // ── Ağırlık kutusu ──
  weightBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },
  weightTitle: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: colors.muted,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  sliderRow: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
    flex: 1,
  },
  sliderPct: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    minWidth: 36,
    textAlign: 'right',
  },

  // Custom slider
  sliderContainer: {
    height: CONTAINER_H,
    position: 'relative',
  },
  sliderRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: TRACK_TOP,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.border,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: TRACK_TOP,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.accent,
  },
  sliderThumb: {
    position: 'absolute',
    top: THUMB_TOP,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.accent,
    boxShadow: '0 2px 6px rgba(233,69,96,0.30)',
    elevation: 3,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: colors.border,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});

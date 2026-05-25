import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleSelect'>;

const ALL_STYLES = [
  'Minimalist',
  'Streetwear',
  'Old Money',
  'Smart Casual',
  'Bohemian',
  'Athleisure',
  'Avant-garde',
];

const MIN_WEIGHT = 5;
const THUMB = 20;
const TRACK_H = 6;
const CONTAINER_H = 36;
const TRACK_TOP = (CONTAINER_H - TRACK_H) / 2;
const THUMB_TOP = (CONTAINER_H - THUMB) / 2;

function equalWeights(names: string[]): StyleEntry[] {
  if (names.length === 0) return [];
  const base = Math.floor(100 / names.length);
  const rem = 100 - base * names.length;
  return names.map((name, i) => ({ name, weight: i === 0 ? base + rem : base }));
}

function redistributeWeights(
  entries: StyleEntry[],
  changedName: string,
  rawValue: number,
): StyleEntry[] {
  const others = entries.filter((e) => e.name !== changedName);
  if (others.length === 0) return entries;

  const maxVal = 100 - others.length * MIN_WEIGHT;
  const newVal = Math.max(MIN_WEIGHT, Math.min(maxVal, rawValue));
  const remaining = 100 - newVal;
  const othersTotal = others.reduce((sum, e) => sum + e.weight, 0);

  let newOthers: StyleEntry[];
  if (othersTotal === 0) {
    const base = Math.floor(remaining / others.length);
    const rem = remaining - base * others.length;
    newOthers = others.map((e, i) => ({ ...e, weight: base + (i === 0 ? rem : 0) }));
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

function WeightSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(300);
  const trackWidthRef = useRef(300);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, trackWidthRef.current));
        onChangeRef.current(Math.round((x / trackWidthRef.current) * 100));
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, trackWidthRef.current));
        onChangeRef.current(Math.round((x / trackWidthRef.current) * 100));
      },
    })
  ).current;

  const fillWidth = (value / 100) * trackWidth;
  const thumbLeft = fillWidth - THUMB / 2;

  return (
    <View
      style={styles.sliderContainer}
      onLayout={(e) => {
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

export default function StyleSelectScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<StyleEntry[]>([
    { name: 'Minimalist', weight: 100 },
  ]);

  const toggle = (style: string) => {
    setEntries((prev) => {
      const isSelected = prev.some((e) => e.name === style);
      if (isSelected) {
        if (prev.length <= 1) return prev;
        return equalWeights(prev.filter((e) => e.name !== style).map((e) => e.name));
      }
      return equalWeights([...prev.map((e) => e.name), style]);
    });
  };

  const handleSliderChange = (name: string, rawValue: number) => {
    setEntries((prev) => redistributeWeights(prev, name, rawValue));
  };

  const handleContinue = () => {
    navigation.navigate('StyleResult', { selectedStyles: entries });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.badge}>YOL A</Text>
        <Text style={styles.title}>Tarzını Seç</Text>
        <Text style={styles.subtitle}>Birden fazla seçebilirsin</Text>

        {/* Stil tag'leri */}
        <View style={styles.tagsWrap}>
          {ALL_STYLES.map((style) => {
            const entry = entries.find((e) => e.name === style);
            const isSelected = !!entry;
            return (
              <TouchableOpacity
                key={style}
                style={[styles.tag, isSelected && styles.tagSelected]}
                onPress={() => toggle(style)}
                activeOpacity={0.75}
              >
                {isSelected && <Text style={styles.tagCheck}>✓ </Text>}
                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                  {style}
                </Text>
                {isSelected && entries.length >= 2 && (
                  <Text style={styles.tagWeight}> {entry.weight}%</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Slider bölümü — sadece 2+ stil seçilince */}
        {entries.length >= 2 && (
          <View style={styles.weightBox}>
            <Text style={styles.weightTitle}>AĞIRLIK DAĞILIMI</Text>
            {entries.map((entry) => (
              <View key={entry.name} style={styles.sliderRow}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>{entry.name}</Text>
                  <Text style={styles.sliderPct}>{entry.weight}%</Text>
                </View>
                <WeightSlider
                  value={entry.weight}
                  onChange={(v) => handleSliderChange(entry.name, v)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            Devam Et ({entries.length} stil) →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    paddingHorizontal: 24,
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
  },

  // ─── Tag'ler ───────────────────────────────────────────────────────────────
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tagSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagCheck: {
    fontSize: 12,
    color: colors.white,
  },
  tagText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  tagTextSelected: {
    color: colors.white,
  },
  tagWeight: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: 'rgba(255,255,255,0.65)',
  },

  // ─── Ağırlık kutusu ────────────────────────────────────────────────────────
  weightBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
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
  },
  sliderPct: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    minWidth: 36,
    textAlign: 'right',
  },

  // ─── Custom slider ─────────────────────────────────────────────────────────
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

  // ─── Footer ────────────────────────────────────────────────────────────────
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
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});

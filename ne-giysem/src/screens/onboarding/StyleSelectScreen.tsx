import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

function calcWeights(names: string[]): StyleEntry[] {
  if (names.length === 0) return [];
  const base = Math.floor(100 / names.length);
  const remainder = 100 - base * names.length;
  return names.map((name, i) => ({
    name,
    weight: i === 0 ? base + remainder : base,
  }));
}

export default function StyleSelectScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string[]>(['Minimalist']);

  const toggle = (style: string) => {
    setSelected((prev) =>
      prev.includes(style)
        ? prev.length > 1 ? prev.filter((s) => s !== style) : prev
        : [...prev, style]
    );
  };

  const handleContinue = () => {
    navigation.navigate('StyleResult', { selectedStyles: calcWeights(selected) });
  };

  const weights = calcWeights(selected);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.badge}>YOL A</Text>
        <Text style={styles.title}>Tarzını Seç</Text>
        <Text style={styles.subtitle}>Birden fazla seçebilirsin</Text>

        {/* Style tags */}
        <View style={styles.tagsWrap}>
          {ALL_STYLES.map((style) => {
            const isSelected = selected.includes(style);
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Weight display — only shown when 2+ styles selected */}
        {selected.length >= 2 && (
          <View style={styles.weightBox}>
            <Text style={styles.weightTitle}>Ağırlık Dağılımı</Text>
            {weights.map((entry) => (
              <View key={entry.name} style={styles.weightRow}>
                <Text style={styles.weightLabel}>{entry.name}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${entry.weight}%` as any }]} />
                </View>
                <Text style={styles.weightPct}>{entry.weight}%</Text>
              </View>
            ))}
            <Text style={styles.weightHint}>
              Ağırlıklar eşit dağıtılır — ilerleyen sürümde özelleştirebilirsin.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            Devam Et ({selected.length} stil) →
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
  weightBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  weightTitle: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  weightLabel: {
    width: 90,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#555555',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  weightPct: {
    width: 36,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: '#555555',
    textAlign: 'right',
  },
  weightHint: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#BBBBBB',
    lineHeight: 16,
  },
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

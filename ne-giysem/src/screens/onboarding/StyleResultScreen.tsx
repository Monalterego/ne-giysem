import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleResult'>;

const PALETTE: Record<string, string[]> = {
  Minimalist:    ['#2C3E50', '#ECF0F1', '#BDC3C7', '#95A5A6', '#1A1A2E'],
  Streetwear:    ['#1A1A2E', '#E94560', '#F8C300', '#2ECC71', '#000000'],
  'Old Money':   ['#8E6F47', '#F5F0E8', '#C9A96E', '#5D4037', '#1A1A2E'],
  'Smart Casual':['#2C3E50', '#ECF0F1', '#3498DB', '#95A5A6', '#1A1A2E'],
  Bohemian:      ['#C0392B', '#E67E22', '#F1C40F', '#8E44AD', '#2ECC71'],
  Athleisure:    ['#1A1A2E', '#E94560', '#FFFFFF', '#3498DB', '#2ECC71'],
  'Avant-garde': ['#8E44AD', '#1A1A2E', '#E94560', '#F39C12', '#ECF0F1'],
};

const DNA_NAMES: Record<string, string> = {
  Minimalist:     'Minimal Elegance',
  Streetwear:     'Urban Edge',
  'Old Money':    'Classic Refinement',
  'Smart Casual': 'Polished Ease',
  Bohemian:       'Free Spirit',
  Athleisure:     'Active Energy',
  'Avant-garde':  'Bold Vision',
};

const TRAITS: Record<string, string[]> = {
  Minimalist:     ['Sade hatlar', 'Kaliteli kumaş', 'Nötr tonlar', 'Zamansız'],
  Streetwear:     ['Oversize fit', 'Grafik baskı', 'Sneaker odaklı', 'Cesur'],
  'Old Money':    ['Klasik kesim', 'Doğal kumaş', 'Sakin palet', 'Şık'],
  'Smart Casual': ['Ofis uyumlu', 'Rahat kesim', 'Temiz görünüm', 'Çok yönlü'],
  Bohemian:       ['Akıcı kumaş', 'Renkli desen', 'Doğa ilhamlı', 'Özgür'],
  Athleisure:     ['Fonksiyonel', 'Sportif', 'Konfor öncelikli', 'Dinamik'],
  'Avant-garde':  ['Deneysel', 'Statement parça', 'Asimetri', 'Sanatsal'],
};

export default function StyleResultScreen({ route }: Props) {
  const { selectedStyles } = route.params;
  const setOnboarded = useUserStore((s) => s.setOnboarded);
  const setStyleProfile = useUserStore((s) => s.setStyleProfile);
  const user = useUserStore((s: { user: import('../../types').User | null }) => s.user);
  const [loading, setLoading] = useState(false);

  const primary = selectedStyles[0];
  const dnaName = DNA_NAMES[primary.name] ?? primary.name;
  const palette = PALETTE[primary.name] ?? PALETTE['Minimalist'];
  const traits = TRAITS[primary.name] ?? [];

  const breakdown = selectedStyles
    .map((s) => `%${s.weight} ${s.name}`)
    .join(' · ');

  const handleStart = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('style_profiles')
      .upsert(
        { user_id: user.id, styles: selectedStyles, color_palette: {} },
        { onConflict: 'user_id' },
      );

    if (error) {
      Alert.alert('Hata', 'Stil profili kaydedilemedi. Lütfen tekrar dene.');
      setLoading(false);
      return;
    }

    setStyleProfile({ styles: selectedStyles, colorPalette: palette });
    setOnboarded(true);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Stil DNA'm: ${dnaName} (${breakdown}) — Ne Giysem? ile keşfettim! 👗`,
    });
  };

  return (
    <LinearGradient
      colors={['#1A1A2E', '#0F3460', '#1A1A2E']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        {/* Badge */}
        <Text style={styles.badge}>STİL DNA KARTIN</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.dnaName}>{dnaName}</Text>
          <Text style={styles.breakdown}>{breakdown}</Text>

          {/* Color palette */}
          <View style={styles.paletteRow}>
            {palette.map((hex, i) => (
              <View key={i} style={[styles.paletteCircle, { backgroundColor: hex }]} />
            ))}
          </View>
          <Text style={styles.paletteLabel}>RENK PALETİN</Text>

          {/* Trait tags */}
          <View style={styles.traitsWrap}>
            {traits.map((t) => (
              <View key={t} style={styles.traitTag}>
                <Text style={styles.traitText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStart} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Dolabımı Oluştur →</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
            <Text style={styles.shareBtnText}>🤍  Paylaş</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  badge: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  dnaName: {
    fontSize: 28,
    fontFamily: fonts.headingBold,
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  breakdown: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
    textAlign: 'center',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  paletteLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  traitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  traitTag: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  traitText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 12px rgba(233,69,96,0.35)',
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  shareBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.5)',
  },
});

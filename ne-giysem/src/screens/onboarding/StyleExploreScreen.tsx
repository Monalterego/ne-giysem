import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';
import { STYLE_DATA_MAP } from '../../constants/styles';
import { STYLE_CARDS, type StyleCardData } from '../../constants/styleCards';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleExplore'>;

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W     = SW - 48;
const CARD_H     = Math.min(SH * 0.60, 480);
const SWIPE_THR  = 80;
const MIN_SWIPES = 15;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeScores(scores: Record<string, number>): StyleEntry[] {
  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) return [];
  entries.sort((a, b) => b[1] - a[1]);
  const top   = entries.slice(0, 3);
  const total = top.reduce((s, [, v]) => s + v, 0);
  const normalized = top.map(([name, v]) => ({
    name,
    weight: Math.round((v / total) * 100),
  }));
  const diff = 100 - normalized.reduce((s, e) => s + e.weight, 0);
  if (diff !== 0 && normalized.length > 0) {
    normalized[0] = { ...normalized[0], weight: normalized[0].weight + diff };
  }
  return normalized;
}

// ─── Moodboard render (her stil için özgün kompozisyon) ───────────────────────

function renderMoodboard(
  name: string,
  c1: string,
  c2: string,
  c3: string,
  w: number,
  h: number,
): React.ReactElement {
  switch (name) {
    /* ── Minimalist ─────────────────────────────── */
    case 'Minimalist':
      return (
        <View style={{ flex: 1, backgroundColor: '#F0EFE9' }}>
          <View style={{ position: 'absolute', top: h * 0.37, left: 36, right: 36, height: 0.6, backgroundColor: '#B0AFAA' }} />
          <View style={{ position: 'absolute', top: h * 0.47, left: 36, right: 36, height: 2.5, backgroundColor: '#2C2C2C' }} />
          <View style={{ position: 'absolute', top: h * 0.57, left: 36, right: 36, height: 0.6, backgroundColor: '#B0AFAA' }} />
          <View style={{ position: 'absolute', bottom: h * 0.2, right: 48, width: 36, height: 36, backgroundColor: '#2C2C2C' }} />
          <View style={{ position: 'absolute', top: h * 0.2, left: 48, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#B0AFAA' }} />
        </View>
      );

    /* ── Old Money ──────────────────────────────── */
    case 'Old Money':
      return (
        <View style={{ flex: 1, backgroundColor: '#1E2A3A' }}>
          <View style={{ position: 'absolute', top: -h * 0.35, left: w * 0.45, width: w * 0.55, height: h * 1.7, backgroundColor: '#C4A97D', opacity: 0.28, transform: [{ rotate: '-16deg' }] }} />
          {[0.24, 0.37, 0.50].map((y, i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: 44, width: 10, height: 10, borderRadius: 5, backgroundColor: '#C4A97D' }} />
          ))}
          <View style={{ position: 'absolute', top: h * 0.62, left: 36, right: 36, height: 1, backgroundColor: '#C4A97D', opacity: 0.45 }} />
          <View style={{ position: 'absolute', top: h * 0.65, left: 44, right: 80, height: 0.5, backgroundColor: '#7C6035', opacity: 0.5 }} />
        </View>
      );

    /* ── Quiet Luxury ───────────────────────────── */
    case 'Quiet Luxury':
      return (
        <LinearGradient colors={['#E6DDD3', '#C2B3A5']} style={{ flex: 1 }}>
          <View style={{ position: 'absolute', top: h * 0.08, left: w * 0.08, width: w * 0.84, height: w * 0.84, borderRadius: w * 0.42, backgroundColor: '#E6DDD3', opacity: 0.55 }} />
          <View style={{ position: 'absolute', top: h * 0.54, left: 44, right: 44, height: 0.8, backgroundColor: '#4A3F38', opacity: 0.25 }} />
          <View style={{ position: 'absolute', top: h * 0.57, left: 44, right: 44, height: 0.8, backgroundColor: '#4A3F38', opacity: 0.12 }} />
          <View style={{ position: 'absolute', bottom: h * 0.22, left: w / 2 - 18, width: 36, height: 5, backgroundColor: '#4A3F38', opacity: 0.45 }} />
        </LinearGradient>
      );

    /* ── Smart Casual ───────────────────────────── */
    case 'Smart Casual':
      return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={{ position: 'absolute', top: -h * 0.08, right: -w * 0.18, width: w * 0.88, height: w * 0.88, borderRadius: w * 0.44, backgroundColor: '#D6DDE8' }} />
          <View style={{ position: 'absolute', top: h * 0.42, left: 0, right: 0, height: h * 0.18, backgroundColor: '#1B4986' }} />
          <View style={{ position: 'absolute', top: h * 0.60, left: 0, right: 0, height: h * 0.045, backgroundColor: '#D6DDE8' }} />
          <View style={{ position: 'absolute', top: h * 0.22, left: 40, width: w * 0.3, height: 2, backgroundColor: '#1B4986', opacity: 0.3 }} />
        </View>
      );

    /* ── Clean Girl ─────────────────────────────── */
    case 'Clean Girl':
      return (
        <LinearGradient colors={['#F8E8D8', '#DEBB9B']} style={{ flex: 1 }}>
          <View style={{ position: 'absolute', top: h * 0.04, left: -w * 0.14, width: w * 0.72, height: w * 0.72, borderRadius: w * 0.36, backgroundColor: '#F8E8D8', opacity: 0.75 }} />
          <View style={{ position: 'absolute', top: h * 0.14, left: w * 0.12, width: w * 0.62, height: w * 0.62, borderRadius: w * 0.31, backgroundColor: '#DEBB9B', opacity: 0.45 }} />
          <View style={{ position: 'absolute', top: h * 0.24, right: -w * 0.08, width: w * 0.52, height: w * 0.52, borderRadius: w * 0.26, backgroundColor: '#B07D50', opacity: 0.22 }} />
          <View style={{ position: 'absolute', top: h * 0.48, left: w / 2 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#B07D50' }} />
        </LinearGradient>
      );

    /* ── Streetwear ─────────────────────────────── */
    case 'Streetwear':
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
          <View style={{ position: 'absolute', top: h * 0.18, left: 0, right: 0, height: h * 0.13, backgroundColor: '#FF4500' }} />
          <View style={{ position: 'absolute', top: h * 0.39, left: w / 2 - 38, width: 76, height: 76, backgroundColor: '#9E9E9E', transform: [{ rotate: '45deg' }] }} />
          <View style={{ position: 'absolute', bottom: h * 0.22, right: 52, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
          <View style={{ position: 'absolute', bottom: h * 0.17, left: 0, right: 0, height: 1, backgroundColor: '#FF4500', opacity: 0.35 }} />
        </View>
      );

    /* ── Athleisure ─────────────────────────────── */
    case 'Athleisure':
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
          <View style={{ position: 'absolute', top: h * 0.1, left: -w * 0.22, width: w * 0.78, height: w * 0.78, borderRadius: w * 0.39, backgroundColor: '#00C9A7', opacity: 0.82 }} />
          <View style={{ position: 'absolute', top: h * 0.55, left: 0, right: 0, height: 3, backgroundColor: '#E8E8E8', opacity: 0.88 }} />
          <View style={{ position: 'absolute', bottom: h * 0.18, right: 44, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#00C9A7' }} />
        </View>
      );

    /* ── Downtown Girl ──────────────────────────── */
    case 'Downtown Girl':
      return (
        <View style={{ flex: 1, backgroundColor: '#1C1C1C' }}>
          <View style={{ position: 'absolute', top: h * 0.1, left: 38, width: 4, height: h * 0.5, backgroundColor: '#C4A882' }} />
          <View style={{ position: 'absolute', top: h * 0.18, right: -w * 0.12, width: w * 0.68, height: w * 0.68, borderRadius: w * 0.34, backgroundColor: '#6B2D2D', opacity: 0.65 }} />
          <View style={{ position: 'absolute', top: h * 0.62, left: 36, right: 36, height: 0.8, backgroundColor: '#C4A882', opacity: 0.6 }} />
          <View style={{ position: 'absolute', top: h * 0.65, left: 36, right: 60, height: 0.4, backgroundColor: '#6B2D2D', opacity: 0.5 }} />
        </View>
      );

    /* ── Coquette ───────────────────────────────── */
    case 'Coquette':
      return (
        <LinearGradient colors={['#FFB3C6', '#FF6B9D']} style={{ flex: 1 }}>
          <View style={{ position: 'absolute', top: h * 0.04, left: w * 0.04, width: w * 0.92, height: w * 0.92, borderRadius: w * 0.46, backgroundColor: '#FFFFFF', opacity: 0.18 }} />
          {/* Bow left */}
          <View style={{ position: 'absolute', top: h * 0.3, left: w * 0.08, width: w * 0.34, height: w * 0.22, borderRadius: 10, backgroundColor: '#FFFFFF', opacity: 0.88, transform: [{ rotate: '-18deg' }] }} />
          {/* Bow right */}
          <View style={{ position: 'absolute', top: h * 0.3, right: w * 0.08, width: w * 0.34, height: w * 0.22, borderRadius: 10, backgroundColor: '#FFFFFF', opacity: 0.88, transform: [{ rotate: '18deg' }] }} />
          {/* Center knot */}
          <View style={{ position: 'absolute', top: h * 0.36, left: w / 2 - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', opacity: 0.95 }} />
          {/* Scatter dots */}
          {([[0.18, 0.18], [0.72, 0.22], [0.14, 0.62], [0.76, 0.58]] as [number, number][]).map(([x, y], i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: w * x, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF1461', opacity: 0.65 }} />
          ))}
        </LinearGradient>
      );

    /* ── Soft Girl ──────────────────────────────── */
    case 'Soft Girl':
      return (
        <View style={{ flex: 1, backgroundColor: '#FDDDE6' }}>
          <View style={{ position: 'absolute', top: h * 0.06, left: w * 0.1, width: w * 0.8, height: w * 0.8, borderRadius: w * 0.4, backgroundColor: '#FFFFFF', opacity: 0.65 }} />
          <View style={{ position: 'absolute', top: h * 0.14, left: w * 0.14, width: 28, height: 28, borderRadius: 14, backgroundColor: '#C8A4D4', opacity: 0.8 }} />
          <View style={{ position: 'absolute', top: h * 0.5, right: w * 0.18, width: 18, height: 18, borderRadius: 9, backgroundColor: '#C8A4D4', opacity: 0.8 }} />
          <View style={{ position: 'absolute', top: h * 0.34, right: w * 0.1, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#F9C8D4', opacity: 0.9 }} />
          <View style={{ position: 'absolute', top: h * 0.42, left: w / 2 - 22, width: 44, height: 44, backgroundColor: '#FF9EC8', opacity: 0.55, transform: [{ rotate: '45deg' }] }} />
        </View>
      );

    /* ── Bohemian ───────────────────────────────── */
    case 'Bohemian':
      return (
        <LinearGradient colors={['#C0622D', '#6B3E2E']} style={{ flex: 1 }}>
          <View style={{ position: 'absolute', top: h * 0.04, left: w * 0.04, width: w * 0.6, height: h * 0.48, borderRadius: w * 0.3, backgroundColor: '#D4A055', opacity: 0.38 }} />
          <View style={{ position: 'absolute', top: h * 0.22, right: w * 0.04, width: w * 0.44, height: h * 0.34, borderRadius: w * 0.22, backgroundColor: '#D4A055', opacity: 0.22, transform: [{ rotate: '-28deg' }] }} />
          <View style={{ position: 'absolute', top: h * 0.45, left: w / 2 - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#D4A055' }} />
          {[0.64, 0.67, 0.70].map((y, i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: 44, right: 44, height: 0.7, backgroundColor: '#D4A055', opacity: 0.45 - i * 0.1 }} />
          ))}
        </LinearGradient>
      );

    /* ── Cottagecore ────────────────────────────── */
    case 'Cottagecore':
      return (
        <View style={{ flex: 1, backgroundColor: '#7DB87D' }}>
          {/* Sky */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h * 0.46, backgroundColor: '#E8D5B7' }} />
          {/* Sun */}
          <View style={{ position: 'absolute', top: h * 0.09, left: w * 0.14, width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', opacity: 0.88 }} />
          {/* Window */}
          <View style={{ position: 'absolute', top: h * 0.11, right: 44, width: 48, height: 62, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 3, borderColor: '#C4827A', backgroundColor: 'transparent' }} />
          {/* Stems */}
          {[0.3, 0.44, 0.58].map((x, i) => (
            <View key={i} style={{ position: 'absolute', top: h * 0.42, left: w * x, width: 3, height: h * 0.22, backgroundColor: '#7DB87D' }} />
          ))}
        </View>
      );

    /* ── Coastal Grandmother ────────────────────── */
    case 'Coastal Grandmother':
      return (
        <View style={{ flex: 1, backgroundColor: '#4A6FA5' }}>
          {/* Linen bottom */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: h * 0.36, backgroundColor: '#F5F0E8' }} />
          {/* Wave curve */}
          <View style={{ position: 'absolute', bottom: h * 0.33, left: -16, right: -16, height: 52, borderTopLeftRadius: 120, borderTopRightRadius: 120, backgroundColor: '#F5F0E8' }} />
          {/* Ocean circle */}
          <View style={{ position: 'absolute', top: h * 0.14, right: 40, width: 68, height: 68, borderRadius: 34, backgroundColor: '#3A5A8C', opacity: 0.55 }} />
          {/* Horizon lines */}
          {[0.53, 0.56, 0.59].map((y, i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: 42 + i * 8, right: 42, height: 1, backgroundColor: '#BDB5A6', opacity: 0.55 }} />
          ))}
        </View>
      );

    /* ── Dark Academia ──────────────────────────── */
    case 'Dark Academia':
      return (
        <View style={{ flex: 1, backgroundColor: '#2C1810' }}>
          {/* Arched window glow */}
          <View style={{ position: 'absolute', top: h * 0.08, left: w / 2 - 48, width: 96, height: 140, borderTopLeftRadius: 48, borderTopRightRadius: 48, backgroundColor: '#D4C5A9', opacity: 0.16 }} />
          {/* Book body */}
          <View style={{ position: 'absolute', top: h * 0.37, left: w * 0.2, width: 68, height: 92, backgroundColor: '#8B4513', opacity: 0.85, borderRadius: 4 }} />
          {/* Book spine */}
          <View style={{ position: 'absolute', top: h * 0.37, left: w * 0.2 + 3, width: 3, height: 92, backgroundColor: '#D4C5A9', opacity: 0.45 }} />
          {/* Warm glow */}
          <View style={{ position: 'absolute', top: h * 0.13, right: w * 0.14, width: 50, height: 50, borderRadius: 25, backgroundColor: '#8B4513', opacity: 0.45 }} />
          {[0.64, 0.67].map((y, i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: 28, right: 28, height: 0.8, backgroundColor: '#D4C5A9', opacity: 0.28 }} />
          ))}
        </View>
      );

    /* ── Y2K ────────────────────────────────────── */
    case 'Y2K':
      return (
        <LinearGradient colors={['#FF69B4', '#87CEEB']} style={{ flex: 1 }}>
          {/* Large diamond */}
          <View style={{ position: 'absolute', top: h * 0.18, left: w / 2 - 68, width: 136, height: 136, backgroundColor: '#FFFFFF', opacity: 0.88, transform: [{ rotate: '45deg' }] }} />
          {/* Star dots */}
          {([[0.14, 0.14], [0.78, 0.18], [0.11, 0.64], [0.80, 0.58], [0.48, 0.07]] as [number, number][]).map(([x, y], i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: w * x, width: 11, height: 11, backgroundColor: '#FFFFFF', opacity: 0.88, transform: [{ rotate: '45deg' }] }} />
          ))}
          {/* Purple circle */}
          <View style={{ position: 'absolute', bottom: h * 0.14, right: w * 0.1, width: 38, height: 38, borderRadius: 19, backgroundColor: '#BF40BF', opacity: 0.72 }} />
        </LinearGradient>
      );

    /* ── Grunge Chic ────────────────────────────── */
    case 'Grunge Chic':
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1A1A' }}>
          {/* Tilted grey block */}
          <View style={{ position: 'absolute', top: h * 0.18, left: -24, width: w * 0.84, height: h * 0.44, backgroundColor: '#5C5C5C', opacity: 0.45, transform: [{ rotate: '-7deg' }] }} />
          {/* Dark red slash */}
          <View style={{ position: 'absolute', top: h * 0.08, right: w * 0.22, width: 5, height: h * 0.56, backgroundColor: '#8B1A1A', transform: [{ rotate: '-38deg' }] }} />
          {/* Scratch lines */}
          <View style={{ position: 'absolute', top: h * 0.55, left: 28, right: 28, height: 1, backgroundColor: '#FFFFFF', opacity: 0.18 }} />
          <View style={{ position: 'absolute', top: h * 0.58, left: 44, right: 64, height: 0.5, backgroundColor: '#FFFFFF', opacity: 0.10 }} />
        </View>
      );

    /* ── Mob Wife ───────────────────────────────── */
    case 'Mob Wife':
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
          {/* Gold fur circle */}
          <View style={{ position: 'absolute', top: h * 0.04, left: -w * 0.14, width: w * 0.88, height: w * 0.88, borderRadius: w * 0.44, backgroundColor: '#8B7355', opacity: 0.45 }} />
          {/* Crimson band */}
          <View style={{ position: 'absolute', top: h * 0.42, left: 0, right: 0, height: h * 0.14, backgroundColor: '#C41E3A' }} />
          {/* Leopard spots */}
          {([[0.28, 0.26], [0.58, 0.33], [0.44, 0.21]] as [number, number][]).map(([x, y], i) => (
            <View key={i} style={{ position: 'absolute', top: h * y, left: w * x, width: 18 + i * 6, height: 11 + i * 3, borderRadius: 8, backgroundColor: '#0D0D0D', opacity: 0.75, transform: [{ rotate: `${i * 20 - 15}deg` }] }} />
          ))}
        </View>
      );

    /* ── Avant-garde ────────────────────────────── */
    case 'Avant-garde':
      return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          {/* Off-center white block */}
          <View style={{ position: 'absolute', top: h * 0.16, left: -18, width: w * 0.62, height: h * 0.42, backgroundColor: '#E8E8E8' }} />
          {/* Red slash */}
          <View style={{ position: 'absolute', top: 0, right: w * 0.28, width: 6, height: h * 0.72, backgroundColor: '#FF0040', transform: [{ rotate: '-19deg' }] }} />
          {/* Black square on white */}
          <View style={{ position: 'absolute', top: h * 0.28, left: w * 0.06, width: 28, height: 28, backgroundColor: '#000000' }} />
          {/* White bar right */}
          <View style={{ position: 'absolute', top: h * 0.62, right: 28, width: w * 0.26, height: 3, backgroundColor: '#E8E8E8' }} />
        </View>
      );

    /* ── Preppy ─────────────────────────────────── */
    case 'Preppy':
      return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          {/* Navy top band */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h * 0.36, backgroundColor: '#1B3A8C' }} />
          {/* Red stripe */}
          <View style={{ position: 'absolute', top: h * 0.36, left: 0, right: 0, height: h * 0.065, backgroundColor: '#C41E3A' }} />
          {/* Navy diamond */}
          <View style={{ position: 'absolute', top: h * 0.49, left: w / 2 - 27, width: 54, height: 54, backgroundColor: '#1B3A8C', transform: [{ rotate: '45deg' }] }} />
          {/* Red dot in navy */}
          <View style={{ position: 'absolute', top: h * 0.17, right: 46, width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#C41E3A' }} />
          {/* White line in navy */}
          <View style={{ position: 'absolute', top: h * 0.22, left: 36, width: w * 0.33, height: 2, backgroundColor: '#FFFFFF', opacity: 0.35 }} />
        </View>
      );

    /* ── Gorpcore ───────────────────────────────── */
    case 'Gorpcore':
      return (
        <View style={{ flex: 1, backgroundColor: '#3D4A2E' }}>
          {/* Sun */}
          <View style={{ position: 'absolute', top: h * 0.1, right: 42, width: 68, height: 68, borderRadius: 34, backgroundColor: '#D4892C' }} />
          {/* Topographic rings */}
          {([1, 0.78, 0.58] as number[]).map((scale, i) => (
            <View key={i} style={{
              position: 'absolute',
              top:  h * (0.32 + i * 0.04),
              left: w * (0.08 - i * 0.02),
              width:  w * scale * 0.82,
              height: h * 0.27 * scale,
              borderRadius: w * 0.42,
              borderWidth: 1.2,
              borderColor: '#D4892C',
              opacity: 0.35 + i * 0.12,
              backgroundColor: 'transparent',
            }} />
          ))}
          {/* Brown band */}
          <View style={{ position: 'absolute', bottom: h * 0.17, left: 0, right: 0, height: h * 0.065, backgroundColor: '#8B7355', opacity: 0.5 }} />
        </View>
      );

    default:
      return <View style={{ flex: 1, backgroundColor: c1 }} />;
  }
}

// ─── MoodboardCard bileşeni ────────────────────────────────────────────────────

function MoodboardCard({
  name,
  keywords,
  cardWidth,
  cardHeight,
}: {
  name: string;
  keywords: [string, string, string];
  cardWidth: number;
  cardHeight: number;
}) {
  const data  = STYLE_DATA_MAP[name];
  const [c1, c2, c3] = data?.palette ?? ['#E0E0E0', '#B0B0B0', '#606060'];

  return (
    <View style={{ width: cardWidth, height: cardHeight, borderRadius: 24, overflow: 'hidden' }}>
      {renderMoodboard(name, c1, c2, c3, cardWidth, cardHeight)}

      {/* Alt bilgi overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={[StyleSheet.absoluteFill, cardInfoStyle]}
      >
        <View style={infoRow}>
          <Text style={emojiStyle}>{data?.emoji ?? '✨'}</Text>
          <Text style={nameStyle}>{name}</Text>
        </View>
        <Text style={kwStyle}>{keywords.join(' · ')}</Text>
      </LinearGradient>
    </View>
  );
}

const cardInfoStyle: import('react-native').ViewStyle = { justifyContent: 'flex-end', padding: 22 };
const infoRow:       import('react-native').ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 };
const emojiStyle:    import('react-native').TextStyle = { fontSize: 28 };
const nameStyle:     import('react-native').TextStyle = { fontSize: 22, fontFamily: fonts.headingBold, color: '#FFFFFF', flexShrink: 1 };
const kwStyle:       import('react-native').TextStyle = { fontSize: 12, fontFamily: fonts.body, color: 'rgba(255,255,255,0.78)' };

// ─── Ana ekran ─────────────────────────────────────────────────────────────────

export default function StyleExploreScreen({ navigation }: Props) {
  const [cards] = useState<StyleCardData[]>(() => shuffleArray([...STYLE_CARDS]));

  const cardIndexRef   = useRef(0);
  const swipeCountRef  = useRef(0);
  const likedIndices   = useRef(new Set<number>());
  const isAnimatingRef = useRef(false);

  const [displayIndex, setDisplayIndex] = useState(0);
  const [swipeCount,   setSwipeCount]   = useState(0);

  const pan = useRef(new Animated.ValueXY()).current;

  const rotation = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-14deg', '0deg', '14deg'],
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, 50, 90],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const passOpacity = pan.x.interpolate({
    inputRange: [-90, -50, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const backScale = pan.x.interpolate({
    inputRange: [-SWIPE_THR, 0, SWIPE_THR],
    outputRange: [1, 0.94, 1],
    extrapolate: 'clamp',
  });

  const handleSwipeRef = useRef<(liked: boolean) => void>(() => undefined);

  const handleSwipe = useCallback(
    (liked: boolean) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      if (liked) likedIndices.current.add(cardIndexRef.current);

      Animated.timing(pan, {
        toValue: { x: liked ? 620 : -620, y: 0 },
        duration: 290,
        useNativeDriver: true,
      }).start(() => {
        pan.setValue({ x: 0, y: 0 });

        const newCount = swipeCountRef.current + 1;
        const newIdx   = cardIndexRef.current + 1;
        swipeCountRef.current = newCount;
        cardIndexRef.current  = newIdx;
        isAnimatingRef.current = false;

        if (newCount >= MIN_SWIPES || newIdx >= cards.length) {
          const finalScores: Record<string, number> = {};
          for (const idx of likedIndices.current) {
            const n = cards[idx].name;
            finalScores[n] = (finalScores[n] ?? 0) + 2;
          }
          const entries = normalizeScores(finalScores);
          navigation.navigate('StyleResult', {
            selectedStyles: entries.length > 0 ? entries : [{ name: 'Minimalist', weight: 100 }],
          });
        } else {
          setDisplayIndex(newIdx);
          setSwipeCount(newCount);
        }
      });
    },
    [cards, navigation, pan],
  );

  handleSwipeRef.current = handleSwipe;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimatingRef.current,
      onMoveShouldSetPanResponder:  () => !isAnimatingRef.current,
      onPanResponderMove: (_, g) => {
        if (isAnimatingRef.current) return;
        pan.setValue({ x: g.dx, y: g.dy * 0.1 });
      },
      onPanResponderRelease: (_, g) => {
        if (isAnimatingRef.current) return;
        if (g.dx > SWIPE_THR) {
          handleSwipeRef.current(true);
        } else if (g.dx < -SWIPE_THR) {
          handleSwipeRef.current(false);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            tension: 180,
            friction: 12,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!isAnimatingRef.current) pan.setValue({ x: 0, y: 0 });
      },
    }),
  ).current;

  const currentCard = cards[displayIndex];
  const nextCard    = cards[displayIndex + 1];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.badge}>YOL C · KEŞİF MODU</Text>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{swipeCount} / {MIN_SWIPES}</Text>
        </View>
      </View>

      <Text style={styles.swipeHint}>Beğen → sağa · Geç → sola</Text>

      {/* Kart yığını */}
      <View style={styles.stackArea}>
        {/* Arka kart */}
        {nextCard && (
          <Animated.View
            style={[styles.cardSlot, { transform: [{ scale: backScale }, { translateY: 12 }], opacity: 0.72, zIndex: 0 }]}
          >
            <MoodboardCard
              name={nextCard.name}
              keywords={nextCard.keywords}
              cardWidth={CARD_W}
              cardHeight={CARD_H}
            />
          </Animated.View>
        )}

        {/* Ön kart (etkileşimli) */}
        <Animated.View
          style={[
            styles.cardSlot,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: rotation },
              ],
              zIndex: 1,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Beğeni göstergesi */}
          <Animated.View style={[styles.indicator, styles.likeInd, { opacity: likeOpacity }]}>
            <Text style={styles.indText}>❤️</Text>
          </Animated.View>
          {/* Geç göstergesi */}
          <Animated.View style={[styles.indicator, styles.passInd, { opacity: passOpacity }]}>
            <Text style={styles.indText}>✕</Text>
          </Animated.View>

          <MoodboardCard
            name={currentCard.name}
            keywords={currentCard.keywords}
            cardWidth={CARD_W}
            cardHeight={CARD_H}
          />
        </Animated.View>
      </View>

      {/* Alt butonlar */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.passBtn]}
          onPress={() => handleSwipe(false)}
          activeOpacity={0.82}
        >
          <Text style={styles.actionBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.tapHint}>veya swipe yap</Text>

        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={() => handleSwipe(true)}
          activeOpacity={0.82}
        >
          <Text style={styles.actionBtnText}>❤️</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 4,
  },
  badge: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    letterSpacing: 1.8,
  },
  counterPill: {
    backgroundColor: colors.surface ?? '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  swipeHint: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 14,
  },
  stackArea: {
    height: CARD_H + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlot: {
    position: 'absolute',
    width: CARD_W,
    boxShadow: '0 8px 24px rgba(26,26,46,0.18)',
    elevation: 8,
    borderRadius: 24,
  },
  indicator: {
    position: 'absolute',
    top: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 3,
  },
  likeInd: {
    right: 20,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  passInd: {
    left: 20,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  indText: {
    fontSize: 28,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  actionBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(26,26,46,0.14)',
    elevation: 4,
  },
  passBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  likeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#22C55E',
  },
  actionBtnText: {
    fontSize: 26,
  },
  tapHint: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#CCCCCC',
    flex: 1,
    textAlign: 'center',
  },
});

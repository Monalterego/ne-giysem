import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PhysicalProfile'>;

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = spacing.xs + 2;
const GRID_W   = (SCREEN_W - layout.screenPaddingH * 2 - GRID_GAP) / 2;

// ─── Sabit veriler ────────────────────────────────────────────────────────────

const BODY_TYPES = [
  { key: 'hourglass', name: 'Kum Saati',  desc: 'Omuz ve kalça geniş, bel ince' },
  { key: 'pear',      name: 'Armut',       desc: 'Kalça omuzdan geniş' },
  { key: 'apple',     name: 'Elma',        desc: 'Orta bölge dolgun' },
  { key: 'rectangle', name: 'Dikdörtgen',  desc: 'Omuz-bel-kalça düz' },
  { key: 'triangle',  name: 'Üçgen',       desc: 'Omuz geniş, kalça dar' },
] as const;

const SKIN_TONES = [
  { key: 'very_light', color: '#F5E6D3' },
  { key: 'light',      color: '#E8C9A0' },
  { key: 'wheat',      color: '#C8956C' },
  { key: 'medium',     color: '#A0674A' },
  { key: 'tan',        color: '#7B4A2D' },
  { key: 'dark',       color: '#4A2810' },
] as const;

const HAIR_COLORS = [
  { key: 'black',       color: '#1A1A1A' },
  { key: 'dark_brown',  color: '#3B1F0A' },
  { key: 'brown',       color: '#6B3A2A' },
  { key: 'light_brown', color: '#A0522D' },
  { key: 'honey',       color: '#C8A96E' },
  { key: 'red',         color: '#8B3A2A' },
  { key: 'gray',        color: '#C4C4C4' },
  { key: 'colored',     color: '#E040FB' },
] as const;

const HAIR_LENGTHS = [
  { key: 'short',     name: 'Kısa' },
  { key: 'medium',    name: 'Orta' },
  { key: 'long',      name: 'Uzun' },
  { key: 'very_long', name: 'Çok Uzun' },
] as const;

const HAIR_TYPES = [
  { key: 'straight', name: 'Düz' },
  { key: 'wavy',     name: 'Dalgalı' },
  { key: 'curly',    name: 'Kıvırcık' },
  { key: 'afro',     name: 'Afro' },
] as const;

// ─── NumberStepper bileşeni ───────────────────────────────────────────────────

function NumberStepper({
  value,
  unit,
  onDecrement,
  onIncrement,
}: {
  value: number;
  unit?: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={stepperStyles.row}>
      <TouchableOpacity style={stepperStyles.btn} onPress={onDecrement} activeOpacity={0.8}>
        <Feather name="minus" size={18} color={colors.white} />
      </TouchableOpacity>

      <View style={stepperStyles.center}>
        <Text style={stepperStyles.value}>{value}</Text>
        {unit ? <Text style={stepperStyles.unit}>{unit}</Text> : null}
      </View>

      <TouchableOpacity style={stepperStyles.btn} onPress={onIncrement} activeOpacity={0.8}>
        <Feather name="plus" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    minWidth: 100,
  },
  value: {
    ...typography.hero,
    color: colors.text,
  },
  unit: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: -spacing.xs,
  },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function PhysicalProfileScreen(_: Props) {
  const user         = useUserStore((s) => s.user);
  const setOnboarded = useUserStore((s) => s.setOnboarded);

  const [height,     setHeight]     = useState(165);
  const [age,        setAge]        = useState(25);
  const [bodyType,   setBodyType]   = useState<string | null>(null);
  const [skinTone,   setSkinTone]   = useState<string | null>(null);
  const [hairColor,  setHairColor]  = useState<string | null>(null);
  const [hairLength, setHairLength] = useState<string | null>(null);
  const [hairType,   setHairType]   = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({
          height,
          age,
          body_type:   bodyType,
          skin_tone:   skinTone,
          hair_color:  hairColor,
          hair_length: hairLength,
          hair_type:   hairType,
        })
        .eq('id', user.id);
      if (error) {
        Alert.alert('Hata', 'Profil kaydedilemedi. Lütfen tekrar dene.');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setOnboarded(true);
  };

  const handleSkip = () => setOnboarded(true);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Fiziksel Profilin</Text>
        <Text style={styles.subtitle}>Kombinler sana daha iyi uysun diye</Text>

        {/* ── Boy ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BOY</Text>
          <NumberStepper
            value={height}
            unit="cm"
            onDecrement={() => setHeight((v) => Math.max(150, v - 1))}
            onIncrement={() => setHeight((v) => Math.min(195, v + 1))}
          />
        </View>

        {/* ── Yaş ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YAŞ</Text>
          <NumberStepper
            value={age}
            onDecrement={() => setAge((v) => Math.max(16, v - 1))}
            onIncrement={() => setAge((v) => Math.min(80, v + 1))}
          />
        </View>

        {/* ── Vücut Tipi ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VÜCUT TİPİ</Text>
          {BODY_TYPES.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.listCard, bodyType === item.key && styles.listCardSelected]}
              onPress={() => setBodyType(item.key)}
              activeOpacity={0.78}
            >
              <View style={styles.listCardInfo}>
                <Text style={styles.listCardName}>{item.name}</Text>
                <Text style={styles.listCardDesc}>{item.desc}</Text>
              </View>
              {bodyType === item.key && <View style={styles.selectedDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Ten Rengi ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEN RENGİ</Text>
          <View style={styles.circleRowSpread}>
            {SKIN_TONES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.circleWrapper48, skinTone === item.key && styles.circleWrapperSelected]}
                onPress={() => setSkinTone(item.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.circle48, { backgroundColor: item.color }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Saç Rengi ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAÇ RENGİ</Text>
          <View style={styles.circleRowWrap}>
            {HAIR_COLORS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.circleWrapper40, hairColor === item.key && styles.circleWrapperSelected]}
                onPress={() => setHairColor(item.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.circle40, { backgroundColor: item.color }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Saç Uzunluğu ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAÇ UZUNLUĞU</Text>
          <View style={styles.gridRow}>
            {HAIR_LENGTHS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.gridCard, hairLength === item.key && styles.gridCardSelected]}
                onPress={() => setHairLength(item.key)}
                activeOpacity={0.78}
              >
                <Text style={[styles.gridCardText, hairLength === item.key && styles.gridCardTextSelected]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Saç Tipi ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAÇ TİPİ</Text>
          <View style={styles.gridRow}>
            {HAIR_TYPES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.gridCard, hairType === item.key && styles.gridCardSelected]}
                onPress={() => setHairType(item.key)}
                activeOpacity={0.78}
              >
                <Text style={[styles.gridCardText, hairType === item.key && styles.gridCardTextSelected]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>Devam Et →</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Şimdi değil, atla →</Text>
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
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
    paddingBottom: 140,
  },

  // Başlık
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // Bölüm
  section: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // ── Liste kartları (vücut tipi) ──────────────────────────────────────────────
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 3,
    marginBottom: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  listCardSelected: {
    borderColor: colors.text,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  listCardInfo: {
    flex: 1,
    gap: 2,
  },
  listCardName: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  listCardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },

  // ── Renk daireleri — seçim halkası ──────────────────────────────────────────
  circleWrapperSelected: {
    borderColor: colors.text,
  },

  // Ten rengi — 6 daire, 48px, tek satır
  circleRowSpread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleWrapper48: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  circle48: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
  },

  // Saç rengi — 8 daire, 40px, wrap (2 satır)
  circleRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  circleWrapper40: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  circle40: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },

  // ── 2×2 grid kartlar (saç uzunluğu, saç tipi) ───────────────────────────────
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCard: {
    width: GRID_W,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  gridCardSelected: {
    borderColor: colors.text,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  gridCardText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  gridCardTextSelected: {
    fontFamily: fonts.bodyBold,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
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
    gap: spacing.sm,
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
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  skipBtnText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});

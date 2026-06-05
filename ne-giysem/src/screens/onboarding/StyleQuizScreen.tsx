import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts, spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleQuiz'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = (SCREEN_WIDTH - 48 - 12) / 2; // 2×24 padding + 12 gap

// ─── Tipler ───────────────────────────────────────────────────────────────────

type GroupName = 'Zamansız' | 'Feminen' | 'Edgy' | 'Günlük & Rahat' | 'Diğer';

interface StyleOption { label: string; scores: { style: string; pts: number }[]; }
interface GroupOption { label: string; group: GroupName; }
interface GroupQuestion { question: string; options: GroupOption[]; }
interface StyleQuestion { question: string; options: StyleOption[]; }

// ─── Katman 1: Grup soruları (herkese sorulur) ────────────────────────────────

const GROUP_QUESTIONS: GroupQuestion[] = [
  {
    question: 'Giyinirken kendini en çok\nnasıl hissetmek istersin?',
    options: [
      { label: 'Sakin, zarif, zamansız', group: 'Zamansız' },
      { label: 'Rahat, pratik, özgür', group: 'Günlük & Rahat' },
      { label: 'Yumuşak, romantik, narin', group: 'Feminen' },
      { label: 'Cesur, dramatik, dikkat çekici', group: 'Edgy' },
      { label: 'İşlevsel, özgün, kuralsız', group: 'Diğer' },
    ],
  },
  {
    question: 'Hangi renk dünyası\nseni içine çeker?',
    options: [
      { label: 'Nötr: bej, krem, gri, siyah-beyaz', group: 'Zamansız' },
      { label: 'Spor & şehir: siyah, gri, neon aksan', group: 'Günlük & Rahat' },
      { label: 'Pastel & yumuşak: pembe, lila, toprak', group: 'Feminen' },
      { label: 'Koyu & metalik: siyah, bordo, gümüş', group: 'Edgy' },
      { label: 'Doğa & fonksiyon: haki, kahve, turuncu', group: 'Diğer' },
    ],
  },
  {
    question: 'Kendini en çok\nnerede hayal edersin?',
    options: [
      { label: 'Şehir merkezi, ofis, klasik mekânlar', group: 'Zamansız' },
      { label: 'Sokak, spor salonu, hareketli şehir', group: 'Günlük & Rahat' },
      { label: 'Doğa, bahçe, romantik kaçamak', group: 'Feminen' },
      { label: 'Gece hayatı, sanat galerisi, konser', group: 'Edgy' },
      { label: 'Dağ, kamp, kampüs, açık hava', group: 'Diğer' },
    ],
  },
];

// ─── Katman 2: Stil soruları — PARÇA 2'de doldurulacak ───────────────────────

const STYLE_QUESTIONS: Record<GroupName, StyleQuestion[]> = {
  'Zamansız':      [],
  'Feminen':       [],
  'Edgy':          [],
  'Günlük & Rahat': [],
  'Diğer':         [],
};

// ─── normalizeScores (korundu) ────────────────────────────────────────────────

function normalizeScores(scores: Record<string, number>): StyleEntry[] {
  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) return [];

  entries.sort((a, b) => b[1] - a[1]);
  const top   = entries.slice(0, 3);
  const total = top.reduce((sum, [, v]) => sum + v, 0);

  const normalized: StyleEntry[] = top.map(([name, v]) => ({
    name,
    weight: Math.round((v / total) * 100),
  }));

  const sum = normalized.reduce((s, e) => s + e.weight, 0);
  if (sum !== 100 && normalized.length > 0) {
    normalized[0] = { ...normalized[0], weight: normalized[0].weight + (100 - sum) };
  }

  return normalized;
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StyleQuizScreen({ navigation }: Props) {
  const [phase,          setPhase]          = useState<'group' | 'style'>('group');
  const [groupScores,    setGroupScores]    = useState<Record<string, number>>({});
  const [styleScores,    setStyleScores]    = useState<Record<string, number>>({});
  const [activeGroup,    setActiveGroup]    = useState<GroupName | null>(null);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const styleQs   = activeGroup ? STYLE_QUESTIONS[activeGroup] : [];
  const questions = phase === 'group' ? GROUP_QUESTIONS : styleQs;
  const question  = questions[currentIndex] as GroupQuestion | StyleQuestion | undefined;

  const advanceWithFade = useCallback((callback: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const handleOption = (optionIndex: number) => {
    if (selectedOption !== null || !question) return;
    setSelectedOption(optionIndex);

    if (phase === 'group') {
      const opt = (question as GroupQuestion).options[optionIndex];
      const ng  = { ...groupScores };
      ng[opt.group] = (ng[opt.group] ?? 0) + 3;
      setGroupScores(ng);

      setTimeout(() => {
        if (currentIndex < GROUP_QUESTIONS.length - 1) {
          advanceWithFade(() => {
            setCurrentIndex((i) => i + 1);
            setSelectedOption(null);
          });
        } else {
          const winner = (
            Object.entries(ng).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Zamansız'
          ) as GroupName;
          advanceWithFade(() => {
            setActiveGroup(winner);
            setPhase('style');
            setCurrentIndex(0);
            setSelectedOption(null);
          });
        }
      }, 380);
    } else {
      const opt = (question as StyleQuestion).options[optionIndex];
      const ns  = { ...styleScores };
      for (const s of opt.scores) ns[s.style] = (ns[s.style] ?? 0) + s.pts;
      setStyleScores(ns);

      const qs = activeGroup ? STYLE_QUESTIONS[activeGroup] : [];
      setTimeout(() => {
        if (currentIndex < qs.length - 1) {
          advanceWithFade(() => {
            setCurrentIndex((i) => i + 1);
            setSelectedOption(null);
          });
        } else {
          const entries = normalizeScores(ns);
          const final   = entries.length > 0 ? entries : [{ name: 'Minimalist', weight: 100 }];
          navigation.navigate('StyleResult', { selectedStyles: final });
        }
      }, 380);
    }
  };

  // İlerleme çubuğu: grup fazı 0–50%, stil fazı 50–100%
  const progressPct = phase === 'group'
    ? `${((currentIndex + 1) / GROUP_QUESTIONS.length) * 50}%`
    : `${50 + ((currentIndex + 1) / Math.max(styleQs.length, 1)) * 50}%`;

  const counterText = phase === 'group'
    ? `${currentIndex + 1} / 3 · Yön belirleniyor`
    : `${currentIndex + 1} / ${styleQs.length} · ${activeGroup ?? ''}`;

  // 5 seçenekli grup kartları için dikey liste; 4 seçenekli stil kartları için 2×2 grid
  const isList = question ? question.options.length > 4 : false;

  if (!question) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>

      {/* İlerleme çubuğu */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressPct as `${number}%` }]} />
      </View>

      <View style={styles.container}>
        {/* Sayaç */}
        <Text style={styles.counter}>{counterText}</Text>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Soru */}
          <Text style={styles.question}>{question.question}</Text>

          {/* Seçenekler */}
          <View style={isList ? styles.listGrid : styles.grid}>
            {question.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    isList ? styles.optionCardFull : styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => handleOption(i)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <Text style={styles.hint}>Seç ve otomatik ilerle</Text>
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
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  counter: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: 18,
    textAlign: 'center',
  },
  question: {
    fontSize: 22,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 30,
  },

  // 2×2 grid — stil soruları (4 seçenek)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },

  // Dikey liste — grup soruları (5 seçenek)
  listGrid: {
    gap: 10,
  },
  optionCardFull: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  optionCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2.5,
    backgroundColor: '#F5F4F2',
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 17,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
  },
  hint: {
    marginTop: 28,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#BBBBBB',
    textAlign: 'center',
  },
});

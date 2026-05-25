import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleQuiz'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = (SCREEN_WIDTH - 48 - 12) / 2; // 2×24 padding + 12 gap

interface QuizOption {
  label: string;
  emoji: string;
  tags: string[];
}

interface QuizQuestion {
  question: string;
  options: [QuizOption, QuizOption, QuizOption, QuizOption];
}

const QUIZ: QuizQuestion[] = [
  {
    question: 'Pazar sabahı kahvaltıya\nne giyersin?',
    options: [
      { label: 'Beyaz tişört\n+ linen pantolon', emoji: '🤍', tags: ['Minimalist', 'Clean Girl'] },
      { label: 'Oversized hoodie\n+ track pants', emoji: '🧢', tags: ['Athleisure', 'Streetwear'] },
      { label: 'Çiçekli midi elbise\n+ sandalet', emoji: '🌸', tags: ['Soft Girl', 'Cottagecore', 'Bohemian'] },
      { label: 'Deri ceket\n+ skinny jean', emoji: '🖤', tags: ['Grunge Chic', 'Downtown Girl'] },
    ],
  },
  {
    question: 'Hangi renk paletine\nçekilirsin?',
    options: [
      { label: 'Nötr\ntonlar', emoji: '🤍', tags: ['Minimalist', 'Quiet Luxury', 'Clean Girl', 'Coastal Grandmother'] },
      { label: 'Pastel\nrenkler', emoji: '🌷', tags: ['Soft Girl', 'Coquette', 'Y2K'] },
      { label: 'Koyu &\ndramatik', emoji: '🌑', tags: ['Dark Academia', 'Grunge Chic', 'Downtown Girl', 'Mob Wife'] },
      { label: 'Canlı &\ncesur', emoji: '🎨', tags: ['Streetwear', 'Y2K', 'Avant-garde', 'Bohemian'] },
    ],
  },
  {
    question: 'Dolabında mutlaka olması\ngereken parça?',
    options: [
      { label: 'İyi kesilmiş\nblazer', emoji: '👔', tags: ['Smart Casual', 'Old Money', 'Quiet Luxury', 'Preppy'] },
      { label: 'Beyaz\nsneaker', emoji: '👟', tags: ['Streetwear', 'Athleisure', 'Clean Girl'] },
      { label: 'Midi\netek', emoji: '🌻', tags: ['Coquette', 'Soft Girl', 'Cottagecore', 'Bohemian'] },
      { label: 'Klasik\ntrençkot', emoji: '🧥', tags: ['Old Money', 'Quiet Luxury', 'Dark Academia', 'Coastal Grandmother'] },
    ],
  },
  {
    question: 'Hangi stil ikonuna\ndaha yakınsın?',
    options: [
      { label: 'Hailey\nBieber', emoji: '✨', tags: ['Clean Girl', 'Quiet Luxury', 'Minimalist'] },
      { label: 'Bella\nHadid', emoji: '🌆', tags: ['Streetwear', 'Downtown Girl', 'Avant-garde'] },
      { label: 'Taylor\nSwift', emoji: '🎀', tags: ['Coquette', 'Soft Girl', 'Preppy'] },
      { label: 'Kendall\nJenner', emoji: '🤍', tags: ['Minimalist', 'Old Money', 'Smart Casual'] },
    ],
  },
  {
    question: 'Alışverişte önceliklendirdiğin\nşey?',
    options: [
      { label: 'Kalite &\nuzun ömür', emoji: '💎', tags: ['Old Money', 'Quiet Luxury', 'Minimalist'] },
      { label: 'En yeni\ntrendler', emoji: '🔥', tags: ['Y2K', 'Streetwear', 'Avant-garde'] },
      { label: 'Pratik &\nfiyat/performans', emoji: '👌', tags: ['Athleisure', 'Smart Casual', 'Clean Girl'] },
      { label: 'Özgün &\nkişisel', emoji: '🎭', tags: ['Bohemian', 'Avant-garde', 'Dark Academia'] },
    ],
  },
  {
    question: 'En çok hangi ortamda\nkendini iyi hissedersin?',
    options: [
      { label: 'Ofis /\nşehir merkezi', emoji: '🏢', tags: ['Smart Casual', 'Old Money', 'Quiet Luxury'] },
      { label: 'Sokak /\ngece hayatı', emoji: '🌃', tags: ['Streetwear', 'Downtown Girl', 'Grunge Chic'] },
      { label: 'Doğa /\nkır evi', emoji: '🌿', tags: ['Cottagecore', 'Bohemian', 'Gorpcore'] },
      { label: 'Sosyal\netkinlik', emoji: '🥂', tags: ['Coquette', 'Mob Wife', 'Y2K'] },
    ],
  },
  {
    question: 'Hangi kombin sana\nen yakın?',
    options: [
      { label: 'Monokrom\ntakım uyumu', emoji: '🖤', tags: ['Minimalist', 'Quiet Luxury', 'Clean Girl'] },
      { label: 'Katmanlı &\ndetaylı görünüm', emoji: '🧣', tags: ['Bohemian', 'Dark Academia', 'Grunge Chic'] },
      { label: 'Mini etek\n+ topuklu', emoji: '👠', tags: ['Coquette', 'Mob Wife', 'Y2K'] },
      { label: 'Oversized\n+ sneaker', emoji: '🧢', tags: ['Streetwear', 'Athleisure', 'Downtown Girl'] },
    ],
  },
  {
    question: 'Seni en iyi tanımlayan\ntek kelime?',
    options: [
      { label: 'Zariflik', emoji: '🌸', tags: ['Old Money', 'Quiet Luxury', 'Smart Casual'] },
      { label: 'Özgürlük', emoji: '🌻', tags: ['Bohemian', 'Cottagecore', 'Avant-garde'] },
      { label: 'Güç', emoji: '⚡', tags: ['Mob Wife', 'Grunge Chic', 'Dark Academia', 'Streetwear'] },
      { label: 'Tazelik', emoji: '💧', tags: ['Clean Girl', 'Soft Girl', 'Coquette', 'Coastal Grandmother'] },
    ],
  },
];

function normalizeScores(scores: Record<string, number>): StyleEntry[] {
  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) return [];

  entries.sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 3);
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

export default function StyleQuizScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores]             = useState<Record<string, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const question = QUIZ[currentIndex];
  const progressPct = `${((currentIndex + 1) / QUIZ.length) * 100}%`;

  const handleOption = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const chosen = question.options[optionIndex];
    const newScores = { ...scores };
    for (const tag of chosen.tags) {
      newScores[tag] = (newScores[tag] ?? 0) + 2;
    }
    setScores(newScores);

    setTimeout(() => {
      if (currentIndex < QUIZ.length - 1) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setCurrentIndex((i) => i + 1);
          setSelectedOption(null);
          Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        });
      } else {
        const styleEntries = normalizeScores(newScores);
        const final = styleEntries.length > 0 ? styleEntries : [{ name: 'Minimalist', weight: 100 }];
        navigation.navigate('StyleResult', { selectedStyles: final });
      }
    }, 380);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* İlerleme çubuğu */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressPct as `${number}%` }]} />
      </View>

      <View style={styles.container}>
        {/* Sayaç */}
        <Text style={styles.counter}>{currentIndex + 1} / {QUIZ.length}</Text>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Soru */}
          <Text style={styles.question}>{question.question}</Text>

          {/* 2×2 seçenek grid */}
          <View style={styles.grid}>
            {question.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => handleOption(i)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
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
    gap: 10,
    boxShadow: '0 2px 8px rgba(26,26,46,0.05)',
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2.5,
    backgroundColor: '#FFF5F7',
  },
  optionEmoji: {
    fontSize: 32,
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

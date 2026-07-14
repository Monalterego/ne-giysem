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
import { t } from '../../i18n';
import { groupLabelOf } from '../../constants/styles';
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
    question: 'quiz.q0',
    options: [
      { label: 'quiz.L0', group: 'Zamansız' },
      { label: 'quiz.L1', group: 'Günlük & Rahat' },
      { label: 'quiz.L2', group: 'Feminen' },
      { label: 'quiz.L3', group: 'Edgy' },
      { label: 'quiz.L4', group: 'Diğer' },
    ],
  },
  {
    question: 'quiz.q1',
    options: [
      { label: 'quiz.L5', group: 'Zamansız' },
      { label: 'quiz.L6', group: 'Günlük & Rahat' },
      { label: 'quiz.L7', group: 'Feminen' },
      { label: 'quiz.L8', group: 'Edgy' },
      { label: 'quiz.L9', group: 'Diğer' },
    ],
  },
  {
    question: 'quiz.q2',
    options: [
      { label: 'quiz.L10', group: 'Zamansız' },
      { label: 'quiz.L11', group: 'Günlük & Rahat' },
      { label: 'quiz.L12', group: 'Feminen' },
      { label: 'quiz.L13', group: 'Edgy' },
      { label: 'quiz.L14', group: 'Diğer' },
    ],
  },
];

// ─── Katman 2: Stil soruları (gruba göre dallanma) ────────────────────────────

const STYLE_QUESTIONS: Record<GroupName, StyleQuestion[]> = {
  'Zamansız': [
    { question: 'quiz.q3', options: [
      { label: 'quiz.L15', scores: [{ style: 'Minimalist',    pts: 3 }, { style: 'Quiet Luxury', pts: 1 }] },
      { label: 'quiz.L16', scores: [{ style: 'Old Money',     pts: 3 }, { style: 'Quiet Luxury', pts: 1 }] },
      { label: 'quiz.L17', scores: [{ style: 'Quiet Luxury',  pts: 3 }, { style: 'Minimalist',   pts: 1 }] },
      { label: 'quiz.L18', scores: [{ style: 'Smart Casual',  pts: 3 }, { style: 'Old Money',    pts: 1 }] },
      { label: 'quiz.L19', scores: [{ style: 'Clean Girl',    pts: 3 }, { style: 'Minimalist',   pts: 1 }] },
    ]},
    { question: 'quiz.q4', options: [
      { label: 'quiz.L20', scores: [{ style: 'Minimalist',   pts: 3 }, { style: 'Quiet Luxury', pts: 1 }] },
      { label: 'quiz.L21', scores: [{ style: 'Old Money',    pts: 3 }] },
      { label: 'quiz.L22', scores: [{ style: 'Quiet Luxury', pts: 3 }] },
      { label: 'quiz.L23', scores: [{ style: 'Smart Casual', pts: 3 }, { style: 'Clean Girl', pts: 1 }] },
      { label: 'quiz.L24', scores: [{ style: 'Clean Girl',   pts: 3 }] },
    ]},
    { question: 'quiz.q5', options: [
      { label: 'quiz.L25', scores: [{ style: 'Minimalist',   pts: 3 }, { style: 'Smart Casual', pts: 1 }] },
      { label: 'quiz.L26', scores: [{ style: 'Old Money',    pts: 3 }, { style: 'Quiet Luxury', pts: 1 }] },
      { label: 'quiz.L27', scores: [{ style: 'Quiet Luxury', pts: 3 }, { style: 'Old Money',    pts: 1 }] },
      { label: 'quiz.L28', scores: [{ style: 'Smart Casual', pts: 3 }] },
      { label: 'quiz.L29', scores: [{ style: 'Clean Girl', pts: 3 }] },
    ]},
    { question: 'quiz.q6', options: [
      { label: 'quiz.L30', scores: [{ style: 'Minimalist',   pts: 3 }] },
      { label: 'quiz.L31', scores: [{ style: 'Old Money',    pts: 3 }, { style: 'Clean Girl', pts: 1 }] },
      { label: 'quiz.L32', scores: [{ style: 'Quiet Luxury', pts: 3 }] },
      { label: 'quiz.L33', scores: [{ style: 'Smart Casual', pts: 3 }] },
      { label: 'quiz.L34', scores: [{ style: 'Clean Girl',   pts: 3 }, { style: 'Minimalist', pts: 1 }] },
    ]},
    { question: 'quiz.q7', options: [
      { label: 'quiz.L35', scores: [{ style: 'Minimalist',   pts: 3 }] },
      { label: 'quiz.L36', scores: [{ style: 'Old Money',    pts: 3 }, { style: 'Quiet Luxury', pts: 1 }] },
      { label: 'quiz.L37', scores: [{ style: 'Quiet Luxury', pts: 3 }] },
      { label: 'quiz.L38', scores: [{ style: 'Smart Casual', pts: 3 }] },
      { label: 'quiz.L39', scores: [{ style: 'Clean Girl',   pts: 3 }] },
    ]},
  ],

  'Feminen': [
    { question: 'quiz.q8', options: [
      { label: 'quiz.L40', scores: [{ style: 'Coquette',            pts: 3 }, { style: 'Soft Girl',           pts: 1 }] },
      { label: 'quiz.L41', scores: [{ style: 'Soft Girl',           pts: 3 }, { style: 'Coquette',            pts: 1 }] },
      { label: 'quiz.L42', scores: [{ style: 'Bohemian',           pts: 3 }] },
      { label: 'quiz.L43', scores: [{ style: 'Cottagecore',         pts: 3 }] },
      { label: 'quiz.L44', scores: [{ style: 'Coastal Grandmother', pts: 3 }] },
    ]},
    { question: 'quiz.q9', options: [
      { label: 'quiz.L45', scores: [{ style: 'Coquette',            pts: 3 }, { style: 'Soft Girl',  pts: 1 }] },
      { label: 'quiz.L46', scores: [{ style: 'Soft Girl',           pts: 3 }] },
      { label: 'quiz.L47', scores: [{ style: 'Bohemian',            pts: 3 }] },
      { label: 'quiz.L48', scores: [{ style: 'Cottagecore',         pts: 3 }] },
      { label: 'quiz.L49', scores: [{ style: 'Coastal Grandmother', pts: 3 }] },
    ]},
    { question: 'quiz.q10', options: [
      { label: 'quiz.L50', scores: [{ style: 'Coquette',            pts: 3 }] },
      { label: 'quiz.L51', scores: [{ style: 'Soft Girl',           pts: 3 }, { style: 'Coquette',            pts: 1 }] },
      { label: 'quiz.L52', scores: [{ style: 'Bohemian',            pts: 3 }] },
      { label: 'quiz.L53', scores: [{ style: 'Cottagecore',         pts: 3 }, { style: 'Coastal Grandmother', pts: 1 }] },
      { label: 'quiz.L54', scores: [{ style: 'Coastal Grandmother', pts: 3 }] },
    ]},
    { question: 'quiz.q11', options: [
      { label: 'quiz.L55', scores: [{ style: 'Coquette',            pts: 3 }] },
      { label: 'quiz.L56', scores: [{ style: 'Soft Girl',          pts: 3 }] },
      { label: 'quiz.L57', scores: [{ style: 'Bohemian',           pts: 3 }] },
      { label: 'quiz.L58', scores: [{ style: 'Cottagecore',        pts: 3 }] },
      { label: 'quiz.L59', scores: [{ style: 'Coastal Grandmother', pts: 3 }, { style: 'Soft Girl', pts: 1 }] },
    ]},
    { question: 'quiz.q12', options: [
      { label: 'quiz.L60', scores: [{ style: 'Coquette',            pts: 3 }] },
      { label: 'quiz.L61', scores: [{ style: 'Soft Girl',           pts: 3 }] },
      { label: 'quiz.L62', scores: [{ style: 'Bohemian',            pts: 3 }] },
      { label: 'quiz.L63', scores: [{ style: 'Cottagecore',         pts: 3 }] },
      { label: 'quiz.L64', scores: [{ style: 'Coastal Grandmother', pts: 3 }] },
    ]},
  ],

  'Edgy': [
    { question: 'quiz.q13', options: [
      { label: 'quiz.L65',  scores: [{ style: 'Dark Academia', pts: 3 }] },
      { label: 'quiz.L102', scores: [{ style: 'Y2K',          pts: 3 }] },
      { label: 'quiz.L66',  scores: [{ style: 'Grunge Chic',  pts: 3 }] },
      { label: 'quiz.L67',  scores: [{ style: 'Mob Wife',     pts: 3 }] },
      { label: 'quiz.L68',  scores: [{ style: 'Avant-garde',  pts: 3 }] },
    ]},
    { question: 'quiz.q14', options: [
      { label: 'quiz.L69', scores: [{ style: 'Dark Academia', pts: 3 }] },
      { label: 'quiz.L70', scores: [{ style: 'Y2K',           pts: 3 }] },
      { label: 'quiz.L71', scores: [{ style: 'Grunge Chic',   pts: 3 }, { style: 'Dark Academia', pts: 1 }] },
      { label: 'quiz.L72', scores: [{ style: 'Mob Wife',      pts: 3 }] },
      { label: 'quiz.L73', scores: [{ style: 'Avant-garde',   pts: 3 }] },
    ]},
    { question: 'quiz.q15', options: [
      { label: 'quiz.L74', scores: [{ style: 'Dark Academia', pts: 3 }] },
      { label: 'quiz.L75', scores: [{ style: 'Y2K',          pts: 3 }] },
      { label: 'quiz.L76', scores: [{ style: 'Grunge Chic',  pts: 3 }] },
      { label: 'quiz.L77', scores: [{ style: 'Mob Wife',     pts: 3 }] },
      { label: 'quiz.L78', scores: [{ style: 'Avant-garde',  pts: 3 }, { style: 'Grunge Chic', pts: 1 }] },
    ]},
    { question: 'quiz.q16', options: [
      { label: 'quiz.L79', scores: [{ style: 'Dark Academia', pts: 3 }] },
      { label: 'quiz.L80', scores: [{ style: 'Y2K',         pts: 3 }] },
      { label: 'quiz.L81', scores: [{ style: 'Grunge Chic', pts: 3 }] },
      { label: 'quiz.L82', scores: [{ style: 'Mob Wife',    pts: 3 }] },
      { label: 'quiz.L83', scores: [{ style: 'Avant-garde', pts: 3 }] },
    ]},
    { question: 'quiz.q17', options: [
      { label: 'quiz.L84', scores: [{ style: 'Dark Academia', pts: 3 }] },
      { label: 'quiz.L85', scores: [{ style: 'Y2K',           pts: 3 }] },
      { label: 'quiz.L86', scores: [{ style: 'Grunge Chic',   pts: 3 }] },
      { label: 'quiz.L87', scores: [{ style: 'Mob Wife',      pts: 3 }] },
      { label: 'quiz.L88', scores: [{ style: 'Avant-garde',   pts: 3 }] },
    ]},
  ],

  'Günlük & Rahat': [
    { question: 'quiz.q18', options: [
      { label: 'quiz.L89', scores: [{ style: 'Streetwear',    pts: 3 }] },
      { label: 'quiz.L90', scores: [{ style: 'Athleisure',    pts: 3 }] },
      { label: 'quiz.L91', scores: [{ style: 'Downtown Girl', pts: 3 }] },
    ]},
    { question: 'quiz.q19', options: [
      { label: 'quiz.L92', scores: [{ style: 'Streetwear',    pts: 3 }, { style: 'Athleisure', pts: 1 }] },
      { label: 'quiz.L93', scores: [{ style: 'Athleisure',    pts: 3 }] },
      { label: 'quiz.L94', scores: [{ style: 'Downtown Girl', pts: 3 }] },
    ]},
    { question: 'quiz.q20', options: [
      { label: 'quiz.L95', scores: [{ style: 'Streetwear',    pts: 3 }] },
      { label: 'quiz.L96', scores: [{ style: 'Athleisure',    pts: 3 }] },
      { label: 'quiz.L97', scores: [{ style: 'Downtown Girl', pts: 3 }] },
    ]},
  ],

  'Diğer': [
    { question: 'quiz.q21', options: [
      { label: 'quiz.L98', scores: [{ style: 'Preppy',    pts: 3 }] },
      { label: 'quiz.L99', scores: [{ style: 'Gorpcore',  pts: 3 }] },
    ]},
    { question: 'quiz.q22', options: [
      { label: 'quiz.L100', scores: [{ style: 'Preppy',   pts: 3 }] },
      { label: 'quiz.L101', scores: [{ style: 'Gorpcore', pts: 3 }] },
    ]},
  ],
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
    ? `${currentIndex + 1} / 3 · ${t('quiz.determiningDirection')}`
    : `${currentIndex + 1} / ${styleQs.length} · ${activeGroup ? groupLabelOf(activeGroup) : ''}`;

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
          <Text style={styles.question}>{t(question.question)}</Text>

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
                    {t(opt.label)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <Text style={styles.hint}>{t('quiz.hint')}</Text>
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

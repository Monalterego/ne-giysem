import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { STYLE_DATA_MAP } from '../../constants/styles';
import { STYLE_CARDS, type StyleCardData } from '../../constants/styleCards';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleExplore'>;

const SWIPE_THR   = 80;
const MIN_SWIPES  = 20;
const CARD_RADIUS = 20;

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
  const result = top.map(([name, v]) => ({
    name,
    weight: Math.round((v / total) * 100),
  }));
  const diff = 100 - result.reduce((s, e) => s + e.weight, 0);
  if (diff !== 0 && result.length > 0) {
    result[0] = { ...result[0], weight: result[0].weight + diff };
  }
  return result;
}

// ─── Moodboard kart bileşeni ──────────────────────────────────────────────────

function MoodboardCard({ card }: { card: StyleCardData }) {
  const data = STYLE_DATA_MAP[card.name];
  const [failed, setFailed] = useState(false);

  // Sabit ilk görsel — random kullanma (prefetch'i bozar + her render yeni URL seçer)
  const imageUri = card.images[0] ?? null;

  const bg = data?.palette[0] ?? colors.black;

  return (
    <View style={{ flex: 1, borderRadius: CARD_RADIUS, overflow: 'hidden', backgroundColor: bg }}>

      {imageUri && !failed ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 72, opacity: 0.35 }}>{data?.emoji ?? '✨'}</Text>
        </View>
      )}

      {/* Alt gradient — şeffaftan siyaha */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.88)']}
        style={cardStyles.gradient}
      >
        <Text style={cardStyles.cardName} numberOfLines={1}>{card.name}</Text>
        <Text style={cardStyles.cardDesc} numberOfLines={2}>
          {data?.turkishDesc ?? card.keywords.join(' · ')}
        </Text>
      </LinearGradient>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  cardName: {
    ...typography.h2,
    fontFamily: fonts.heading,
    color: colors.white,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
  },
});

// ─── Ana ekran ─────────────────────────────────────────────────────────────────

export default function StyleExploreScreen({ navigation }: Props) {
  const [cards] = useState<StyleCardData[]>(() => shuffleArray([...STYLE_CARDS]));

  // Tüm kart görsellerini mount'ta prefetch et → swipe öncesi cache'te
  useEffect(() => {
    STYLE_CARDS.forEach((c) => {
      if (c.images[0]) Image.prefetch(c.images[0]).catch(() => {});
    });
  }, []);

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
        swipeCountRef.current  = newCount;
        cardIndexRef.current   = newIdx;
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
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>

      {/* Başlık + sayaç */}
      <View style={styles.header}>
        <Text style={styles.badge}>YOL C · KEŞİF MODU</Text>
        <Text style={styles.counter}>{swipeCount + 1} / {MIN_SWIPES}</Text>
      </View>

      <Text style={styles.swipeHint}>Beğen → sağa · Geç → sola</Text>

      {/* Kart yığını */}
      <View style={styles.stackArea}>
        {nextCard && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scale: backScale }], opacity: 0.72, zIndex: 0 },
            ]}
          >
            <MoodboardCard card={nextCard} />
          </Animated.View>
        )}

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
          {/* Beğeni / geç göstergeleri */}
          <Animated.View style={[styles.indicator, styles.likeInd, { opacity: likeOpacity }]}>
            <Feather name="heart" size={22} color={colors.success} />
          </Animated.View>
          <Animated.View style={[styles.indicator, styles.passInd, { opacity: passOpacity }]}>
            <Feather name="x" size={22} color={colors.error} />
          </Animated.View>

          <MoodboardCard card={currentCard} />
        </Animated.View>
      </View>

      {/* Alt butonlar */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.passBtn]}
          onPress={() => handleSwipe(false)}
          activeOpacity={0.82}
        >
          <Feather name="x" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.tapHint}>veya kaydır</Text>

        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={() => handleSwipe(true)}
          activeOpacity={0.82}
        >
          <Feather name="heart" size={22} color={colors.white} />
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

  // Başlık
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  badge: {
    ...typography.label,
    color: colors.textTertiary,
  },
  counter: {
    ...typography.label,
    color: colors.textSecondary,
  },
  swipeHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // Kart alanı
  stackArea: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.sm,
  },
  cardSlot: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    ...shadows.card,
  },

  // Swipe göstergeleri
  indicator: {
    position: 'absolute',
    top: spacing.lg,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  likeInd: {
    right: spacing.lg,
    borderColor: colors.success,
    backgroundColor: 'rgba(45,106,79,0.1)',
  },
  passInd: {
    left: spacing.lg,
    borderColor: colors.error,
    backgroundColor: 'rgba(192,57,43,0.1)',
  },

  // Alt butonlar
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  passBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  likeBtn: {
    backgroundColor: colors.black,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
    textAlign: 'center',
  },
});

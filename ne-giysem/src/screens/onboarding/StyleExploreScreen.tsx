import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
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

function MoodboardCard({
  card,
  cardWidth,
  cardHeight,
}: {
  card: StyleCardData;
  cardWidth: number;
  cardHeight: number;
}) {
  const data = STYLE_DATA_MAP[card.name];
  const [failed, setFailed] = useState(false);

  // Mount'ta bir kez rastgele URL seç — yeniden render'da değişmesin
  const imageUri = useMemo(() => {
    if (card.images.length === 0) return null;
    return card.images[Math.floor(Math.random() * card.images.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.name]);

  const bg = data?.palette[0] ?? '#1A1A2E';

  return (
    <View style={{ width: cardWidth, height: cardHeight, borderRadius: 24, overflow: 'hidden', backgroundColor: bg }}>

      {/* Fotoğraf — yoksa palette renk + emoji fallback */}
      {imageUri && !failed ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, fallbackStyle]}>
          <Text style={fallbackEmoji}>{data?.emoji ?? '✨'}</Text>
        </View>
      )}

      {/* Alt gradient overlay + isim + anahtar kelimeler */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={[StyleSheet.absoluteFill, overlayStyle]}
      >
        <View style={nameRow}>
          <Text style={emojiText}>{data?.emoji ?? '✨'}</Text>
          <Text style={nameText} numberOfLines={1}>{card.name}</Text>
        </View>
        <Text style={kwText}>{card.keywords.join(' · ')}</Text>
      </LinearGradient>
    </View>
  );
}

// Sabit stil nesneleri (bileşen dışında — her render'da yeniden oluşturulmasın)
const fallbackStyle: import('react-native').ViewStyle = { alignItems: 'center', justifyContent: 'center' };
const fallbackEmoji: import('react-native').TextStyle = { fontSize: 72, opacity: 0.5 };
const overlayStyle:  import('react-native').ViewStyle = { justifyContent: 'flex-end', padding: 24 };
const nameRow:       import('react-native').ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 };
const emojiText:     import('react-native').TextStyle = { fontSize: 28 };
const nameText:      import('react-native').TextStyle = { fontSize: 22, fontFamily: fonts.headingBold, color: '#FFFFFF', flexShrink: 1 };
const kwText:        import('react-native').TextStyle = { fontSize: 12, fontFamily: fonts.body, color: 'rgba(255,255,255,0.80)' };

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

  // Animasyon değerleri — pan'den türetilmiş
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
      {/* Başlık + sayaç */}
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
            style={[
              styles.cardSlot,
              { transform: [{ scale: backScale }, { translateY: 12 }], opacity: 0.72, zIndex: 0 },
            ]}
          >
            <MoodboardCard card={nextCard} cardWidth={CARD_W} cardHeight={CARD_H} />
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
          {/* Beğeni / geç göstergeleri */}
          <Animated.View style={[styles.indicator, styles.likeInd, { opacity: likeOpacity }]}>
            <Text style={styles.indText}>❤️</Text>
          </Animated.View>
          <Animated.View style={[styles.indicator, styles.passInd, { opacity: passOpacity }]}>
            <Text style={styles.indText}>✕</Text>
          </Animated.View>

          <MoodboardCard card={currentCard} cardWidth={CARD_W} cardHeight={CARD_H} />
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

        <Text style={styles.tapHint}>veya kaydır</Text>

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

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    emojis: ['👕', '👗', '👠', '🧥'],
    title: 'Dolabını Dijitalleştir',
    subtitle: 'Fotoğrafla, keşfet, her gün mükemmel görün. AI destekli kişisel stil danışmanın.',
  },
  {
    emojis: ['✨', '🎯', '🎨', '💡'],
    title: 'AI ile Kombin Yap',
    subtitle: 'Yapay zeka destekli stil önerileri ile her gün harika kombinler oluştur.',
  },
  {
    emojis: ['🛍️', '📸', '💫', '⭐'],
    title: 'Mağazada Analiz Et',
    subtitle: 'Mağazada beğendiğin ürünü çek, dolabınla uyumunu anında öğren.',
  },
];

export default function WelcomeScreen({ navigation }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIndex(idx);
  };

  const handleNext = () => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < SLIDES.length) {
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      navigation.navigate('Signup');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.emojiGrid}>
              {item.emojis.map((emoji, i) => (
                <View
                  key={i}
                  style={[
                    styles.emojiCard,
                    { transform: [{ rotate: `${(i - 1.5) * 6}deg` }] },
                  ]}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>
            {activeIndex < SLIDES.length - 1 ? 'İleri →' : 'Başlayalım →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  slide: {
    width: SCREEN_W,
    paddingHorizontal: 28,
    paddingTop: 32,
    alignItems: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'rgba(252,228,236,0.25)',
    borderRadius: 24,
  },
  emojiCard: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emojiText: {
    fontSize: 28,
  },
  slideTitle: {
    fontSize: 24,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});

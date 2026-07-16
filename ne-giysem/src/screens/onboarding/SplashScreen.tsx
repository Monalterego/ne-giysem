import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../constants/theme';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Splash'>;

const LOGO = 120;          // logo kutusu (px)
const STROKE = 5.4;        // çizgi kalınlığı (1024 ölçeğinden ölçekli)

// 1024 viewBox'tan 120px'e ölçeklenmiş segmentler.
// Sıra = kalemin gittiği yol: sol-üst → tepe → sağ-üst → dip → sol-alt → sağ-alt → sol-üst
const SEGMENTS = [
  { len: 53.9,  angle: -30,  midX: 36.4, midY: 19.5,  dur: 141 },
  { len: 54.1,  angle: 30,   midX: 83.2, midY: 19.5,  dur: 142 },
  { len: 93.4,  angle: 120,  midX: 83.3, midY: 73.5,  dur: 245 },
  { len: 54.2,  angle: -150, midX: 36.4, midY: 100.4, dur: 142 },
  { len: 93.6,  angle: 0,    midX: 59.7, midY: 86.8,  dur: 246 },
  { len: 107.8, angle: -150, midX: 59.8, midY: 59.9,  dur: 284 },
];

export default function SplashScreen({ navigation }: Props) {
  // Her segment için bir ilerleme değeri (0 → 1)
  const progress = useRef(SEGMENTS.map(() => new Animated.Value(0))).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const tagFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Segmentleri SIRAYLA çiz (tek kalem darbesi hissi)
    const draw = Animated.sequence(
      SEGMENTS.map((s, i) =>
        Animated.timing(progress[i], {
          toValue: 1,
          duration: s.dur,
          easing: Easing.linear,      // sabit kalem hızı — doğal çizim
          useNativeDriver: false,     // width animasyonu native driver desteklemez
        })
      )
    );

    Animated.sequence([
      Animated.delay(100),
      draw,                                    // ~1200ms
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(tagFade, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Signup'), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.logoBox}>
          {SEGMENTS.map((s, i) => (
            <View
              key={i}
              style={[
                styles.segWrap,
                {
                  left: s.midX - s.len / 2,
                  top: s.midY - STROKE / 2,
                  width: s.len,
                  height: STROKE,
                  transform: [{ rotate: `${s.angle}deg` }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.segBar,
                  {
                    width: progress[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, s.len],
                    }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <Animated.Text style={[styles.title, { opacity: textFade }]}>SESTINA</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: tagFade }]}>
          {t('splash.tagline')}
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.white },        // ← BEYAZ (eskiden siyahtı)
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBox: { width: LOGO, height: LOGO, marginBottom: spacing.lg },
  segWrap: { position: 'absolute' },
  segBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: STROKE,
    borderRadius: STROKE / 2,        // yuvarlak uçlar
    backgroundColor: colors.black,   // ← SİYAH çizgi (eskiden beyazdı)
  },
  title: {
    fontSize: 48,
    fontFamily: fonts.heading,
    color: colors.black,             // ← eskiden white
    letterSpacing: 8,
    fontWeight: '400',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: fonts.body,
    color: colors.textSecondary,     // ← eskiden textTertiary (beyazımsı)
    letterSpacing: 4,
  },
});

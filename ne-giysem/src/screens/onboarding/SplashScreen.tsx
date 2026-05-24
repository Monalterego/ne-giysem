import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Welcome'), 2200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient
      colors={['#1A1A2E', '#0F3460', '#E94560']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.inner}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>👗</Text>
        </View>
        <Text style={styles.title}>Ne Giysem?</Text>
        <Text style={styles.subtitle}>KİŞİSEL STİL DANIŞMANIN</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.headingBold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 3,
  },
});

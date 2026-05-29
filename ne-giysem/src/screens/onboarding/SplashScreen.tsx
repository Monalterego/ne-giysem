import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.title}>Ne Giysem?</Text>
      <Text style={styles.subtitle}>KİŞİSEL STİL DANIŞMANIN</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  line: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: 48,
    fontFamily: fonts.heading,
    color: colors.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: fonts.body,
    color: colors.textTertiary,
    letterSpacing: 4,
  },
});

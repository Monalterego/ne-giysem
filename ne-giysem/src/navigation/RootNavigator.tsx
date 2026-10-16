import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useUserStore } from '../store/useUserStore';

import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import AgeGateScreen from '../screens/onboarding/AgeGateScreen';
import ConsentGateScreen from '../screens/onboarding/ConsentGateScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  // 18+ onayı: giriş yolundan bağımsız tek kapı (undefined = henüz okunmadı → kapı okur)
  const ageConfirmed = useUserStore((s) => !!s.user?.ageConfirmedAt);
  // Mevcut kullanıcı: rıza kaydı YOK (null — okunmuş ve boş; undefined = henüz okunmadı,
  // kapı açılmaz) ama hassas veri var → AgeGate'ten sonra bir kez rıza kapısı
  const needsConsent = useUserStore((s) => {
    const u = s.user;
    if (!u || u.sensitiveConsentAt !== null) return false;
    const hasPhysical = [u.height, u.weight, u.age, u.bodyType, u.skinTone, u.hairColor, u.hairLength, u.hairType]
      .some((v) => v != null);
    return hasPhysical || !!u.avatarUrl;
  });

  console.log('[RootNavigator] render — isAuthenticated:', isAuthenticated, '| isOnboarded:', isOnboarded, '| age:', ageConfirmed);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && !ageConfirmed ? (
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      ) : isAuthenticated && needsConsent ? (
        <Stack.Screen name="ConsentGate" component={ConsentGateScreen} />
      ) : isAuthenticated && isOnboarded ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

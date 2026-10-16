import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useUserStore } from '../store/useUserStore';

import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import AgeGateScreen from '../screens/onboarding/AgeGateScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  // 18+ onayı: giriş yolundan bağımsız tek kapı (undefined = henüz okunmadı → kapı okur)
  const ageConfirmed = useUserStore((s) => !!s.user?.ageConfirmedAt);

  console.log('[RootNavigator] render — isAuthenticated:', isAuthenticated, '| isOnboarded:', isOnboarded, '| age:', ageConfirmed);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && !ageConfirmed ? (
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      ) : isAuthenticated && isOnboarded ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

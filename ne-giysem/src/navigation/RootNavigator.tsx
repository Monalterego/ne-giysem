import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useUserStore } from '../store/useUserStore';
import { useConsentStore, requiredTryOnConsents } from '../store/useConsentStore';

import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import AgeGateScreen from '../screens/onboarding/AgeGateScreen';
import ConsentGateScreen from '../screens/onboarding/ConsentGateScreen';
import PaywallScreen from '../screens/main/PaywallScreen';
import AiConsentScreen from '../screens/main/AiConsentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  // 18+ onayı: giriş yolundan bağımsız tek kapı (undefined = henüz okunmadı → kapı okur)
  const ageConfirmed = useUserStore((s) => !!s.user?.ageConfirmedAt);
  // Mevcut kullanıcı: elinde fotoğraf / fiziksel bilgi var ama ilgili açık rıza
  // consent_events'te yok → AgeGate'ten sonra yalnızca eksik rızaları soran kapı.
  // Rızalar henüz okunmadıysa (loaded false) kapı açılmaz.
  const user          = useUserStore((s) => s.user);
  const consentLoaded = useConsentStore((s) => s.loaded);
  const records       = useConsentStore((s) => s.records);
  const needsConsent  = consentLoaded && requiredTryOnConsents(user, records).length > 0;

  console.log('[RootNavigator] render — isAuthenticated:', isAuthenticated, '| isOnboarded:', isOnboarded, '| age:', ageConfirmed);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && !ageConfirmed ? (
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      ) : isAuthenticated && needsConsent ? (
        <Stack.Screen name="ConsentGate" component={ConsentGateScreen} />
      ) : isAuthenticated && isOnboarded ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {/* Tam ekran paywall — her yerden openPaywall() (navigationRef) ile açılır */}
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          {/* Yapay zekâ izni — ilk kıyafet ekleme / ilk tarama öncesi, Gizlilik'ten de */}
          <Stack.Screen
            name="AiConsent"
            component={AiConsentScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
          />
        </Stack.Group>
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

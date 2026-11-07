import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useUserStore } from '../store/useUserStore';
import { useConsentStore, requiredTryOnConsents, needsNoticeUpdate } from '../store/useConsentStore';
import { usePlanStore, hasAccess } from '../store/usePlanStore';
import { colors } from '../constants/theme';

import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import AgeGateScreen from '../screens/onboarding/AgeGateScreen';
import ConsentGateScreen from '../screens/onboarding/ConsentGateScreen';
import PaywallScreen from '../screens/main/PaywallScreen';
import AiConsentScreen from '../screens/main/AiConsentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Plan henüz okunmadı — ana ekranlar ya da paywall bir an yanıp sönmesin */
function PlanLoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

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
  // Ya da rızası geçerli ama aydınlatmanın güncel ana sürümünü okumamış → yalnız "Okudum" adımı
  const needsConsent  = consentLoaded
    && (requiredTryOnConsents(user, records).length > 0 || needsNoticeUpdate(records));
  // Hard paywall (Adım 15): onboarding sonrası erişim (deneme / abonelik) yoksa yalnızca paywall
  const planLoaded = usePlanStore((s) => s.loaded);
  const access     = usePlanStore((s) => hasAccess(s.plan));

  console.log('[RootNavigator] render — isAuthenticated:', isAuthenticated, '| isOnboarded:', isOnboarded, '| age:', ageConfirmed, '| access:', planLoaded ? access : '?');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && !ageConfirmed ? (
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      ) : isAuthenticated && needsConsent ? (
        <Stack.Screen name="ConsentGate" component={ConsentGateScreen} />
      ) : isAuthenticated && isOnboarded && !planLoaded ? (
        <Stack.Screen name="PlanLoading" component={PlanLoadingScreen} />
      ) : isAuthenticated && isOnboarded && !access ? (
        // Kapatılamaz: satın alma / geri yükleme sonrası plan güncellenince ana ekranlara geçilir
        <Stack.Screen name="Paywall" component={PaywallScreen} options={{ gestureEnabled: false }} />
      ) : isAuthenticated && isOnboarded ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainTabNavigator} />
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

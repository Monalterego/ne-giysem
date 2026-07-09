import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';
import { useUserStore } from '../store/useUserStore';
import type { UserState } from '../store/useUserStore';

import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import SignupScreen from '../screens/onboarding/SignupScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import StyleChoiceScreen from '../screens/onboarding/StyleChoiceScreen';
import StyleSelectScreen from '../screens/onboarding/StyleSelectScreen';
import StyleQuizScreen from '../screens/onboarding/StyleQuizScreen';
import StyleExploreScreen from '../screens/onboarding/StyleExploreScreen';
import StyleResultScreen from '../screens/onboarding/StyleResultScreen';
import PhysicalProfileScreen from '../screens/onboarding/PhysicalProfileScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  // Kimlik doğrulaması var ama onboarding tekrar açıldıysa (profil güncelleme)
  // doğrudan StyleChoice'a git, Splash/Signup akışını atla
  const isAuthenticated        = useUserStore((s: UserState) => s.isAuthenticated);
  const targetOnboardingScreen = useUserStore((s: UserState) => s.targetOnboardingScreen);

  let initialRoute: keyof OnboardingStackParamList;
  if (!isAuthenticated) {
    initialRoute = 'Splash';
  } else {
    initialRoute = targetOnboardingScreen ?? 'StyleChoice';
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,          // kaydırarak geri dönmeyi kapat (kart swipe'ı ile çakışıyor)
        fullScreenGestureEnabled: false, // tam ekran geri jesti (varsa) kapalı
      }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="StyleChoice" component={StyleChoiceScreen} />
      <Stack.Screen name="StyleSelect" component={StyleSelectScreen} />
      <Stack.Screen name="StyleQuiz" component={StyleQuizScreen} />
      <Stack.Screen name="StyleExplore" component={StyleExploreScreen} />
      <Stack.Screen name="StyleResult" component={StyleResultScreen} />
      <Stack.Screen name="PhysicalProfile" component={PhysicalProfileScreen} />
    </Stack.Navigator>
  );
}

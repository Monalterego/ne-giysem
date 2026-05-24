import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';

import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import SignupScreen from '../screens/onboarding/SignupScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import StyleChoiceScreen from '../screens/onboarding/StyleChoiceScreen';
import StyleSelectScreen from '../screens/onboarding/StyleSelectScreen';
import StyleResultScreen from '../screens/onboarding/StyleResultScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="StyleChoice" component={StyleChoiceScreen} />
      <Stack.Screen name="StyleSelect" component={StyleSelectScreen} />
      <Stack.Screen name="StyleResult" component={StyleResultScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ScanStackParamList } from './types';
import ScanScreen from '../screens/main/ScanScreen';
import StoreResultScreen from '../screens/main/StoreResultScreen';

const Stack = createNativeStackNavigator<ScanStackParamList>();

export default function ScanNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanHome" component={ScanScreen} />
      <Stack.Screen name="StoreResult" component={StoreResultScreen} />
    </Stack.Navigator>
  );
}

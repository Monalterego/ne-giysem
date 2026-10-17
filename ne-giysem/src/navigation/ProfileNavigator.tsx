import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import ProfileScreen from '../screens/main/ProfileScreen';
import ProfilePhotoScreen from '../screens/main/profile/ProfilePhotoScreen';
import StyleDnaScreen from '../screens/main/profile/StyleDnaScreen';
import PhysicalInfoScreen from '../screens/main/profile/PhysicalInfoScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
      <Stack.Screen name="ProfileStyle" component={StyleDnaScreen} />
      <Stack.Screen name="ProfilePhysical" component={PhysicalInfoScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';

import HomeScreen from '../screens/main/HomeScreen';
import WardrobeNavigator from './WardrobeNavigator';
import CombosScreen from '../screens/main/CombosScreen';
import ScanScreen from '../screens/main/ScanScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E94560',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#f0f0f0' },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Ana Sayfa' }} />
      <Tab.Screen name="Wardrobe" component={WardrobeNavigator} options={{ tabBarLabel: 'Dolap' }} />
      <Tab.Screen name="Combos" component={CombosScreen} options={{ tabBarLabel: 'Kombin' }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ tabBarLabel: 'Tara' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}

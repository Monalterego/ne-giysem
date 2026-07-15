import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { t } from '../i18n';
import type { MainTabParamList } from './types';

import HomeNavigator from './HomeNavigator';
import WardrobeNavigator from './WardrobeNavigator';
import CombosScreen from '../screens/main/CombosScreen';
import ScanNavigator from './ScanNavigator';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: '#C4C4C4',
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="home" size={size} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="Wardrobe"
        component={WardrobeNavigator}
        options={{
          tabBarLabel: t('nav.wardrobe'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'shirt' : 'shirt-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Combos"
        component={CombosScreen}
        options={{
          tabBarLabel: t('nav.combos'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'sparkles' : 'sparkles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanNavigator}
        options={{
          tabBarLabel: t('nav.scan'),
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="camera" size={size} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="user" size={size} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

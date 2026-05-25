import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from './types';

import HomeScreen from '../screens/main/HomeScreen';
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
        tabBarActiveTintColor: '#E94560',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#f0f0f0' },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wardrobe"
        component={WardrobeNavigator}
        options={{
          tabBarLabel: 'Dolap',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'shirt' : 'shirt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Combos"
        component={CombosScreen}
        options={{
          tabBarLabel: 'Kombin',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanNavigator}
        options={{
          tabBarLabel: 'Tara',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

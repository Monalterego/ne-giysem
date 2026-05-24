import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from './types';
import WardrobeScreen from '../screens/main/WardrobeScreen';
import UploadScreen from '../screens/main/UploadScreen';
import UploadDetailScreen from '../screens/main/UploadDetailScreen';

const Stack = createNativeStackNavigator<WardrobeStackParamList>();

export default function WardrobeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WardrobeList" component={WardrobeScreen} />
      <Stack.Screen name="Upload" component={UploadScreen} />
      <Stack.Screen name="UploadDetail" component={UploadDetailScreen} />
    </Stack.Navigator>
  );
}

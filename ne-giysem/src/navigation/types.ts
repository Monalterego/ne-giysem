import type { NavigatorScreenParams } from '@react-navigation/native';

export type StyleEntry = { name: string; weight: number };

export type OnboardingStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Signup: undefined;
  Login: undefined;
  StyleChoice: undefined;
  StyleSelect: undefined;
  StyleQuiz: undefined;
  StyleExplore: undefined;
  StyleResult: { selectedStyles: StyleEntry[] };
  PhysicalProfile: undefined;
};

import type { WardrobeItem } from '../types';

export type HomeStackParamList = {
  HomeMain: undefined;
  Calendar: undefined;
};

export type WardrobeStackParamList = {
  WardrobeList: undefined;
  Upload: undefined;
  UploadDetail:
    | { processedBase64: string; originalUri: string; existingItem?: undefined }
    | { processedBase64?: undefined; originalUri?: undefined; existingItem: WardrobeItem };
};

export type ScanStackParamList = {
  ScanHome: undefined;
  StoreResult: {
    processedBase64: string;
    originalUri: string;
  };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfilePhoto: undefined;      // fotoğraf ekle/değiştir/kaldır + rehber
  ProfileStyle: undefined;      // Stil DNA detayı + yeniden belirle
  ProfilePhysical: undefined;   // fiziksel bilgiler + düzenle
};

export type MainTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Combos: { focusComboKey?: string; occasion?: string } | undefined;
  Scan: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

/** Paywall'un hangi giriş noktasından açıldığı — üstteki açıklama metnini seçer */
export type PaywallReason = 'generic' | 'wardrobe' | 'scan' | 'planning' | 'tryon';

export type RootStackParamList = {
  AgeGate: undefined;
  ConsentGate: undefined;
  Onboarding: undefined;
  Main: undefined;
  Paywall: { reason?: PaywallReason } | undefined;
};

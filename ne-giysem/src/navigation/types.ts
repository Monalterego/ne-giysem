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
    // manual: yapay zekâ izni yok — fotoğraf olduğu gibi, otomatik tanıma yapılmaz
    | { processedBase64: string; originalUri: string; manual?: boolean; existingItem?: undefined }
    | { processedBase64?: undefined; originalUri?: undefined; manual?: undefined; existingItem: WardrobeItem };
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
  ProfilePrivacy: undefined;    // Gizlilik ve izinler — üç izin, durum + geri çekme
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
  AiConsent: undefined;   // lib/aiConsent openAiConsent() ile açılır
};

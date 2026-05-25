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
};

import type { WardrobeItem } from '../types';

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

export type MainTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Combos: undefined;
  Scan: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

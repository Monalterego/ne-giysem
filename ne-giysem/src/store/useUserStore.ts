import { create } from 'zustand';
import type { User, StyleProfile } from '../types';
import type { OnboardingStackParamList } from '../navigation/types';
import { getLocale, setLocale } from '../i18n';

export interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  targetOnboardingScreen: keyof OnboardingStackParamList | null;
  locale: 'tr' | 'en';
  setUser: (user: User | null) => void;
  setStyleProfile: (profile: StyleProfile) => void;
  setPhysicalProfile: (fields: Partial<Pick<User, 'height' | 'age' | 'bodyType' | 'skinTone' | 'hairColor' | 'hairLength' | 'hairType'>>) => void;
  setAvatarUrl: (url: string) => void;
  setOnboarded: (value: boolean) => void;
  setTargetOnboardingScreen: (screen: keyof OnboardingStackParamList | null) => void;
  setUserLocale: (l: 'tr' | 'en') => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  targetOnboardingScreen: null,
  locale: getLocale(),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setStyleProfile: (profile) =>
    set((state) => ({
      user: state.user ? { ...state.user, styleProfile: profile } : null,
    })),
  setPhysicalProfile: (fields) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...fields } : null,
    })),
  setAvatarUrl: (url) =>
    set((state) => ({
      user: state.user ? { ...state.user, avatarUrl: url } : null,
    })),
  setOnboarded: (value) =>
    set({ isOnboarded: value, ...(value ? { targetOnboardingScreen: null } : {}) }),
  setTargetOnboardingScreen: (screen) => set({ targetOnboardingScreen: screen }),
  // Dil değiştir: kalıcı kaydet (setLocale) + UI'ın yeniden render'ı için state güncelle
  setUserLocale: (l) => { setLocale(l); set({ locale: l }); },
  logout: () => set({ user: null, isAuthenticated: false, isOnboarded: false, targetOnboardingScreen: null }),
}));

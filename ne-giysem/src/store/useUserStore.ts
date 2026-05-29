import { create } from 'zustand';
import type { User, StyleProfile } from '../types';
import type { OnboardingStackParamList } from '../navigation/types';

export interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  targetOnboardingScreen: keyof OnboardingStackParamList | null;
  setUser: (user: User | null) => void;
  setStyleProfile: (profile: StyleProfile) => void;
  setPhysicalProfile: (fields: Partial<Pick<User, 'height' | 'age' | 'bodyType' | 'skinTone' | 'hairColor' | 'hairLength' | 'hairType'>>) => void;
  setAvatarUrl: (url: string) => void;
  setOnboarded: (value: boolean) => void;
  setTargetOnboardingScreen: (screen: keyof OnboardingStackParamList | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  targetOnboardingScreen: null,
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
  logout: () => set({ user: null, isAuthenticated: false, isOnboarded: false, targetOnboardingScreen: null }),
}));

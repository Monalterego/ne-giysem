import { create } from 'zustand';
import type { User, StyleProfile } from '../types';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  setUser: (user: User | null) => void;
  setStyleProfile: (profile: StyleProfile) => void;
  setOnboarded: (value: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setStyleProfile: (profile) =>
    set((state) => ({
      user: state.user ? { ...state.user, styleProfile: profile } : null,
    })),
  setOnboarded: (value) => set({ isOnboarded: value }),
  logout: () => set({ user: null, isAuthenticated: false, isOnboarded: false }),
}));

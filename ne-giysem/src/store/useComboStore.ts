import { create } from 'zustand';
import type { Combo } from '../types';

interface ComboStore {
  cache: Record<string, Combo[]>;
  setCache: (occasionId: string, combos: Combo[]) => void;
  clearCache: () => void;
}

export const useComboStore = create<ComboStore>((set) => ({
  cache: {},
  setCache: (occasionId, combos) => set((state) => ({
    cache: { ...state.cache, [occasionId]: combos },
  })),
  clearCache: () => set({ cache: {} }),
}));

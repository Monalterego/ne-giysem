import { create } from 'zustand';
import type { WardrobeItem } from '../types';

interface WardrobeState {
  items: WardrobeItem[];
  isLoading: boolean;
  setItems: (items: WardrobeItem[]) => void;
  addItem: (item: WardrobeItem) => void;
  removeItem: (id: string) => void;
  setLoading: (value: boolean) => void;
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  items: [],
  isLoading: false,
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  setLoading: (value) => set({ isLoading: value }),
}));

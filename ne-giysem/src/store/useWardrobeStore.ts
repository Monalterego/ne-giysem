import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { WardrobeItem } from '../types';

interface WardrobeState {
  items: WardrobeItem[];
  isLoading: boolean;
  wornComboKeys: Set<string>;
  setItems: (items: WardrobeItem[]) => void;
  addItem: (item: WardrobeItem) => void;
  removeItem: (id: string) => void;
  updateItem: (item: WardrobeItem) => void;
  setLoading: (value: boolean) => void;
  fetchItems: (userId: string) => Promise<void>;
  markWorn: (key: string) => void;
  fetchWornToday: (userId: string) => Promise<void>;
}

function mapRow(row: any): WardrobeItem {
  return {
    id: row.id,
    userId: row.user_id,
    originalImageUrl: row.image_url ?? '',
    processedImageUrl: row.processed_image_url ?? '',
    category: row.category,
    subCategory: row.subcategory ?? undefined,
    colors: row.colors ?? [],
    pattern: row.pattern ?? undefined,
    fabric: row.fabric ?? undefined,
    seasons: row.season ?? [],
    brand: row.brand ?? undefined,
    price: row.price ?? undefined,
    createdAt: row.created_at,
  };
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  items: [],
  isLoading: false,
  wornComboKeys: new Set<string>(),
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  updateItem: (updated) => set((state) => ({
    items: state.items.map((i) => i.id === updated.id ? updated : i),
  })),
  setLoading: (value) => set({ isLoading: value }),

  fetchItems: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ items: data.map(mapRow) });
    }
    set({ isLoading: false });
  },

  markWorn: (key) => set((state) => ({
    wornComboKeys: new Set([...state.wornComboKeys, key]),
  })),

  fetchWornToday: async (userId: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('combos')
      .select('items')
      .eq('user_id', userId)
      .gte('worn_at', todayStart.toISOString());
    if (data) {
      const keys = new Set<string>(
        (data as { items: string[] }[]).map((row) => [...row.items].sort().join('|')),
      );
      set({ wornComboKeys: keys });
    }
  },
}));

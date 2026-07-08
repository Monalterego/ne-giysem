import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { WardrobeItem } from '../types';
import { fetchWeather as fetchWeatherApi, getCoords } from '../utils/weatherService';
import type { WeatherData } from '../utils/weatherService';

interface WardrobeState {
  items: WardrobeItem[];
  isLoading: boolean;
  wornComboKeys: Set<string>;
  weather: WeatherData | null;
  weatherLoading: boolean;
  setItems: (items: WardrobeItem[]) => void;
  addItem: (item: WardrobeItem) => void;
  removeItem: (id: string) => void;
  updateItem: (item: WardrobeItem) => void;
  setLoading: (value: boolean) => void;
  fetchItems: (userId: string) => Promise<void>;
  markWorn: (key: string) => void;
  fetchWornToday: (userId: string) => Promise<void>;
  fetchWeather: () => Promise<void>;
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(row: any): WardrobeItem {
  return {
    id: row.id,
    userId: row.user_id,
    originalImageUrl: row.image_url ?? '',
    processedImageUrl: row.processed_image_url ?? '',
    category: row.category,
    subCategory:  row.subcategory    ?? undefined,
    colors:       parseJsonArray(row.colors),
    pattern:      row.pattern        ?? undefined,
    fabric:       row.fabric         ?? undefined,
    seasons:      parseJsonArray(row.season),
    brand:        row.brand          ?? undefined,
    price:        row.price          ?? undefined,
    itemName:     row.item_name      ?? undefined,
    fit:          row.fit            ?? undefined,
    neckline:     row.neckline       ?? undefined,
    sleeveLength: row.sleeve_length  ?? undefined,
    details:      row.details        ?? undefined,
    createdAt:    row.created_at,
  };
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  items: [],
  isLoading: false,
  wornComboKeys: new Set<string>(),
  weather: null,
  weatherLoading: false,
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

  fetchWeather: async () => {
    set({ weatherLoading: true });
    try {
      const coords = await getCoords();
      const data = await fetchWeatherApi(coords?.lat, coords?.lon);
      set({ weather: data });
    } catch {
      // hava durumu başarısız olursa sessizce geç
    } finally {
      set({ weatherLoading: false });
    }
  },

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

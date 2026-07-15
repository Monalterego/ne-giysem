import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { WardrobeItem } from '../types';
import { fetchWeather as fetchWeatherApi, getCoords } from '../utils/weatherService';
import type { WeatherData } from '../utils/weatherService';

// Yerel tarihi 'YYYY-MM-DD' string'e çevirir — DATE kolonu için (toISOString UTC'ye kaydırır, gün kayar)
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Takvim/geçmiş girişi — state'e yazılmaz, sorgudan döndürülür
export interface WornEntry {
  items: string[];   // parça id'leri (silinmiş olabilir)
  score: number;
  wornAt: string;    // ISO tarih
}

// Planlanan kombin girişi — gelecek bir güne atanmış
export interface PlannedEntry {
  id: string;          // silme için gerekli
  items: string[];
  score: number;
  plannedFor: string;  // 'YYYY-MM-DD'
}

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
  fetchWornHistory: (userId: string, from: Date, to: Date) => Promise<WornEntry[]>;
  fetchPlannedRange: (userId: string, from: Date, to: Date) => Promise<PlannedEntry[]>;
  planCombo: (userId: string, itemIds: string[], score: number, date: Date) => Promise<boolean>;
  removePlan: (id: string) => Promise<boolean>;
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
    signals:      parseJsonArray(row.signals),
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

  // Belirli tarih aralığındaki giyilen kombinler — takvim/geçmiş için, state'e yazmaz
  fetchWornHistory: async (userId, from, to) => {
    const { data, error } = await supabase
      .from('combos')
      .select('items, score, worn_at')
      .eq('user_id', userId)
      .gte('worn_at', from.toISOString())
      .lte('worn_at', to.toISOString())
      .order('worn_at', { ascending: false });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      items: parseJsonArray(r.items),
      score: r.score ?? 0,
      wornAt: r.worn_at,
    }));
  },

  // Belirli tarih aralığındaki planlanan kombinler (planned_for dolu)
  fetchPlannedRange: async (userId, from, to) => {
    const { data, error } = await supabase
      .from('combos')
      .select('id, items, score, planned_for')
      .eq('user_id', userId)
      .not('planned_for', 'is', null)
      .gte('planned_for', toDateStr(from))
      .lte('planned_for', toDateStr(to))
      .order('planned_for', { ascending: true });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      id: r.id,
      items: parseJsonArray(r.items),
      score: r.score ?? 0,
      plannedFor: r.planned_for,
    }));
  },

  // Kombini bir güne planla — worn_at YOK, bu bir plan kaydı
  planCombo: async (userId, itemIds, score, date) => {
    const { error } = await supabase.from('combos').insert({
      user_id: userId,
      items: itemIds,
      score,
      planned_for: toDateStr(date),
      created_at: new Date().toISOString(),
    });
    return !error;
  },

  removePlan: async (id) => {
    const { error } = await supabase.from('combos').delete().eq('id', id);
    return !error;
  },
}));

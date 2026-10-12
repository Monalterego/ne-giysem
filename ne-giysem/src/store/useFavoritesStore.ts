import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { comboSignatureForCache } from '../utils/virtualModel';
import type { Combo } from '../types';

export interface FavoriteCombo {
  id: string;
  signature: string;
  itemIds: string[];
  score: number;
  occasion: string | null;
  createdAt: string;
}

interface FavoritesStore {
  favorites: FavoriteCombo[];       // en yeni en başta
  favoriteSigs: Set<string>;        // hızlı "favori mi?" kontrolü
  fetchFavorites: (userId: string) => Promise<void>;
  toggleFavorite: (userId: string, combo: Combo, occasion: string) => Promise<void>;
}

const sigsOf = (list: FavoriteCombo[]) => new Set(list.map((f) => f.signature));

const byNewest = (a: FavoriteCombo, b: FavoriteCombo) => b.createdAt.localeCompare(a.createdAt);

// Yazımı süren imzalar — hızlı çift dokunuşta ekle/sil yarışını önler (DB ile state ayrışmasın)
const pending = new Set<string>();

function mapRow(row: any): FavoriteCombo {
  return {
    id:        row.id,
    signature: row.signature,
    itemIds:   Array.isArray(row.item_ids) ? row.item_ids : [],
    score:     row.score ?? 0,
    occasion:  row.occasion ?? null,
    createdAt: row.created_at,
  };
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  favoriteSigs: new Set<string>(),

  fetchFavorites: async (userId) => {
    const { data, error } = await supabase
      .from('favorite_combos')
      .select('id, signature, item_ids, score, occasion, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.warn('favoriler alınamadı:', error.message); return; }
    const favorites = (data ?? []).map(mapRow);
    set({ favorites, favoriteSigs: sigsOf(favorites) });
  },

  // İyimser: önce state (kalp anında dolsun), sonra Supabase; hata olursa geri al
  toggleFavorite: async (userId, combo, occasion) => {
    const sig = comboSignatureForCache(combo.items);
    if (pending.has(sig)) return;
    pending.add(sig);
    try {
      if (get().favoriteSigs.has(sig)) {
        // ── Silme ──
        const removed = get().favorites.filter((f) => f.signature === sig);
        set((s) => {
          const favorites = s.favorites.filter((f) => f.signature !== sig);
          return { favorites, favoriteSigs: sigsOf(favorites) };
        });
        const { error } = await supabase
          .from('favorite_combos')
          .delete()
          .eq('user_id', userId)
          .eq('signature', sig);
        if (error) {
          console.warn('favori silinemedi:', error.message);
          set((s) => {
            const favorites = [...removed, ...s.favorites].sort(byNewest);
            return { favorites, favoriteSigs: sigsOf(favorites) };
          });
        }
      } else {
        // ── Ekleme ──
        const tempId = `tmp_${Date.now()}`;
        const entry: FavoriteCombo = {
          id:        tempId,
          signature: sig,
          itemIds:   combo.items.map((i) => i.id),
          score:     combo.score,
          occasion,
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          const favorites = [entry, ...s.favorites];
          return { favorites, favoriteSigs: sigsOf(favorites) };
        });
        const { data, error } = await supabase
          .from('favorite_combos')
          .insert({
            user_id:  userId,
            signature: sig,
            item_ids: entry.itemIds,
            score:    entry.score,
            occasion,
          })
          .select('id, created_at')
          .single();
        if (error) {
          // 23505 = unique ihlali → bu imza zaten favoride; hata sayma, state doğru
          if (error.code === '23505') return;
          console.warn('favori eklenemedi:', error.message);
          set((s) => {
            const favorites = s.favorites.filter((f) => f.id !== tempId);
            return { favorites, favoriteSigs: sigsOf(favorites) };
          });
        } else if (data) {
          // Geçici id'yi gerçek kayıtla değiştir
          set((s) => ({
            favorites: s.favorites.map((f) =>
              f.id === tempId ? { ...f, id: data.id, createdAt: data.created_at } : f),
          }));
        }
      }
    } finally {
      pending.delete(sig);
    }
  },
}));

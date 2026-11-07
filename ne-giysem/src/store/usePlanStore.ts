import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { callEdge, edgeError } from '../lib/edgeFunctions';
import { sdkHasEntitlement } from '../lib/purchases';

// ─── Plan + kullanım — TEK KAYNAK sunucu: rpc('get_usage') (022) ─────────────
// Hard paywall: ücretsiz plan yok. plan 'trial' | 'premium' = erişim var; 'none' = gate.
// limit null = sınırsız. Yenileme: açılış, ön plana geliş, satın alma / geri yükleme.
// RPC başarısızsa önceki değer korunur; hiç okunamadıysa son bilinen erişim
// (AsyncStorage) kullanılır → ödeme yapmış kullanıcı ağ hatasında kilitlenmez.
// Asıl sınırı sunucu uygular.

export type Plan = 'trial' | 'premium' | 'none';
export type QuotaWindow = 'trial' | 'setup' | 'monthly' | 'none';

export interface Quota {
  used: number;
  limit: number | null;
  /** Premium: sonraki ay başı / kurulum ayı bitişi. Deneme: null (deneme sonu trial.ends_at) */
  reset_at: string | null;
  window: QuotaWindow;
}

export interface Usage {
  plan: Plan;
  access_expires_at: string | null;   // 'infinity' olabilir (süresiz)
  will_renew: boolean | null;
  trial: { started_at: string | null; ends_at: string | null } | null;
  trial_used: boolean;
  /** Erişim yoksa neyin bittiği (paywall başlığı); hiç abone olmamışsa null */
  ended: 'trial' | 'subscription' | null;
  wardrobe: { used: number; limit: number | null };
  tryon:    Quota;
  scan:     Quota;
  packshot: Quota;
}

/** Paywall'daki limit satırı — app_limits'ten (rpc get_limits). null = sınırsız */
export interface Limits {
  trial:   { packshot: number | null; tryon: number | null; scan: number | null };
  premium: {
    packshot_monthly: number | null; packshot_annual_setup: number | null;
    packshot_setup_days: number | null; packshot_daily: number | null;
    tryon_monthly: number | null; scan_monthly: number | null;
  };
}

const ACCESS_CACHE_KEY = 'plan.lastAccess';
type CachedAccess = { plan: Plan; expiresAt: string | null };

/** expires_at gelecekte mi ('infinity' dahil) */
function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  if (expiresAt === 'infinity') return true;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts > Date.now();
}

interface PlanState {
  plan: Plan;
  usage: Usage | null;
  limits: Limits | null;
  /** En az bir kez karar verildi mi (sunucu, önbellek ya da SDK) — gate yalnızca o zaman */
  loaded: boolean;
  refresh: () => Promise<Usage | null>;
  /** Satın alma / geri yükleme sonrası: önce sunucu senkronu, sonra get_usage */
  syncAfterPurchase: () => Promise<Usage | null>;
  loadLimits: () => Promise<Limits | null>;
  reset: () => void;
}

let inFlight: Promise<Usage | null> | null = null;

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: 'none',
  usage: null,
  limits: null,
  loaded: false,

  refresh: () => {
    // Aynı anda gelen çağrılar (açılış + ön plan + ekran) tek RPC'yi paylaşsın
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_usage');
        if (error || !data) {
          if (error) console.warn('[plan] get_usage:', error.message);
          await fallbackAccess(set, get);
          return null;
        }
        const usage = data as Usage;
        // Sunucu henüz senkronlanmadıysa (satın almadan saniyeler sonra) SDK'ya da bak
        const plan: Plan = usage.plan === 'none' && (await sdkHasEntitlement()) ? 'premium' : usage.plan;
        set({ usage, plan, loaded: true });
        try {
          await AsyncStorage.setItem(ACCESS_CACHE_KEY,
            JSON.stringify({ plan, expiresAt: usage.access_expires_at } satisfies CachedAccess));
        } catch { /* önbellek isteğe bağlı */ }
        return usage;
      } catch (e) {
        console.warn('[plan] get_usage exception:', e);
        await fallbackAccess(set, get);
        return null;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  syncAfterPurchase: async () => {
    try {
      const res = await callEdge('sync-entitlement', {});
      if (!res.ok) throw await edgeError(res);
    } catch (e) {
      // Webhook yine de yazacak; get_usage o ana kadar eski durumu gösterebilir
      console.warn('[plan] sync-entitlement:', e);
    }
    return get().refresh();
  },

  loadLimits: async () => {
    try {
      const { data, error } = await supabase.rpc('get_limits');
      if (error || !data) {
        if (error) console.warn('[plan] get_limits:', error.message);
        return get().limits;
      }
      set({ limits: data as Limits });
      return data as Limits;
    } catch (e) {
      console.warn('[plan] get_limits exception:', e);
      return get().limits;
    }
  },

  reset: () => {
    set({ plan: 'none', usage: null, limits: null, loaded: false });
    AsyncStorage.removeItem(ACCESS_CACHE_KEY).catch(() => {});
  },
}));

/** get_usage okunamadı: daha önce karar verildiyse dokunma; yoksa önbellek → SDK → gate */
async function fallbackAccess(
  set: (s: Partial<PlanState>) => void, get: () => PlanState,
): Promise<void> {
  if (get().loaded) return;
  let cached: CachedAccess | null = null;
  try {
    const raw = await AsyncStorage.getItem(ACCESS_CACHE_KEY);
    cached = raw ? (JSON.parse(raw) as CachedAccess) : null;
  } catch { /* önbellek okunamadı */ }
  if (cached && cached.plan !== 'none' && notExpired(cached.expiresAt)) {
    set({ plan: cached.plan, loaded: true });
    return;
  }
  if (await sdkHasEntitlement()) {
    set({ plan: 'premium', loaded: true });
    return;
  }
  set({ plan: 'none', loaded: true });
}

/** Erişim var mı (deneme ya da premium) */
export function hasAccess(plan: Plan): boolean {
  return plan === 'trial' || plan === 'premium';
}

/** Kalan hak; bilinmiyorsa null, sınırsızsa Infinity */
export function remaining(q: Quota | undefined | null): number | null {
  if (!q) return null;
  if (q.limit === null) return Infinity;
  return Math.max(0, q.limit - q.used);
}

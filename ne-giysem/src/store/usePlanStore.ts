import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { callEdge, edgeError } from '../lib/edgeFunctions';

// ─── Plan + kullanım — TEK KAYNAK sunucu: rpc('get_usage') (013) ─────────────
// limit null = sınırsız. Yenileme: açılış, ön plana geliş, satın alma / geri yükleme.
// RPC başarısızsa (ağ, 013 henüz çalışmamış) önceki değer korunur ve loaded false
// kalabilir → istemci ön kontrolleri engellemez; asıl sınırı sunucu uygular.

export type Plan = 'free' | 'premium';

export interface Usage {
  plan: Plan;
  premium_expires_at: string | null;   // 'infinity' olabilir (süresiz)
  will_renew: boolean | null;
  wardrobe: { used: number; limit: number | null };
  tryon:    { used: number; limit: number; reset_at: string | null };
  scan:     { used: number; limit: number | null; reset_at: string };
}

interface PlanState {
  plan: Plan;
  usage: Usage | null;
  /** En az bir kez başarıyla okundu mu (kilit UI'ları yalnızca o zaman gösterilir) */
  loaded: boolean;
  refresh: () => Promise<Usage | null>;
  /** Satın alma / geri yükleme sonrası: önce sunucu senkronu, sonra get_usage */
  syncAfterPurchase: () => Promise<Usage | null>;
  reset: () => void;
}

let inFlight: Promise<Usage | null> | null = null;

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: 'free',
  usage: null,
  loaded: false,

  refresh: () => {
    // Aynı anda gelen çağrılar (açılış + ön plan + ekran) tek RPC'yi paylaşsın
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_usage');
        if (error || !data) {
          if (error) console.warn('[plan] get_usage:', error.message);
          return null;
        }
        const usage = data as Usage;
        set({ usage, plan: usage.plan, loaded: true });
        return usage;
      } catch (e) {
        console.warn('[plan] get_usage exception:', e);
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

  reset: () => set({ plan: 'free', usage: null, loaded: false }),
}));

/** Premium satın alınmış ama süresi geçmiş mi (premium_expires_at geçmişte) */
export function premiumExpired(usage: Usage | null): boolean {
  if (!usage || usage.plan === 'premium' || !usage.premium_expires_at) return false;
  const ts = Date.parse(usage.premium_expires_at);
  return Number.isFinite(ts) && ts <= Date.now();
}

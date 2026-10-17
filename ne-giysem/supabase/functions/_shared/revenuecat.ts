// supabase/functions/_shared/revenuecat.ts
//
// RevenueCat → entitlements senkronu (revenuecat-webhook + sync-entitlement ortak kodu)
// ve abone silme (delete-account).
//
// Olay içeriğine güvenilmez: her seferinde REST v1 GET /subscribers/{id} ile güncel
// durum çekilir, 'premium' entitlement'ı entitlements tablosuna yazılır.
// app_user_id = Supabase auth.users.id (istemci Purchases.logIn(uid) ile bağlar).
//
// Gerekli secret: REVENUECAT_SECRET_API_KEY (sk_..., v1 REST)
// Opsiyonel:      REVENUECAT_ENTITLEMENT_ID (varsayılan 'premium')
//
// Hata mesajlarına kullanıcı kimliği YAZILMAZ — çağıranlar bunları ops_events'e iletir.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const RC_BASE = "https://api.revenuecat.com/v1";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Secret yoksa null — çağıran 503 + ops_events döner. */
export function revenueCatKey(): string | null {
  return Deno.env.get("REVENUECAT_SECRET_API_KEY") || null;
}

function entitlementId(): string {
  return Deno.env.get("REVENUECAT_ENTITLEMENT_ID") || "premium";
}

export interface EntitlementState {
  plan: "free" | "premium";
  expires_at: string | null;   // 'infinity' = süresiz
  will_renew: boolean | null;
  product_id: string | null;
  store: string | null;
  period_type: string | null;
}

const FREE: EntitlementState = {
  plan: "free", expires_at: null, will_renew: null, product_id: null, store: null, period_type: null,
};

// ── RevenueCat REST v1 yanıtının kullandığımız kısmı ─────────────────────────
interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
}
interface RcSubscription {
  expires_date: string | null;
  store?: string;
  period_type?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
}
interface RcSubscriber {
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
  non_subscriptions?: Record<string, { store?: string }[]>;
}

async function fetchSubscriber(key: string, appUserId: string): Promise<RcSubscriber> {
  const res = await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`revenuecat-get:${res.status}`);
  const body = await res.json().catch(() => null);
  if (!body?.subscriber) throw new Error("revenuecat-get:bad-body");
  return body.subscriber as RcSubscriber;
}

/** Android'de abonelik anahtarı 'urun:baseplan' olabilir — önce tam eşleşme. */
function findSubscription(sub: RcSubscriber, productId: string): RcSubscription | null {
  const subs = sub.subscriptions ?? {};
  if (subs[productId]) return subs[productId];
  const key = Object.keys(subs).find((k) => k.startsWith(`${productId}:`) || productId.startsWith(`${k}:`));
  return key ? subs[key] : null;
}

/** expires_date ile grace period bitişinin geç olanı; ikisi de null → süresiz. */
function effectiveExpiry(ent: RcEntitlement): string {
  if (ent.expires_date == null) return "infinity";
  const grace = ent.grace_period_expires_date;
  return grace && Date.parse(grace) > Date.parse(ent.expires_date) ? grace : ent.expires_date;
}

function toState(sub: RcSubscriber): EntitlementState | null {
  const ent = sub.entitlements?.[entitlementId()];
  if (!ent) return null;

  const expiresAt = effectiveExpiry(ent);
  const s = findSubscription(sub, ent.product_identifier);
  const store = s?.store ?? sub.non_subscriptions?.[ent.product_identifier]?.[0]?.store ?? null;

  // SDK'nın willRenew mantığı: süresiz/promosyon yenilenmez; iptal veya ödeme sorunu yoksa yeniler
  const willRenew = s != null
    && expiresAt !== "infinity"
    && store !== "promotional"
    && !s.unsubscribe_detected_at
    && !s.billing_issues_detected_at;

  const premium = expiresAt === "infinity" || Date.parse(expiresAt) > Date.now();
  return {
    plan: premium ? "premium" : "free",
    expires_at: expiresAt,
    will_renew: willRenew,
    product_id: ent.product_identifier ?? null,
    store,
    period_type: s?.period_type ?? null,
  };
}

/**
 * RevenueCat'ten çek → entitlements'a yaz.
 *   entitlement var  → upsert (süresi geçmişse de; premium_expires_at "bitti" mesajı için)
 *   entitlement yok  → satırı sil
 * Kullanıcı auth.users'ta yoksa (silinmiş) FK hatası yutulur → FREE döner.
 * Fırlatır: RevenueCat / DB hatası (mesajda kimlik yok).
 */
export async function syncEntitlement(
  admin: SupabaseClient, key: string, userId: string,
): Promise<EntitlementState> {
  const state = toState(await fetchSubscriber(key, userId));

  if (!state) {
    const { error } = await admin.from("entitlements").delete().eq("user_id", userId);
    if (error) throw new Error(`entitlements-delete:${error.code ?? "unknown"}`);
    return FREE;
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("entitlements").upsert({
    user_id:        userId,
    entitlement:    "premium",   // SQL kuralı bu değeri arar (RC'deki kimlik farklı olsa da)
    product_id:     state.product_id,
    store:          state.store,
    period_type:    state.period_type,
    expires_at:     state.expires_at,
    will_renew:     state.will_renew,
    updated_at:     now,
    last_synced_at: now,
  }, { onConflict: "user_id" });

  if (error) {
    // 23503 = foreign key: auth.users'ta yok (hesap silinmiş) → yazacak satır yok
    if (error.code === "23503") return FREE;
    throw new Error(`entitlements-upsert:${error.code ?? "unknown"}`);
  }
  return state;
}

/** Hesap silme: RevenueCat'teki abone kaydını sil. 404 = zaten yok → başarılı. */
export async function deleteSubscriber(key: string, userId: string): Promise<void> {
  const res = await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok && res.status !== 404) throw new Error(`revenuecat-delete:${res.status}`);
}

// supabase/functions/revenuecat-webhook/index.ts
//
// ⚠️ DEPLOY: RevenueCat Supabase JWT göndermez → gateway JWT doğrulaması KAPALI olmalı:
//    npx supabase functions deploy revenuecat-webhook --no-verify-jwt
//    Kimlik doğrulama burada: Authorization başlığı = REVENUECAT_WEBHOOK_SECRET
//    (RevenueCat → Integrations → Webhooks → "Authorization header value").
//
// Akış:
//   1. Authorization sabit zamanlı karşılaştırılır → uyuşmazsa 401
//   2. TEST olayı → 200
//   3. Olay türüne güvenilmez: app_user_id (TRANSFER'de transferred_from/to'daki tüm
//      kimlikler) için RevenueCat'ten güncel durum çekilir → entitlements (_shared/revenuecat.ts)
//   4. UUID olmayan kimlikler ($RCAnonymousID:... vb.) yoksayılır → 200
//   5. Hata → ops_events (kimliksiz) + 500 → RevenueCat yeniden dener
//
// Gerekli secret'lar: REVENUECAT_WEBHOOK_SECRET, REVENUECAT_SECRET_API_KEY
// Yoksa 503 + ops_events.

import { adminClient, json } from "../_shared/auth.ts";
import { reportOpsEvent } from "../_shared/ops.ts";
import { revenueCatKey, syncEntitlement, UUID_RE } from "../_shared/revenuecat.ts";

const SOURCE = "revenuecat-webhook";

/** Sabit zamanlı eşitlik: iki tarafın SHA-256'sı karşılaştırılır (uzunluk sızmaz). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  const admin  = adminClient();
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const rcKey  = revenueCatKey();
  if (!secret || !rcKey) {
    await reportOpsEvent(admin, SOURCE, "revenuecat_secrets_missing", {
      webhook_secret: !!secret, api_key: !!rcKey,
    });
    return json({ error: "service-unavailable" }, 503);
  }

  if (!(await safeEqual(req.headers.get("Authorization") ?? "", secret))) {
    console.error(`[${SOURCE}] 401 authorization mismatch`);
    return json({ error: "unauthorized" }, 401);
  }

  const body  = await req.json().catch(() => null);
  const event = body?.event;
  if (!event || typeof event.type !== "string") return json({ error: "bad-request" }, 400);

  if (event.type === "TEST") return json({ ok: true, test: true });

  const candidates = [
    typeof event.app_user_id === "string" ? event.app_user_id : null,
    ...(event.type === "TRANSFER"
      ? [...strings(event.transferred_from), ...strings(event.transferred_to)]
      : []),
  ];
  const ids = [...new Set(candidates.filter((id): id is string => !!id && UUID_RE.test(id)))];

  // Anonim / yabancı kimlik → bizde karşılığı yok
  if (ids.length === 0) return json({ ok: true, ignored: true });

  try {
    for (const id of ids) await syncEntitlement(admin, rcKey, id);
    console.log(`[${SOURCE}] ${event.type} · ${ids.length} abone senkronlandı`);
    return json({ ok: true, synced: ids.length });
  } catch (e) {
    await reportOpsEvent(admin, SOURCE, "revenuecat_webhook_failed", {
      event_type: event.type,
      error: e instanceof Error ? e.message : String(e),
    });
    return json({ error: "sync-failed" }, 500);
  }
});

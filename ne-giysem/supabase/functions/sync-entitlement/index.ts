// supabase/functions/sync-entitlement/index.ts
//
// İstemci satın alma / geri yükleme sonrası hemen çağırır — webhook gecikmesini
// beklemeden entitlements güncellensin. Yalnızca çağıranın kendi uid'i senkronlanır.
//
// Yanıt: { plan, expires_at, will_renew, product_id, store, period_type }
// Ayrıntılı limitler için istemci ardından get_usage() RPC'sini çağırır.
//
// Gerekli secret: REVENUECAT_SECRET_API_KEY (yoksa 503 + ops_events)
// Deploy: normal (JWT doğrulaması açık).

import { adminClient, requireUser, json, CORS, bumpUsage } from "../_shared/auth.ts";
import { reportOpsEvent, serviceUnavailable } from "../_shared/ops.ts";
import { revenueCatKey, syncEntitlement } from "../_shared/revenuecat.ts";

const SOURCE = "sync-entitlement";
// RevenueCat API'sini istemciden dövmeye karşı günlük tavan (normal kullanım: birkaç)
const DAILY_CAP = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  const admin = adminClient();
  try {
    const user = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    const rcKey = revenueCatKey();
    if (!rcKey) {
      await reportOpsEvent(admin, SOURCE, "revenuecat_secrets_missing", { api_key: false });
      return serviceUnavailable();
    }

    if (!(await bumpUsage(admin, user.id, "sync_entitlement", DAILY_CAP))) {
      return json({ error: "rate-limited" }, 429);
    }

    return json(await syncEntitlement(admin, rcKey, user.id));
  } catch (e) {
    await reportOpsEvent(admin, SOURCE, "revenuecat_sync_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return json({ error: "sync-failed" }, 500);
  }
});

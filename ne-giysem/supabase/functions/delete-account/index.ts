// supabase/functions/delete-account/index.ts
//
// Hesap silme (App Store 5.1.1(v), Google Play hesap silme politikası).
//
// Sıra:
//   1. Çağıranın kimliğini doğrula (kendi JWT'si) — kimse başkasının hesabını silemez.
//   2. Apple authorization code geldiyse → refresh token'a çevir → Apple'da iptal et.
//      Supabase bunu yapmıyor (supabase/auth#1308). Başarısız olursa silme YİNE DE sürer
//      (Apple TN3194: token elde edilemese de silme talebi yerine getirilmeli).
//   3. Storage: 3 bucket'taki <user_id>/ dosyalarını sil (storage cascade olmaz).
//   4. RevenueCat abone kaydını sil (DELETE /subscribers/{uid}). Başarısız olursa silme
//      YİNE DE sürer — log + ops_events (kimliksiz).
//   5. auth.users kaydını sil → profiles / style_profiles / wardrobe_items / combos /
//      favorite_combos / entitlements ON DELETE CASCADE ile otomatik gider.
//
// Gerekli secret'lar (npx supabase secrets set ...):
//   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID (= bundle id), APPLE_PRIVATE_KEY (.p8 içeriği)
//   REVENUECAT_SECRET_API_KEY (yoksa RevenueCat adımı atlanır + ops_events)
// Otomatik gelenler: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";
import { reportOpsEvent } from "../_shared/ops.ts";
import { deleteSubscriber, revenueCatKey } from "../_shared/revenuecat.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS = ["wardrobe-items", "mannequin-cache", "avatars"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Apple ────────────────────────────────────────────────────────────────

async function appleClientSecret(): Promise<string> {
  const teamId   = Deno.env.get("APPLE_TEAM_ID");
  const keyId    = Deno.env.get("APPLE_KEY_ID");
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  const rawKey   = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !clientId || !rawKey) throw new Error("apple-secrets-missing");

  // Secret tek satır olarak girildiyse \n kaçışlarını gerçek satır sonuna çevir
  const pem = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  const key = await importPKCS8(pem, "ES256");

  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);
}

async function revokeApple(code: string): Promise<string> {
  const clientId = Deno.env.get("APPLE_CLIENT_ID")!;
  const secret   = await appleClientSecret();
  const form     = { "Content-Type": "application/x-www-form-urlencoded" };

  // Tek kullanımlık kodu refresh token'a çevir
  const tokRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tokRes.ok || !tok.refresh_token) {
    return `token-exchange-failed:${tokRes.status}:${tok.error ?? "unknown"}`;
  }

  // Hemen iptal et — token hiçbir yere yazılmıyor
  const revRes = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token: tok.refresh_token,
      token_type_hint: "refresh_token",
    }),
  });
  return revRes.ok ? "revoked" : `revoke-failed:${revRes.status}`;
}

// ── Storage ──────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function purgeStorage(admin: any, uid: string): Promise<number> {
  let removed = 0;
  for (const bucket of BUCKETS) {
    // Dosyalar <uid>/<dosya> şeklinde düz duruyor. Sayfa sayfa sil.
    // Koruma: remove sessizce başarısız olursa sonsuz döngüye girmesin.
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
      if (error) throw new Error(`list:${bucket}:${error.message}`);
      if (!data || data.length === 0) break;

      const paths = data.map((f: { name: string }) => `${uid}/${f.name}`);
      const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
      if (rmErr) throw new Error(`remove:${bucket}:${rmErr.message}`);
      removed += paths.length;

      if (data.length < 1000) break;
    }
  }
  return removed;
}

// ── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const url     = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin   = createClient(url, service, { auth: { persistSession: false } });

    // 1) Kimlik: çağıranın kendi oturum token'ı
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));

    // 2) Apple iptali — en iyi çaba, silmeyi engellemez
    let apple = "skipped";
    if (typeof body?.appleAuthCode === "string" && body.appleAuthCode.length > 0) {
      try {
        apple = await revokeApple(body.appleAuthCode);
      } catch (e) {
        apple = `error:${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // 3) Storage
    const removed = await purgeStorage(admin, user.id);

    // 4) RevenueCat — en iyi çaba, silmeyi engellemez
    let revenuecat = "skipped";
    const rcKey = revenueCatKey();
    if (!rcKey) {
      await reportOpsEvent(admin, "delete-account", "revenuecat_secrets_missing", { api_key: false });
    } else {
      try {
        await deleteSubscriber(rcKey, user.id);
        revenuecat = "deleted";
      } catch (e) {
        revenuecat = `error:${e instanceof Error ? e.message : String(e)}`;
        await reportOpsEvent(admin, "delete-account", "revenuecat_delete_failed", { error: revenuecat });
      }
    }

    // 5) Kullanıcı → tüm tablolar cascade
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: "delete-failed", detail: delErr.message }, 500);

    console.log(`[delete-account] ${user.id} silindi · dosya:${removed} · apple:${apple} · revenuecat:${revenuecat}`);
    return json({ ok: true, removedFiles: removed, apple, revenuecat });
  } catch (e) {
    console.error("[delete-account]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

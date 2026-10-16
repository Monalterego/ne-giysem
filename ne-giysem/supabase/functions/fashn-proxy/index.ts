// supabase/functions/fashn-proxy/index.ts
//
// FASHN proxy'si — kimlik + kota + izin listesi sunucuda.
//
// action 'start'  → start_tryon: kota kontrolü + render_id (limit doluysa 402)
// action 'run'    → render_id zorunlu; model + girdi anahtarları izin listesinde,
//                   görsel URL'leri kullanıcının kendi storage'ı veya kendi FASHN çıktısı
// action 'status' → prediction id kullanıcının bir render'ına ait olmalı (403);
//                   completed ise çıktılar kaydedilir; model-create değilse render başarılı

import { adminClient, requireUser, json, CORS } from "../_shared/auth.ts";
import { reportOpsEvent, serviceUnavailable } from "../_shared/ops.ts";

const FASHN_BASE = "https://api.fashn.ai/v1";

// Model → izinli inputs anahtarları (src/utils/virtualModel.ts'te kullanılanlar)
const ALLOWED_INPUTS: Record<string, readonly string[]> = {
  "model-create": ["prompt", "aspect_ratio"],
  "tryon-v1.6":   ["model_image", "garment_image", "garment_photo_type", "category",
                   "mode", "segmentation_free", "seed", "output_format"],
  "tryon-max":    ["model_image", "product_image", "prompt", "resolution", "generation_mode"],
};

// Maliyeti etkileyen değerler koddaki değere sabit
const PINNED_VALUES: Record<string, Record<string, readonly unknown[]>> = {
  "tryon-max": { resolution: ["1k"] },
};

const IMAGE_FIELDS = ["model_image", "garment_image", "product_image"] as const;
const STORAGE_BUCKETS = new Set(["avatars", "wardrobe-items", "mannequin-cache"]);

// FASHN id formatı repoda/yanıtlarda görülmedi → biçim tahmini yok; yalnızca güvenli
// karakter kümesi (path enjeksiyonunu keser). Asıl kontrol: id'nin kullanıcıya ait olması.
const PREDICTION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** https://<proje>/storage/v1/object/(public|sign)/<bucket>/<uid>/<dosya...> mı? */
function isOwnStorageUrl(raw: string, uid: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  const origin = new URL(Deno.env.get("SUPABASE_URL")!).origin;
  if (url.origin !== origin) return false;

  const m = url.pathname.match(/^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return false;
  const [, , bucket, owner, rest] = m;
  if (!STORAGE_BUCKETS.has(bucket) || owner !== uid) return false;

  // Kodlanmış ../ ile başka klasöre kaçmayı engelle
  try {
    return rest.split("/").every((seg) => {
      const s = decodeURIComponent(seg);
      return s !== "" && s !== "." && s !== ".." && !s.includes("/");
    });
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function isAllowedImage(admin: any, raw: unknown, uid: string): Promise<boolean> {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  if (isOwnStorageUrl(raw, uid)) return true;
  // Kullanıcının daha önceki bir render'ında FASHN'ın döndürdüğü çıktı mı?
  const { data, error } = await admin.rpc("user_owns_output", { p_user: uid, p_url: raw });
  if (error) throw new Error(`user_owns_output: ${error.message}`);
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const key = Deno.env.get("FASHN_API_KEY");
    if (!key) return json({ error: "FASHN_API_KEY missing" }, 500);

    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      console.error(`[fashn-proxy] 400 invalid-body user=${user.id}`);
      return json({ error: "invalid-body" }, 400);
    }

    // Her 400 nedeni function log'una — istemci sürümü / eksik alan teşhisi için
    const bad = (reason: string, detail?: unknown) => {
      console.error(`[fashn-proxy] 400 ${reason}`, JSON.stringify({
        user:      user.id,
        action:    body.action ?? null,
        model:     body.payload?.model_name ?? null,
        render_id: body.render_id ?? null,
        keys:      Object.keys(body),
        ...(detail !== undefined ? { detail } : {}),
      }));
      return json({ error: reason }, 400);
    };

    // ── start ──────────────────────────────────────────────────────────────
    if (body.action === "start") {
      const { data, error } = await admin.rpc("start_tryon", { p_user: user.id });
      if (error) throw new Error(`start_tryon: ${error.message}`);
      if (!data?.allowed) {
        return json({ error: "quota-exceeded", used: data?.used ?? null, limit: data?.limit ?? null }, 402);
      }
      return json(data);
    }

    // ── run ────────────────────────────────────────────────────────────────
    if (body.action === "run") {
      const renderId = body.render_id;
      // render_id hiç yok → kota öncesi istemci paketi (OTA henüz uygulanmamış).
      // 426: istemci "uygulamayı kapatıp aç" der. Biçimi bozuksa normal 400.
      if (renderId === undefined) {
        console.error(`[fashn-proxy] 426 update-required user=${user.id} keys=${Object.keys(body).join(",")}`);
        return json({ error: "update-required" }, 426);
      }
      if (typeof renderId !== "string" || !UUID_RE.test(renderId)) {
        return bad("render_id required");
      }

      const modelName = body.payload?.model_name;
      const inputs    = body.payload?.inputs;
      const allowedKeys = typeof modelName === "string" ? ALLOWED_INPUTS[modelName] : undefined;
      if (!allowedKeys) return bad("model-not-allowed");
      if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
        return bad("invalid-inputs");
      }

      for (const k of Object.keys(inputs)) {
        if (!allowedKeys.includes(k)) return bad(`input-not-allowed:${k}`);
      }
      for (const [k, values] of Object.entries(PINNED_VALUES[modelName] ?? {})) {
        if (k in inputs && !values.includes(inputs[k])) {
          return bad(`value-not-allowed:${k}`);
        }
      }
      for (const f of IMAGE_FIELDS) {
        if (f in inputs && !(await isAllowedImage(admin, inputs[f], user.id))) {
          // Reddedilen URL de loga (yalnızca 200 karakter — yine de kullanıcı yolu içerir)
          return bad(`image-not-allowed:${f}`, String(inputs[f]).slice(0, 200));
        }
      }

      // FASHN'a gitmeden ÖNCE çağrı bütçesinden yer ayır
      const { data: reserved, error: resErr } = await admin.rpc("register_run", {
        p_user: user.id, p_render: renderId, p_prediction_id: null,
      });
      if (resErr) throw new Error(`register_run: ${resErr.message}`);
      if (reserved !== true) return json({ error: "run-budget-exceeded" }, 429);

      const res  = await fetch(`${FASHN_BASE}/run`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: modelName, inputs }),
      });
      const text = await res.text();
      // FASHN'ın kendi hatası istemciye aynı status ile geçer (400 dahil) — ayırt edilsin
      if (!res.ok) {
        console.error(`[fashn-proxy] upstream /run ${res.status} model=${modelName} render=${renderId}`, text.slice(0, 500));

        // Ölçülmüş biçim: 429 {"error":"OutOfCredits"}. 429'u istemciye geçirmeyiz —
        // 429 bizim run bütçemize (run-budget-exceeded) ayrılı.
        let upstreamError: unknown;
        try { upstreamError = JSON.parse(text)?.error; } catch { /* JSON değil */ }
        if (upstreamError === "OutOfCredits") {
          await reportOpsEvent(admin, "fashn-proxy", "fashn_out_of_credits", {
            status: res.status, model: modelName,
          });
          return serviceUnavailable();
        }
      }

      if (res.ok) {
        let id: unknown;
        try { id = JSON.parse(text)?.id; } catch { /* yanıt JSON değil */ }
        if (typeof id === "string" && PREDICTION_ID_RE.test(id)) {
          // Tür sunucuda belirlenir: model-create dışındakiler try-on → tamamlanınca başarı
          const { error: regErr } = await admin.rpc("register_run", {
            p_user: user.id, p_render: renderId, p_prediction_id: id,
            p_is_tryon: modelName !== "model-create",
          });
          if (regErr) throw new Error(`register_run(id): ${regErr.message}`);
        }
      }
      return new Response(text, { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (body.action === "status") {
      const id = body.id;
      if (typeof id !== "string" || !PREDICTION_ID_RE.test(id)) {
        return bad("invalid-id");
      }

      const { data: renderId, error: ownErr } = await admin.rpc("render_for_prediction", {
        p_user: user.id, p_prediction_id: id,
      });
      if (ownErr) throw new Error(`render_for_prediction: ${ownErr.message}`);
      if (!renderId) return json({ error: "forbidden" }, 403);

      const res  = await fetch(`${FASHN_BASE}/status/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${key}` },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[fashn-proxy] upstream /status ${res.status} id=${id}`, text.slice(0, 500));
      }

      if (res.ok) {
        // deno-lint-ignore no-explicit-any
        let s: any = null;
        try { s = JSON.parse(text); } catch { /* yanıt JSON değil */ }
        if (s?.status === "completed") {
          // Çıktıları kaydet + try-on ise render'ı başarılı işaretle — karar tamamen
          // sunucuda (istemcinin gönderdiği 'final' vb. alanlar yok sayılır)
          const outputs = (Array.isArray(s.output) ? s.output : [])
            .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("https://"));
          const { error } = await admin.rpc("complete_prediction", {
            p_user: user.id, p_render: renderId, p_prediction_id: id, p_urls: outputs,
          });
          if (error) throw new Error(`complete_prediction: ${error.message}`);
        }
      }
      return new Response(text, { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return bad("invalid action");
  } catch (e) {
    console.error("[fashn-proxy]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

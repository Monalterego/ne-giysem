// supabase/functions/garment-image/index.ts
//
// Kıyafet görselini hazırlama: FASHN packshot ("stüdyo görseli"). Adım 8-10 (G3).
// FASHN background-remove HİÇBİR dalda kullanılmaz (karar 07.11.2026); packshot yoksa ya
// da başarısızsa istemci cihaz üstü kesime (modules/garment-cutout) düşer.
//
// Packshot modeli FASHN dokümanında YOK (07.11.2026): yalnızca /run'ın 400 yanıtından
// `product_image` zorunlu olduğu biliniyor. Bu yüzden:
//   • girdi yalnızca product_image + return_base64 (başka parametre gönderilmez — maliyeti
//     ve geçerli değerleri bilinmiyor; ölçüm: docs/plans/packshot-gecis-inceleme.md)
//   • çıktı savunmacı ayrıştırılır (firstOutputCandidate): data URI beklenir; https URL
//     gelirse sunucu indirip base64'e çevirir ve bunu loglar (gizlilik metni 60 dk diyor)
//   • completed gövdesinin biçimi her işte loglanır (output shape, boyut)
//
// action 'start'  { image_b64 } (yeni parça, JPEG base64, önek yok) YA DA { item_id }
//                 ("stüdyo kalitesine yükselt": parçanın kayıtlı görseli 10 dk imzalı URL)
//                 → ai_processing 2.0 → start_garment_job (kota + günlük tavan) → FASHN /run
//                 ← { job_id, used, limit, reset_at, window } | 402 quota-exceeded | 429 daily-limit
// action 'status' { job_id } → iş kullanıcının olmalı → FASHN /status
//                 ← { status } | completed: { status, image_b64, mime } | failed: { status, error }
//
// Kota / iade (021_garment_jobs.sql): rezervasyon start'ta; completed → kalıcı;
// /run başarısız (her türlü — FASHN işi başlamadı, kredi yok) ya da /status failed
// (moderasyon dahil; FASHN başarısız işi ücretlendirmez) → fail_garment_job = iade.
// /status'un HTTP hatası geçici sayılır, iade yok. Kullanıcı packshot'ı reddederse iade yok.

import { adminClient, requireUser, json, CORS } from "../_shared/auth.ts";
import { reportOpsEvent, serviceUnavailable } from "../_shared/ops.ts";
import { aiConsentGate } from "../_shared/consent.ts";
import {
  fashnKey, fashnRun, fashnStatus, isOutOfCredits, parsePredictionId, parseStatus,
  firstOutputCandidate, parseImageDataUri, decodeBase64, encodeBase64,
} from "../_shared/fashn.ts";

const SOURCE = "garment-image";

// İstemci görseli 1400px JPEG'e indiriyor (anthropic-proxy / bg-removal-proxy ile aynı tavan)
const MAX_IMAGE_B64    = 2_000_000;
// Çıktı tavanı (bucket sınırı, 019_storage_limits) — istemciye base64 olarak döner
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_S = 10 * 60;   // FASHN'a giden bağlantılar (storageUrls.ts ile aynı)
const ITEMS_BUCKET     = "wardrobe-items";
const OBJECT_PREFIX    = "/storage/v1/object/";

const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** İşçinin CPU süresi (ms); ortam sunmuyorsa null */
function cpuMs(): number | null {
  // deno-lint-ignore no-explicit-any
  const u = (globalThis as any).process?.cpuUsage?.();
  return u && typeof u.user === "number" ? (u.user + u.system) / 1000 : null;
}

/** DB değeri (yol ya da eski tam URL) → bucket içi yol; kullanıcının klasöründe değilse null */
function itemPath(value: unknown, uid: string): string | null {
  if (typeof value !== "string" || !value) return null;
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const p = new URL(value).pathname;
      const m = p.match(/^\/storage\/v1\/object\/(?:public|sign)\/wardrobe-items\/(.+)$/);
      if (!m || !p.startsWith(OBJECT_PREFIX)) return null;
      path = decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  path = path.split("?")[0];
  if (!path.startsWith(`${uid}/`)) return null;
  const rest = path.slice(uid.length + 1);
  if (!rest || rest.split("/").some((s) => s === "" || s === "." || s === "..")) return null;
  return path;
}

// deno-lint-ignore no-explicit-any
async function refund(admin: any, uid: string, jobId: string, reason: string) {
  const { data, error } = await admin.rpc("fail_garment_job", { p_user: uid, p_job: jobId });
  if (error) console.error(`[${SOURCE}] fail_garment_job ${jobId}: ${error.message}`);
  else console.error(`[${SOURCE}] iş ${jobId} iade (${reason}) → ${data === true ? "ok" : "zaten iade/başarılı"}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);
  const cpuStart = cpuMs();

  try {
    const key = fashnKey();
    if (!key) return json({ error: "FASHN_API_KEY missing" }, 500);

    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Yapay zekâ izni (2.0) — kıyafet fotoğrafı FASHN'a gider
    const gate = await aiConsentGate(admin, user.id);
    if (gate) return gate;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid-body" }, 400);

    const bad = (reason: string) => {
      console.error(`[${SOURCE}] 400 ${reason}`, JSON.stringify({ user: user.id, action: body.action ?? null }));
      return json({ error: reason }, 400);
    };

    // ── start ──────────────────────────────────────────────────────────────
    if (body.action === "start") {
      const hasImage = body.image_b64 !== undefined;
      const hasItem  = body.item_id !== undefined;
      if (hasImage === hasItem) return bad("image_b64-or-item_id");

      // Girdi doğrulaması rezervasyondan ÖNCE (bizim 400'lerimiz kotaya dokunmaz)
      let productImage: string;
      let itemId: string | null = null;
      if (hasImage) {
        const b64 = body.image_b64;
        if (typeof b64 !== "string" || !b64) return bad("image_b64-required");
        if (b64.length > MAX_IMAGE_B64) return json({ error: "image-too-large" }, 413);
        // JPEG (toUploadJpeg çıktısı) — base64 "/9j/" ile başlar
        if (!b64.startsWith("/9j/") || !BASE64_RE.test(b64)) return bad("image-not-jpeg");
        productImage = `data:image/jpeg;base64,${b64}`;
      } else {
        if (typeof body.item_id !== "string" || !UUID_RE.test(body.item_id)) return bad("item_id-invalid");
        itemId = body.item_id;
        const { data: item, error: itemErr } = await admin
          .from("wardrobe_items")
          .select("processed_image_url")
          .eq("id", itemId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (itemErr) throw new Error(`wardrobe_items: ${itemErr.message}`);
        if (!item) return json({ error: "item-not-found" }, 404);
        const path = itemPath(item.processed_image_url, user.id);
        if (!path) return bad("item-image-invalid");
        const { data: signed, error: sErr } = await admin.storage.from(ITEMS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_S);
        if (sErr || !signed?.signedUrl) throw new Error(`sign: ${sErr?.message ?? "boş"}`);
        productImage = signed.signedUrl;
      }

      const { data: start, error: startErr } = await admin.rpc("start_garment_job", {
        p_user: user.id, p_kind: "packshot", p_item: itemId,
      });
      if (startErr) throw new Error(`start_garment_job: ${startErr.message}`);
      if (!start?.allowed) {
        if (start?.error === "daily-limit")    return json({ error: "daily-limit" }, 429);
        if (start?.error === "item-not-found") return json({ error: "item-not-found" }, 404);
        if (start?.error)                      return json({ error: start.error }, 409);
        return json({
          error: "quota-exceeded",
          used: start?.used ?? null, limit: start?.limit ?? null,
          plan: start?.plan ?? null, window: start?.window ?? null, reset_at: start?.reset_at ?? null,
        }, 402);
      }
      const jobId: string = start.job_id;

      // Yalnızca zorunlu alan + base64 çıktı (bkz. dosya başı)
      const res = await fashnRun(key, "packshot", { product_image: productImage, return_base64: true });
      if (!res.ok) {
        console.error(`[${SOURCE}] upstream /run ${res.status} job=${jobId}`, res.text.slice(0, 500));
        // FASHN işi başlamadı → kredi yok → her durumda iade (istemci cihaz kesimine düşer)
        await refund(admin, user.id, jobId, `upstream-run-${res.status}`);
        if (isOutOfCredits(res.text)) {
          await reportOpsEvent(admin, SOURCE, "fashn_out_of_credits", { status: res.status, model: "packshot" });
          return serviceUnavailable();
        }
        if (res.status >= 500) return serviceUnavailable();
        // 4xx: girdi reddi (örn. InputValidationError) — kodu istemciye geçir
        return json({ error: "packshot-rejected", status: res.status }, 422);
      }

      const predictionId = parsePredictionId(res.text);
      if (!predictionId) {
        console.error(`[${SOURCE}] /run yanıtında id yok job=${jobId}`, res.text.slice(0, 300));
        await refund(admin, user.id, jobId, "no-prediction-id");
        return json({ error: "upstream-bad-response" }, 502);
      }
      console.log(`[${SOURCE}] packshot run job=${jobId} prediction=${predictionId} credits_used=${res.creditsUsed ?? "?"}`);
      const { error: regErr } = await admin.rpc("register_garment_prediction", {
        p_user: user.id, p_job: jobId, p_prediction: predictionId,
      });
      if (regErr) throw new Error(`register_garment_prediction: ${regErr.message}`);

      return json({
        job_id: jobId, used: start.used, limit: start.limit,
        reset_at: start.reset_at ?? null, window: start.window ?? null,
      });
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (body.action === "status") {
      const jobId = body.job_id;
      if (typeof jobId !== "string" || !UUID_RE.test(jobId)) return bad("job_id-invalid");

      const { data: job, error: jobErr } = await admin
        .from("garment_jobs")
        .select("prediction_id, succeeded_at, failed_at")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (jobErr) throw new Error(`garment_jobs: ${jobErr.message}`);
      if (!job) return json({ error: "forbidden" }, 403);
      if (job.failed_at) return json({ status: "failed", error: { name: "Refunded" } });
      if (!job.prediction_id) return json({ status: "starting" });

      const res = await fashnStatus(key, job.prediction_id);
      if (!res.ok) {
        // Yoklama hatası geçici olabilir; iade yok
        console.error(`[${SOURCE}] upstream /status ${res.status} job=${jobId}`, res.text.slice(0, 300));
        if (isOutOfCredits(res.text)) {
          await reportOpsEvent(admin, SOURCE, "fashn_out_of_credits", { status: res.status, at: "status" });
        }
        return serviceUnavailable();
      }

      const s = parseStatus(res.text);
      if (!s) {
        console.error(`[${SOURCE}] /status JSON değil job=${jobId}`, res.text.slice(0, 300));
        return json({ error: "upstream-bad-response" }, 502);
      }

      if (s.status === "failed") {
        // Moderasyon (ContentModerationError) dahil — FASHN ücretlendirmez → iade
        console.error(`[${SOURCE}] prediction failed job=${jobId}`, JSON.stringify(s.error ?? null).slice(0, 300));
        await refund(admin, user.id, jobId, `prediction-failed:${s.error?.name ?? "?"}`);
        return json({ status: "failed", error: { name: s.error?.name ?? null, message: s.error?.message ?? null } });
      }

      if (s.status !== "completed") return json({ status: s.status ?? "processing" });

      // completed — belgelenmemiş model: biçimi her seferinde logla
      const { value, shape } = firstOutputCandidate(s);
      let mime: string;
      let bytes: Uint8Array;
      let outputKind: "data-uri" | "url";
      const img = parseImageDataUri(value);
      if (img) {
        outputKind = "data-uri";
        mime = img.mime;
        try { bytes = decodeBase64(img.base64); } catch { bytes = new Uint8Array(0); }
      } else if (typeof value === "string" && value.startsWith("https://")) {
        // return_base64 yok sayıldı → FASHN CDN'inde 3 gün kalır (gizlilik metni 60 dk diyor)
        outputKind = "url";
        console.error(`[${SOURCE}] packshot URL döndü (return_base64 yok sayıldı?) job=${jobId}`);
        const dl = await fetch(value);
        const type = (dl.headers.get("content-type") ?? "").split(";")[0].trim();
        if (!dl.ok || !["image/jpeg", "image/png", "image/webp"].includes(type)) {
          console.error(`[${SOURCE}] çıktı indirilemedi ${dl.status} ${type} job=${jobId}`);
          await refund(admin, user.id, jobId, "output-download");
          return json({ status: "failed", error: { name: "OutputUnavailable" } });
        }
        mime = type;
        bytes = new Uint8Array(await dl.arrayBuffer());
      } else {
        console.error(`[${SOURCE}] completed ama görsel yok job=${jobId} shape=${shape}`,
          typeof value === "string" ? value.slice(0, 40) : String(value));
        await refund(admin, user.id, jobId, "output-missing");
        return json({ status: "failed", error: { name: "OutputUnavailable" } });
      }

      if (!bytes.length || bytes.length > MAX_OUTPUT_BYTES) {
        console.error(`[${SOURCE}] çıktı boyutu geçersiz ${bytes.length} job=${jobId}`);
        await refund(admin, user.id, jobId, "output-size");
        return json({ status: "failed", error: { name: "OutputUnavailable" } });
      }

      const { error: doneErr } = await admin.rpc("complete_garment_job", { p_user: user.id, p_job: jobId });
      if (doneErr) throw new Error(`complete_garment_job: ${doneErr.message}`);

      const cpuEnd = cpuMs();
      console.log(`[${SOURCE}] packshot completed`, JSON.stringify({
        job: jobId, shape, output_kind: outputKind, mime, bytes: bytes.length,
        response_keys: Object.keys(s), credits_used: res.creditsUsed,
        cpu_ms: cpuStart !== null && cpuEnd !== null ? Math.round((cpuEnd - cpuStart) * 10) / 10 : null,
      }));

      return json({ status: "completed", image_b64: encodeBase64(bytes), mime });
    }

    return bad("invalid action");
  } catch (e) {
    console.error(`[${SOURCE}]`, e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

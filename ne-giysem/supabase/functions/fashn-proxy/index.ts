// supabase/functions/fashn-proxy/index.ts
//
// FASHN proxy'si — kimlik + kota + izin listesi sunucuda.
//
// action 'start'  → start_tryon: kota kontrolü + render_id (limit doluysa 402)
//                   deneme: toplam trial.tryon_total · premium: premium.tryon_monthly / takvim
//                   ayı (022, app_limits); abonelik / deneme yoksa 403 subscription-required
// action 'run'    → render_id zorunlu; model + girdi anahtarları izin listesinde,
//                   görsel URL'leri kullanıcının kendi storage'ı veya kendi FASHN çıktısı
// action 'status' → prediction id kullanıcının bir render'ına ait olmalı (403);
//                   completed ise çıktılar kaydedilir; model-create değilse render başarılı
// action 'finish' → deneme sonu: son ara çıktıyı try-on cache anahtarına kopyalar (isteğe
//                   bağlı) ve render'ın ara dosyalarını (tmp_) siler
//
// Çıktılar (return_base64, sunucu ekler): FASHN çıktıyı CDN'e koymaz, base64 döner (FASHN
// beyanı: 60 dk erişilebilir). completed'da proxy görseli mannequin-cache'e yazar:
//   try-on katmanı → <uid>/tmp_<render>_<prediction>.<jpg|png>  (deneme bitince silinir)
//   model-create   → <uid>/base_mannequin.png
// ve istemciye base64 yerine 10 dk'lık imzalı URL + path döner. Sonraki katman bu URL'i
// model_image olarak gönderir (isOwnStorageUrl kabul eder). Dosyalar alt klasörde DEĞİL:
// delete-account ve export-my-data yalnızca <uid>/ kökünü listeliyor.
//
// Rıza (consent_events, 014) — eksikse 403 { error: 'consent-required', kinds };
// verilmiş ama metin sürümü eskiyse (_shared/consent.ts MIN_CONSENT_MAJOR)
// 403 { error: 'consent-version-outdated', kinds }:
//   start : tryon_photo YA DA tryon_physical'dan en az biri (kota düşmeden önce)
//   run   : model-create                    → tryon_physical (fiziksel bilgi → manken tarifi)
//           model_image avatars bucket'ında → tryon_photo    (profil fotoğrafı)

import { adminClient, requireUser, json, CORS } from "../_shared/auth.ts";
import { reportOpsEvent, serviceUnavailable } from "../_shared/ops.ts";
import { consentState, consentRequired } from "../_shared/consent.ts";
import type { ConsentKind } from "../_shared/consent.ts";
import { accessGate } from "../_shared/access.ts";
import {
  fashnKey, fashnRun, fashnStatus, isOutOfCredits, parsePredictionId, parseStatus,
  httpsOutputs, parseImageDataUri, decodeBase64, PREDICTION_ID_RE,
} from "../_shared/fashn.ts";
import type { DataUriImage, FashnStatusBody } from "../_shared/fashn.ts";

// Model → izinli inputs anahtarları (src/utils/virtualModel.ts'te kullanılanlar).
// return_base64 burada YOK: istemci gönderemez (400), sunucu her çağrıya ekler.
const ALLOWED_INPUTS: Record<string, readonly string[]> = {
  "model-create": ["prompt", "aspect_ratio"],
  "tryon-v1.6":   ["model_image", "garment_image", "garment_photo_type", "category",
                   "mode", "segmentation_free", "seed", "output_format"],
  "tryon-max":    ["model_image", "product_image", "prompt", "resolution", "generation_mode",
                   "output_format"],
};

// Maliyeti etkileyen değerler koddaki değere sabit. Sabitlenen anahtar ZORUNLU:
// gönderilmezse FASHN varsayılanı (maliyeti bilinmiyor) devreye girerdi → 400.
// tryon-max output_format: varsayılan png idi, cache'e .jpg adıyla yazılıyordu → jpeg
const PINNED_VALUES: Record<string, Record<string, readonly unknown[]>> = {
  "tryon-max": { resolution: ["1k"], generation_mode: ["balanced"], output_format: ["jpeg"] },
};

// Gönderilmezse sunucunun eklediği değerler (PINNED_VALUES kontrolünden ÖNCE). Maliyeti
// etkilemeyen anahtarlar için: eski bundle göndermiyor, 400 yerine sabit değer eklenir.
// Gönderilmiş ama farklı değer → yine PINNED_VALUES'tan 400.
const DEFAULT_VALUES: Record<string, Record<string, unknown>> = {
  "tryon-max": { output_format: "jpeg" },
};

const IMAGE_FIELDS = ["model_image", "garment_image", "product_image"] as const;
const STORAGE_BUCKETS = new Set(["avatars", "wardrobe-items", "mannequin-cache"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Çıktı depolama ──────────────────────────────────────────────────────────
const OUTPUT_BUCKET     = "mannequin-cache";
const BASE_MANNEQUIN    = "base_mannequin.png";          // privacyActions.ts ile aynı ad
const TMP_PREFIX        = "tmp_";
const MAX_OUTPUT_BYTES  = 10 * 1024 * 1024;              // bucket sınırı (019_storage_limits)
const OUTPUT_LINK_TTL_S = 10 * 60;                       // FASHN'a giden bağlantılarla aynı (storageUrls.ts)
const TMP_MAX_AGE_MS    = 60 * 60 * 1000;                // start'ta bundan eski ara dosyalar silinir
// tmp_<render uuid>_<prediction id>.<jpg|png|webp> — prediction id PREDICTION_ID_RE karakterleri
// (webp: parseImageDataUri kabul ediyor; try-on çıktısı bugün jpeg/png)
const TMP_NAME_RE   = /^tmp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[A-Za-z0-9_-]{1,128}\.(jpg|png|webp)$/i;
// Try-on cache adı: v2_<sıralı parça id'leri>_<manken sürümü>.jpg (virtualModel tryOnCacheSignature)
const CACHE_NAME_RE = /^v2_[A-Za-z0-9_-]{1,900}\.jpg$/;

/** İşçinin CPU süresi (ms, user+system). Çalışma ortamı sunmuyorsa null. */
function cpuMs(): number | null {
  // deno-lint-ignore no-explicit-any
  const u = (globalThis as any).process?.cpuUsage?.();
  return u && typeof u.user === "number" ? (u.user + u.system) / 1000 : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Çıktı okunamıyor (süresi dolmuş "_expired", bozuk base64, sınır üstü) → 410; istemci yoklamayı bırakır */
function outputUnavailable(id: string, reason: string) {
  console.error(`[fashn-proxy] 410 output-unavailable id=${id} reason=${reason}`);
  return json({ error: "output-unavailable" }, 410);
}

/**
 * Kullanıcının <uid>/ kökündeki tmp_ dosyalarından `shouldRemove` true dönenleri siler.
 * Asla fırlatmaz (temizlik ana akışı bozmasın); silinen sayısını döner.
 */
async function removeTemp(
  // deno-lint-ignore no-explicit-any
  admin: any, uid: string, shouldRemove: (f: { name: string; created_at?: string | null }) => boolean,
): Promise<number> {
  try {
    const { data, error } = await admin.storage.from(OUTPUT_BUCKET)
      .list(uid, { limit: 1000, search: TMP_PREFIX });
    if (error) { console.error(`[fashn-proxy] tmp listelenemedi: ${error.message}`); return 0; }
    const paths = (data ?? [])
      // deno-lint-ignore no-explicit-any
      .filter((f: any) => f.id && typeof f.name === "string" && f.name.startsWith(TMP_PREFIX) && shouldRemove(f))
      // deno-lint-ignore no-explicit-any
      .map((f: any) => `${uid}/${f.name}`);
    if (!paths.length) return 0;
    const { error: rmErr } = await admin.storage.from(OUTPUT_BUCKET).remove(paths);
    if (rmErr) { console.error(`[fashn-proxy] tmp silinemedi: ${rmErr.message}`); return 0; }
    return paths.length;
  } catch (e) {
    console.error("[fashn-proxy] tmp temizliği", e);
    return 0;
  }
}

/**
 * completed + base64 çıktı → mannequin-cache'e yaz, yanıtı imzalı URL + path ile yeniden yaz.
 * Storage hatası → 503: istemci 5xx'te yoklamaya devam eder, sonraki completed yanıtında
 * (FASHN'da 60 dk erişilebilir) yeniden denenir. complete_prediction tekrarı zararsız
 * (mark_render_success coalesce, output_urls distinct).
 */
async function persistOutput(
  // deno-lint-ignore no-explicit-any
  admin: any, uid: string, renderId: string, id: string,
  s: FashnStatusBody, img: DataUriImage, cpuStart: number | null,
): Promise<Response> {
  // Tür sunucu kaydından: try-on katmanı mı, model-create mi (register_run p_is_tryon)
  const { data: render, error: rErr } = await admin
    .from("tryon_renders")
    .select("tryon_prediction_ids")
    .eq("id", renderId)
    .eq("user_id", uid)
    .maybeSingle();
  if (rErr) throw new Error(`tryon_renders: ${rErr.message}`);
  const isTryon = ((render?.tryon_prediction_ids ?? []) as string[]).includes(id);
  const path = isTryon ? `${uid}/${TMP_PREFIX}${renderId}_${id}.${img.ext}` : `${uid}/${BASE_MANNEQUIN}`;

  const t0 = performance.now();
  let bytes: Uint8Array;
  try { bytes = decodeBase64(img.base64); } catch { return outputUnavailable(id, "invalid-base64"); }
  const decodeMs = performance.now() - t0;
  if (bytes.length > MAX_OUTPUT_BYTES) return outputUnavailable(id, `too-large:${bytes.length}`);

  const t1 = performance.now();
  const { error: upErr } = await admin.storage.from(OUTPUT_BUCKET)
    .upload(path, bytes, { upsert: true, contentType: img.mime });
  const uploadMs = performance.now() - t1;
  if (upErr) {
    console.error(`[fashn-proxy] çıktı yazılamadı id=${id}: ${upErr.message}`);
    return serviceUnavailable();
  }

  const { data: signed, error: sErr } = await admin.storage.from(OUTPUT_BUCKET)
    .createSignedUrl(path, OUTPUT_LINK_TTL_S);
  if (sErr || !signed?.signedUrl) {
    console.error(`[fashn-proxy] çıktı imzalanamadı id=${id}: ${sErr?.message ?? "boş"}`);
    return serviceUnavailable();
  }

  const cpuEnd = cpuMs();
  console.log("[fashn-proxy] output saved", JSON.stringify({
    id, render: renderId, kind: isTryon ? "tryon" : "mannequin", mime: img.mime,
    bytes: bytes.length, b64_chars: img.base64.length,
    decode_ms: round1(decodeMs), upload_ms: round1(uploadMs),
    // İstek başından beri işçi CPU'su (ağ beklemesi dahil değil); ortam sunmuyorsa null
    cpu_ms: cpuStart !== null && cpuEnd !== null ? round1(cpuEnd - cpuStart) : null,
  }));

  return json({ ...s, output: [signed.signedUrl], path }, 200);
}

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

/** Kendi storage URL'inin bucket'ı (isOwnStorageUrl'den SONRA çağrılır); değilse null */
function storageBucket(raw: string): string | null {
  try {
    const m = new URL(raw).pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\//);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * ÜST SERVİS hatasında render'ı iade et (kotadan düşmesin), sonra 503.
 * Yalnızca /run'da (iş başlamadı: OutOfCredits ya da 5xx). /status'un HTTP hatasında
 * ÇAĞRILMAZ (geçici yoklama hatası). Bizim 400/403/426/429
 * doğrulamalarımızda ÇAĞRILMAZ (istemci bilerek hata üretip kotasını geri alamasın).
 * İade başarısız olsa da 503 döner; hata loglanır.
 */
// deno-lint-ignore no-explicit-any
async function refundAndUnavailable(admin: any, uid: string, renderId: string, reason: string) {
  const { data, error } = await admin.rpc("fail_render", { p_user: uid, p_render: renderId });
  if (error) console.error(`[fashn-proxy] fail_render ${renderId}: ${error.message}`);
  else console.error(`[fashn-proxy] render ${renderId} iade (${reason}) → ${data === true ? "ok" : "zaten iade/yok"}`);
  return serviceUnavailable();
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
  const cpuStart = cpuMs();

  try {
    const key = fashnKey();
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
      // Hard paywall (022): abonelik / deneme yoksa render açılmaz. Yalnızca start'ta:
      // açılmış bir denemenin run / status / finish adımları yarıda kesilmesin.
      const access = await accessGate(admin, user.id);
      if (access) return access;

      // Sanal deneme rızalarından en az biri geçerli değilse render açılmaz (kota düşmez).
      // Hiçbiri geçerli değil ama biri eski sürümle verilmişse → consent-version-outdated
      const [photo, physical] = await Promise.all([
        consentState(admin, user.id, "tryon_photo"),
        consentState(admin, user.id, "tryon_physical"),
      ]);
      if (photo !== "granted" && physical !== "granted") {
        const outdated = ([["tryon_photo", photo], ["tryon_physical", physical]] as const)
          .filter(([, s]) => s === "outdated").map(([k]) => k as ConsentKind);
        return outdated.length
          ? consentRequired("consent-version-outdated", outdated)
          : consentRequired("consent-required", ["tryon_photo", "tryon_physical"]);
      }

      // Yarım kalmış denemelerin (çökme, ağ kopması — finish gelmedi) ara dosyaları
      const swept = await removeTemp(admin, user.id, (f) =>
        !f.created_at || Date.now() - Date.parse(f.created_at) > TMP_MAX_AGE_MS);
      if (swept) console.log(`[fashn-proxy] start: ${swept} eski ara dosya silindi user=${user.id}`);

      const { data, error } = await admin.rpc("start_tryon", { p_user: user.id });
      if (error) throw new Error(`start_tryon: ${error.message}`);
      if (!data?.allowed) {
        if (data?.error === "subscription-required") return json({ error: "subscription-required" }, 403);
        return json({
          error: "quota-exceeded",
          used: data?.used ?? null,
          limit: data?.limit ?? null,
          plan: data?.plan ?? null,
          window: data?.window ?? null,
          reset_at: data?.reset_at ?? null,   // premium: sonraki ayın 1'i (Istanbul); deneme: null
        }, 402);
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
      for (const [k, v] of Object.entries(DEFAULT_VALUES[modelName] ?? {})) {
        if (!(k in inputs)) inputs[k] = v;
      }
      for (const [k, values] of Object.entries(PINNED_VALUES[modelName] ?? {})) {
        if (!(k in inputs)) return bad(`value-required:${k}`);
        if (!values.includes(inputs[k])) {
          return bad(`value-not-allowed:${k}`, inputs[k]);
        }
      }
      for (const f of IMAGE_FIELDS) {
        if (f in inputs && !(await isAllowedImage(admin, inputs[f], user.id))) {
          // Reddedilen URL de loga (yalnızca 200 karakter — yine de kullanıcı yolu içerir)
          return bad(`image-not-allowed:${f}`, String(inputs[f]).slice(0, 200));
        }
      }

      // Rıza: bu çağrının FASHN'a gönderdiği kişisel veriye göre (run bütçesinden ÖNCE)
      const needed: ConsentKind[] = [];
      if (modelName === "model-create") needed.push("tryon_physical");
      if (typeof inputs.model_image === "string" && storageBucket(inputs.model_image) === "avatars") {
        needed.push("tryon_photo");
      }
      const missing: ConsentKind[] = [];
      const outdated: ConsentKind[] = [];
      for (const kind of needed) {
        const state = await consentState(admin, user.id, kind);
        if (state === "missing") missing.push(kind);
        else if (state === "outdated") outdated.push(kind);
      }
      if (missing.length) {
        console.error(`[fashn-proxy] 403 consent-required user=${user.id} model=${modelName} missing=${missing.join(",")}`);
        return consentRequired("consent-required", missing);
      }
      if (outdated.length) {
        console.error(`[fashn-proxy] 403 consent-version-outdated user=${user.id} model=${modelName} kinds=${outdated.join(",")}`);
        return consentRequired("consent-version-outdated", outdated);
      }

      // FASHN'a gitmeden ÖNCE çağrı bütçesinden yer ayır
      const { data: reserved, error: resErr } = await admin.rpc("register_run", {
        p_user: user.id, p_render: renderId, p_prediction_id: null,
      });
      if (resErr) throw new Error(`register_run: ${resErr.message}`);
      if (reserved !== true) return json({ error: "run-budget-exceeded" }, 429);

      // Çıktı CDN'e değil yanıta (base64) — completed'da bizim storage'a yazılır
      const res  = await fashnRun(key, modelName, { ...inputs, return_base64: true });
      const text = res.text;
      // FASHN'ın kendi hatası istemciye aynı status ile geçer (400 dahil) — ayırt edilsin
      if (!res.ok) {
        console.error(`[fashn-proxy] upstream /run ${res.status} model=${modelName} render=${renderId}`, text.slice(0, 500));

        // Ölçülmüş biçim: 429 {"error":"OutOfCredits"}. 429'u istemciye geçirmeyiz —
        // 429 bizim run bütçemize (run-budget-exceeded) ayrılı.
        if (isOutOfCredits(text)) {
          await reportOpsEvent(admin, "fashn-proxy", "fashn_out_of_credits", {
            status: res.status, model: modelName,
          });
          return await refundAndUnavailable(admin, user.id, renderId, "out-of-credits");
        }
        if (res.status >= 500) {
          return await refundAndUnavailable(admin, user.id, renderId, `upstream-run-${res.status}`);
        }
      }

      if (res.ok) {
        const id = parsePredictionId(text);
        if (id) {
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

      const res  = await fashnStatus(key, id);
      const text = res.text;
      if (!res.ok) {
        console.error(`[fashn-proxy] upstream /status ${res.status} id=${id}`, text.slice(0, 500));
        // Yoklama hatası geçici olabilir; FASHN'da iş sürüyor olabilir → İADE YOK, yalnızca 503
        if (isOutOfCredits(text)) {
          await reportOpsEvent(admin, "fashn-proxy", "fashn_out_of_credits", { status: res.status, at: "status" });
          return serviceUnavailable();
        }
        if (res.status >= 500) return serviceUnavailable();
      }

      if (res.ok) {
        const s = parseStatus(text);
        if (s?.status === "completed") {
          // Çıktıları kaydet + try-on ise render'ı başarılı işaretle — karar tamamen
          // sunucuda (istemcinin gönderdiği 'final' vb. alanlar yok sayılır)
          const outputs = httpsOutputs(s);
          const { error } = await admin.rpc("complete_prediction", {
            p_user: user.id, p_render: renderId, p_prediction_id: id, p_urls: outputs,
          });
          if (error) throw new Error(`complete_prediction: ${error.message}`);

          // base64 çıktı → bizim storage'a; https (FASHN base64'ü yok saydıysa) → eskisi gibi
          // aynen geçer; ikisi de değilse ("_expired" vb.) → 410
          const first = Array.isArray(s.output) ? s.output[0] : undefined;
          const img = parseImageDataUri(first);
          if (img) return await persistOutput(admin, user.id, renderId, id, s, img, cpuStart);
          if (!outputs.length) {
            return outputUnavailable(id, typeof first === "string" ? first.slice(0, 40) : typeof first);
          }
        } else if (s?.status === "failed") {
          // FASHN işin kendisinin başarısız olduğunu bildirdi (biçim: virtualModel.ts
          // `s.status === 'failed'`, `s.error.name/message`).
          // İade YALNIZCA hiçbir try-on katmanı henüz tamamlanmadıysa (succeeded_at null):
          // aksi halde istemci 1. katman çıktısını alıp sonraki katmanı bilerek
          // başarısız ettirerek kotasını geri alabilirdi.
          // Yanıt istemciye aynen geçer: hata mesajı (örn. poz) friendlyError'a ulaşsın.
          console.error(`[fashn-proxy] prediction failed id=${id}`, JSON.stringify(s.error ?? null).slice(0, 300));
          const { data: render, error: rErr } = await admin
            .from("tryon_renders")
            .select("succeeded_at")
            .eq("id", renderId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (rErr) {
            console.error(`[fashn-proxy] render okunamadı ${renderId}: ${rErr.message}`);
          } else if (render && render.succeeded_at === null) {
            const { data: refunded, error } = await admin.rpc("fail_render", { p_user: user.id, p_render: renderId });
            if (error) console.error(`[fashn-proxy] fail_render ${renderId}: ${error.message}`);
            else console.error(`[fashn-proxy] render ${renderId} iade (prediction-failed) → ${refunded === true ? "ok" : "zaten iade/yok"}`);
          } else {
            console.error(`[fashn-proxy] render ${renderId} iade YOK (prediction-failed, try-on katmanı zaten tamamlanmış)`);
          }
        }
      }
      return new Response(text, { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── finish ─────────────────────────────────────────────────────────────
    // { render_id, final_path?, cache_key? } — final_path ile cache_key birlikte gelir.
    // Kopyalama sunucuda (istemci indirip yüklemez); sonra render'ın tmp_ dosyaları silinir.
    if (body.action === "finish") {
      const renderId = body.render_id;
      if (typeof renderId !== "string" || !UUID_RE.test(renderId)) return bad("render_id required");

      const { data: render, error: rErr } = await admin
        .from("tryon_renders")
        .select("id")
        .eq("id", renderId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (rErr) throw new Error(`tryon_renders: ${rErr.message}`);
      if (!render) return bad("render-not-owned");

      const finalPath = body.final_path;
      const cacheKey  = body.cache_key;
      if ((finalPath === undefined) !== (cacheKey === undefined)) return bad("final-path-cache-key-pair");

      const prefix = `${TMP_PREFIX}${renderId}_`;
      let copied = false;
      if (finalPath !== undefined) {
        // Yalnızca bu kullanıcının bu render'a ait ara dosyası: <uid>/tmp_<render_id>_<id>.<ext>
        const ownPrefix = `${user.id}/`;
        if (typeof finalPath !== "string" || !finalPath.startsWith(ownPrefix)) {
          return bad("final-path-not-allowed");
        }
        const name = finalPath.slice(ownPrefix.length);
        if (!name.startsWith(prefix) || !TMP_NAME_RE.test(name)) return bad("final-path-not-allowed");
        if (typeof cacheKey !== "string" || !CACHE_NAME_RE.test(cacheKey)) return bad("cache-key-not-allowed");

        // copy hedefin üzerine yazmaz → önce hedefi kaldır (yoksa sessizce geçer)
        const dest = `${user.id}/${cacheKey}`;
        await admin.storage.from(OUTPUT_BUCKET).remove([dest]);
        const { error: cpErr } = await admin.storage.from(OUTPUT_BUCKET).copy(finalPath, dest);
        if (cpErr) {
          // Ara dosyalar SİLİNMEZ: istemci yedek yolda imzalı URL'den indirip yükler
          console.error(`[fashn-proxy] finish copy ${renderId}: ${cpErr.message}`);
          return serviceUnavailable();
        }
        copied = true;
      }

      const removed = await removeTemp(admin, user.id, (f) => f.name.startsWith(prefix));
      console.log(`[fashn-proxy] finish render=${renderId} copied=${copied} removed=${removed}`);
      return json({ ok: true, copied, removed });
    }

    return bad("invalid action");
  } catch (e) {
    console.error("[fashn-proxy]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

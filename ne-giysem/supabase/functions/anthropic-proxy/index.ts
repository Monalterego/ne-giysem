// supabase/functions/anthropic-proxy/index.ts
//
// Anthropic proxy'si — istemci gövdesi AYNEN iletilmez; izin verilen alanlardan
// yeniden kurulur. Kimlik (getUser) + yapay zekâ izni + abonelik + günlük sayaç sunucuda.
//
// purpose 'scan' ("Uyar mı?"): hak burada düşer (022 scan_jobs). Claude çağrısından önce
// start_scan_job (dolu → 402 scan-limit); yanıt tanınan bir ürünse complete, değilse ya
// da üst servis hatasında fail (iade) — "tanıyamadık → hak düşmez" kuralı sunucuda.

import { adminClient, requireUser, bumpUsage, json, CORS } from "../_shared/auth.ts";
import { aiConsentGate } from "../_shared/consent.ts";
import { accessGate } from "../_shared/access.ts";
import { reportOpsEvent, serviceUnavailable } from "../_shared/ops.ts";

// ─── Sınırlar (tek yer) ──────────────────────────────────────────────────────
const DAILY_CAP        = 150;
// Uygulamada kullanılan modeller: visionAnalysis.ts, StyleResultScreen.tsx
const ALLOWED_MODELS   = new Set(["claude-sonnet-5", "claude-sonnet-4-5-20250929"]);
const MAX_TOKENS_CAP   = 4096;            // koddaki en yüksek değer (visionAnalysis)
const ALLOWED_EFFORT   = new Set(["low"]); // output_config.effort — kodda yalnızca 'low'
// İstemci görseli 1400px JPEG'e indiriyor (~400 KB → base64 ~550 K karakter)
const MAX_IMAGE_B64    = 2_000_000;
const MAX_IMAGES       = 1;
const MAX_TEXT_CHARS   = 20_000;          // vision prompt'u ~7 K karakter
const MAX_MESSAGES     = 4;
const IMAGE_TYPES      = new Set(["image/jpeg", "image/png", "image/webp"]);
// Vision prompt'unun kategori değerleri (visionAnalysis.ts CATEGORY_MAP ile aynı)
const SCAN_CATEGORIES  = new Set(["ust", "alt", "elbise_tulum", "dis", "ayakkabi", "canta", "aksesuar"]);

class BadRequest extends Error {}

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

// deno-lint-ignore no-explicit-any
function sanitizeMessages(raw: any): { role: "user" | "assistant"; content: string | Block[] }[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    throw new BadRequest("invalid-messages");
  }
  let textChars = 0;
  let images = 0;

  // deno-lint-ignore no-explicit-any
  return raw.map((m: any) => {
    if (m?.role !== "user" && m?.role !== "assistant") throw new BadRequest("invalid-role");

    if (typeof m.content === "string") {
      textChars += m.content.length;
      if (textChars > MAX_TEXT_CHARS) throw new BadRequest("text-too-long");
      return { role: m.role, content: m.content };
    }
    if (!Array.isArray(m.content)) throw new BadRequest("invalid-content");

    // deno-lint-ignore no-explicit-any
    const content: Block[] = m.content.map((b: any) => {
      if (b?.type === "text" && typeof b.text === "string") {
        textChars += b.text.length;
        if (textChars > MAX_TEXT_CHARS) throw new BadRequest("text-too-long");
        return { type: "text", text: b.text };
      }
      if (
        b?.type === "image" && b.source?.type === "base64" &&
        IMAGE_TYPES.has(b.source.media_type) && typeof b.source.data === "string"
      ) {
        if (++images > MAX_IMAGES) throw new BadRequest("too-many-images");
        if (b.source.data.length > MAX_IMAGE_B64) throw new BadRequest("image-too-large");
        return { type: "image", source: { type: "base64", media_type: b.source.media_type, data: b.source.data } };
      }
      throw new BadRequest("block-not-allowed");
    });
    return { role: m.role, content };
  });
}

/**
 * Tarama yanıtı ürün olarak tanındı mı? İstemcinin parseVisionResponse kuralıyla aynı:
 * ilk metin bloğundaki ilk { … son } arası JSON ve category bilinen bir değer.
 */
function recognizedProduct(raw: string): boolean {
  try {
    const text = JSON.parse(raw)?.content?.find((b: { type?: string }) => b?.type === "text")?.text;
    if (typeof text !== "string") return false;
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    if (first === -1 || last <= first) return false;
    const parsed = JSON.parse(text.slice(first, last + 1));
    return typeof parsed?.category === "string" && SCAN_CATEGORIES.has(parsed.category);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Apple 5.1.2(i): güncel 'ai_processing' izni yoksa hiçbir istek Anthropic'e gitmez
    // (görselsiz Stil DNA isteği dahil — istemci izin yoksa onu hiç göndermez).
    // Onaylanan metin eskiyse 403 consent-version-outdated (_shared/consent.ts)
    const gate = await aiConsentGate(admin, user.id);
    if (gate) return gate;

    // Hard paywall (022): abonelik / deneme yoksa Anthropic'e istek gitmez
    const access = await accessGate(admin, user.id);
    if (access) return access;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid-body" }, 400);

    // ── Gövdeyi yeniden kur — tools/tool_choice/metadata vb. hiçbir şey geçmez
    if (!ALLOWED_MODELS.has(body.model)) return json({ error: "model-not-allowed" }, 400);

    let messages;
    try { messages = sanitizeMessages(body.messages); }
    catch (e) {
      if (e instanceof BadRequest) return json({ error: e.message }, 400);
      throw e;
    }

    const requested = Number.isInteger(body.max_tokens) && body.max_tokens > 0 ? body.max_tokens : MAX_TOKENS_CAP;
    // deno-lint-ignore no-explicit-any
    const outgoing: Record<string, any> = {
      model:      body.model,
      max_tokens: Math.min(requested, MAX_TOKENS_CAP),
      messages,
    };
    if (body.system !== undefined) {
      if (typeof body.system !== "string" || body.system.length > MAX_TEXT_CHARS) {
        return json({ error: "invalid-system" }, 400);
      }
      outgoing.system = body.system;
    }
    if (body.output_config !== undefined) {
      const effort = body.output_config?.effort;
      if (!ALLOWED_EFFORT.has(effort)) return json({ error: "output-config-not-allowed" }, 400);
      outgoing.output_config = { effort };
    }

    if (body.purpose !== undefined && body.purpose !== "scan") return json({ error: "invalid-purpose" }, 400);
    const isScan = body.purpose === "scan";

    // ── Günlük sınır (geçerli istekler sayılır)
    if (!(await bumpUsage(admin, user.id, "anthropic", DAILY_CAP))) {
      return json({ error: "daily-limit" }, 429);
    }

    // ── "Uyar mı?" hakkı: Claude'dan önce rezervasyon (hak sunucuda düşer)
    let scanJob: string | null = null;
    if (isScan) {
      const { data: start, error: startErr } = await admin.rpc("start_scan_job", { p_user: user.id });
      if (startErr) throw new Error(`start_scan_job: ${startErr.message}`);
      if (!start?.allowed) {
        if (start?.error === "subscription-required") return json({ error: "subscription-required" }, 403);
        if (start?.error) return json({ error: start.error }, 409);
        return json({
          error: "scan-limit",
          used: start?.used ?? null, limit: start?.limit ?? null,
          window: start?.window ?? null, reset_at: start?.reset_at ?? null,
        }, 402);
      }
      scanJob = start.job_id;
    }

    // İş kapatma hatası yanıtı bozmasın: açık iş 10 dk sonra kendiliğinden kotadan düşer
    const closeScan = async (ok: boolean) => {
      if (!scanJob) return;
      const { error } = await admin.rpc(ok ? "complete_scan_job" : "fail_scan_job", {
        p_user: user.id, p_job: scanJob,
      });
      if (error) console.error(`[anthropic-proxy] scan job ${ok ? "complete" : "fail"}: ${error.message}`);
    };

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify(outgoing),
      });
    } catch (e) {
      await closeScan(false);
      throw e;
    }
    const data = await res.text();
    if (isScan) await closeScan(res.ok && recognizedProduct(data));

    if (!res.ok) {
      console.error(`[anthropic-proxy] upstream ${res.status} model=${outgoing.model}`, data.slice(0, 500));
      // Kredi/ödeme: 402 ya da gövdede "credit balance" (Anthropic bakiye hatasını
      // 400 invalid_request_error + "Your credit balance is too low…" ile döndürür)
      if (res.status === 402 || /credit[ _]balance/i.test(data)) {
        await reportOpsEvent(admin, "anthropic-proxy", "anthropic_out_of_credits", {
          status: res.status, model: outgoing.model,
        });
        return serviceUnavailable();
      }
    }

    return new Response(data, {
      status: res.status,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[anthropic-proxy]", e);
    return json({ error: String(e) }, 500);
  }
});

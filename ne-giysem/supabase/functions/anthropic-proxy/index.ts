// supabase/functions/anthropic-proxy/index.ts
//
// Anthropic proxy'si — istemci gövdesi AYNEN iletilmez; izin verilen alanlardan
// yeniden kurulur. Kimlik (getUser) + yapay zekâ izni + günlük sayaç sunucuda.

import { adminClient, requireUser, bumpUsage, json, CORS } from "../_shared/auth.ts";
import { hasConsent, consentRequired } from "../_shared/consent.ts";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Apple 5.1.2(i): güncel 'ai_processing' izni yoksa hiçbir istek Anthropic'e gitmez
    // (görselsiz Stil DNA isteği dahil — istemci izin yoksa onu hiç göndermez)
    if (!(await hasConsent(admin, user.id, "ai_processing"))) return consentRequired();

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

    // ── Günlük sınır (geçerli istekler sayılır)
    if (!(await bumpUsage(admin, user.id, "anthropic", DAILY_CAP))) {
      return json({ error: "daily-limit" }, 429);
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify(outgoing),
    });
    const data = await res.text();

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

// supabase/functions/bg-removal-proxy/index.ts
//
// Poof arka plan silme proxy'si — kimlik (getUser) + boyut tavanı + günlük sayaç.

import { adminClient, requireUser, bumpUsage, json, CORS } from "../_shared/auth.ts";

// ─── Sınırlar (tek yer) ──────────────────────────────────────────────────────
const DAILY_CAP     = 150;
// İstemci görseli 1400px JPEG'e indiriyor (~400 KB → base64 ~550 K karakter)
const MAX_IMAGE_B64 = 2_000_000;

const POOF_URL = "https://api.poof.bg/v1/remove";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const image_b64 = body?.image_b64;
    if (typeof image_b64 !== "string" || !image_b64) return json({ error: "image_b64 required" }, 400);
    if (image_b64.length > MAX_IMAGE_B64)            return json({ error: "image-too-large" }, 413);

    if (!(await bumpUsage(admin, user.id, "bg", DAILY_CAP))) {
      return json({ error: "daily-limit" }, 429);
    }

    const binary = Uint8Array.from(atob(image_b64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("image_file", new Blob([binary], { type: "image/jpeg" }), "image.jpg");
    form.append("format", "jpg");          // alpha yok → arka plan düz renk
    form.append("channels", "rgb");        // opaque, şeffaflık yok — FASHN'ı bozan buydu
    form.append("bg_color", "#ffffff");    // beyaz zemin (rgb ile birlikte çalışır, # şart)

    const res = await fetch(POOF_URL, {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("POOF_API_KEY")! },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: "Poof error " + res.status, detail: errText }, res.status);
    }

    const buffer = await res.arrayBuffer();
    return json({ result_b64: toBase64(new Uint8Array(buffer)) });
  } catch (e) {
    console.error("[bg-removal-proxy]", e);
    return json({ error: String(e) }, 500);
  }
});

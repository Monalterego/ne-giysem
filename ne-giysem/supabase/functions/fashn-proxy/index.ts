import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const FASHN_BASE = "https://api.fashn.ai/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = Deno.env.get("FASHN_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "FASHN_API_KEY missing" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

    const body = await req.json();
    // body.action: "run" veya "status"; status ise body.id gerekli
    let fashnUrl: string;
    let fashnOpts: RequestInit;

    if (body.action === "run") {
      fashnUrl = `${FASHN_BASE}/run`;
      fashnOpts = {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body.payload),
      };
    } else if (body.action === "status") {
      fashnUrl = `${FASHN_BASE}/status/${body.id}`;
      fashnOpts = { method: "GET", headers: { "Authorization": `Bearer ${key}` } };
    } else {
      return new Response(JSON.stringify({ error: "invalid action" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const res = await fetch(fashnUrl, fashnOpts);
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

// supabase/functions/_shared/fashn.ts
//
// FASHN API'nin ortak çağrı katmanı — model bağımsız (/v1/run + /v1/status).
// Yetki, kota, girdi izin listesi ve sahiplik kontrolleri ÇAĞIRANDA kalır
// (fashn-proxy; ileride garment-image: packshot / background-remove).
// Yanıt gövdesi ham metin olarak döner: proxy'ler FASHN yanıtını istemciye aynen geçirir
// (fashn-proxy completed + base64 çıktıda yanıtı kendi storage URL'iyle yeniden yazar).

export const FASHN_BASE = "https://api.fashn.ai/v1";

// FASHN id formatı repoda/yanıtlarda görülmedi → biçim tahmini yok; yalnızca güvenli
// karakter kümesi (path enjeksiyonunu keser). Asıl kontrol: id'nin kullanıcıya ait olması.
export const PREDICTION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** FASHN'ın ham HTTP yanıtı (gövde metin olarak) */
export interface FashnResponse {
  ok: boolean;
  status: number;
  text: string;
}

/** /status gövdesinin kullandığımız alanları */
export interface FashnStatusBody {
  id?: string;
  status?: "starting" | "in_queue" | "processing" | "completed" | "failed" | string;
  output?: unknown;
  error?: { name?: string; message?: string } | null;
}

/** FASHN_API_KEY secret'ı; yoksa null (çağıran 500 döner) */
export function fashnKey(): string | null {
  return Deno.env.get("FASHN_API_KEY") ?? null;
}

/** POST /run — tahmin başlatır. Girdi doğrulaması çağıranın işi. */
export async function fashnRun(
  key: string, modelName: string, inputs: Record<string, unknown>,
): Promise<FashnResponse> {
  const res = await fetch(`${FASHN_BASE}/run`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

/** GET /status/:id — id PREDICTION_ID_RE ile önceden doğrulanmış olmalı */
export async function fashnStatus(key: string, id: string): Promise<FashnResponse> {
  const res = await fetch(`${FASHN_BASE}/status/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${key}` },
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

/** FASHN kredi hatası mı? Ölçülmüş biçim: 429 {"error":"OutOfCredits"} */
export function isOutOfCredits(text: string): boolean {
  try { return JSON.parse(text)?.error === "OutOfCredits"; } catch { return false; }
}

/** /run yanıtındaki prediction id; yoksa ya da biçim dışıysa null */
export function parsePredictionId(text: string): string | null {
  let id: unknown;
  try { id = JSON.parse(text)?.id; } catch { /* yanıt JSON değil */ }
  return typeof id === "string" && PREDICTION_ID_RE.test(id) ? id : null;
}

/** /status gövdesi; JSON değilse null */
export function parseStatus(text: string): FashnStatusBody | null {
  try { return JSON.parse(text) as FashnStatusBody; } catch { return null; }
}

/** completed çıktılarından yalnızca https URL'leri (return_base64 çıktıları dahil değil) */
export function httpsOutputs(s: FashnStatusBody): string[] {
  return (Array.isArray(s.output) ? s.output : [])
    .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("https://"));
}

/** return_base64 çıktısı (data:image/<jpeg|png>;base64,...) — tür, uzantı ve base64 gövdesi */
export interface DataUriImage {
  mime: "image/jpeg" | "image/png";
  ext: "jpg" | "png";
  base64: string;
}

/**
 * completed çıktısının ilk elemanı bir görsel data URI'si mi? Değilse null
 * (https URL, "_expired" vb.). Gövde burada doğrulanmaz — decodeBase64 hatalıysa fırlatır.
 */
export function parseImageDataUri(raw: unknown): DataUriImage | null {
  if (typeof raw !== "string" || !raw.startsWith("data:")) return null;
  const comma = raw.indexOf(",");
  if (comma < 0) return null;
  const header = raw.slice(5, comma).toLowerCase();
  if (header === "image/jpeg;base64") return { mime: "image/jpeg", ext: "jpg", base64: raw.slice(comma + 1) };
  if (header === "image/png;base64")  return { mime: "image/png",  ext: "png", base64: raw.slice(comma + 1) };
  return null;
}

/** base64 → bayt dizisi (geçersiz karakterde atob fırlatır) */
export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

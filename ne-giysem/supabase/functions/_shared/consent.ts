// supabase/functions/_shared/consent.ts
//
// Rıza kontrolü — karar consent_events'in en son satırından (014_privacy_consent.sql).
// Kayıt yoksa izin verilmemiş sayılır. Onaylanan metnin ANA sürümü sunucunun kabul
// ettiği en düşük ana sürümden eskiyse izin "eski" sayılır (403 consent-version-outdated):
// istemci güncel metni gösterip yeniden onay ister.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./auth.ts";

export type ConsentKind = "ai_processing" | "tryon_photo" | "tryon_physical";

/**
 * Sunucunun kabul ettiği en düşük ANA sürüm — TEK yer (fashn-proxy, anthropic-proxy,
 * bg-removal-proxy; ileride garment-image). İstemcideki CONSENT_VERSIONS
 * (src/constants/consent.ts) ana sürümüyle birlikte artırılır; önce OTA (yeni metin +
 * yeniden onay), sonra bu değerin deploy'u — aksi halde eski bundle 403 alır.
 *   ai_processing 2: FASHN alıcı olarak eklendi (izin metni 2.0)
 */
export const MIN_CONSENT_MAJOR: Record<ConsentKind, number> = {
  ai_processing:  2,
  tryon_photo:    1,
  tryon_physical: 1,
};

/** 'granted' geçerli · 'outdated' verilmiş ama metin sürümü eski · 'missing' yok / reddedilmiş */
export type ConsentState = "granted" | "outdated" | "missing";

/** "ana.alt" → ana; biçim dışı (eski tarihli sürümler) → null (eski sayılır) */
function majorVersion(v: unknown): number | null {
  const m = /^(\d+)\.(\d+)$/.exec(typeof v === "string" ? v : "");
  return m ? Number(m[1]) : null;
}

/** En son kayda göre durum. Okuma hatasında fırlatır (500) — belirsizlikte izin varsayılmaz. */
export async function consentState(
  admin: SupabaseClient, userId: string, kind: ConsentKind,
): Promise<ConsentState> {
  const { data, error } = await admin
    .from("consent_events")
    .select("granted, text_version")
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`consent_events: ${error.message}`);
  if (!data || data.granted !== true) return "missing";
  const major = majorVersion(data.text_version);
  return major !== null && major >= MIN_CONSENT_MAJOR[kind] ? "granted" : "outdated";
}

/**
 * 403 — istemci kodu görünce izin ekranını / elle akışı açar (edgeFunctions EdgeError.code).
 *   'ai-consent-required'      : bg-removal-proxy, anthropic-proxy (ai_processing yok)
 *   'consent-required'         : fashn-proxy (tryon_photo / tryon_physical; kinds = eksik olanlar)
 *   'consent-version-outdated' : izin var ama onaylanan metin eski (kinds = eski olanlar)
 */
export const consentRequired = (
  code: "ai-consent-required" | "consent-required" | "consent-version-outdated" = "ai-consent-required",
  kinds?: ConsentKind[],
) => json(kinds ? { error: code, kinds } : { error: code }, 403);

/**
 * ai_processing kapısı (anthropic-proxy, bg-removal-proxy): geçerliyse null,
 * değilse döndürülecek 403 yanıtı.
 */
export async function aiConsentGate(admin: SupabaseClient, userId: string): Promise<Response | null> {
  const state = await consentState(admin, userId, "ai_processing");
  if (state === "granted") return null;
  if (state === "outdated") return consentRequired("consent-version-outdated", ["ai_processing"]);
  return consentRequired();
}

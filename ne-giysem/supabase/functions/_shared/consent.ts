// supabase/functions/_shared/consent.ts
//
// Rıza kontrolü — karar consent_events'in en son satırından (014_privacy_consent.sql,
// consent_granted). Kayıt yoksa izin verilmemiş sayılır.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./auth.ts";

export type ConsentKind = "ai_processing" | "tryon_photo" | "tryon_physical";

/** RPC hatasında fırlatır (500) — belirsizlikte izin varsayılmaz. */
export async function hasConsent(
  admin: SupabaseClient, userId: string, kind: ConsentKind,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consent_granted", { p_user: userId, p_kind: kind });
  if (error) throw new Error(`consent_granted: ${error.message}`);
  return data === true;
}

/** İstemci bu kodu görünce izin ekranını / elle akışı açar (edgeFunctions EdgeError.code). */
export const consentRequired = () => json({ error: "ai-consent-required" }, 403);

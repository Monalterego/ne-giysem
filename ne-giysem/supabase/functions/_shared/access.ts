// supabase/functions/_shared/access.ts
//
// Hard paywall (022): abonelik ya da deneme yoksa yapay zekâ / görsel işlemleri yapılmaz.
// Kaynak has_access (= entitlements.expires_at > now(); deneme dahil). Kontrol her
// rezervasyondan ve üst servis çağrısından ÖNCE yapılır → kota / kredi / iade gerekmez.
// İstemci 403 'subscription-required' görünce paywall'a (gate) döner.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./auth.ts";

/** Erişim varsa null, yoksa döndürülecek 403. RPC hatasında fırlatır (500). */
export async function accessGate(admin: SupabaseClient, userId: string): Promise<Response | null> {
  const { data, error } = await admin.rpc("has_access", { p_user: userId });
  if (error) throw new Error(`has_access: ${error.message}`);
  return data === true ? null : json({ error: "subscription-required" }, 403);
}

// supabase/functions/_shared/ops.ts
//
// Üst servis kredi/ödeme hataları: ops_events'e yaz (10 dk tekrar bastırma SQL'de)
// ve istemciye 503 dön. Kullanıcıya fatura durumu sızmaz; 429 bizim bütçemize ayrılı.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./auth.ts";

/** Asla fırlatmaz — olay kaydı başarısız olsa da kullanıcı yanıtı etkilenmez. */
export async function reportOpsEvent(
  admin: SupabaseClient, source: string, kind: string, detail: Record<string, unknown>,
): Promise<void> {
  console.error(`[${source}] ops ${kind}`, JSON.stringify(detail));
  try {
    const { error } = await admin.rpc("record_ops_event", {
      p_source: source, p_kind: kind, p_detail: detail,
    });
    if (error) console.error(`[${source}] record_ops_event: ${error.message}`);
  } catch (e) {
    console.error(`[${source}] record_ops_event`, e);
  }
}

export const serviceUnavailable = () => json({ error: "service-unavailable" }, 503);

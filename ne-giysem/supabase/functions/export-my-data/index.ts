// supabase/functions/export-my-data/index.ts
//
// "Verilerimi indir" (KVKK md. 11 erişim hakkı / veri taşınabilirliği).
// Kimlik (getUser) → yalnızca çağıranın kendi verisi, service_role ile okunur.
//
// İçerik: profil, stil profilleri, dolap meta verisi, kombinler, favoriler, rıza geçmişi,
// abonelik durumu (JSON) + kullanıcının kendi <uid>/ klasöründeki fotoğraflar için
// 1 saat geçerli imzalı linkler. Dosyaların kendisi gövdeye konmaz (boyut).
// Günlük 3 çağrı (api_usage fn = 'export').

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adminClient, requireUser, bumpUsage, json, CORS } from "../_shared/auth.ts";

// ─── Sınırlar (tek yer) ──────────────────────────────────────────────────────
const DAILY_CAP      = 3;
const LINK_TTL_SEC   = 60 * 60;   // 1 saat
const BUCKETS        = ["wardrobe-items", "avatars", "mannequin-cache"] as const;
const PAGE           = 1000;
const MAX_FILES      = 20_000;    // bucket başına koruma (sonsuz döngü / dev yanıt olmasın)
const FORMAT_VERSION = 1;

/** Tablo okuma — hata dışa aktarmayı durdurur (eksik dosya vermektense 500). */
async function rows(
  admin: SupabaseClient, table: string, column: string, uid: string, order = "created_at",
): Promise<unknown[]> {
  const { data, error } = await admin.from(table).select("*").eq(column, uid).order(order);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

/** <uid>/ altındaki dosya adları (düz yapı — storageUrls.ts) */
async function listFiles(admin: SupabaseClient, bucket: string, uid: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; offset < MAX_FILES; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(uid, { limit: PAGE, offset });
    if (error) throw new Error(`list:${bucket}:${error.message}`);
    for (const f of data ?? []) {
      // Alt klasör girdisi (id null) dosya değil
      if (f.id) paths.push(`${uid}/${f.name}`);
    }
    if (!data || data.length < PAGE) break;
  }
  return paths;
}

async function signedLinks(
  admin: SupabaseClient, bucket: string, paths: string[],
): Promise<{ path: string; url: string | null }[]> {
  const out: { path: string; url: string | null }[] = [];
  for (let i = 0; i < paths.length; i += PAGE) {
    const batch = paths.slice(i, i + PAGE);
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(batch, LINK_TTL_SEC);
    if (error) throw new Error(`sign:${bucket}:${error.message}`);
    for (const s of data ?? []) out.push({ path: s.path ?? "", url: s.signedUrl ?? null });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    if (!(await bumpUsage(admin, user.id, "export", DAILY_CAP))) {
      return json({ error: "daily-limit" }, 429);
    }

    const uid = user.id;

    const { data: profile, error: profErr } = await admin
      .from("profiles").select("*").eq("id", uid).maybeSingle();
    if (profErr) throw new Error(`profiles: ${profErr.message}`);

    const [styleProfiles, wardrobe, combos, favorites, consents] = await Promise.all([
      rows(admin, "style_profiles",  "user_id", uid),
      rows(admin, "wardrobe_items",  "user_id", uid),
      rows(admin, "combos",          "user_id", uid),
      rows(admin, "favorite_combos", "user_id", uid),
      rows(admin, "consent_events",  "user_id", uid, "id"),
    ]);

    // Abonelik: satır yoksa ücretsiz. Karar kuralı 013 ile aynı (expires_at > now)
    const { data: ent, error: entErr } = await admin
      .from("entitlements")
      .select("product_id, store, period_type, expires_at, will_renew, updated_at")
      .eq("user_id", uid)
      .maybeSingle();
    if (entErr) throw new Error(`entitlements: ${entErr.message}`);
    const expiresAt = ent?.expires_at ? Date.parse(ent.expires_at) : NaN;
    const isPremium = !!ent && (ent.expires_at === "infinity" || expiresAt > Date.now());

    const files: Record<string, { path: string; url: string | null }[]> = {};
    for (const bucket of BUCKETS) {
      const paths = await listFiles(admin, bucket, uid);
      files[bucket] = paths.length ? await signedLinks(admin, bucket, paths) : [];
    }

    const now = new Date();
    return json({
      format_version: FORMAT_VERSION,
      exported_at:    now.toISOString(),
      account: {
        id:              uid,
        email:           user.email ?? null,
        created_at:      user.created_at,
        sign_in_methods: (user.identities ?? []).map((i) => i.provider),
      },
      profile:         profile ?? null,
      style_profiles:  styleProfiles,
      wardrobe_items:  wardrobe,
      combos,
      favorite_combos: favorites,
      consent_history: consents,
      subscription: {
        plan:        isPremium ? "premium" : "free",
        entitlement: ent ?? null,
      },
      files,
      files_note:       "Links are valid for 1 hour.",
      links_expire_at:  new Date(now.getTime() + LINK_TTL_SEC * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[export-my-data]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// supabase/functions/_shared/auth.ts
//
// Proxy'lerin ortak kimlik doğrulaması. Gateway'in verify_jwt'si tek başına yetmez:
// uygulamaya gömülü anon key de geçerli bir JWT. Burada token'ın gerçek bir
// kullanıcıya ait olduğu auth.getUser ile doğrulanır (delete-account ile aynı desen).

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** service_role client — RLS'i atlar; yalnızca sunucuda. */
export function adminClient(): SupabaseClient {
  const url     = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, service, { auth: { persistSession: false } });
}

/** Authorization: Bearer <kullanıcı JWT> → kullanıcı; yoksa/geçersizse null. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<User | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return null;
  return user;
}

/** Günlük sayaç; sınır aşıldıysa false. RPC hatasında fırlatır (500). */
export async function bumpUsage(
  admin: SupabaseClient, userId: string, fn: string, cap: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("bump_usage", { p_user: userId, p_fn: fn, p_cap: cap });
  if (error) throw new Error(`bump_usage: ${error.message}`);
  return data === true;
}

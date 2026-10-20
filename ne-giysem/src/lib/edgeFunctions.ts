import { supabase } from './supabase';

const FUNCTIONS_URL = 'https://bdvrgbylirftuxmrpbea.supabase.co/functions/v1';

/**
 * Edge function'ın 2xx dışı yanıtı. code: sunucunun { error } alanı (örn. 'daily-limit').
 * message üst servis gövdesini de içerir — friendlyError'ın FASHN/Poof eşleştirmeleri
 * (kredi, poz, format) bozulmasın diye.
 */
export class EdgeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly payload: Record<string, unknown> = {},
    detail = '',
  ) {
    super(`edge ${status} ${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'EdgeError';
  }
}

/** Proxy'ler (bg-removal, anthropic) yapay zekâ izni yoksa 403 'ai-consent-required' döner */
export function isAiConsentError(err: unknown): err is EdgeError {
  return err instanceof EdgeError && err.code === 'ai-consent-required';
}

/** Oturum yoksa çağrı YAPILMAZ — 401 sayılır. */
async function accessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new EdgeError(401, 'no-session');
  return session.access_token;
}

/** Kullanıcı JWT'siyle POST. Yanıt döner; hata durumunu çağıran ele alır. */
export async function callEdge(fn: string, body: unknown): Promise<Response> {
  const token = await accessToken();
  return fetch(`${FUNCTIONS_URL}/${fn}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
}

/** 2xx dışı yanıttan EdgeError üretir (gövde JSON değilse code = 'http-<status>'). */
export async function edgeError(res: Response): Promise<EdgeError> {
  const text = await res.text().catch(() => '');
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(text) ?? {}; } catch { /* JSON değil */ }
  const code = typeof payload.error === 'string' ? payload.error : `http-${res.status}`;
  // Ham gövde geliştirici loguna; kullanıcıya friendlyError gösterilir
  const fn = res.url.split('/functions/v1/')[1] ?? res.url;
  console.warn(`[edge] ${fn} → ${res.status}`, text.slice(0, 400));
  return new EdgeError(res.status, code, payload, text.slice(0, 400));
}

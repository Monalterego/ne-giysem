import { callEdge, edgeError } from '../lib/edgeFunctions';

/**
 * Ürün URL'inden og:image görselini çekip base64 döndürür.
 * Tüm iş sunucuda (fetch-product): sayfa + görsel orada indirilir, cihaz IP'si
 * ürün sitesine gitmez. Hata → EdgeError (code: invalid-url, blocked-host,
 * og-image-not-found, too-large, timeout, daily-limit …) — ekran mesaja çevirir.
 */
export async function scrapeProductImage(url: string): Promise<string> {
  const res = await callEdge('fetch-product', { url });
  if (!res.ok) throw await edgeError(res);
  const json = await res.json() as { image_b64?: string };
  if (!json.image_b64) throw new Error('fetch-product: boş yanıt');
  return json.image_b64;
}

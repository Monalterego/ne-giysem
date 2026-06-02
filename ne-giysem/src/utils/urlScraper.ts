import { Platform } from 'react-native';
import { base64Encode } from './base64';

const PROXY_PRIMARY  = 'https://api.codetabs.com/v1/proxy?quest=';
const PROXY_FALLBACK = 'https://thingproxy.freeboard.io/fetch/';
const FETCH_TIMEOUT  = 8000; // ms

// AbortController ile timeout'lu fetch
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// HTML fetch: önce codetabs, timeout/hata olursa thingproxy fallback
async function fetchHtml(url: string): Promise<string> {
  const encoded = encodeURIComponent(url);
  const primaryUrl  = `${PROXY_PRIMARY}${encoded}`;
  const fallbackUrl = `${PROXY_FALLBACK}${encoded}`;

  console.log('[urlScraper] fetchHtml → primary proxy:', primaryUrl);
  try {
    const res = await fetchWithTimeout(primaryUrl, FETCH_TIMEOUT);
    console.log('[urlScraper] primary proxy yanıtı — status:', res.status, 'ok:', res.ok);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    console.log('[urlScraper] primary HTML alındı — uzunluk:', html.length, 'karakter');
    return html;
  } catch (primaryErr: any) {
    console.warn('[urlScraper] primary proxy başarısız:', primaryErr.message, '— fallback deneniyor:', fallbackUrl);
    const res = await fetch(fallbackUrl);
    console.log('[urlScraper] fallback proxy yanıtı — status:', res.status, 'ok:', res.ok);
    if (!res.ok) throw new Error(`Proxy bağlantı hatası: ${res.status}`);
    const html = await res.text();
    console.log('[urlScraper] fallback HTML alındı — uzunluk:', html.length, 'karakter');
    return html;
  }
}

// HTML'den og:image veya twitter:image meta tag'ini regex ile çıkarır
function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) {
      console.log('[urlScraper] og:image bulundu:', m[1]);
      return m[1];
    }
  }
  console.warn('[urlScraper] og:image / twitter:image bulunamadı. HTML başı:', html.slice(0, 300));
  return null;
}

// Görsel URL'ini indirip base64'e çevirir (native-uyumlu — FileReader/Blob yok)
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  // Web'de direkt fetch CORS hatası verir → codetabs proxy kullan
  const fetchUrl = Platform.OS === 'web'
    ? `${PROXY_PRIMARY}${encodeURIComponent(imageUrl)}`
    : imageUrl;

  console.log('[urlScraper] görsel fetch → platform:', Platform.OS, 'url:', fetchUrl);
  const res = await fetch(fetchUrl);
  console.log('[urlScraper] görsel yanıtı — status:', res.status, 'ok:', res.ok);
  if (!res.ok) throw new Error(`Görsel indirilemedi: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const b64 = base64Encode(bytes);
  console.log('[urlScraper] base64 hazır — uzunluk:', b64.length, 'karakter');
  return b64;
}

// Ürün URL'inden og:image görselini çekip base64 döndürür
export async function scrapeProductImage(url: string): Promise<string> {
  console.log('[urlScraper] scrapeProductImage başladı — url:', url);
  const html = await fetchHtml(url);
  if (!html) throw new Error('Sayfa içeriği alınamadı.');

  const imageUrl = extractMetaImage(html);
  if (!imageUrl) {
    throw new Error(
      'Ürün görseli bulunamadı. Sayfanın og:image meta etiketi desteklenmiyor olabilir.',
    );
  }

  return imageUrlToBase64(imageUrl);
}

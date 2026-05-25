import { Platform } from 'react-native';

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
  try {
    const res = await fetchWithTimeout(`${PROXY_PRIMARY}${encoded}`, FETCH_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch {
    // Fallback
    const res = await fetch(`${PROXY_FALLBACK}${encoded}`);
    if (!res.ok) throw new Error(`Proxy bağlantı hatası: ${res.status}`);
    return res.text();
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
    if (m?.[1]) return m[1];
  }
  return null;
}

// Görsel URL'ini indirip base64'e çevirir
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  // Web'de direkt fetch CORS hatası verir → codetabs proxy kullan
  const fetchUrl = Platform.OS === 'web'
    ? `${PROXY_PRIMARY}${encodeURIComponent(imageUrl)}`
    : imageUrl;

  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Görsel indirilemedi: ${res.status}`);
  const blob = await res.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      resolve(data.includes(',') ? data.split(',')[1] : data);
    };
    reader.onerror = () => reject(new Error('Görsel okunamadı'));
    reader.readAsDataURL(blob);
  });
}

// Ürün URL'inden og:image görselini çekip base64 döndürür
export async function scrapeProductImage(url: string): Promise<string> {
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

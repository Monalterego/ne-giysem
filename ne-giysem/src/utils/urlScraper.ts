import { Platform } from 'react-native';

const PROXY_GET = 'https://api.allorigins.win/get?url=';
const PROXY_RAW = 'https://api.allorigins.win/raw?url=';

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
  // Web'de direkt fetch CORS hatası verir → allorigins raw proxy kullan
  const fetchUrl = Platform.OS === 'web'
    ? `${PROXY_RAW}${encodeURIComponent(imageUrl)}`
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
  const proxyRes = await fetch(`${PROXY_GET}${encodeURIComponent(url)}`);
  if (!proxyRes.ok) throw new Error(`Proxy bağlantı hatası: ${proxyRes.status}`);

  const json = await proxyRes.json() as { contents: string };
  const html = json.contents ?? '';
  if (!html) throw new Error('Sayfa içeriği alınamadı.');

  const imageUrl = extractMetaImage(html);
  if (!imageUrl) {
    throw new Error(
      'Ürün görseli bulunamadı. Sayfanın og:image meta etiketi desteklenmiyor olabilir.',
    );
  }

  return imageUrlToBase64(imageUrl);
}

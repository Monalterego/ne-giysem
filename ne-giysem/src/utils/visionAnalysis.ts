import type { ClothingCategory, Season } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface VisionResult {
  category: ClothingCategory;
  subcategory?: string;
  colors: string[];
  pattern?: string;
  seasons: Season[];
}

const CATEGORY_MAP: Record<string, ClothingCategory> = {
  ust: 'upper',
  alt: 'lower',
  dis: 'outer',
  ayakkabi: 'shoes',
  aksesuar: 'accessory',
};

const SEASON_MAP: Record<string, Season> = {
  ilkbahar: 'spring',
  yaz: 'summer',
  sonbahar: 'fall',
  kis: 'winter',
};

const PROMPT = `Bu kıyafet görselini analiz et. YALNIZCA geçerli JSON döndür, başka hiçbir metin yazma.

{
  "category": "ust" veya "alt" veya "dis" veya "ayakkabi" veya "aksesuar",
  "subcategory": kıyafetin alt tipi — örn. "tisort", "gomlek", "pantolon", "etek", "sort", "ceket", "hirka", "elbise", "kazak", "mont", "bot", "sneaker", "topuklu", "sandalet", "terlik",
  "colors": en fazla 3 dominant rengin hex kodu dizisi — örn. ["#1A1A2E", "#FFFFFF"],
  "pattern": "duz" veya "cizgili" veya "ekose" veya "cicekli" veya "geometrik",
  "season": uygun mevsimlerin dizisi — örn. ["yaz"] veya ["ilkbahar", "sonbahar"] veya ["kis"]
}`;

function parseVisionResponse(text: string): VisionResult {
  // Markdown code fence'leri temizle
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const raw = JSON.parse(clean);

  const seasons: Season[] = Array.isArray(raw.season)
    ? (raw.season as string[]).map((s) => SEASON_MAP[s]).filter((s): s is Season => !!s)
    : [];

  const colors: string[] = Array.isArray(raw.colors)
    ? (raw.colors as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];

  return {
    category: CATEGORY_MAP[raw.category ?? ''] ?? 'upper',
    subcategory: typeof raw.subcategory === 'string' ? raw.subcategory : undefined,
    colors,
    pattern: typeof raw.pattern === 'string' ? raw.pattern : undefined,
    seasons,
  };
}

export async function analyzeClothingImage(base64: string): Promise<VisionResult> {
  if (!API_KEY) {
    throw new Error('Anthropic API key eksik. .env dosyasını kontrol et.');
  }

  let mediaType: 'image/jpeg' | 'image/png' = 'image/png';
  let imageData = base64;
  if (base64.startsWith('data:')) {
    const semicolon = base64.indexOf(';');
    const mime = base64.slice(5, semicolon);
    if (mime === 'image/jpeg') mediaType = 'image/jpeg';
    imageData = base64.slice(base64.indexOf(',') + 1);
  }

  const requestBody = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  };
  console.log('[visionAnalysis] request body:', JSON.stringify({
    ...requestBody,
    messages: requestBody.messages.map((m) => ({
      ...m,
      content: m.content.map((c: any) =>
        c.type === 'image' ? { ...c, source: { ...c.source, data: `[base64 ${imageData.length} chars, ${mediaType}]` } } : c,
      ),
    })),
  }, null, 2));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('API Error status:', res.status);
    console.error('API Error body:', errorText);
    throw new Error(`API error: ${res.status} ${errorText}`);
  }

  const json = await res.json();
  const text: string = (json as any)?.content?.[0]?.text ?? '';
  if (!text) throw new Error('Claude API boş yanıt döndürdü.');

  return parseVisionResponse(text);
}

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Claude API hatası: ${res.status}`);
  }

  const json = await res.json();
  const text: string = (json as any)?.content?.[0]?.text ?? '';
  if (!text) throw new Error('Claude API boş yanıt döndürdü.');

  return parseVisionResponse(text);
}

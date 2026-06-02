import type { ClothingCategory, Season } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface VisionResult {
  category: ClothingCategory;
  subcategory?: string;
  colors: string[];
  pattern?: string;
  fabric?: string;
  seasons: Season[];
  itemName?: string;
  fit?: string;
  neckline?: string;
  sleeveLength?: string;
  details?: string[];
}

const CATEGORY_MAP: Record<string, ClothingCategory> = {
  ust:           'upper',
  alt:           'lower',
  elbise_tulum:  'dress_jumpsuit',
  dis:           'outer',
  ayakkabi:      'shoes',
  canta:         'bag',
  aksesuar:      'accessory',
};

const SEASON_MAP: Record<string, Season> = {
  ilkbahar: 'spring',
  yaz: 'summer',
  sonbahar: 'fall',
  kis: 'winter',
};

const PROMPT = `Bu kıyafet görselini analiz et. YALNIZCA geçerli JSON döndür, başka hiçbir metin yazma.

{
  "category": "ust" | "alt" | "elbise_tulum" | "dis" | "ayakkabi" | "canta" | "aksesuar",
  "subcategory": aşağıdaki değerlerden biri:
    ust için → "tisort" | "bluz" | "gomlek" | "kazak" | "triko" | "hirka" | "yelek" | "sweatshirt" | "hoodie" | "body"
    alt için → "pantolon" | "jean" | "etek" | "sort" | "tayt"
    elbise_tulum için → "mini_elbise" | "midi_elbise" | "maxi_elbise" | "tulum"
    dis için → "ceket" | "blazer" | "mont" | "kaban" | "trenchkot" | "yagmurluk"
    ayakkabi için → "sneaker" | "loafer" | "bot" | "cizme" | "topuklu" | "sandalet" | "terlik" | "babet"
    canta için → "omuz_cantasi" | "clutch" | "tote" | "bel_cantasi" | "sirt_cantasi" | "mini_canta"
    aksesuar için → "kolye" | "kupe" | "bileklik" | "yuzuk" | "fular" | "kaskol" | "bandana" | "kemer" | "sapka" | "gozluk",
  "name": Zara/HM tarzı kısa ürün adı — örn. "Düşük bel geniş paça jean", "Balon kollu çizgili gömlek", "Kruvaze blazer ceket",
  "fit": kesim — "slim" | "regular" | "oversized" | "crop" | "midi" | "maxi" | "mini",
  "neckline": yaka tipi, SADECE ust ve elbise_tulum için — "yuvarlak" | "v yaka" | "polo" | "balikci" | "kayik" | "halter" | "dik yaka" | null,
  "sleeve": kol boyu, SADECE ust için — "kolsuz" | "kisa kol" | "3/4 kol" | "uzun kol" | "balon kol" | null,
  "details": öne çıkan max 3 detay — örn. ["dugmeli", "cepli", "firfirli", "bagcikli", "seritli", "fermanuarli", "kapsonlu", "kesiksiz", "asimetrik"],
  "colors": en fazla 3 dominant rengin hex kodu dizisi — örn. ["#1A1A2E", "#FFFFFF"],
  "pattern": "duz" | "cizgili" | "ekose" | "cicekli" | "geometrik",
  "fabric": kumaş tahmini. Görselden EMİN DEĞİLSEN 'bilmiyorum' ver, tahmin uydurma — "pamuk" | "keten" | "denim" | "ipek" | "yun" | "polyester" | "viskon" | "saten" | "kadife" | "karisim" | "bilmiyorum",
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

  const details: string[] | undefined = Array.isArray(raw.details)
    ? (raw.details as unknown[]).filter((d): d is string => typeof d === 'string').slice(0, 3)
    : undefined;

  const mappedCategory = CATEGORY_MAP[raw.category ?? ''];
  if (!mappedCategory) console.warn('[vision] bilinmeyen kategori:', raw.category);

  return {
    category: mappedCategory ?? 'upper',
    subcategory:  typeof raw.subcategory === 'string' ? raw.subcategory : undefined,
    colors,
    pattern:      typeof raw.pattern  === 'string' ? raw.pattern  : undefined,
    fabric:       typeof raw.fabric   === 'string' ? raw.fabric   : undefined,
    seasons,
    itemName:     typeof raw.name     === 'string' ? raw.name     : undefined,
    fit:          typeof raw.fit      === 'string' ? raw.fit      : undefined,
    neckline:     typeof raw.neckline === 'string' ? raw.neckline : undefined,
    sleeveLength: typeof raw.sleeve   === 'string' ? raw.sleeve   : undefined,
    details:      details?.length ? details : undefined,
  };
}

function toJpegBase64(input: string): Promise<string> {
  const raw = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  const srcType = raw.startsWith('/9j/') ? 'image/jpeg' : 'image/png';

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context kullanılamıyor')); return; }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    img.onerror = () => reject(new Error('Görsel canvas\'a yüklenemedi'));
    img.src = `data:${srcType};base64,${raw}`;
  });
}

export async function analyzeClothingImage(base64: string): Promise<VisionResult> {
  if (!API_KEY) {
    throw new Error('Anthropic API key eksik. .env dosyasını kontrol et.');
  }

  const jpegData = await toJpegBase64(base64);

  const requestBody = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: jpegData },
          },
          { type: 'text', text: PROMPT },
        ],
      },
      // Prefill: JSON disiplinini garantiler; yanıt '{' ile devam eder
      { role: 'assistant', content: '{' },
    ],
  };
  console.log('[visionAnalysis] request body:', JSON.stringify({
    ...requestBody,
    messages: requestBody.messages.map((m: any) => ({
      ...m,
      content: Array.isArray(m.content)
        ? m.content.map((c: any) =>
            c.type === 'image' ? { ...c, source: { ...c.source, data: `[jpeg base64 ${jpegData.length} chars]` } } : c,
          )
        : m.content,
    })),
  }, null, 2));

  const attemptRequest = async (): Promise<VisionResult> => {
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
      console.error('[vision] API error status:', res.status);
      console.error('[vision] API error body:', errorText);
      throw new Error(`API error: ${res.status} ${errorText}`);
    }

    const json = await res.json();
    const text: string = (json as any)?.content?.[0]?.text ?? '';
    if (!text) throw new Error('Claude API boş yanıt döndürdü.');
    // Prefill '{' + yanıt continuation = tam JSON
    return parseVisionResponse('{' + text);
  };

  try {
    return await attemptRequest();
  } catch (firstErr) {
    console.warn('[vision] ilk deneme başarısız, yeniden deneniyor:', firstErr);
    try {
      return await attemptRequest();
    } catch (secondErr) {
      throw new Error('VISION_FAIL: ' + String(secondErr));   // GEÇİCİ
    }
  }
}

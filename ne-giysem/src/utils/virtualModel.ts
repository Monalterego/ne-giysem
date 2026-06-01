import type { WardrobeItem } from '../types';

const OPENAI_API_KEY    = process.env.EXPO_PUBLIC_OPENAI_API_KEY    ?? '';
const REPLICATE_API_KEY = process.env.EXPO_PUBLIC_REPLICATE_API_KEY ?? '';
const FASHN_API_KEY     = process.env.EXPO_PUBLIC_FASHN_API_KEY     ?? '';

// ─── Açıklama eşlemeleri ──────────────────────────────────────────────────────

const SKIN_TONE_MAP: Record<string, string> = {
  very_light: 'very fair',
  light:      'light',
  wheat:      'light olive',
  medium:     'medium brown',
  tan:        'tan',
  dark:       'dark',
};

const HAIR_COLOR_MAP: Record<string, string> = {
  black:       'black',
  dark_brown:  'dark brown',
  brown:       'brown',
  light_brown: 'light brown',
  honey:       'honey blonde',
  red:         'auburn red',
  gray:        'gray',
  colored:     'colorfully dyed',
};

const HAIR_LENGTH_MAP: Record<string, string> = {
  short:     'short',
  medium:    'medium-length',
  long:      'long',
  very_long: 'very long',
};

const HAIR_TYPE_MAP: Record<string, string> = {
  straight: 'straight',
  wavy:     'wavy',
  curly:    'curly',
  afro:     'natural afro',
};

const BODY_TYPE_MAP: Record<string, string> = {
  hourglass: 'hourglass figure',
  pear:      'pear-shaped',
  apple:     'apple-shaped',
  rectangle: 'straight rectangular',
  triangle:  'inverted triangle',
};

const CATEGORY_DESC: Record<string, string> = {
  upper:          'top',
  lower:          'bottoms',
  dress_jumpsuit: 'dress',
  outer:          'jacket',
  shoes:          'shoes',
  bag:            'bag',
  accessory:      'accessory',
};

// ─── Tip ──────────────────────────────────────────────────────────────────────

export interface PhysicalProfile {
  height:     number;
  age:        number;
  bodyType:   string | null;
  skinTone:   string | null;
  hairColor:  string | null;
  hairLength: string | null;
  hairType:   string | null;
}

// ─── GPT-4o: manken görseli üret ─────────────────────────────────────────────

async function generateModelImage(profile: PhysicalProfile): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key eksik — .env dosyasında EXPO_PUBLIC_OPENAI_API_KEY ayarla');

  const skin   = SKIN_TONE_MAP[profile.skinTone   ?? ''] ?? 'medium';
  const hColor = HAIR_COLOR_MAP[profile.hairColor  ?? ''] ?? 'brown';
  const hLen   = HAIR_LENGTH_MAP[profile.hairLength ?? ''] ?? 'medium-length';
  const hType  = HAIR_TYPE_MAP[profile.hairType   ?? ''] ?? 'straight';
  const body   = BODY_TYPE_MAP[profile.bodyType   ?? ''] ?? 'average';

  const prompt =
    `A full-body photo of a female fashion model, ${profile.height} cm tall, ` +
    `${profile.age} years old, ${body} body type, ${skin} skin tone, ` +
    `${hLen} ${hColor} ${hType} hair. ` +
    `Standing straight, facing forward, neutral pose, wearing plain white underwear. ` +
    `White studio background, full body shot, professional fashion photography, ` +
    `natural lighting, high quality, realistic, clean composition.`;

  console.log('API key:', process.env.EXPO_PUBLIC_OPENAI_API_KEY?.substring(0, 10));
  console.log('Prompt:', prompt);

  let data: any;
  try {
    console.log('fetch başlıyor...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:   'gpt-image-1',
        prompt,
        n:       1,
        size:    '1024x1536',
        quality: 'medium',
      }),
    });
    console.log('fetch bitti, status:', response.status);
    data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.error?.message ?? `OpenAI API hatası: ${response.status}`);
    }
  } catch (error) {
    console.log('fetch HATA:', error);
    throw error;
  }

  const b64 = data?.data?.[0]?.b64_json as string | undefined;
  if (!b64) throw new Error('Görsel verisi alınamadı');
  return `data:image/png;base64,${b64}`;
}

// ─── Replicate IDM-VTON: sanal deneme ────────────────────────────────────────

async function applyVirtualTryOn(
  humanImg: string,
  garmImg: string,
  garmentDesc: string,
): Promise<string> {
  if (!REPLICATE_API_KEY) throw new Error('Replicate API key eksik — .env dosyasında EXPO_PUBLIC_REPLICATE_API_KEY ayarla');

  // Prediction başlat
  const startRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      version: 'c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4',
      input: {
        human_img:       humanImg,
        garm_img:        garmImg,
        garment_des:     garmentDesc,
        is_checked:      true,
        is_checked_crop: false,
        denoise_steps:   30,
        seed:            42,
      },
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error((err as any)?.detail ?? `Replicate başlatma hatası: ${startRes.status}`);
  }

  const prediction = await startRes.json() as any;
  const predId = prediction.id as string | undefined;
  if (!predId) throw new Error('Prediction ID alınamadı');

  // Sonucu bekle — max 60 saniye, 2 saniyede bir poll
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
    });
    const status = await statusRes.json() as any;
    if (status.status === 'succeeded') {
      const output = status.output;
      return Array.isArray(output) ? (output[0] as string) : (output as string);
    }
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`Replicate işlemi başarısız: ${status.error ?? status.status}`);
    }
  }

  throw new Error('Replicate zaman aşımına uğradı (60 saniye)');
}

// ─── FASHN istemcisi ──────────────────────────────────────────────────────────

const FASHN_BASE       = 'https://api.fashn.ai/v1';
const FASHN_POLL_MS    = 2_000;
const FASHN_TIMEOUT_MS = 90_000;

/**
 * FASHN API'de prediction başlatır, sonuç görsel URL'ini döndürür.
 * @param modelName  Örn. 'tryon-v1.6'
 * @param inputs     model_image, garment_image ve opsiyonel parametreler
 * @returns          CDN URL (72 saat geçerli)
 */
export async function runFashn(
  modelName: string,
  inputs: Record<string, unknown>,
): Promise<string> {
  if (!FASHN_API_KEY) {
    throw new Error('FASHN API key eksik — EXPO_PUBLIC_FASHN_API_KEY .env dosyasını kontrol et.');
  }

  // 1. Prediction başlat
  const runRes = await fetch(`${FASHN_BASE}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FASHN_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });

  if (!runRes.ok) {
    const body = await runRes.text();
    throw new Error(`FASHN /run ${runRes.status}: ${body}`);
  }

  const runJson = await runRes.json() as { id?: string; error?: unknown };
  if (runJson.error) throw new Error(`FASHN run hatası: ${JSON.stringify(runJson.error)}`);
  const id = runJson.id;
  if (!id) throw new Error('FASHN /run: yanıtta id yok');

  console.log(`[fashn] prediction başladı — id: ${id}`);

  // 2. Status polling — 2 sn aralık, 90 sn timeout
  const deadline = Date.now() + FASHN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, FASHN_POLL_MS));

    const statusRes = await fetch(`${FASHN_BASE}/status/${id}`, {
      headers: { 'Authorization': `Bearer ${FASHN_API_KEY}` },
    });

    if (!statusRes.ok) {
      const body = await statusRes.text();
      throw new Error(`FASHN /status ${statusRes.status}: ${body}`);
    }

    const s = await statusRes.json() as {
      id: string;
      status: 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed';
      output?: string[];
      error?: { name?: string; message?: string };
    };

    console.log(`[fashn] ${id} → ${s.status}`);

    if (s.status === 'completed') {
      const url = s.output?.[0];
      if (!url) throw new Error('FASHN completed ancak output boş');
      return url;
    }

    if (s.status === 'failed') {
      const msg = s.error?.message ?? s.error?.name ?? 'bilinmeyen hata';
      throw new Error(`FASHN prediction başarısız: ${msg}`);
    }

    // 'starting' | 'in_queue' | 'processing' → beklemeye devam
  }

  throw new Error(`FASHN zaman aşımı (${FASHN_TIMEOUT_MS / 1000}s) — id: ${id}`);
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export async function generateVirtualModelImage(
  profile: PhysicalProfile,
  items: WardrobeItem[],
  avatarUrl?: string,
): Promise<string> {
  const item = items[0];
  if (!item) throw new Error('Kıyafet bulunamadı');

  // avatarUrl varsa GPT-4o adımını atla, direkt IDM-VTON'a gönder
  const humanImg = avatarUrl ?? await generateModelImage(profile);

  const garmentDesc = item.itemName ?? CATEGORY_DESC[item.category] ?? item.category;
  return applyVirtualTryOn(humanImg, item.processedImageUrl, garmentDesc);
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/virtualModel.ts

if (require.main === module) {
  // Stabil public model görseli — tam boy, tek kişi, nötr duruş
  const TEST_MODEL_IMAGE =
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=768&q=80';

  // Buraya Supabase processedImageUrl yapıştır
  // Örn: 'https://xyz.supabase.co/storage/v1/object/public/wardrobe/processed/abc.png'
  const TEST_GARMENT_IMAGE = 'BURAYA_SUPABASE_PROCESSED_IMAGE_URL';

  (async () => {
    console.log('\n── FASHN Virtual Try-On Testi ──────────────────────────────────────────');
    console.log('Model    :', TEST_MODEL_IMAGE);
    console.log('Garment  :', TEST_GARMENT_IMAGE);

    try {
      const resultUrl = await runFashn('tryon-v1.6', {
        model_image:        TEST_MODEL_IMAGE,
        garment_image:      TEST_GARMENT_IMAGE,
        garment_photo_type: 'flat-lay',   // Supabase processed görseller düz zemin
        mode:               'balanced',
        num_samples:        1,
        return_base64:      false,
      });

      console.log('\n✅ Sonuç URL:', resultUrl);
      console.log('   Tarayıcıda aç → görsel doğru mu kontrol et.');
    } catch (err) {
      console.error('\n❌ Hata:', err);
    }
  })();
}

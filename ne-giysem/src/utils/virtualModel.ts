import type { WardrobeItem } from '../types';

const OPENAI_API_KEY    = process.env.EXPO_PUBLIC_OPENAI_API_KEY    ?? '';
const REPLICATE_API_KEY = process.env.EXPO_PUBLIC_REPLICATE_API_KEY ?? '';

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

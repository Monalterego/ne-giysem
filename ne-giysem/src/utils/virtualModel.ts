import type { WardrobeItem } from '../types';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

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

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function describeItem(item: WardrobeItem): string {
  const color = item.colors?.[0] ?? '';
  const name  = item.itemName ?? CATEGORY_DESC[item.category] ?? item.category;
  return [color, name].filter(Boolean).join(' ');
}

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

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export async function generateVirtualModelImage(
  profile: PhysicalProfile,
  items: WardrobeItem[],
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key eksik — .env dosyasında EXPO_PUBLIC_OPENAI_API_KEY ayarla');

  const skin   = SKIN_TONE_MAP[profile.skinTone   ?? ''] ?? 'medium';
  const hColor = HAIR_COLOR_MAP[profile.hairColor  ?? ''] ?? 'brown';
  const hLen   = HAIR_LENGTH_MAP[profile.hairLength ?? ''] ?? 'medium-length';
  const hType  = HAIR_TYPE_MAP[profile.hairType   ?? ''] ?? 'straight';
  const body   = BODY_TYPE_MAP[profile.bodyType   ?? ''] ?? 'average';
  const outfit = items.map(describeItem).filter(Boolean).join(', ');

  const prompt =
    `Editorial fashion photography. Female model, ${profile.height} cm tall, ` +
    `${profile.age} years old, ${body} body type, ${skin} skin tone, ` +
    `${hLen} ${hColor} ${hType} hair. ` +
    `Wearing: ${outfit || 'casual outfit'}. ` +
    `White studio background, full body shot, professional fashion photography, ` +
    `natural lighting, high quality, realistic, clean composition.`;

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

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.log('OpenAI error:', JSON.stringify(errBody));
    throw new Error((errBody as any)?.error?.message ?? `OpenAI API hatası: ${response.status}`);
  }

  const data = await response.json();
  const url  = (data as any)?.data?.[0]?.url as string | undefined;
  if (!url) throw new Error('Görsel URL alınamadı');
  return url;
}

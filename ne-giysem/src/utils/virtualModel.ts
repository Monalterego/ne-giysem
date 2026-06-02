import type { WardrobeItem } from '../types';

const FASHN_API_KEY = process.env.EXPO_PUBLIC_FASHN_API_KEY ?? '';

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

// ─── FASHN istemcisi ──────────────────────────────────────────────────────────

const FASHN_BASE       = 'https://api.fashn.ai/v1';
const FASHN_POLL_MS    = 2_000;
const FASHN_TIMEOUT_MS = 90_000;

/**
 * FASHN API'de prediction başlatır, sonuç görsel URL'ini döndürür.
 * @param modelName  Örn. 'tryon-v1.6' | 'model-create'
 * @param inputs     Model girdileri
 * @returns          CDN URL (72 saat geçerli)
 */
export async function runFashn(
  modelName: string,
  inputs: Record<string, unknown>,
): Promise<string> {
  if (!FASHN_API_KEY) {
    throw new Error('FASHN API key eksik — EXPO_PUBLIC_FASHN_API_KEY .env dosyasını kontrol et.');
  }

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
  }

  throw new Error(`FASHN zaman aşımı (${FASHN_TIMEOUT_MS / 1000}s) — id: ${id}`);
}

// ─── Manken prompt ───────────────────────────────────────────────────────────

export function profileToPrompt(profile: PhysicalProfile): string {
  const skin   = SKIN_TONE_MAP[profile.skinTone   ?? ''] ?? 'medium brown';
  const hColor = HAIR_COLOR_MAP[profile.hairColor  ?? ''] ?? 'brown';
  const hLen   = HAIR_LENGTH_MAP[profile.hairLength ?? ''] ?? 'medium-length';
  const hType  = HAIR_TYPE_MAP[profile.hairType   ?? ''] ?? 'straight';
  const body   = BODY_TYPE_MAP[profile.bodyType   ?? ''] ?? 'average';

  return (
    `Full-body studio photograph of a woman, ${profile.age} years old, ${profile.height} cm, ` +
    `${body} body type, ${skin} skin tone, ${hLen} ${hType} ${hColor} hair, ` +
    `standing in a neutral front-facing pose, arms relaxed at sides, ` +
    `plain light-gray background, photorealistic, high quality.`
  );
}

// ─── Manken görseli kaynağı ───────────────────────────────────────────────────

/**
 * Öncelik: avatarUrl → savedMannequinUrl → FASHN model-create
 * Kalıcı kayıt Aşama C'de; burada sadece URL döndürülür.
 */
export async function getModelImage(
  profile: PhysicalProfile,
  avatarUrl?: string,
  savedMannequinUrl?: string,
): Promise<string> {
  if (avatarUrl)          return avatarUrl;
  if (savedMannequinUrl)  return savedMannequinUrl;

  console.log('[fashn] manken üretiliyor (model-create)...');
  const url = await runFashn('model-create', {
    prompt:       profileToPrompt(profile),
    aspect_ratio: '2:3',
  });
  console.log('[fashn] manken hazır:', url);
  return url;
}

// ─── Katmanlama sırası ────────────────────────────────────────────────────────

const LAYER_ORDER: Partial<Record<WardrobeItem['category'], number>> = {
  lower:          1,
  dress_jumpsuit: 1,
  upper:          2,
  outer:          3,
  shoes:          4,
};

/**
 * Çanta ve aksesuarları eler; kalan parçaları katmanlama sırasına dizer.
 * Elbise varsa aynı kombindeteki üst ve alt parçalar atlanır.
 */
export function selectAndOrderGarments(items: WardrobeItem[]): WardrobeItem[] {
  const hasDress = items.some((i) => i.category === 'dress_jumpsuit');

  return items
    .filter((i) => {
      if (i.category === 'bag' || i.category === 'accessory') return false;
      if (hasDress && (i.category === 'upper' || i.category === 'lower')) return false;
      return true;
    })
    .sort((a, b) => (LAYER_ORDER[a.category] ?? 99) - (LAYER_ORDER[b.category] ?? 99));
}

// ─── Katmanlı giydirme ────────────────────────────────────────────────────────

/**
 * Her parçayı sırayla giydirir; her adımın çıktısı bir sonraki adıma model_image olarak girer.
 */
export async function layeredTryOn(
  modelImage: string,
  garments: WardrobeItem[],
): Promise<string> {
  let current = modelImage;

  for (const g of garments) {
    const label = g.itemName ?? g.subCategory ?? g.category;
    console.log(`[fashn] katman: ${g.category} / ${label}`);

    current = await runFashn('tryon-v1.6', {
      model_image:        current,
      garment_image:      g.processedImageUrl,
      garment_photo_type: 'flat-lay',
      category:           'auto',
      mode:               'balanced',
    });

    console.log(`[fashn] katman çıktı (${label}):`, current);
  }

  return current;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export async function generateVirtualModelImage(
  profile: PhysicalProfile,
  items: WardrobeItem[],
  avatarUrl?: string,
  savedMannequinUrl?: string,
): Promise<string> {
  const model    = await getModelImage(profile, avatarUrl, savedMannequinUrl);
  const garments = selectAndOrderGarments(items);
  if (!garments.length) throw new Error('Giydirilecek parça yok');
  return layeredTryOn(model, garments);
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/virtualModel.ts

if (require.main === module) {
  const testProfile: PhysicalProfile = {
    height:     168,
    age:        27,
    bodyType:   'hourglass',
    skinTone:   'wheat',
    hairColor:  'dark_brown',
    hairLength: 'long',
    hairType:   'wavy',
  };

  // Gerçek Supabase processedImageUrl'lerini buraya yapıştır
  const makeItem = (
    id: string,
    name: string,
    category: WardrobeItem['category'],
    url: string,
  ): WardrobeItem => ({
    id, userId: 'test', itemName: name,
    category, subCategory: undefined,
    colors: [], pattern: 'duz', seasons: [], fabric: undefined,
    originalImageUrl: url, processedImageUrl: url,
    createdAt: '',
  });

  const testGarments: WardrobeItem[] = [
    makeItem('g1', 'Siyah wide-leg pantolon', 'lower',
      'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/9254cb44-c680-4798-8ce6-fc2ebdbd33ea.png'),
    makeItem('g2', 'Beyaz oversize bluz',     'upper',
      'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/aca876d0-f0b6-4815-9c8e-2c94af14aa1b.png'),
    makeItem('g3', 'Siyah loafer',            'shoes',
      'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/0828f58d-4327-4657-96cc-7c721406699f.png'),
  ];

  (async () => {
    console.log('\n── FASHN Katmanlı Kombin Testi ─────────────────────────────────────────');
    console.log('Profil:', JSON.stringify(testProfile));
    console.log('Parçalar:', testGarments.map((g) => `${g.category}/${g.itemName}`).join(', '));
    console.log('Avatar: YOK → model-create yolu\n');

    try {
      const mannequinUrl = await getModelImage(testProfile);
      console.log('\n[1] Manken URL:', mannequinUrl);
      console.log('    → Tarayıcıda aç: tam boy, nötr poz, açık gri zemin var mı?\n');

      const garments = selectAndOrderGarments(testGarments);
      console.log('[2] Katmanlama sırası:', garments.map((g) => g.category).join(' → '));

      const finalUrl = await layeredTryOn(mannequinUrl, garments);
      console.log('\n✅ Final URL:', finalUrl);
      console.log('   → Tarayıcıda aç: manken üzerinde tüm parçalar katmanlanmış mı?');
    } catch (err) {
      console.error('\n❌ Hata:', err);
    }
  })();
}

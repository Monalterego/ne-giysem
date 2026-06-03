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
const FASHN_TIMEOUT_MS = 180_000;

// Geçici ağ kopmalarında üstel backoff ile yeniden dener (1.5s → 3s)
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise<void>((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

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

  const runRes = await fetchWithRetry(`${FASHN_BASE}/run`, {
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

    let statusRes: Response;
    try {
      statusRes = await fetchWithRetry(`${FASHN_BASE}/status/${id}`, {
        headers: { 'Authorization': `Bearer ${FASHN_API_KEY}` },
      });
    } catch {
      throw new Error('Manken üretimi sırasında bağlantı koptu, tekrar dene.');
    }

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

// FASHN tryon-v1.6 geçerli kategoriler: tops | bottoms | one-pieces
// Shoes/footwear FASHN'de desteklenmiyor → selectAndOrderGarments'tan çıkarılır.
const FASHN_CATEGORY: Partial<Record<WardrobeItem['category'], string>> = {
  upper:          'tops',
  lower:          'bottoms',
  dress_jumpsuit: 'one-pieces',
  outer:          'tops',
};

const LAYER_ORDER: Partial<Record<WardrobeItem['category'], number>> = {
  lower:          1,
  dress_jumpsuit: 1,
  upper:          2,
  outer:          3,
};

/**
 * FASHN'in desteklemediği kategorileri (shoes, bag, accessory) eler;
 * kalan parçaları katmanlama sırasına dizer.
 * Elbise varsa kombindeteki üst ve alt parçalar atlanır.
 */
export function selectAndOrderGarments(items: WardrobeItem[]): WardrobeItem[] {
  const hasDress = items.some((i) => i.category === 'dress_jumpsuit');

  return items
    .filter((i) => {
      if (!(i.category in FASHN_CATEGORY)) return false;   // shoes/bag/accessory elenir
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
    const label    = g.itemName ?? g.subCategory ?? g.category;
    const category = FASHN_CATEGORY[g.category] ?? 'tops';
    console.log(`[fashn] katman: ${g.category} → FASHN category="${category}" / ${label}`);

    current = await runFashn('tryon-v1.6', {
      model_image:        current,
      garment_image:      g.processedImageUrl,
      garment_photo_type: 'flat-lay',
      category,
      mode:               'balanced',
    });

    console.log(`[fashn] katman çıktı (${label}):`, current);
  }

  return current;
}

// ─── Cache anahtar yardımcısı ────────────────────────────────────────────────

/**
 * Kombinin giyilebilir parçalarından (bag/accessory hariç) sıralı, güvenli bir
 * cache anahtar dizgisi üretir. Supabase storage path'inde kullanılır.
 */
export function comboSignatureForCache(items: WardrobeItem[]): string {
  return items
    .filter((i) => i.category !== 'bag' && i.category !== 'accessory')
    .map((i) => i.id)
    .sort()
    .join('_');
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

  let result = await layeredTryOn(model, garments);

  // Shoes katmanı: tryon-max (tryon-v1.6'da desteklenmiyor)
  const shoe = items.find((i) => i.category === 'shoes');
  if (shoe) {
    console.log('[fashn] tryon-max: ayakkabı ekleniyor...');
    result = await runFashn('tryon-max', {
      model_image:     result,
      product_image:   shoe.processedImageUrl,
      prompt:          'shoes worn on feet',
      resolution:      '1k',
      generation_mode: 'balanced',
    });
    console.log('[fashn] tryon-max ayakkabı çıktı:', result);
  }

  return result;
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

  // Shoes FASHN tryon-v1.6'da desteklenmiyor — sadece lower + upper test edilir
  const testGarments: WardrobeItem[] = [
    makeItem('g1', 'Siyah wide-leg pantolon', 'lower',
      'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/9254cb44-c680-4798-8ce6-fc2ebdbd33ea.png'),
    makeItem('g2', 'Beyaz oversize bluz',     'upper',
      'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/aca876d0-f0b6-4815-9c8e-2c94af14aa1b.png'),
  ];

  // Shoes URL'i — tryon-max testi için ayrı tutulur
  const TEST_SHOES_URL =
    'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/wardrobe-items/8550494a-bc32-49a2-86cd-ee931117b287/0828f58d-4327-4657-96cc-7c721406699f.png';

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

      const layeredUrl = await layeredTryOn(mannequinUrl, garments);
      console.log('\n[3] Katmanlı (üst+alt) URL:', layeredUrl);
      console.log('    → Tarayıcıda aç: üst+alt düzgün giydirilmiş mi?\n');

      // ── tryon-max ayakkabı denemesi ─────────────────────────────────────────
      // tryon-max şeması (v1.6'dan farklı):
      //   model_image   → kişi görseli
      //   product_image → ürün görseli  (v1.6'daki garment_image değil!)
      //   prompt        → stil ipucu
      //   resolution    → '1k' | '2k' | '4k'
      //   generation_mode → 'balanced' | 'quality'
      //   category alanı YOK
      console.log('[4] tryon-max: ayakkabı ekleniyor...');
      const shoesUrl = await runFashn('tryon-max', {
        model_image:     layeredUrl,
        product_image:   TEST_SHOES_URL,
        prompt:          'shoes worn on feet',
        resolution:      '1k',
        generation_mode: 'balanced',
      });
      console.log('\n✅ tryon-max ayakkabı URL:', shoesUrl);
      console.log('   → (a) Ayakkabı ayağa düzgün giydirilmiş mi?');
      console.log('   → (b) Üst+alt kıyafet BOZULMADAN korunmuş mu?');
      console.log('   Evetse: tryon-max shoes katmanı Ana Akış\'a eklenebilir.');
    } catch (err) {
      console.error('\n❌ Hata:', err);
    }
  })();
}

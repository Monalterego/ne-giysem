import type { WardrobeItem } from '../types';
import { callEdge, edgeError, EdgeError } from '../lib/edgeFunctions';
import { signedUrlForFashn } from '../lib/storageUrls';
import { isOuter } from './comboEngine';

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
  weight?:    number;
  age:        number;
  bodyType:   string | null;
  skinTone:   string | null;
  hairColor:  string | null;
  hairLength: string | null;
  hairType:   string | null;
}

// ─── FASHN istemcisi ──────────────────────────────────────────────────────────

const FASHN_POLL_MS    = 2_000;
const FASHN_TIMEOUT_MS = 240_000;

// Geçici ağ kopmalarında üstel backoff ile yeniden dener (1.5s → 3s).
// YALNIZCA status için — /run tekrar denenirse FASHN'da aynı iş iki kez başlayabilir.
// EdgeError (oturum yok vb.) tekrar denenmez.
async function withRetry(call: () => Promise<Response>, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await call();
    } catch (err) {
      if (err instanceof EdgeError || i === retries) throw err;
      await new Promise<void>((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

export type TryOnStart =
  | { allowed: true;  renderId: string; used: number; limit: number | null }
  | { allowed: false; used: number | null; limit: number | null;
      /** 'trial' → deneme toplamı bitti; 'premium' → bu ayki hak bitti (paywall yok, Adım 15) */
      plan: 'trial' | 'premium' | null; resetAt: string | null };

/**
 * Sunucuda kota kontrolü + render kaydı. Bir try-on'un tüm FASHN çağrıları
 * (manken + katmanlar + ayakkabı) dönen renderId altında sayılır.
 */
export async function startTryOn(): Promise<TryOnStart> {
  const res = await callEdge('fashn-proxy', { action: 'start' });
  if (res.status === 402) {
    const body = await res.json().catch(() => ({})) as {
      used?: number; limit?: number; plan?: 'trial' | 'premium' | null; reset_at?: string | null;
    };
    return {
      allowed: false, used: body.used ?? null, limit: body.limit ?? null,
      plan: body.plan ?? null, resetAt: body.reset_at ?? null,
    };
  }
  if (!res.ok) throw await edgeError(res);
  const body = await res.json() as { render_id: string; used: number; limit: number | null };
  return { allowed: true, renderId: body.render_id, used: body.used, limit: body.limit };
}

/**
 * Bir FASHN adımının çıktısı. fashn-proxy çıktıyı mannequin-cache'e yazar:
 * url = 10 dk'lık imzalı URL (sonraki adıma model_image olarak gider),
 * path = bucket içi yol (<uid>/tmp_… ya da <uid>/base_mannequin.png).
 * path null → sunucu yazmadı (FASHN https döndürdü): url FASHN CDN URL'idir.
 */
export type FashnOutput = { url: string; path: string | null };

/**
 * FASHN API'de prediction başlatır, tamamlanınca çıktıyı döndürür.
 * @param modelName  Örn. 'tryon-v1.6' | 'model-create'
 * @param inputs     Model girdileri
 * @param renderId   startTryOn'dan gelen render kimliği
 */
export async function runFashn(
  modelName: string,
  inputs: Record<string, unknown>,
  renderId: string,
): Promise<FashnOutput> {
  // Tek deneme — bkz. withRetry
  const runRes = await callEdge('fashn-proxy', {
    action: 'run',
    render_id: renderId,
    payload: { model_name: modelName, inputs },
  });
  if (!runRes.ok) throw await edgeError(runRes);

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
      statusRes = await withRetry(() => callEdge('fashn-proxy', { action: 'status', id }));
    } catch (err) {
      if (err instanceof EdgeError) throw err;
      throw new Error('Manken üretimi sırasında bağlantı koptu, tekrar dene.');
    }

    if (!statusRes.ok) {
      // 5xx/503 yoklamada geçici olabilir — FASHN'da iş sürüyor olabilir; proxy bu
      // durumda iade de yapmaz. Hata gösterme, deadline'a kadar yoklamaya devam et.
      // (503'ü kullanıcı yalnızca /run ve start'ta görür.)
      if (statusRes.status >= 500) {
        const e = await edgeError(statusRes);
        console.warn(`[fashn] ${id} status ${statusRes.status} — yoklama sürüyor`, e.code);
        continue;
      }
      throw await edgeError(statusRes);
    }

    const s = await statusRes.json() as {
      id: string;
      status: 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed';
      output?: string[];
      path?: string;
      error?: { name?: string; message?: string };
    };

    console.log(`[fashn] ${id} → ${s.status}`);

    if (s.status === 'completed') {
      const url = s.output?.[0];
      if (!url) throw new Error('FASHN completed ancak output boş');
      return { url, path: typeof s.path === 'string' ? s.path : null };
    }

    if (s.status === 'failed') {
      // Ad + mesaj birlikte: PoseError gibi hata adları errorMessage eşleşmesine ulaşsın
      const msg = [s.error?.name, s.error?.message].filter(Boolean).join(': ') || 'bilinmeyen hata';
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
    (profile.weight ? `${profile.weight} kg, ` : '') +
    `${body} body type, ${skin} skin tone, ${hLen} ${hType} ${hColor} hair, ` +
    `standing in a neutral front-facing pose, arms relaxed at sides, ` +
    `wearing simple plain seamless nude/beige fitted underwear (sports bra and briefs), ` +
    `no outerwear, no pants, no skirt, no socks, minimal neutral base layer, ` +
    `plain light-gray background, photorealistic, high quality.`
  );
}

// ─── Manken görseli kaynağı ───────────────────────────────────────────────────

/** Manken kaynağı: storage yolu (ya da eski tam URL / harici FASHN URL'i) + bucket'ı */
export type ModelSource = { bucket: 'avatars' | 'mannequin-cache'; ref: string };

/**
 * Yapay manken üretimi (FASHN model-create). Sunucu çıktıyı <uid>/base_mannequin.png
 * olarak yazar (path). Kotadan düşmez ama render'ın çağrı bütçesine dahildir.
 */
export async function createMannequin(profile: PhysicalProfile, renderId: string): Promise<FashnOutput> {
  console.log('[fashn] manken üretiliyor (model-create)...');
  const out = await runFashn('model-create', {
    prompt:       profileToPrompt(profile),
    aspect_ratio: '2:3',
  }, renderId);
  console.log('[fashn] manken hazır:', out.path ?? '(FASHN URL)');
  return out;
}

/**
 * Öncelik: verilen kaynak (avatar / kayıtlı manken) → FASHN model-create.
 * Kaynak storage'daysa FASHN'a 10 dk'lık imzalı URL gider (FASHN URL'leri saklıyor).
 */
export async function getModelImage(
  profile: PhysicalProfile,
  renderId: string,
  source?: ModelSource | null,
): Promise<string> {
  if (source) return signedUrlForFashn(source.bucket, source.ref);
  return (await createMannequin(profile, renderId)).url;
}

// ─── Katmanlama sırası ────────────────────────────────────────────────────────

// FASHN tryon-v1.6 geçerli kategoriler: tops | bottoms | one-pieces
// Shoes/footwear FASHN'de desteklenmiyor → selectAndOrderGarments'tan çıkarılır.
// Dış giyim ('outer' + hırka/yelek, comboEngine isOuter) try-on'a girmez: katman
// başına bir FASHN çağrısı ve önceki katmanı bozma riski — kartta yine görünür.
const FASHN_CATEGORY: Partial<Record<WardrobeItem['category'], string>> = {
  upper:          'tops',
  lower:          'bottoms',
  dress_jumpsuit: 'one-pieces',
};

const LAYER_ORDER: Partial<Record<WardrobeItem['category'], number>> = {
  lower:          1,
  dress_jumpsuit: 1,
  upper:          2,
};

/**
 * FASHN'in desteklemediği kategorileri (shoes, bag, accessory) ve dış giyimi eler;
 * kalan parçaları katmanlama sırasına dizer.
 * Elbise varsa kombindeteki üst ve alt parçalar atlanır.
 * İstisna: normal üst ve elbise yoksa 'upper' kategorisindeki ilk hırka/yelek üst olarak
 * giydirilir. Motor bunu üretmez (comboEngine çekirdek üstü isOuter'ı dışlar); motor dışı
 * kombinlerde olur — örn. favori kaydedildikten sonra üstü "Hırka" olarak düzenlenmişse.
 */
export function selectAndOrderGarments(items: WardrobeItem[]): WardrobeItem[] {
  const hasDress   = items.some((i) => i.category === 'dress_jumpsuit');
  const hasCoreTop = items.some((i) => i.category === 'upper' && !isOuter(i));
  // 'outer' kategorisi (ceket, mont…) hiçbir durumda üst sayılmaz
  const layerAsTop = !hasDress && !hasCoreTop
    ? items.find((i) => i.category === 'upper' && isOuter(i))
    : undefined;

  return items
    .filter((i) => {
      if (!(i.category in FASHN_CATEGORY)) return false;   // outer/shoes/bag/accessory elenir
      if (isOuter(i) && i !== layerAsTop) return false;    // hırka/yelek — üst yerine geçmiyorsa
      if (hasDress && (i.category === 'upper' || i.category === 'lower')) return false;
      return true;
    })
    .sort((a, b) => (LAYER_ORDER[a.category] ?? 99) - (LAYER_ORDER[b.category] ?? 99));
}

/** Kombinde giydirilmeyen dış giyim var mı? (sonuç ekranı notu — üst yerine giydirilen hırka sayılmaz) */
export function hasOmittedOuterwear(items: WardrobeItem[]): boolean {
  const dressed = new Set(selectAndOrderGarments(items).map((i) => i.id));
  return items.some((i) => isOuter(i) && !dressed.has(i.id));
}

/** Try-on'a giren ayakkabı (tryon-max adımı) — ilk ayakkabı */
function tryOnShoe(items: WardrobeItem[]): WardrobeItem | undefined {
  return items.find((i) => i.category === 'shoes');
}

// ─── Katmanlı giydirme ────────────────────────────────────────────────────────

/**
 * Her parçayı sırayla giydirir; her adımın çıktısı (bizim storage'daki ara dosyanın imzalı
 * URL'i) bir sonraki adıma model_image olarak girer.
 */
export async function layeredTryOn(
  modelImage: string,
  garments: WardrobeItem[],
  renderId: string,
): Promise<FashnOutput> {
  let current: FashnOutput = { url: modelImage, path: null };

  for (const g of garments) {
    const label    = g.itemName ?? g.subCategory ?? g.category;
    const category = FASHN_CATEGORY[g.category] ?? 'tops';
    console.log(`[fashn] katman: ${g.category} → FASHN category="${category}" / ${label}`);

    current = await runFashn('tryon-v1.6', {
      model_image:        current.url,
      // Katmandan hemen önce imzalanır — 10 dk TTL uzun render'da da geçerli kalsın
      garment_image:      await signedUrlForFashn('wardrobe-items', g.processedImageUrl),
      // 'flat-lay' sadece düz serili/ghost manken görselleri için; kullanıcılar
      // askıda/yatakta/mankende çekiyor → 'auto' otomatik tespit etsin
      garment_photo_type: 'auto',
      category,
      mode:               'quality',
      // false → orijinal kıyafet düzgün kaldırılır (alt parça binme sorunu)
      segmentation_free:  false,
      // varsayılan seed sabit 42; rastgele seed her üretimde farklı varyasyon dener
      seed:               Math.floor(Math.random() * 4294967295),
      // jpeg: tüketici try-on için daha hızlı yanıt + ~8x küçük (cached egress)
      output_format:      'jpeg',
    }, renderId);

    console.log(`[fashn] katman çıktı (${label}):`, current.path ?? '(FASHN URL)');
  }

  return current;
}

/**
 * Deneme sonu (fashn-proxy 'finish'). final verilirse sunucu son ara dosyayı
 * <uid>/<cacheName>'e kopyalar; her durumda bu render'ın ara dosyalarını (tmp_) siler.
 * Döner: kopyalandı mı. Hata → fırlatır (çağıran yedek yola düşer).
 */
export async function finishTryOn(
  renderId: string,
  final?: { path: string; cacheName: string },
): Promise<boolean> {
  const res = await callEdge('fashn-proxy', {
    action: 'finish',
    render_id: renderId,
    ...(final ? { final_path: final.path, cache_key: final.cacheName } : {}),
  });
  if (!res.ok) throw await edgeError(res);
  const body = await res.json() as { copied?: boolean };
  return body.copied === true;
}

// ─── Cache anahtar yardımcısı ────────────────────────────────────────────────

// Try-on cache sürümü. v1 (önek yok) dış giyimi de içeriyordu; v2 yalnızca gerçekten
// giydirilen parçalardan oluşur → eski (dış giyimli) çıktılar isabet vermez.
const TRYON_CACHE_VERSION = 'v2';

/**
 * Try-on cache anahtarı: yalnızca giydirilen parçalar (selectAndOrderGarments + ayakkabı),
 * sıralı id'ler, sürüm önekli. Dosya adında parça id'leri kalır — parça silinince ilgili
 * cache'i bulmak için (privacyActions.deleteWardrobeItemFiles).
 */
export function tryOnCacheSignature(items: WardrobeItem[]): string {
  const ids = tryOnItems(items).map((i) => i.id).sort();
  return `${TRYON_CACHE_VERSION}_${ids.join('_')}`;
}

/** FASHN'a görseli gidecek parçalar: giydirilenler + ayakkabı (cache imzası, rezervasyon öncesi kontrol) */
export function tryOnItems(items: WardrobeItem[]): WardrobeItem[] {
  const shoe = tryOnShoe(items);
  return [...selectAndOrderGarments(items), ...(shoe ? [shoe] : [])];
}

/**
 * Kombinin giyilebilir parçalarından (bag/accessory hariç) sıralı imza.
 * Favoriler bunu DB'ye yazar (favorite_combos.signature) — değiştirilirse mevcut
 * favoriler eşleşmez. Try-on cache'i artık tryOnCacheSignature kullanır.
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
  renderId: string,
  source?: ModelSource | null,
): Promise<FashnOutput> {
  const model    = await getModelImage(profile, renderId, source);
  const garments = selectAndOrderGarments(items);
  if (!garments.length) throw new Error('Giydirilecek parça yok');

  const shoe = tryOnShoe(items);

  let result = await layeredTryOn(model, garments, renderId);

  // Shoes katmanı: tryon-max (tryon-v1.6'da desteklenmiyor)
  if (shoe) {
    console.log('[fashn] tryon-max: ayakkabı ekleniyor...');
    result = await runFashn('tryon-max', {
      model_image:     result.url,
      product_image:   await signedUrlForFashn('wardrobe-items', shoe.processedImageUrl),
      prompt:          'shoes worn on feet',
      resolution:      '1k',
      // Sunucu yalnızca 'balanced' kabul eder (fashn-proxy PINNED_VALUES) — maliyet
      generation_mode: 'balanced',
      // Sunucuda sabit: cache dosyası .jpg (varsayılan png idi)
      output_format:   'jpeg',
    }, renderId);
    console.log('[fashn] tryon-max ayakkabı çıktı:', result.path ?? '(FASHN URL)');
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
      // Sunucu kotası — oturum açık bir kullanıcı gerekir
      const start = await startTryOn();
      if (!start.allowed) throw new Error(`kota dolu: ${start.used}/${start.limit}`);
      const renderId = start.renderId;

      const mannequinUrl = await getModelImage(testProfile, renderId);
      console.log('\n[1] Manken URL:', mannequinUrl);
      console.log('    → Tarayıcıda aç: tam boy, nötr poz, açık gri zemin var mı?\n');

      const garments = selectAndOrderGarments(testGarments);
      console.log('[2] Katmanlama sırası:', garments.map((g) => g.category).join(' → '));

      const layeredUrl = (await layeredTryOn(mannequinUrl, garments, renderId)).url;
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
      const shoesUrl = (await runFashn('tryon-max', {
        model_image:     layeredUrl,
        product_image:   await signedUrlForFashn('wardrobe-items', TEST_SHOES_URL),
        prompt:          'shoes worn on feet',
        resolution:      '1k',
        generation_mode: 'balanced',
        output_format:   'jpeg',
      }, renderId)).url;
      console.log('\n✅ tryon-max ayakkabı URL:', shoesUrl);
      console.log('   → (a) Ayakkabı ayağa düzgün giydirilmiş mi?');
      console.log('   → (b) Üst+alt kıyafet BOZULMADAN korunmuş mu?');
      console.log('   Evetse: tryon-max shoes katmanı Ana Akış\'a eklenebilir.');
    } catch (err) {
      console.error('\n❌ Hata:', err);
    }
  })();
}

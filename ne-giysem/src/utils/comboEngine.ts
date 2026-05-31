import type { WardrobeItem, Combo, Season } from '../types';
import { OCCASIONS } from '../constants/occasions';
import type { OccasionId } from '../constants/occasions';
import { itemColorScore, outfitColorScore } from './colorTheory';
import { isItemAllowed, getFormalityFit, OCCASION_RULES } from './occasionRules';
import { getVisualWeight, isStatement } from './itemTraits';
import { proportionScore } from './proportionTheory';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface UserProfileInput {
  styleProfile?: string;   // "Minimalist %60, Old Money %40"
  height?: number;
  age?: number;
  bodyType?: string;
  skinTone?: string;
  hairColor?: string;
  hairLength?: string;
  hairType?: string;
}

const OCCASION_TR: Record<Occasion, string> = {
  all:     'Günlük',
  gunluk:  'Günlük',
  is:      'İş',
  brunch:  'Brunch & Kahve',
  gece:    'Gece & Out',
  date:    'Date',
  davet:   'Düğün & Davet',
  spor:    'Spor & Aktif',
  seyahat: 'Seyahat',
};

function getCurrentSeason(): Season {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

function seasonDesc(s: Season): string {
  const map: Record<Season, string> = { spring: 'ilkbahar', summer: 'yaz', fall: 'sonbahar', winter: 'kış' };
  return map[s];
}

export type Occasion = OccasionId | 'all';
export type { OccasionId };

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Çekirdek parçalara renk uyumu en yüksek n adayı döner (min eşik: 0.65)
function bestMatches(core: WardrobeItem[], candidates: WardrobeItem[], n: number): WardrobeItem[] {
  return candidates
    .map((c) => ({
      item: c,
      score: core.reduce((sum, ci) => sum + itemColorScore(ci, c), 0) / core.length,
    }))
    .filter((x) => x.score > 0.65)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.item);
}

const OUTER_SUBCATEGORIES = [
  'hirka', 'yelek', 'ceket', 'blazer', 'mont', 'kaban', 'trenchkot', 'yagmurluk',
];

function isOuter(item: WardrobeItem): boolean {
  return item.category === 'outer' || OUTER_SUBCATEGORIES.includes(item.subCategory ?? '');
}

// Aksesuar bölge haritası — her bölgeden kombinde en fazla 1 parça
const ACCESSORY_ZONES: Record<string, string> = {
  kupe: 'yuz', gozluk: 'yuz', sapka: 'yuz',
  kolye: 'boyun', fular: 'boyun', kaskol: 'boyun', bandana: 'boyun',
  bileklik: 'bilek', yuzuk: 'bilek',
  kemer: 'bel',
};

// Bu okasyonlarda dış giyim her zaman denenir (hava durumundan bağımsız)
const FORMAL_OUTER_OCCASIONS = new Set<string>(['is', 'davet', 'gece', 'date', 'brunch']);

interface ComposedOutfit {
  items: WardrobeItem[];
  points: number;
  completeness: number;
  chosenOuter?: WardrobeItem;
}

// 7-puan outfit kompozisyon motoru
// core üzerine sırayla çanta → dış giyim → aksesuar ekler; puan bütçesi + tek-odak kuralına uyar
function composeOutfit(
  core: WardrobeItem[],
  pools: { bags: WardrobeItem[]; outers: WardrobeItem[]; accessories: WardrobeItem[] },
  occasion: Occasion,
): ComposedOutfit {
  const ruleKey: OccasionId = occasion === 'all' ? 'gunluk' : occasion as OccasionId;
  const rule = OCCASION_RULES[ruleKey];
  const outfitItems = [...core];
  const pts = () => outfitItems.reduce((s, i) => s + getVisualWeight(i), 0);

  // a) ÇANTA: renk uyumlu en iyi çantayı ekle
  const bag = bestMatches(core, pools.bags, 1)[0];
  if (bag) outfitItems.push(bag);

  // b) DIŞ GİYİM: spor dışı + (formal okasyon veya puan henüz hedefe ulaşmadıysa)
  let chosenOuter: WardrobeItem | undefined;
  if (occasion !== 'spor') {
    const outer = bestMatches(core, pools.outers, 1)[0];
    if (outer && (FORMAL_OUTER_OCCASIONS.has(occasion) || pts() < rule.pointTarget[0])) {
      outfitItems.push(outer);
      chosenOuter = outer;
    }
  }

  // c) AKSESUARLAR — bölge tekil + tek-odak (yüz/boyun) + puan bütçesi döngüsü
  // minAccessories karşılanana kadar pointTarget[0] tavanı devreye girmez;
  // pointTarget[1] (max) SADECE minAccessories sağlandıktan sonra kapatır.
  const ranked = bestMatches(core, pools.accessories, pools.accessories.length);
  let accStatements = 0;
  let accAdded = 0;
  const usedZones = new Set<string>();
  let faceNeckStatement = false;

  for (const acc of ranked) {
    const reachedMin = pts() >= rule.pointTarget[0];
    const enoughAcc  = accAdded >= rule.minAccessories;
    if (reachedMin && enoughAcc) break;
    if (enoughAcc && pts() >= rule.pointTarget[1]) break;
    const zone = ACCESSORY_ZONES[acc.subCategory ?? ''];
    if (!zone) continue;
    if (usedZones.has(zone)) continue;
    if (isStatement(acc)) {
      if (accStatements >= rule.maxStatementAccessories) continue;
      if ((zone === 'yuz' || zone === 'boyun') && faceNeckStatement) continue;
      accStatements++;
      if (zone === 'yuz' || zone === 'boyun') faceNeckStatement = true;
    }
    outfitItems.push(acc);
    usedZones.add(zone);
    accAdded++;
  }

  // d) Tamamlama skoru: hedefteyse 1, dışındaysa mesafeye göre lineer düşer
  const p = pts();
  const [min, max] = rule.pointTarget;
  const completeness = (p >= min && p <= max)
    ? 1
    : Math.max(0, 1 - (p < min ? min - p : p - max) * 0.15);

  return { items: outfitItems, points: p, completeness, chosenOuter };
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────

const CANDIDATE_CAP = 40;

function comboLabel(score: number): string {
  return score >= 80 ? 'Mükemmel Uyum' : score >= 65 ? 'İyi Kombin' : 'Kabul Edilebilir';
}

// Kombinın taban imzası: üst/alt/elbise ID'lerinin sıralı birleşimi
// Aynı imza = aynı çekirdek (çeşitlilik için sert engel)
function baseSignature(combo: Combo): string {
  return combo.items
    .filter((i) => ['upper', 'lower', 'dress_jumpsuit'].includes(i.category))
    .map((i) => i.id)
    .sort()
    .join('|');
}

const PENALTY = 8;

// Greedy çeşitlilik seçimi: skor + kullanım cezası + çekirdek tekrar engeli
function selectDiverse(candidates: Combo[], maxCombos: number): Combo[] {
  const selected        = [] as Combo[];
  const usage           = new Map<string, number>();
  const usedSignatures  = new Set<string>();
  const pool            = [...candidates];

  while (selected.length < maxCombos && pool.length) {
    let bestIdx = -1, bestAdj = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (usedSignatures.has(baseSignature(c))) continue;      // sert: aynı çekirdek yasak
      const reuse = c.items.reduce((s, it) => s + (usage.get(it.id) ?? 0), 0);
      const adj   = c.score - reuse * PENALTY;                 // yumuşak: tekrar cezası
      if (adj > bestAdj) { bestAdj = adj; bestIdx = i; }
    }
    if (bestIdx === -1) break;                                  // kalan adayların hepsi çakışıyor
    const chosen = pool.splice(bestIdx, 1)[0];
    selected.push(chosen);
    usedSignatures.add(baseSignature(chosen));
    for (const it of chosen.items) usage.set(it.id, (usage.get(it.id) ?? 0) + 1);
  }
  return selected;
}

export function generateCombos(
  items: WardrobeItem[],
  maxCombos = 12,
  occasion: Occasion = 'all',
): Combo[] {
  // Hard-filter: dress-code ihlalleri (terlik+davet, sneaker+davet vb.) elenir
  const allow = (item: WardrobeItem) =>
    occasion === 'all' || isItemAllowed(item, occasion as OccasionId);

  // Hırka/yelek dahil tüm dış giyim outers havuzuna — çekirdek üst sayılmaz
  const uppers      = items.filter((i) => i.category === 'upper' && !isOuter(i) && allow(i));
  const lowers      = items.filter((i) => i.category === 'lower' && allow(i));
  const shoes       = items.filter((i) => i.category === 'shoes' && allow(i));
  const dresses     = items.filter((i) => i.category === 'dress_jumpsuit' && allow(i));
  const bags        = items.filter((i) => i.category === 'bag');
  const outers      = items.filter(isOuter);
  const accessories = items.filter((i) => i.category === 'accessory');

  // ─── 1. GEÇİŞ: ucuz proxy (colorHarmony + occFit), composeOutfit çağrısı yok ──────
  const ruleKey: OccasionId = occasion === 'all' ? 'gunluk' : occasion as OccasionId;
  type Candidate = { core: WardrobeItem[]; colorHarmony: number; occFit: number; prop: number };
  const candidates: Candidate[] = [];

  if (uppers.length && lowers.length && shoes.length) {
    for (const upper of uppers) {
      for (const lower of lowers) {
        for (const shoe of shoes) {
          const colorHarmony =
            itemColorScore(upper, lower) * 0.45 +
            itemColorScore(lower, shoe)  * 0.35 +
            itemColorScore(upper, shoe)  * 0.20;
          const occFit =
            (getFormalityFit(upper, ruleKey) +
             getFormalityFit(lower, ruleKey) +
             getFormalityFit(shoe, ruleKey)) / 3;
          candidates.push({ core: [upper, lower, shoe], colorHarmony, occFit, prop: proportionScore([upper, lower, shoe]) });
        }
      }
    }
  }

  if (dresses.length && shoes.length) {
    for (const dress of dresses) {
      for (const shoe of shoes) {
        const colorHarmony = itemColorScore(dress, shoe);
        const occFit       = (getFormalityFit(dress, ruleKey) + getFormalityFit(shoe, ruleKey)) / 2;
        candidates.push({ core: [dress, shoe], colorHarmony, occFit, prop: proportionScore([dress, shoe]) });
      }
    }
  }

  // colorHarmony + occFit proxy'ye göre sırala, en iyi CANDIDATE_CAP çekirdeği seç
  candidates.sort((a, b) => (b.colorHarmony + b.occFit + b.prop) - (a.colorHarmony + a.occFit + a.prop));
  const top = candidates.slice(0, CANDIDATE_CAP);

  // ─── 2. GEÇİŞ: composeOutfit çağır, final skor hesapla ──────────────────────
  const now = new Date().toISOString();
  const pools = { bags, outers, accessories };

  const encouraged = OCCASION_RULES[ruleKey].encouraged;

  const results = top
    .map(({ core, colorHarmony, occFit }) => {
      const { items: outfitItems, completeness, chosenOuter } = composeOutfit(core, pools, occasion);
      const prop = proportionScore(core, chosenOuter);
      // Çekirdek içinde okasyon tarafından teşvik edilen subCategory'lerin oranı
      const encCoverage = core.filter((i) => encouraged.includes(i.subCategory ?? '')).length / core.length;
      // Pass 1 proxy (ikili) + outfit dağılım skoru harmanlama
      const pairwiseColor = colorHarmony;
      const colorHarmonyFinal = 0.7 * pairwiseColor + 0.3 * outfitColorScore(outfitItems);
      // Ağırlıklar toplamı = 1.0 → clamp gerekmez
      const final01 = 0.35 * colorHarmonyFinal + 0.20 * occFit + 0.20 * prop + 0.13 * completeness + 0.12 * encCoverage;
      const score   = Math.round(final01 * 100);
      return {
        id: uid(),
        items: outfitItems,
        score,
        occasion,
        label: comboLabel(score),
        createdAt: now,
      } as Combo;
    })
    .sort((a, b) => b.score - a.score);
  return selectDiverse(results, maxCombos);
}

// Dolabın kombin üretmek için hangi kategorilerde eksik olduğunu döner
export function missingCategories(items: WardrobeItem[]): string[] {
  const missing: string[] = [];
  const hasUpper  = items.some((i) => i.category === 'upper');
  const hasLower  = items.some((i) => i.category === 'lower');
  const hasDress  = items.some((i) => i.category === 'dress_jumpsuit');
  const hasShoes  = items.some((i) => i.category === 'shoes');

  if (!hasUpper && !hasDress) missing.push('üst kıyafet veya elbise');
  if (!hasLower && !hasDress) missing.push('alt kıyafet');
  if (!hasShoes)              missing.push('ayakkabı');
  return missing;
}

// ─── Claude AI kombin motoru ─────────────────────────────────────────────────

const OCCASION_PRIORITY: Record<string, string[]> = {
  gece:    ['mini_elbise', 'midi_elbise', 'topuklu', 'sandalet', 'etek'],
  date:    ['midi_elbise', 'maxi_elbise', 'mini_elbise', 'topuklu', 'sandalet', 'etek', 'bluz'],
  davet:   ['maxi_elbise', 'midi_elbise', 'topuklu'],
  is:      ['blazer', 'gomlek', 'pantolon', 'topuklu', 'loafer'],
  brunch:  ['midi_elbise', 'etek', 'bluz', 'loafer', 'sandalet'],
  spor:    ['tayt', 'sort', 'tisort', 'hoodie', 'sneaker'],
  seyahat: ['pantolon', 'sneaker', 'loafer', 'bluz', 'tisort'],
  gunluk:  ['jean', 'tisort', 'bluz', 'sneaker', 'loafer'],
};

export async function generateCombosAI(
  items: WardrobeItem[],
  userProfile: UserProfileInput,
  weather?: { temp: number; description: string } | null,
  occasion: Occasion = 'all',
  page = 0,
  previousItemIds: string[] = [],
  styleProfile?: Record<string, number>,
): Promise<Combo[]> {
  if (!API_KEY) throw new Error('Anthropic API key eksik');
  if (!items.length) return [];

  // Mevsim ön filtresi
  const season   = getCurrentSeason();
  const filtered = items.filter((i) => i.seasons.length === 0 || i.seasons.includes(season));
  const pool     = filtered.length >= 3 ? filtered : items;

  // İsimsiz parçaları AI prompt'undan çıkar — AI doğru ID eşleştirmesi yapamaz
  const validPool = pool.filter((i) => i.itemName && i.itemName.trim() !== '');

  const occasionData = OCCASIONS.find((o) => o.id === occasion) ?? OCCASIONS[0];

  const outerPool    = validPool.filter(isOuter);
  const optionalPool = validPool.filter((i) => ['bag', 'accessory'].includes(i.category));
  const corePool     = validPool.filter((i) => !isOuter(i) && !['bag', 'accessory'].includes(i.category));

  // Okasyon önceliğine göre sırala — AI listedeki ilk parçalara daha fazla ağırlık verir
  const prioritySubs = OCCASION_PRIORITY[occasion] ?? [];
  corePool.sort((a, b) => {
    const aScore = prioritySubs.indexOf(a.subCategory ?? '');
    const bScore = prioritySubs.indexOf(b.subCategory ?? '');
    return (aScore === -1 ? 999 : aScore) - (bScore === -1 ? 999 : bScore);
  });

  const wardrobeText = corePool.map((item) =>
    `- ID:${item.id} | ${item.itemName} (${item.subCategory ?? item.category})` +
    ` | Renk: ${item.colors[0] ?? 'belirsiz'}` +
    ` | Kumaş: ${item.fabric ?? 'belirsiz'}` +
    ` | Desen: ${item.pattern ?? 'düz'}` +
    ` | Mevsim: ${item.seasons.length ? item.seasons.map(seasonDesc).join(', ') : 'tüm mevsimler'}`,
  ).join('\n');

  const outerText = outerPool.length
    ? `\nDIŞ GİYİM (hırka, ceket, blazer vb.):\n` +
      outerPool.map((item) => `- ID:${item.id} | ${item.itemName}`).join('\n')
    : '';

  const optionalText = optionalPool.length
    ? `\nOPSİYONEL TAMAMLAYICI PARÇALAR (aksesuar, çanta):\n` +
      optionalPool.map((item) => `- ID:${item.id} | ${item.itemName}`).join('\n')
    : '';

  const profileLines = [
    styleProfile
      ? `- Stil DNA: ${Object.entries(styleProfile).map(([k, v]) => `${k} %${v}`).join(', ')}`
      : (userProfile.styleProfile ? `- Stil DNA: ${userProfile.styleProfile}` : null),
    userProfile.height       ? `- Boy: ${userProfile.height}cm`          : null,
    userProfile.age          ? `- Yaş: ${userProfile.age}`               : null,
    userProfile.bodyType     ? `- Vücut tipi: ${userProfile.bodyType}`   : null,
    userProfile.skinTone     ? `- Ten rengi: ${userProfile.skinTone}`    : null,
    (userProfile.hairColor || userProfile.hairLength || userProfile.hairType)
      ? `- Saç: ${[userProfile.hairColor, userProfile.hairLength, userProfile.hairType].filter(Boolean).join(', ')}` : null,
  ].filter(Boolean).join('\n') || '- Profil bilgisi girilmemiş';

  const weatherText    = weather ? `${weather.temp}°C, ${weather.description}` : 'Bilinmiyor';
  const needsOuter     = weather ? weather.temp < 18 : false;
  const previousNote   = previousItemIds.length > 0
    ? `\nDAHA ÖNCE GÖSTERİLEN PARÇALAR: ${previousItemIds.join(', ')} — Bu parçaları içeren kombinler yerine farklı parçaları ön plana çıkar.`
    : '';

  const systemPrompt = `Sen uzman bir moda stilistisin. Renk teorisi, Kibbe vücut tipleri, seasonal color analysis ve stil sistemleri konusunda derin bilgin var. Kullanıcının fiziksel özelliklerine ve stil profiline göre kişiselleştirilmiş kombin önerileri yapıyorsun. Sadece JSON döndür, başka hiçbir şey yazma.`;

  const userPrompt =
`KULLANICI PROFİLİ:
${profileLines}

HAVA DURUMU: ${weatherText}

OKASYON: ${occasionData.label}
OKASYON TANIMI: ${occasionData.styleGuide}
${previousNote}

GARDROP PARÇALARI (${corePool.length} parça):
${wardrobeText}
${outerText}
${optionalText}

GÖREV:
Bu kişi için 5 adet kombin öner. Aşağıdaki KATMANLı yapıya kesinlikle uy:

KATMAN 1 — ZORUNLU (her kombinasyonda mutlaka olmalı):
• 1 ÜST GİYİM + 1 ALT GİYİM + 1 AYAKKABI
• VEYA: 1 ELBİSE/TULUM + 1 AYAKKABI
Not: Hiçbir kombinasyonda 2 üst veya 2 alt giyim olamaz.
Not: Dış giyim (hırka, ceket, blazer, mont) ÜST GİYİM sayılmaz — ayrı katmandır.

KATMAN 2 — HER KOMBİNDE OLMALI:
• 1 ÇANTA — dolaptaki çantalardan seç. Dolabında çanta yoksa reasoning'e "Dolabında çanta yok, eklemeyi düşün" yaz ve çanta ID'si verme.
• 1 AKSESUAR — kolye, küpe, kemer, fular vb. dolaptaki aksesuarlardan seç. Yoksa reasoning'e not ekle.

KATMAN 3 — DIŞ GİYİM:
${needsOuter ? '• Hava 18°C altında — her kombinlere dolaptaki dış giyimden 1 parça EKLE (hırka, ceket, blazer, mont).' : '• Hava uygun — dış giyim opsiyonel, ekleme zorunluluğu yok.'}

AYRICA:
- Okasyon tanımına kesinlikle uy
- Ten rengine ve vücut tipine uygun parçaları tercih et
- Stil DNA'ya uygun kombinasyonlar kur
- Renk uyumuna dikkat et

JSON formatı:
Tüm parçaları (üst, alt, ayakkabı, çanta, aksesuar, dış giyim) tek "items" array'ine koy. Ayrı field kullanma.
{
  "combos": [
    {
      "items": ["upper_id", "lower_id", "shoes_id", "bag_id", "accessory_id"],
      "score": 92,
      "occasion": "${occasionData.id}",
      "reasoning": "Kısa Türkçe gerekçe (1 cümle)"
    }
  ]
}`;

  console.log('=== KOMBIN PROMPT ===');
  console.log('SYSTEM:', systemPrompt);
  console.log('USER:', userPrompt);
  console.log('Core pool count:', corePool.length);
  console.log('Outer pool count:', outerPool.length);
  console.log('Optional pool count:', optionalPool.length);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':        API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':     'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API hatası: ${res.status}`);

  const json   = await res.json();
  const text: string = (json as any)?.content?.[0]?.text ?? '';
  if (!text) throw new Error('Claude boş yanıt döndürdü');

  const clean  = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const parsed = JSON.parse(clean) as {
    combos: Array<{ items: string[]; score: number; occasion: string; reasoning: string }>;
  };

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const now = new Date().toISOString();

  return parsed.combos
    .map((c) => {
      const comboItems = c.items
        .map((id) => itemMap.get(id))
        .filter((i): i is WardrobeItem => !!i);
      if (comboItems.length < 2) return null;
      return {
        id: uid(),
        items: comboItems,
        score: Math.max(0, Math.min(98, Math.round(c.score))),
        occasion,
        label: c.reasoning,
        createdAt: now,
      } as Combo;
    })
    .filter((c): c is Combo => c !== null)
    .slice(0, 5);
}

// ID listesinden Combo nesnesi oluşturur (Supabase cache'den geri yüklemek için)
export function buildComboFromIds(
  itemIds: string[],
  allItems: WardrobeItem[],
  score: number,
  occasion: Occasion = 'gunluk',
): Combo | null {
  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const comboItems = itemIds
    .map((id) => itemMap.get(id))
    .filter((i): i is WardrobeItem => !!i);
  if (comboItems.length < 2) return null;
  return {
    id: uid(),
    items: comboItems,
    score: Math.max(0, Math.min(98, Math.round(score))),
    occasion,
    label: comboLabel(score),
    createdAt: new Date().toISOString(),
  };
}

// ─── Mağaza uyum analizi ─────────────────────────────────────────────────────

export interface StoreAnalysis {
  totalChecked: number;    // dolaptaki toplam parça
  compatibleCount: number; // uyumlu parça sayısı (skor > 0.6)
  avgScore: number;        // ortalama uyum skoru (0-100)
  topCombos: Combo[];      // en iyi 3 kombin önerisi
  sameCategory: number;    // aynı kategoride mevcut parça sayısı
}

// Taranan mağaza ürününü dolaptaki parçalara karşı analiz eder
export function analyzeStoreItem(
  scannedItem: WardrobeItem,
  wardrobeItems: WardrobeItem[],
): StoreAnalysis {
  if (!wardrobeItems.length) {
    return { totalChecked: 0, compatibleCount: 0, avgScore: 0, topCombos: [], sameCategory: 0 };
  }

  // Her dolap parçasıyla ikili renk uyum skoru
  const pairScores = wardrobeItems.map((item) => itemColorScore(scannedItem, item));
  const compatibleCount = pairScores.filter((s) => s > 0.6).length;
  const avgScore = Math.round(
    (pairScores.reduce((a, b) => a + b, 0) / pairScores.length) * 100,
  );

  // Taranan ürünü dolaba ekleyerek kombin motoru çalıştır
  const allCombos = generateCombos([scannedItem, ...wardrobeItems], 50);
  const topCombos = allCombos
    .filter((c) => c.items.some((i) => i.id === scannedItem.id))
    .slice(0, 3);

  const sameCategory = wardrobeItems.filter((i) => i.category === scannedItem.category).length;

  return { totalChecked: wardrobeItems.length, compatibleCount, avgScore, topCombos, sameCategory };
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/comboEngine.ts

if (require.main === module) {
  const T = (
    id: string, label: string, category: string, subCategory: string,
    colors: string[], fabric: string,
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors, fabric: fabric as WardrobeItem['fabric'],
    pattern: 'duz', seasons: [], createdAt: '',
    itemName: label,
  });

  // ── Bölüm 1: minAccessories + tek-odak garantisi ─────────────────────────
  // Senaryo (a): statement-ağırlıklı — kırmızı küpe renk uyumlu
  const stmtWardrobe: WardrobeItem[] = [
    T('s1', 'kırmızı bluz',    'upper',     'bluz',     ['#E94560'], 'silk'),
    T('s2', 'siyah pantolon',  'lower',     'pantolon', ['#1A1A1A'], 'wool'),
    T('s3', 'siyah topuklu',   'shoes',     'topuklu',  ['#1A1A1A'], 'velvet'),
    T('s4', 'altın clutch',    'bag',       'clutch',   ['#D4A017'], 'satin'),
    T('s5', 'kırmızı küpe',    'accessory', 'kupe',     ['#E94560'], 'blend'),  // statement
    T('s6', 'altın kolye',     'accessory', 'kolye',    ['#D4A017'], 'blend'),  // statement
    T('s7', 'sade bileklik',   'accessory', 'bileklik', ['#1A1A1A'], 'blend'),  // staple
    T('s8', 'siyah blazer',    'outer',     'blazer',   ['#1A1A1A'], 'wool'),
    T('s9', 'bej hırka',       'upper',     'hirka',    ['#F5F5DC'], 'cotton'), // isOuter → dış giyim
  ];

  // Havuz doğrulaması
  const corePool  = stmtWardrobe.filter((i) => i.category === 'upper' && !isOuter(i));
  const outerPool = stmtWardrobe.filter(isOuter);
  console.log('\n── Havuz Doğrulama ──────────────────────────────────────────────────────');
  console.log(`Çekirdek üst: [${corePool.map((i) => i.subCategory).join(', ')}]  ← hırka OLMAMALI`);
  console.log(`Dış giyim:    [${outerPool.map((i) => i.subCategory).join(', ')}]  ← hırka+blazer OLMALI`);

  for (const occ of ['gece', 'date'] as Occasion[]) {
    const rule = OCCASION_RULES[occ as OccasionId];
    console.log(`\n══ (a) Statement | ${occ.toUpperCase()} — puan [${rule.pointTarget[0]}, ${rule.pointTarget[1]}], minAcc:${rule.minAccessories}, maxStmt:${rule.maxStatementAccessories} ══`);
    for (const combo of generateCombos(stmtWardrobe, 2, occ)) {
      const subs    = combo.items.map((i) => i.subCategory ?? i.category);
      const accSubs = combo.items.filter((i) => i.category === 'accessory').map((i) => i.subCategory);
      const points  = combo.items.reduce((s, i) => s + getVisualWeight(i), 0);
      console.log(`  Skor:${combo.score} | Puan:${points} | [${subs.join(', ')}]`);
      console.log(`    ≥ minAcc(${rule.minAccessories}): ${accSubs.length >= rule.minAccessories ? '✅ OK (' + accSubs.length + ')' : '❌ HATA (' + accSubs.length + ')'}`);
      console.log(`    Tek-odak:  ${subs.includes('kupe') && subs.includes('kolye') ? '❌ İHLAL' : '✅ OK'}`);
    }
  }

  // ── Bölüm 2: çeşitlilik testi — 3 üst × 3 alt × 3 ayakkabı, 5 kombin ──────
  const diverseWardrobe: WardrobeItem[] = [
    // 3 üst
    T('d1', 'siyah bluz',      'upper',     'bluz',     ['#1A1A1A'], 'silk'),
    T('d2', 'kırmızı bluz',    'upper',     'bluz',     ['#E94560'], 'satin'),
    T('d3', 'beyaz gomlek',    'upper',     'gomlek',   ['#FFFFFF'], 'cotton'),
    // 3 alt
    T('d4', 'siyah pantolon',  'lower',     'pantolon', ['#1A1A1A'], 'wool'),
    T('d5', 'kırmızı etek',    'lower',     'etek',     ['#E94560'], 'satin'),
    T('d6', 'siyah mini etek', 'lower',     'etek',     ['#1A1A1A'], 'velvet'),
    // 3 ayakkabı
    T('d7', 'siyah topuklu',   'shoes',     'topuklu',  ['#1A1A1A'], 'velvet'),
    T('d8', 'altın sandalet',  'shoes',     'sandalet', ['#D4A017'], 'satin'),
    T('d9', 'siyah bot',       'shoes',     'bot',      ['#1A1A1A'], 'blend'),
    // çanta + aksesuarlar + dış giyim
    T('d10', 'altın clutch',   'bag',       'clutch',   ['#D4A017'], 'satin'),
    T('d11', 'siyah omuz',     'bag',       'omuz_cantasi', ['#1A1A1A'], 'blend'),
    T('d12', 'kırmızı küpe',   'accessory', 'kupe',     ['#E94560'], 'blend'),  // statement
    T('d13', 'altın kolye',    'accessory', 'kolye',    ['#D4A017'], 'blend'),  // statement
    T('d14', 'sade bileklik',  'accessory', 'bileklik', ['#1A1A1A'], 'blend'),  // staple
    T('d15', 'siyah blazer',   'outer',     'blazer',   ['#1A1A1A'], 'wool'),
  ];

  const fiveCombos = generateCombos(diverseWardrobe, 5, 'gece');
  const gecRule    = OCCASION_RULES['gece'];

  console.log('\n══ ÇEŞİTLİLİK: 3×3×3 dolap, 5 kombin, GECE ══');
  console.log(`   Hedef puan [${gecRule.pointTarget[0]}, ${gecRule.pointTarget[1]}], minAcc:${gecRule.minAccessories}\n`);

  const sigs      = fiveCombos.map(baseSignature);
  const itemFreq  = new Map<string, number>();
  fiveCombos.forEach((combo) =>
    combo.items
      .filter((i) => ['upper', 'lower', 'shoes'].includes(i.category))
      .forEach((i) => itemFreq.set(i.id, (itemFreq.get(i.id) ?? 0) + 1)),
  );
  const maxFreq = itemFreq.size ? Math.max(...itemFreq.values()) : 0;

  fiveCombos.forEach((combo, idx) => {
    const subs   = combo.items.map((i) => i.subCategory ?? i.category);
    const points = combo.items.reduce((s, i) => s + getVisualWeight(i), 0);
    console.log(`  [${idx + 1}] Skor:${combo.score} | Puan:${points} | sig:${baseSignature(combo)}`);
    console.log(`      Parçalar: [${subs.join(', ')}]`);
  });

  console.log(`\n  Benzersiz çekirdekler: ${new Set(sigs).size}/${fiveCombos.length}  ${new Set(sigs).size === fiveCombos.length ? '✅ FARKLI' : '❌ ÇAKIŞMA'}`);
  console.log(`  Maks tekrar (üst/alt/ayakkabı): ${maxFreq}/${fiveCombos.length}  ${maxFreq < fiveCombos.length ? '✅ OK' : '❌ TEK PARÇA 5\'TE DE VAR'}`);

  // ── Bölüm 3: proportionScore doğrulama ────────────────────────────────────
  const P = (
    id: string, category: string, subCategory: string, fit?: string,
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors: ['#1A1A1A'], pattern: 'duz', seasons: [], createdAt: '',
    fit, itemName: `${subCategory}/${fit ?? 'normal'}`,
  });

  const propCases: Array<{ label: string; core: WardrobeItem[]; beklenen: string }> = [
    {
      label: 'oversized üst + slim jean + loafer',
      core: [P('p1','upper','bluz','oversized'), P('p2','lower','jean','slim'), P('p3','shoes','loafer')],
      beklenen: 'YÜKSEK ~0.97',
    },
    {
      label: 'oversized üst + oversized wide pantolon + loafer (çift-oversized)',
      core: [P('p4','upper','bluz','oversized'), P('p5','lower','pantolon','oversized'), P('p6','shoes','loafer')],
      beklenen: 'DÜŞÜK ~0.75',
    },
    {
      label: 'chunky sneaker + wide-leg pantolon + normal üst',
      core: [P('p7','upper','bluz'), P('p8','lower','pantolon','oversized'), P('p9','shoes','sneaker')],
      beklenen: 'YÜKSEK ~0.92',
    },
    {
      label: 'chunky sneaker + skinny pantolon + normal üst',
      core: [P('p10','upper','bluz'), P('p11','lower','pantolon','slim'), P('p12','shoes','sneaker')],
      beklenen: 'DÜŞÜK ~0.82',
    },
  ];

  console.log('\n── proportionScore Doğrulama ─────────────────────────────────────────────');
  for (const { label, core: c, beklenen } of propCases) {
    const sc = proportionScore(c);
    console.log(`  ${label}`);
    console.log(`    prop=${sc.toFixed(3)}  (beklenen: ${beklenen})`);
  }

  // ── Bölüm 4: Skor bant kontrolü (tüm çeşitlilik kombinlerinin 77-96 arası yayılımı)
  const scores = fiveCombos.map((c) => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const spread = maxScore - minScore;
  console.log('\n── Skor Bant Kontrolü ────────────────────────────────────────────────────');
  console.log(`  Skorlar: [${scores.join(', ')}]`);
  console.log(`  Min: ${minScore}  Max: ${maxScore}  Yayılım: ${spread}`);
  console.log(`  77-96 bandı: ${minScore >= 55 && maxScore <= 98 ? '✅ OK' : '⚠️  KONTROL ET'}`);
  console.log(`  Yayılım ≥5:  ${spread >= 5 ? '✅ OK' : '⚠️  Hepsi aynı skor — çeşitlilik yok'}`);
}

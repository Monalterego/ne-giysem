import type { WardrobeItem, Combo, Season, StyleProfile } from '../types';
import { OCCASIONS } from '../constants/occasions';
import type { OccasionId } from '../constants/occasions';
import { itemColorScore, outfitColorScore } from './colorTheory';
import { isNeutral } from './colorUtils';
import { isItemAllowed, getFormalityFit, OCCASION_RULES } from './occasionRules';
import { registerFit, registerCoherence } from './registerTheory';
import { getVisualWeight, isStatement, getFormality } from './itemTraits';
import { proportionScore } from './proportionTheory';
import { buildReasoning } from './reasoning';
import { seasonFit } from './seasonTheory';
import type { WeatherData } from './weatherService';
import { computeStyleVector } from './styleVector';

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

  // Çekirdek renk ortalamasını hesapla (core × aday): register-ağırlıklı seçimlerde ortak yardımcı
  const colorAvg = (aday: WardrobeItem) =>
    core.reduce((s, ci) => s + itemColorScore(ci, aday), 0) / core.length;

  // a) ÇANTA: argmax( colorMatch × registerFit )
  const bag = pools.bags
    .map((b) => ({ item: b, score: colorAvg(b) * registerFit(b, occasion) }))
    .sort((a, b) => b.score - a.score)[0]?.item;
  if (bag) outfitItems.push(bag);

  // b) DIŞ GİYİM: argmax( colorMatch × registerFit ), spor hariç
  let chosenOuter: WardrobeItem | undefined;
  if (occasion !== 'spor') {
    const outer = pools.outers
      .map((o) => ({ item: o, score: colorAvg(o) * registerFit(o, occasion) }))
      .sort((a, b) => b.score - a.score)[0]?.item;
    if (outer && (FORMAL_OUTER_OCCASIONS.has(occasion) || pts() < rule.pointTarget[0])) {
      outfitItems.push(outer);
      chosenOuter = outer;
    }
  }

  // c) AKSESUARLAR — register-ağırlıklı sıralama + registerFit < 0.4 ekleme yasağı
  // minAccessories karşılanana kadar pointTarget[0] tavanı devreye girmez;
  // pointTarget[1] (max) SADECE minAccessories sağlandıktan sonra kapatır.
  const ranked = pools.accessories
    .map((a) => ({ item: a, colorMatch: colorAvg(a), regF: registerFit(a, occasion) }))
    .filter((x) => x.colorMatch > 0.65 && x.regF >= 0.4)
    .sort((a, b) => (b.colorMatch * b.regF) - (a.colorMatch * a.regF))
    .map((x) => x.item);
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
  weather?: WeatherData,
  styleProfile?: StyleProfile,
): Combo[] {
  // Stil vektörü — Pass 2 yumuşak modülasyonu için; profil yoksa nötr (tüm eksenler 0)
  const sv = computeStyleVector(styleProfile);

  // Hard-filter: dress-code ihlalleri (terlik+davet, sneaker+davet vb.) elenir
  const allow = (item: WardrobeItem) =>
    occasion === 'all' || isItemAllowed(item, occasion as OccasionId);

  // Hırka/yelek dahil tüm dış giyim outers havuzuna — çekirdek üst sayılmaz
  const uppers      = items.filter((i) => i.category === 'upper' && !isOuter(i) && allow(i));
  const lowers      = items.filter((i) => i.category === 'lower' && allow(i));
  const shoes       = items.filter((i) => i.category === 'shoes' && allow(i));
  const dresses     = items.filter((i) => i.category === 'dress_jumpsuit' && allow(i));
  const bags        = items.filter((i) => i.category === 'bag'       && allow(i));
  const outers      = items.filter((i) => isOuter(i)                && allow(i));
  const accessories = items.filter((i) => i.category === 'accessory' && allow(i));

  // ─── 1. GEÇİŞ: ucuz proxy (colorHarmony + occFit), composeOutfit çağrısı yok ──────
  const ruleKey: OccasionId = occasion === 'all' ? 'gunluk' : occasion as OccasionId;
  type Candidate = { core: WardrobeItem[]; colorHarmony: number; occFit: number; prop: number; regFit: number; seasonProxy: number };
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
          const regFit =
            (registerFit(upper, ruleKey) +
             registerFit(lower, ruleKey) +
             registerFit(shoe, ruleKey)) / 3;
          const seasonProxy =
            (seasonFit(upper, weather) +
             seasonFit(lower, weather) +
             seasonFit(shoe,  weather)) / 3;
          candidates.push({ core: [upper, lower, shoe], colorHarmony, occFit, prop: proportionScore([upper, lower, shoe]), regFit, seasonProxy });
        }
      }
    }
  }

  if (dresses.length && shoes.length) {
    for (const dress of dresses) {
      for (const shoe of shoes) {
        const colorHarmony = itemColorScore(dress, shoe);
        const occFit       = (getFormalityFit(dress, ruleKey) + getFormalityFit(shoe, ruleKey)) / 2;
        const regFit       = (registerFit(dress, ruleKey) + registerFit(shoe, ruleKey)) / 2;
        const seasonProxy  = (seasonFit(dress, weather) + seasonFit(shoe, weather)) / 2;
        candidates.push({ core: [dress, shoe], colorHarmony, occFit, prop: proportionScore([dress, shoe]), regFit, seasonProxy });
      }
    }
  }

  // proxy skoruna göre sırala; seasonProxy çarpan değil toplamsal — kaba eleme için yeterli
  candidates.sort((a, b) =>
    (b.colorHarmony + b.occFit + b.prop + b.regFit + b.seasonProxy) -
    (a.colorHarmony + a.occFit + a.prop + a.regFit + a.seasonProxy),
  );
  const top = candidates.slice(0, CANDIDATE_CAP);

  // ─── 2. GEÇİŞ: composeOutfit çağır, final skor hesapla ──────────────────────
  const now = new Date().toISOString();
  const pools = { bags, outers, accessories };

  const encouraged = OCCASION_RULES[ruleKey].encouraged;

  const results = top
    .map(({ core, colorHarmony }) => {
      const { items: outfitItems, completeness, chosenOuter } = composeOutfit(core, pools, occasion);
      const prop = proportionScore(core, chosenOuter);
      // Çekirdek içinde okasyon tarafından teşvik edilen subCategory'lerin oranı
      const encCoverage = core.filter((i) => encouraged.includes(i.subCategory ?? '')).length / core.length;
      // Pass 1 proxy (ikili) + outfit dağılım skoru harmanlama
      const pairwiseColor = colorHarmony;
      const colorHarmonyFinal = 0.7 * pairwiseColor + 0.3 * outfitColorScore(outfitItems);
      // Formalite + register bağlam skoru ortalaması
      const contextFit = core.reduce(
        (s, item) => s + 0.5 * getFormalityFit(item, ruleKey) + 0.5 * registerFit(item, occasion),
        0,
      ) / core.length;
      // Register tutarlılık çarpanı (1.0 = tutarlı, 0.75 = sert çelişki)
      const coherence = registerCoherence([...core, ...(chosenOuter ? [chosenOuter] : [])]);
      // Mevsim uyum çarpanı: çanta/aksesuar hariç tüm giyim parçaları üzerinden ortalama
      const clothingItems = outfitItems.filter(
        (i) => !['bag', 'accessory'].includes(i.category),
      );
      const seasonScore = clothingItems.length
        ? clothingItems.reduce((s, i) => s + seasonFit(i, weather), 0) / clothingItems.length
        : 1.0;
      // Ağırlıklar toplamı = 1.0; coherence ve seasonScore dışsal çarpanlar
      const final01 = (0.35 * colorHarmonyFinal + 0.20 * contextFit + 0.20 * prop + 0.13 * completeness + 0.12 * encCoverage) * coherence * seasonScore;

      // Stil DNA yumuşak modülasyonu — ±%15 sert tavan; Layer 1 teorisini ezmez
      const outfitColorfulness = core.filter((i) => !isNeutral(i.colors[0] ?? '')).length / (core.length || 1);
      const avgFormality01     = core.reduce((s, i) => s + getFormality(i), 0) / ((core.length || 1) * 10);
      let styleAdj = 0;
      styleAdj += sv.colorBoldness      * (outfitColorfulness - 0.5) * 0.35; // renkli/cesur kombinleri yukarı
      styleAdj += sv.formalityShift     * (avgFormality01    - 0.5) * 0.35; // resmiyet eğilimi hizalaması
      styleAdj += sv.structureLooseness * (1 - prop)                * 0.35; // gevşek silüet toleransı
      const styleMult = Math.max(0.85, Math.min(1.15, 1 + styleAdj));
      const score = Math.round(final01 * styleMult * 100);
      const reasoning = buildReasoning({
        items: outfitItems, occasion,
        colorHarmony: colorHarmonyFinal, contextFit, prop, encCoverage,
      });
      return {
        id: uid(),
        items: outfitItems,
        score,
        occasion,
        label: comboLabel(score),
        reasoning,
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
  verdict: string;          // 'Dolabına çok uygun' | 'Zaten benzeri var' | 'Eksik parçaları tamamlıyor'
  reasons: string[];        // 2-3 deterministik Türkçe cümle
  combos: WardrobeItem[][]; // en iyi 3 kombinin items dizisi (taranan ürünü içeriyor)
  missing: string[];        // taranan ürünle daha iyi gidecek eksik kategori önerileri
  avgScore: number;         // 0-100
  compatibleCount: number;
  totalChecked: number;
  sameCategory: number;
}

// Eşleşme beklentisi yüksek kategori çiftleri
const PAIRING_CATS: Partial<Record<string, string[]>> = {
  upper:          ['lower', 'shoes'],
  lower:          ['upper', 'shoes'],
  dress_jumpsuit: ['shoes'],
  shoes:          ['upper', 'lower'],
  outer:          ['upper', 'lower'],
};

const CAT_LABEL_TR: Record<string, string> = {
  upper: 'üst', lower: 'alt', shoes: 'ayakkabı',
  outer: 'dış giyim', bag: 'çanta', accessory: 'aksesuar', dress_jumpsuit: 'elbise',
};

/**
 * Taranan mağaza ürününü lokal motor aracılığıyla dolaptaki parçalara karşı analiz eder.
 * Senkron, deterministik, sıfır network.
 */
export function analyzeStoreItem(
  scannedItem: WardrobeItem,
  wardrobeItems: WardrobeItem[],
  weather?: WeatherData,
  styleProfile?: StyleProfile,
): StoreAnalysis {
  if (!wardrobeItems.length) {
    return {
      verdict: 'Eksik parçaları tamamlıyor',
      reasons: ['Dolabında henüz parça yok. Kıyafetler ekleyince uyum analizi başlar.'],
      combos: [], missing: [], avgScore: 0, compatibleCount: 0, totalChecked: 0, sameCategory: 0,
    };
  }

  // a) Kombin motoru — taranan ürünü dolaba ekleyerek çalıştır
  const allCombos  = generateCombos([scannedItem, ...wardrobeItems], 50, 'all', weather, styleProfile);
  const topCombos  = allCombos.filter((c) => c.items.some((i) => i.id === scannedItem.id)).slice(0, 3);
  const combos     = topCombos.map((c) => c.items);

  // b) Uyum istatistikleri
  const pairScores     = wardrobeItems.map((item) => itemColorScore(scannedItem, item));
  const compatibleCount = pairScores.filter((s) => s > 0.6).length;
  const avgScore = topCombos.length
    ? Math.round(topCombos.reduce((s, c) => s + c.score, 0) / topCombos.length)
    : Math.round((pairScores.reduce((a, b) => a + b, 0) / pairScores.length) * 100);
  const sameCategory = wardrobeItems.filter((i) => i.category === scannedItem.category).length;

  // c) Verdict
  let verdict: string;
  if (sameCategory >= 3 && avgScore < 80)             verdict = 'Zaten benzeri var';
  else if (topCombos.length === 0 || compatibleCount < 3) verdict = 'Eksik parçaları tamamlıyor';
  else                                                  verdict = 'Dolabına çok uygun';

  // d) Gerekçeler
  const reasons: string[] = [];
  if (topCombos[0]?.reasoning) {
    reasons.push(`Dolapla uyumlu kombinler kuruluyor: ${topCombos[0].reasoning}`);
  }
  reasons.push(
    `${wardrobeItems.length} parçanın ${compatibleCount}'iyle uyumlu, ${topCombos.length} kombin kuruluyor.`,
  );
  if (verdict === 'Zaten benzeri var')             reasons.push('Dolabında benzer işleve sahip parçalar zaten var.');
  else if (verdict === 'Eksik parçaları tamamlıyor') reasons.push('Dolabındaki eksik kombinleri tamamlayabilir.');
  else                                              reasons.push('Dolabına değer katabilir.');

  // e) Eksik kategori önerileri — ince dolap kategorileri
  const missing: string[] = [];
  const pairingCats = PAIRING_CATS[scannedItem.category] ?? [];
  for (const cat of pairingCats) {
    if (wardrobeItems.filter((i) => i.category === cat).length < 2 && missing.length < 2) {
      missing.push(`uyumlu ${CAT_LABEL_TR[cat] ?? cat}`);
    }
  }

  return { verdict, reasons, combos, missing, avgScore, compatibleCount, totalChecked: wardrobeItems.length, sameCategory };
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

  // ── Bölüm 5: Register bağlam testi ────────────────────────────────────────
  // Her senaryoda iki ayrı dolap → en iyi kombinlerin skorlarını karşılaştır.
  const RR = (
    id: string, name: string, category: string, subCategory: string, colors: string[],
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors, pattern: 'duz', seasons: [], createdAt: '',
    itemName: name,
  });

  // Senaryo 1 — SPOR: atletik vs casual
  const sporAthWardrobe = [
    RR('sa1', 'Spor sütyeni',    'upper',  'tisort',  ['#1A1A1A']),
    RR('sa2', 'Antrenman taytı', 'lower',  'tayt',    ['#1A1A1A']),
    RR('sa3', 'Koşu sneaker',    'shoes',  'sneaker', ['#FFFFFF']),
  ];
  const sporCasWardrobe = [
    RR('sc1', 'Beyaz bluz',   'upper', 'bluz',   ['#FFFFFF']),
    RR('sc2', 'Skinny jean',  'lower', 'jean',   ['#5B7EC0']),
    RR('sc3', 'Süet loafer',  'shoes', 'loafer', ['#1A1A1A']),
  ];

  // Senaryo 2 — GÜNLÜK: spor sütyenli vs sade üstlü (jean+sneaker aynı)
  const gunlukSporWardrobe = [
    RR('gs1', 'Spor sütyeni',  'upper', 'tisort',  ['#1A1A1A']),
    RR('gs2', 'Jean pantolon', 'lower', 'jean',    ['#5B7EC0']),
    RR('gs3', 'Sneaker',       'shoes', 'sneaker', ['#FFFFFF']),
  ];
  const gunlukNorWardrobe = [
    RR('gn1', 'Temel bluz',    'upper', 'bluz',    ['#FFFFFF']),
    RR('gn2', 'Jean pantolon', 'lower', 'jean',    ['#5B7EC0']),
    RR('gn3', 'Sneaker',       'shoes', 'sneaker', ['#FFFFFF']),
  ];

  // Senaryo 3 — İŞ: business vs saten gece elbisesi
  const isBusinessWardrobe = [
    RR('ib1', 'Beyaz gomlek',   'upper', 'gomlek',    ['#FFFFFF']),
    RR('ib2', 'Siyah pantolon', 'lower', 'pantolon',  ['#1A1A1A']),
    RR('ib3', 'Siyah loafer',   'shoes', 'loafer',    ['#1A1A1A']),
  ];
  const isSatenWardrobe = [
    RR('ie1', 'Saten gece elbisesi', 'dress_jumpsuit', 'midi_elbise', ['#CC3344']),
    RR('ie2', 'Topuklu',             'shoes',          'topuklu',     ['#1A1A1A']),
  ];

  const sporA = generateCombos(sporAthWardrobe, 1, 'spor')[0]?.score   ?? 0;
  const sporC = generateCombos(sporCasWardrobe, 1, 'spor')[0]?.score   ?? 0;
  const gunS  = generateCombos(gunlukSporWardrobe, 1, 'gunluk')[0]?.score ?? 0;
  const gunN  = generateCombos(gunlukNorWardrobe,  1, 'gunluk')[0]?.score ?? 0;
  const isB   = generateCombos(isBusinessWardrobe, 1, 'is')[0]?.score  ?? 0;
  const isE   = generateCombos(isSatenWardrobe,    1, 'is')[0]?.score  ?? 0;

  console.log('\n── Register Bağlam Testi ─────────────────────────────────────────────────');
  console.log(`  spor:   atletik=${sporA}  casual=${sporC}  ${sporA > sporC ? '✅ atletik > casual' : '❌ beklenen: atletik > casual'}`);
  console.log(`  gunluk: normal=${gunN}  spor-üst=${gunS}   ${gunN > gunS  ? '✅ normal > spor-üst' : '❌ beklenen: normal > spor-üst'}`);
  console.log(`  is:     business=${isB}  saten-gece=${isE}  ${isB > isE   ? '✅ business > saten-gece' : '❌ beklenen: business > saten-gece'}`);

  // ── Bölüm 6: Register-farkındı çanta/aksesuar seçimi ──────────────────────
  const RA = (
    id: string, name: string, category: string, subCategory: string, colors: string[],
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors, pattern: 'duz', seasons: [], createdAt: '',
    itemName: name,
  });

  const regAccWardrobe: WardrobeItem[] = [
    // Çekirdek
    RA('ra1', 'Siyah mini elbise',  'dress_jumpsuit', 'mini_elbise', ['#1A1A1A']),
    RA('ra2', 'Siyah topuklu',      'shoes',          'topuklu',     ['#1A1A1A']),
    RA('ra3', 'Beyaz gomlek',        'upper',          'gomlek',      ['#FFFFFF']),
    RA('ra4', 'Siyah pantolon',      'lower',          'pantolon',    ['#1A1A1A']),
    RA('ra5', 'Siyah loafer',        'shoes',          'loafer',      ['#1A1A1A']),
    // Çantalar
    RA('ra6', 'Altın clutch',        'bag',        'clutch',          ['#D4A017']),
    RA('ra7', 'Hasır tote çanta',    'bag',        'tote',            ['#D4B030']),
    // Aksesuarlar
    RA('ra8', 'Beyzbol şapkası',     'accessory',  'sapka',           ['#1A1A1A']),
    RA('ra9', 'Altın kolye',         'accessory',  'kolye',           ['#D4A017']),
    RA('raA', 'Siyah kemer',         'accessory',  'kemer',           ['#1A1A1A']),
  ];

  console.log('\n── Register-Farkındı Seçim Testi ────────────────────────────────────────');
  for (const occ of ['is', 'gece', 'davet'] as Occasion[]) {
    const cs       = generateCombos(regAccWardrobe, 3, occ);
    const all      = cs.flatMap((c) => c.items);
    const hasSapka = all.some((i) => i.subCategory === 'sapka');
    const bagSubs  = [...new Set(all.filter((i) => i.category === 'bag').map((i) => i.subCategory ?? '-'))];
    console.log(`  ${occ.padEnd(6)}: şapka=${hasSapka ? '❌ VAR' : '✅ YOK'}  çantalar=[${bagSubs.join(', ')}]`);
  }

  // gece: clutch tercih kontrolü
  const geceCombos7 = generateCombos(regAccWardrobe, 5, 'gece');
  const geceBags7   = geceCombos7.flatMap((c) => c.items).filter((i) => i.category === 'bag');
  const clutchN = geceBags7.filter((i) => i.subCategory === 'clutch').length;
  const toteN   = geceBags7.filter((i) => i.subCategory === 'tote').length;
  console.log(`  gece çanta dağılımı: clutch=${clutchN}  tote=${toteN}  ${clutchN >= toteN ? '✅ clutch tercihli' : '⚠️  tote öne çıkıyor'}`);

  // ── Bölüm 7: Stil DNA modülasyonu — Old Money vs Streetwear ─────────────────
  // Senaryo: tailored set (blazer+pantolon+loafer, nötr, high-formality, fitted)
  //          ile street set (hoodie+jean+sneaker, nötr, low-formality, oversized)
  //          aynı dolapta. occasion='all' → formalite filtresi devrede değil.
  // Beklenti: OM → tailored üste; SW → street üste; ikisi farklı.

  const ST = (
    id: string, name: string, category: string, subCategory: string,
    colors: string[], fit?: string,
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors, pattern: 'duz', seasons: [], createdAt: '',
    itemName: name, fit,
  });

  // Nötr renkler — renk ekseni gürültüsünü sıfırlar, formality+structure eksenlerini izole eder
  const styleDolap7: WardrobeItem[] = [
    // TAILORED set: yüksek formality (blazer≈8, pantolon=6, loafer=6), fitted
    ST('s71', 'Klasik blazer',       'outer', 'blazer',   ['#1A1A1A'], 'fitted'),
    ST('s72', 'Tailored pantolon',   'lower', 'pantolon', ['#1A1A1A'], 'slim'),
    ST('s73', 'Siyah loafer',        'shoes', 'loafer',   ['#1A1A1A']),
    // STREET set: düşük formality (hoodie≈1, jean≈3, sneaker≈2), oversized/loose
    ST('s74', 'Oversized hoodie',    'upper', 'hoodie',   ['#FFFFFF'], 'oversized'),
    ST('s75', 'Baggy jean',          'lower', 'jean',     ['#FFFFFF'], 'oversized'),
    ST('s76', 'Beyaz sneaker',       'shoes', 'sneaker',  ['#FFFFFF']),
  ];

  // isOuter(blazer) = true → çekirdek üst ÜRETMİYOR; tailored set için dışarıdan gömlek ekle
  const blazerUpperProxy = ST('s77', 'Beyaz gomlek', 'upper', 'gomlek', ['#FFFFFF']);
  const fullDolap7 = [...styleDolap7, blazerUpperProxy];

  const omProfile7: StyleProfile = { styles: [{ name: 'Old Money',  weight: 1 }], colorPalette: [] };
  const swProfile7: StyleProfile = { styles: [{ name: 'Streetwear', weight: 1 }], colorPalette: [] };

  const omCombos7 = generateCombos(fullDolap7, 3, 'all', undefined, omProfile7);
  const swCombos7 = generateCombos(fullDolap7, 3, 'all', undefined, swProfile7);
  const noCombos7 = generateCombos(fullDolap7, 3, 'all');
  const noRef7    = generateCombos(fullDolap7, 3, 'all', undefined, undefined);

  const TAILORED7 = new Set(['blazer', 'pantolon', 'loafer', 'gomlek']);
  const STREET7   = new Set(['hoodie', 'jean', 'sneaker']);

  const omTop = omCombos7[0];
  const swTop = swCombos7[0];
  const noTop = noCombos7[0];

  // Çekirdek parçaların tailored/street skoru
  const coreItems = (c: Combo) => c.items.filter((i) => ['upper','lower','shoes'].includes(i.category));
  const tailoredScore7 = (c: Combo) => coreItems(c).filter((i) => TAILORED7.has(i.subCategory ?? '')).length;
  const streetScore7   = (c: Combo) => coreItems(c).filter((i) => STREET7.has(i.subCategory ?? '')).length;

  const omIsTailored = omTop ? tailoredScore7(omTop) >= 2 : false;
  const swIsStreet   = swTop ? streetScore7(swTop) >= 2 : false;
  const topsDiffer   = !!(omTop && swTop && baseSignature(omTop) !== baseSignature(swTop));
  const noRegress    = !!(noTop && noRef7[0] && baseSignature(noTop) === baseSignature(noRef7[0]));

  console.log('\n── Bölüm 7: Stil DNA Modülasyonu (Old Money vs Streetwear) ─────────────');

  for (const [label, combos] of [
    ['Old Money  ', omCombos7],
    ['Streetwear ', swCombos7],
    ['Profil=yok ', noCombos7],
  ] as Array<[string, Combo[]]>) {
    console.log(`\n  ${label}:`);
    for (const [idx, c] of combos.entries()) {
      const subs = coreItems(c).map((i) => i.subCategory ?? i.category);
      console.log(`    [${idx}] skor=${c.score}  çekirdek=[${subs.join(', ')}]`);
    }
  }

  console.log('\n  ── Assert ──────────────────────────────────────────────────────────────');
  console.log(`  OM top tailored parça ≥2 : ${omIsTailored ? '✅' : '❌'}  (tailored=${tailoredScore7(omTop!)}, street=${streetScore7(omTop!)})`);
  console.log(`  SW top street parça   ≥2 : ${swIsStreet   ? '✅' : '❌'}  (tailored=${tailoredScore7(swTop!)}, street=${streetScore7(swTop!)})`);
  console.log(`  İki TOP kombinin farklı   : ${topsDiffer   ? '✅' : '❌'}`);
  console.log(`  undefined profil regresyon: ${noRegress    ? '✅' : '❌'}`);

  // ±%15 tavan: profil skoru ile no-profil skoru arasındaki fark ≤ base*0.16
  console.log('  ±%15 tavan kontrolü:');
  for (let i = 0; i < noCombos7.length; i++) {
    const base = noCombos7[i]?.score ?? 0;
    const omS  = omCombos7[i]?.score ?? 0;
    const swS  = swCombos7[i]?.score ?? 0;
    const omOk = Math.abs(omS - base) <= Math.ceil(base * 0.16);
    const swOk = Math.abs(swS - base) <= Math.ceil(base * 0.16);
    console.log(`    [${i}] base=${base}  OM=${omS}${omOk ? '✅' : '❌'}  SW=${swS}${swOk ? '✅' : '❌'}`);
  }

  // ── Bölüm 8: analyzeStoreItem lokal motor entegrasyonu ─────────────────────
  const SA = (
    id: string, name: string, category: string, subCategory: string, colors: string[],
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors, pattern: 'duz', seasons: [], createdAt: '', itemName: name,
  });

  const scanned8 = SA('scan', 'Kırmızı bluz', 'upper', 'bluz', ['#E94560']);
  const wardrobe8: WardrobeItem[] = [
    SA('w1', 'Siyah pantolon',   'lower',  'pantolon',  ['#1A1A1A']),
    SA('w2', 'Siyah loafer',     'shoes',  'loafer',    ['#1A1A1A']),
    SA('w3', 'Altın clutch',     'bag',    'clutch',    ['#D4A017']),
    SA('w4', 'Beyaz bluz',       'upper',  'bluz',      ['#FFFFFF']),
    SA('w5', 'Krem bluz',        'upper',  'bluz',      ['#FFF5E0']),
    SA('w6', 'Lacivert bluz',    'upper',  'bluz',      ['#0F3460']),
  ];
  const weatherMock8: WeatherData = { temp: 20, description: 'ılık', icon: '⛅', recommendation: 'Hafif kıyafetler' };
  const swProfile8: StyleProfile  = { styles: [{ name: 'Streetwear', weight: 1 }], colorPalette: [] };

  const baseResult   = analyzeStoreItem(scanned8, wardrobe8);
  const weatherResult = analyzeStoreItem(scanned8, wardrobe8, weatherMock8);
  const styleResult  = analyzeStoreItem(scanned8, wardrobe8, weatherMock8, swProfile8);

  console.log('\n── Bölüm 8: analyzeStoreItem ─────────────────────────────────────────────');
  console.log(`  [BASE]    verdict="${baseResult.verdict}"  avgScore=${baseResult.avgScore}  combos=${baseResult.combos.length}`);
  console.log(`  [WEATHER] verdict="${weatherResult.verdict}"  avgScore=${weatherResult.avgScore}`);
  console.log(`  [STYLE]   verdict="${styleResult.verdict}"  avgScore=${styleResult.avgScore}`);
  console.log(`  Motor entegrasyonu: combos[0] taranan ürünü içeriyor=${baseResult.combos[0]?.some(i=>i.id==='scan') ? '✅' : '❌'}`);
  console.log(`  sameCategory=3 → "${baseResult.verdict}" ${baseResult.sameCategory >= 3 ? '(sameCategory>=3 aktif)' : ''}`);
  console.log(`  Reasons:`);
  for (const r of baseResult.reasons) console.log(`    • ${r}`);
  console.log(`  Missing: [${baseResult.missing.join(', ')}]`);
  const weatherChanges = weatherResult.avgScore !== baseResult.avgScore ||
    JSON.stringify(weatherResult.combos.map(g=>g.map(i=>i.id))) !== JSON.stringify(baseResult.combos.map(g=>g.map(i=>i.id)));
  const styleChanges  = styleResult.avgScore !== baseResult.avgScore;
  console.log(`  Weather etkisi: ${weatherChanges ? '✅ combos/skor değişti' : '⚠️  değişmedi (hava etkisi yok)'}`);
  console.log(`  Style etkisi:   ${styleChanges  ? '✅ skor değişti'         : '⚠️  değişmedi'}`);
}

import type { WardrobeItem, Combo, Season } from '../types';
import { OCCASIONS } from '../constants/occasions';
import type { OccasionId } from '../constants/occasions';

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

// ─── Renk yardımcıları ───────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

// Nötr renkler (siyah, beyaz, gri, bej, lacivert) her şeyle uyumlu
function isNeutral(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return true;
  const [h, s, l] = hsl;
  if (s < 15) return true;                              // düşük doygunluk → nötr
  if (l > 90) return true;                              // çok açık → kırık beyaz / krem
  if (h >= 200 && h <= 255 && s < 45 && l < 30) return true; // lacivert
  return false;
}

// Sıcak renkler: kırmızı, turuncu, sarı, pembe (hue 0-60 veya 300-360)
function isWarmColor(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  const [h, s, l] = hsl;
  if (s < 15 || l > 90) return false;
  return h <= 60 || h >= 300;
}

// Bir parçanın belirli bir occasion'a uyum katsayısı (-0.15 ile +0.15 arası)
function itemOccasionFit(item: WardrobeItem, occasion: Occasion): number {
  if (occasion === 'all' || occasion === 'gunluk' || occasion === 'brunch' || occasion === 'seyahat') return 0;
  const fabric  = item.fabric ?? 'unknown';
  const pattern = item.pattern ?? '';
  const allNeutral  = item.colors.length > 0 && item.colors.every(isNeutral);
  const hasWarm     = item.colors.some(isWarmColor);

  switch (occasion) {
    case 'is': {
      let fit = 0;
      if (allNeutral) fit += 0.08;
      if (['cotton', 'linen', 'silk', 'wool', 'blend'].includes(fabric)) fit += 0.06;
      if (fabric === 'denim') fit -= 0.12;
      if (fabric === 'polyester') fit -= 0.06;
      if (pattern === 'floral') fit -= 0.05;
      return fit;
    }
    case 'spor': {
      let fit = 0;
      if (fabric === 'polyester') fit += 0.15;
      if (fabric === 'cotton') fit += 0.03;
      return fit;
    }
    case 'date':
    case 'gece': {
      let fit = 0;
      if (hasWarm) fit += 0.08;
      if (['silk', 'satin', 'velvet'].includes(fabric)) fit += 0.10;
      if (pattern === 'floral') fit += 0.06;
      if (allNeutral && !hasWarm) fit -= 0.03;
      return fit;
    }
    case 'davet': {
      let fit = 0;
      if (['silk', 'satin', 'velvet'].includes(fabric)) fit += 0.12;
      if (hasWarm) fit += 0.05;
      if (pattern === 'floral') fit += 0.04;
      if (fabric === 'denim') fit -= 0.10;
      if (fabric === 'polyester') fit -= 0.08;
      return fit;
    }
    default:
      return 0;
  }
}

// İki hex renk arasındaki uyum skoru (0–1)
function pairScore(hex1: string, hex2: string): number {
  if (isNeutral(hex1) || isNeutral(hex2)) return 1.0;
  const hsl1 = hexToHsl(hex1);
  const hsl2 = hexToHsl(hex2);
  if (!hsl1 || !hsl2) return 0.85;
  const diff = Math.abs(hsl1[0] - hsl2[0]);
  const hueDiff = Math.min(diff, 360 - diff);
  if (hueDiff <= 30) return 0.9;                        // analog / monokromatik
  if (hueDiff >= 150 && hueDiff <= 210) return 0.85;   // komplementer
  if (hueDiff >= 110 && hueDiff <= 130) return 0.75;   // triadik
  return 0.35;                                          // uyumsuz
}

// İki parça arasındaki ortalama renk uyum skoru
function itemColorScore(a: WardrobeItem, b: WardrobeItem): number {
  if (!a.colors.length || !b.colors.length) return 0.82; // renk bilinmiyorsa makul varsayılan
  const scores = a.colors.flatMap((c1) => b.colors.map((c2) => pairScore(c1, c2)));
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

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

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────

function comboLabel(score: number): string {
  return score >= 80 ? 'Mükemmel Uyum' : score >= 65 ? 'İyi Kombin' : 'Kabul Edilebilir';
}

export function generateCombos(
  items: WardrobeItem[],
  maxCombos = 12,
  occasion: Occasion = 'all',
): Combo[] {
  const uppers      = items.filter((i) => i.category === 'upper');
  const lowers      = items.filter((i) => i.category === 'lower');
  const shoes       = items.filter((i) => i.category === 'shoes');
  const dresses     = items.filter((i) => i.category === 'dress_jumpsuit');
  const bags        = items.filter((i) => i.category === 'bag');
  const outers      = items.filter((i) => i.category === 'outer');
  const accessories = items.filter((i) => i.category === 'accessory');

  const results: Combo[] = [];
  const now = new Date().toISOString();

  // ─── Üst + Alt + Ayakkabı kombileri ────────────────────────────────────────
  if (uppers.length && lowers.length && shoes.length) {
    for (const upper of uppers) {
      for (const lower of lowers) {
        for (const shoe of shoes) {
          // Üst-Alt uyumu en ağır; Alt-Ayakkabı önemli; Üst-Ayakkabı daha az kritik
          const ulScore  = itemColorScore(upper, lower);
          const lsScore  = itemColorScore(lower, shoe);
          const usScore  = itemColorScore(upper, shoe);
          const colorRaw = ulScore * 0.45 + lsScore * 0.35 + usScore * 0.20;

          const occasionFit =
            (itemOccasionFit(upper, occasion) +
             itemOccasionFit(lower, occasion) +
             itemOccasionFit(shoe, occasion)) / 3;

          const raw   = Math.max(0, Math.min(1, colorRaw + occasionFit));
          const score = Math.round(raw * 100);

          const coreItems = [upper, lower, shoe];
          const suggestedItems = [
            ...bestMatches(coreItems, bags, 1),
            ...bestMatches(coreItems, outers, 1),
            ...bestMatches(coreItems, accessories, 2),
          ];

          results.push({
            id: uid(),
            items: coreItems,
            suggestedItems: suggestedItems.length ? suggestedItems : undefined,
            score,
            occasion,
            label: comboLabel(score),
            createdAt: now,
          });
        }
      }
    }
  }

  // ─── Elbise/Tulum + Ayakkabı kombileri ────────────────────────────────────
  if (dresses.length && shoes.length) {
    for (const dress of dresses) {
      for (const shoe of shoes) {
        const colorRaw = itemColorScore(dress, shoe);
        const occasionFit = (itemOccasionFit(dress, occasion) + itemOccasionFit(shoe, occasion)) / 2;
        const raw   = Math.max(0, Math.min(1, colorRaw + occasionFit));
        const score = Math.round(raw * 100);

        const coreItems = [dress, shoe];
        const suggestedItems = [
          ...bestMatches(coreItems, bags, 1),
          ...bestMatches(coreItems, outers, 1),
          ...bestMatches(coreItems, accessories, 2),
        ];

        results.push({
          id: uid(),
          items: coreItems,
          suggestedItems: suggestedItems.length ? suggestedItems : undefined,
          score,
          occasion,
          label: comboLabel(score),
          createdAt: now,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxCombos);
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

export async function generateCombosAI(
  items: WardrobeItem[],
  userProfile: UserProfileInput,
  weather?: { temp: number; description: string } | null,
  occasion: Occasion = 'all',
  page = 0,
  previousItemIds: string[] = [],
): Promise<Combo[]> {
  if (!API_KEY) throw new Error('Anthropic API key eksik');
  if (!items.length) return [];

  // Mevsim ön filtresi
  const season   = getCurrentSeason();
  const filtered = items.filter((i) => i.seasons.length === 0 || i.seasons.includes(season));
  const pool     = filtered.length >= 3 ? filtered : items;

  const occasionData = OCCASIONS.find((o) => o.id === occasion) ?? OCCASIONS[0];

  const corePool     = pool.filter((i) => !['bag', 'accessory'].includes(i.category));
  const optionalPool = pool.filter((i) => ['bag', 'accessory'].includes(i.category));

  const wardrobeText = corePool.map((item) =>
    `- ID:${item.id} | ${item.itemName ?? item.subCategory ?? item.category} (${item.subCategory ?? item.category})` +
    ` | Renk: ${item.colors[0] ?? 'belirsiz'}` +
    ` | Kumaş: ${item.fabric ?? 'belirsiz'}` +
    ` | Desen: ${item.pattern ?? 'düz'}` +
    ` | Mevsim: ${item.seasons.length ? item.seasons.map(seasonDesc).join(', ') : 'tüm mevsimler'}`,
  ).join('\n');

  const optionalText = optionalPool.length
    ? `\nOPSİYONEL TAMAMLAYICI PARÇALAR (aksesuar, çanta):\n` +
      optionalPool.map((item) => `- ID:${item.id} | ${item.itemName ?? item.subCategory ?? item.category}`).join('\n')
    : '';

  const profileLines = [
    userProfile.styleProfile ? `- Stil DNA: ${userProfile.styleProfile}` : null,
    userProfile.height       ? `- Boy: ${userProfile.height}cm`          : null,
    userProfile.age          ? `- Yaş: ${userProfile.age}`               : null,
    userProfile.bodyType     ? `- Vücut tipi: ${userProfile.bodyType}`   : null,
    userProfile.skinTone     ? `- Ten rengi: ${userProfile.skinTone}`    : null,
    (userProfile.hairColor || userProfile.hairLength || userProfile.hairType)
      ? `- Saç: ${[userProfile.hairColor, userProfile.hairLength, userProfile.hairType].filter(Boolean).join(', ')}` : null,
  ].filter(Boolean).join('\n') || '- Profil bilgisi girilmemiş';

  const weatherText    = weather ? `${weather.temp}°C, ${weather.description}` : 'Bilinmiyor';
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
${optionalText}

GÖREV:
Bu kişi için 5 adet kombin öner.

ZORUNLU KOMBİN YAPISI — İSTİSNASIZ:
- Dolaptaki parçalarda elbise/tulum varsa: 1 elbise/tulum + 1 ayakkabı (ASLA alt giyim ekleme)
- Dolaptaki parçalarda elbise/tulum yoksa: 1 üst + 1 alt + 1 ayakkabı
- HİÇBİR kombinasyonda 2 üst giyim veya 2 alt giyim olmamalı
- Aksesuar ve çanta opsiyoneldir: uygunsa 4. veya 5. parça olarak eklenebilir

AYRICA:
- Okasyon tanımına kesinlikle uy
- Ten rengine ve vücut tipine uygun parçaları tercih et
- Stil DNA'ya uygun kombinasyonlar kur
- Renk uyumuna dikkat et

JSON formatı:
{
  "combos": [
    {
      "items": ["item_id_1", "item_id_2", "item_id_3"],
      "score": 92,
      "occasion": "${occasionData.id}",
      "reasoning": "Kısa Türkçe gerekçe (1 cümle)"
    }
  ]
}`;

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
  occasion: Occasion = 'casual',
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

import type { WardrobeItem } from '../types';
import type { WeatherData } from './weatherService';

// ─── Tip ─────────────────────────────────────────────────────────────────────

type Season = 'winter' | 'spring' | 'fall' | 'summer';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

// Kışlık/ağır parçalar — 26°C üstünde ceza
const HEAVY_SUB = ['kaban', 'mont', 'kazak', 'triko', 'cizme', 'bot'];

// Yazlık/hafif parçalar — 8°C altında ceza
const LIGHT_SUB = ['sandalet', 'terlik', 'sort'];

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

/** İstanbul iklimine göre anlık sıcaklıktan aktif mevsim tahmini */
export function tempToSeason(temp: number): Season {
  if (temp < 12) return 'winter';
  if (temp > 19) return 'summer';
  return 'spring'; // 12-19 → ara mevsim; spring/fall aynı kova
}

/**
 * Parçanın seasons dizisini güvenli parse eder.
 * Supabase bazen JSON string olarak döndürebilir — her iki formata da toleranslı.
 */
function parseSeasons(item: WardrobeItem): string[] {
  const raw = item.seasons as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  return [];
}

/**
 * 0–1 mevsim uyum skoru.
 * weather yoksa 1.0 döner — ceza yok, davranış değişmez.
 */
export function seasonFit(item: WardrobeItem, weather?: WeatherData): number {
  if (!weather) return 1.0;

  const active  = tempToSeason(weather.temp);
  const seasons = parseSeasons(item);
  let fit = 1.0;

  // a) Kategorik uyumsuzluk: parça belirli mevsimlere sahip ama aktif mevsim içinde değil
  if (seasons.length && !seasons.includes(active)) fit -= 0.25;

  // b) Sıcaklık uçları — doğrudan subCategory / kumaş / isim sinyali
  const sub  = item.subCategory ?? '';
  const name = (item.itemName ?? '').toLowerCase();

  if (weather.temp > 26 && HEAVY_SUB.includes(sub)) fit -= 0.4;
  if (
    weather.temp < 8 &&
    (LIGHT_SUB.includes(sub) ||
      item.fabric === 'linen' ||
      /keten|askılı|askili/.test(name))
  ) {
    fit -= 0.4;
  }

  return Math.max(0, fit);
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/seasonTheory.ts

if (require.main === module) {
  const W = (
    id: string, label: string, category: string, subCategory: string,
    seasons: string[], fabric?: string,
  ): WardrobeItem => ({
    id, userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors: ['#1A1A1A'], pattern: 'duz', seasons: seasons as WardrobeItem['seasons'],
    createdAt: '', itemName: label, fabric: fabric as WardrobeItem['fabric'],
  });

  const kaban    = W('k1', 'Kışlık kaban',    'outer', 'kaban',    ['fall','winter']);
  const sandalet = W('s1', 'Yazlık sandalet',  'shoes', 'sandalet', ['spring','summer']);
  const jean     = W('j1', 'Jean pantolon',   'lower', 'jean',     []);
  const bot      = W('b1', 'Siyah bot',       'shoes', 'bot',      ['fall','winter']);
  const kazak    = W('z1', 'Yün kazak',       'upper', 'kazak',    ['fall','winter']);
  const keten    = W('t1', 'Keten bluz',      'upper', 'bluz',     ['spring','summer'], 'linen');
  const blazer   = W('r1', 'Ofis blazer',     'outer', 'blazer',   []);

  const winterW: WeatherData = { temp: 5,  description: 'soğuk',  icon: '❄️', recommendation: 'Kalın kıyafetler' };
  const summerW: WeatherData = { temp: 30, description: 'sıcak',  icon: '☀️', recommendation: 'İnce yazlık' };
  const mildW:   WeatherData = { temp: 16, description: 'ılıman', icon: '⛅', recommendation: 'Hafif ceket' };

  console.log('\n── seasonFit — bireysel parça testleri ──────────────────────────────────');
  const cases: Array<{ item: WardrobeItem; weather: WeatherData; expected: string }> = [
    { item: sandalet, weather: winterW, expected: 'DÜŞÜK ~0.35 (kategorik-0.25 + hafif-0.4 = -0.65 → max 0)' },
    { item: keten,    weather: winterW, expected: 'DÜŞÜK ~0.35 (kategorik-0.25 + keten-0.4 = -0.65 → max 0)' },
    { item: bot,      weather: winterW, expected: 'YÜKSEK 1.0 (winters içinde, ağır değil)' },
    { item: kazak,    weather: winterW, expected: 'YÜKSEK 1.0 (winters içinde, 26°C koşulu yok)' },
    { item: kaban,    weather: summerW, expected: 'DÜŞÜK 0.35 (kategorik-0.25 + ağır-0.4 = -0.65 → max 0)' },
    { item: jean,     weather: summerW, expected: 'YÜKSEK 1.0 (mevsim kısıtı yok, kışlık değil)' },
    { item: blazer,   weather: mildW,   expected: 'YÜKSEK 1.0 (mevsim kısıtı yok, ne kışlık ne yazlık)' },
    { item: keten,    weather: summerW, expected: 'YÜKSEK 0.75 (summer içinde, hafif ceza yok)' },
    { item: jean,     weather: undefined as unknown as WeatherData, expected: '1.0 (weather=undefined → nötr)' },
  ];

  const COL = 52;
  for (const { item, weather, expected } of cases) {
    const fit = seasonFit(item, weather ?? undefined);
    console.log(`  ${item.itemName!.padEnd(22)} | fit=${fit.toFixed(2)} | beklenen: ${expected}`);
  }

  // ── (a) Kış testi: sandalet düşük, bot yüksek ──────────────────────────────
  console.log('\n── (a) Kış (temp=5) ────────────────────────────────────────────────────');
  console.log(`  sandalet fit=${seasonFit(sandalet, winterW).toFixed(2)}  (beklenen: 0.00)`);
  console.log(`  keten    fit=${seasonFit(keten, winterW).toFixed(2)}  (beklenen: 0.00)`);
  console.log(`  bot      fit=${seasonFit(bot,    winterW).toFixed(2)}  (beklenen: 1.00)`);
  console.log(`  kazak    fit=${seasonFit(kazak,  winterW).toFixed(2)}  (beklenen: 1.00)`);

  // ── (b) Yaz testi: kaban düşük, jean yüksek ────────────────────────────────
  console.log('\n── (b) Yaz (temp=30) ───────────────────────────────────────────────────');
  console.log(`  kaban    fit=${seasonFit(kaban,  summerW).toFixed(2)}  (beklenen: 0.00)`);
  console.log(`  jean     fit=${seasonFit(jean,   summerW).toFixed(2)}  (beklenen: 1.00)`);
  console.log(`  keten    fit=${seasonFit(keten,  summerW).toFixed(2)}  (beklenen: 0.75)`);

  // ── (c) weather=undefined regresyon ────────────────────────────────────────
  console.log('\n── (c) weather=undefined regresyon ────────────────────────────────────');
  const allItems = [kaban, sandalet, jean, bot, kazak, keten, blazer];
  const allOne = allItems.every((i) => seasonFit(i, undefined) === 1.0);
  console.log(`  Tüm parçalar 1.0: ${allOne ? '✅ EVET' : '❌ HAYIR'}`);
}

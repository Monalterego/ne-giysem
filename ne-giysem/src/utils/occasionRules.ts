import type { WardrobeItem } from '../types';
import type { OccasionId } from '../constants/occasions';
import { getFormality } from './itemTraits';

// ─── Tip tanımı ───────────────────────────────────────────────────────────────

export interface OccasionRule {
  /** Hedef formalite aralığı [min, max] — dışındakiler yumuşak cezalanır */
  targetFormality: [number, number];
  /** Kombinin toplam formality puan hedefi [min, max] (gelecekte kombin skoru için) */
  pointTarget: [number, number];
  /** Kombinasyonda izin verilen maksimum statement aksesuar sayısı */
  maxStatementAccessories: number;
  /** Kombine eklenmesi garanti edilen minimum aksesuar sayısı */
  minAccessories: number;
  /** ASLA doğru olmayan subCategory'ler — dress-code veya fonksiyonel çelişki */
  hardExcluded: string[];
  /** İdeal subCategory'ler — gelecekte küçük skor bonusu için */
  encouraged: string[];
}

// ─── Okasyon kuralları tablosu ────────────────────────────────────────────────

export const OCCASION_RULES: Record<OccasionId, OccasionRule> = {
  spor: {
    targetFormality:        [0, 3],
    pointTarget:            [3, 4],
    maxStatementAccessories: 0,
    minAccessories:          0,
    hardExcluded:           ['topuklu', 'clutch', 'maxi_elbise', 'midi_elbise', 'mini_elbise', 'gomlek', 'blazer'],
    encouraged:             ['tayt', 'sort', 'tisort', 'hoodie', 'sweatshirt', 'sneaker'],
  },
  gunluk: {
    targetFormality:        [2, 6],
    pointTarget:            [4, 6],
    maxStatementAccessories: 1,
    minAccessories:          0,
    hardExcluded:           [],
    encouraged:             ['jean', 'tisort', 'bluz', 'sneaker', 'loafer'],
  },
  seyahat: {
    targetFormality:        [2, 6],
    pointTarget:            [4, 6],
    maxStatementAccessories: 1,
    minAccessories:          0,
    hardExcluded:           ['topuklu', 'maxi_elbise', 'clutch'],
    encouraged:             ['pantolon', 'sneaker', 'loafer', 'bluz', 'tisort', 'bot'],
  },
  tatil: {
    targetFormality:        [1, 5],
    pointTarget:            [4, 6],
    maxStatementAccessories: 2,
    minAccessories:          0,
    hardExcluded:           ['blazer', 'topuklu', 'bot', 'mont', 'kaban', 'sweatshirt', 'hoodie', 'tayt', 'cizme', 'trenchkot'],
    encouraged:             ['sort', 'sandalet', 'sapka', 'gomlek', 'bluz', 'mini_elbise', 'tote'],
  },
  brunch: {
    targetFormality:        [4, 7],
    pointTarget:            [5, 7],
    maxStatementAccessories: 1,
    minAccessories:          1,
    hardExcluded:           [],
    encouraged:             ['midi_elbise', 'etek', 'bluz', 'loafer', 'sandalet'],
  },
  is: {
    targetFormality:        [5, 9],
    pointTarget:            [5, 7],
    maxStatementAccessories: 1,
    minAccessories:          1,
    hardExcluded:           ['maxi_elbise', 'mini_elbise', 'sort', 'tayt', 'terlik', 'sapka', 'sweatshirt', 'hoodie'],
    encouraged:             ['blazer', 'gomlek', 'pantolon', 'topuklu', 'loafer'],
  },
  date: {
    targetFormality:        [5, 8],
    pointTarget:            [6, 8],
    maxStatementAccessories: 1,
    minAccessories:          1,
    hardExcluded:           ['sort', 'tayt', 'terlik', 'sweatshirt', 'hoodie', 'sapka'],
    encouraged:             ['midi_elbise', 'mini_elbise', 'topuklu', 'sandalet', 'etek', 'bluz'],
  },
  gece: {
    targetFormality:        [5, 9],
    pointTarget:            [6, 8],
    maxStatementAccessories: 1,
    minAccessories:          1,
    hardExcluded:           ['sort', 'tayt', 'terlik', 'sweatshirt', 'hoodie', 'sapka', 'sneaker'],
    encouraged:             ['mini_elbise', 'midi_elbise', 'topuklu', 'bot', 'clutch', 'etek'],
  },
  davet: {
    targetFormality:        [7, 10],
    pointTarget:            [7, 9],
    maxStatementAccessories: 2,
    minAccessories:          2,
    hardExcluded:           ['sneaker', 'hoodie', 'sweatshirt', 'tayt', 'sort', 'jean', 'terlik', 'sapka', 'bandana', 'gozluk', 'tisort'],
    encouraged:             ['maxi_elbise', 'midi_elbise', 'topuklu', 'clutch'],
  },
};

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

/**
 * Sadece dress-code / fonksiyonel çelişkileri filtreler (hardExcluded).
 * Geri kalan her şey getFormalityFit ile yumuşak cezalanır, elenmez.
 */
export function isItemAllowed(item: WardrobeItem, occasion: OccasionId): boolean {
  const sub = item.subCategory;
  if (!sub) return true;
  return !OCCASION_RULES[occasion].hardExcluded.includes(sub);
}

/**
 * 0–1 formalite uyum skoru.
 * Parça hedef aralık içindeyse 1.0; dışındaysa mesafeye göre lineer düşer (0.18/birim).
 * Çok uzak parçalar 0'a kadar inebilir.
 */
export function getFormalityFit(item: WardrobeItem, occasion: OccasionId): number {
  const f = getFormality(item);
  const [min, max] = OCCASION_RULES[occasion].targetFormality;
  if (f >= min && f <= max) return 1.0;
  const dist = f < min ? min - f : f - max;
  return Math.max(0, Math.min(1, 1 - dist * 0.18));
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx ts-node src/utils/occasionRules.ts

if (require.main === module) {
  const OCCASIONS_ORDER: OccasionId[] = [
    'spor', 'gunluk', 'seyahat', 'tatil', 'brunch', 'is', 'date', 'gece', 'davet',
  ];

  type TestItem = WardrobeItem & { label: string };

  const testItems: TestItem[] = [
    {
      label: 'sneaker',
      id: 't1', userId: 'u', originalImageUrl: '', processedImageUrl: '',
      category: 'shoes', subCategory: 'sneaker',
      colors: ['#FFFFFF'], pattern: 'duz', fabric: 'cotton', seasons: [], createdAt: '',
      // f=2: spor=T/1.00  gunluk=T/1.00  seyahat=T/1.00  brunch=T/0.64
      //      is=T/0.46    date=T/0.46    gece=T/0.46     davet=F/0.10
    },
    {
      label: 'terlik',
      id: 't2', userId: 'u', originalImageUrl: '', processedImageUrl: '',
      category: 'shoes', subCategory: 'terlik',
      colors: ['#FFFFFF'], pattern: 'duz', fabric: 'cotton', seasons: [], createdAt: '',
      // f=1: spor=T/1.00  gunluk=T/0.82  seyahat=T/0.82  brunch=T/0.46
      //      is=F/0.28    date=F/0.28    gece=F/0.28     davet=F/0.00
    },
    {
      label: 'blazer',
      id: 't3', userId: 'u', originalImageUrl: '', processedImageUrl: '',
      category: 'outer', subCategory: 'blazer',
      colors: ['#1A1A1A'], pattern: 'duz', fabric: 'wool', seasons: [], createdAt: '',
      // f=8.5: spor=T/0.01  gunluk=T/0.55  seyahat=T/0.55  brunch=T/0.73
      //        is=T/1.00    date=T/0.91    gece=T/1.00     davet=T/1.00
    },
    {
      label: 'mini_elbise/saten',
      id: 't4', userId: 'u', originalImageUrl: '', processedImageUrl: '',
      category: 'dress_jumpsuit', subCategory: 'mini_elbise',
      colors: ['#E94560'], pattern: 'duz', fabric: 'satin', seasons: [], createdAt: '',
      // f=6.5: spor=T/0.37  gunluk=T/0.91  seyahat=T/0.91  brunch=T/1.00
      //        is=T/1.00    date=T/1.00    gece=T/1.00     davet=T/0.91
    },
    {
      label: 'jean',
      id: 't5', userId: 'u', originalImageUrl: '', processedImageUrl: '',
      category: 'lower', subCategory: 'jean',
      colors: ['#5B7EC0'], pattern: 'duz', fabric: 'denim', seasons: [], createdAt: '',
      // f=2: spor=T/1.00  gunluk=T/1.00  seyahat=T/1.00  brunch=T/0.64
      //      is=T/0.46    date=T/0.46    gece=T/0.46     davet=F/0.10
    },
  ];

  // Başlık
  const COL = 9;
  const header = 'ITEM'.padEnd(22) + OCCASIONS_ORDER.map((o) => o.padEnd(COL)).join('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const item of testItems) {
    const cells = OCCASIONS_ORDER.map((occ) => {
      const allowed = isItemAllowed(item, occ);
      const fit     = getFormalityFit(item, occ);
      return `${allowed ? 'T' : 'F'}/${fit.toFixed(2)}`.padEnd(COL);
    });
    console.log(item.label.padEnd(22) + cells.join(''));
  }

  console.log('\nDoğrulama kontrolleri:');
  const sneaker = testItems[0];
  const terlik  = testItems[1];
  console.log(`sneaker + is   → allowed=${isItemAllowed(sneaker, 'is')}, fit=${getFormalityFit(sneaker, 'is').toFixed(2)}  (beklenen: TRUE, ~0.46)`);
  console.log(`topuklu + spor → hardExcluded=${OCCASION_RULES.spor.hardExcluded.includes('topuklu')} (beklenen: true)`);
  console.log(`terlik + davet → allowed=${isItemAllowed(terlik, 'davet')}  (beklenen: FALSE)`);
}

import type { WardrobeItem } from '../types';
import type { OccasionId } from '../constants/occasions';
import { getFormality, resolveSignals } from './itemTraits';

// ─── Tip tanımı ───────────────────────────────────────────────────────────────

export interface OccasionRule {
  /** Hedef formalite aralığı [min, max] — dışındakiler yumuşak cezalanır */
  targetFormality: [number, number];
  /** Kombinin görsel puan hedefi [min, max] — completeness skoru ve dış giyim kararında kullanılır */
  pointTarget: [number, number];
  /** Kombinasyonda izin verilen maksimum statement aksesuar sayısı */
  maxStatementAccessories: number;
  /** Kombinde toplam maksimum aksesuar sayısı (Rule of Three) */
  maxAccessories?: number;
  /** Kombine eklenmesi garanti edilen minimum aksesuar sayısı */
  minAccessories: number;
  /** ASLA doğru olmayan subCategory'ler — dress-code veya fonksiyonel çelişki */
  hardExcluded: string[];
  /** İdeal subCategory'ler — encCoverage skoru + aksesuar önceliği/filtre muafiyetinde aktif kullanılır */
  encouraged: string[];
  /** Bu okazyon için dolapta EN AZ BİRİ bulunması gereken ayakkabı alt kategorileri.
   *  Yoksa hiç kombin üretilmez — zorlama öneri yerine yapıcı boş durum gösterilir. */
  requiredShoes?: string[];
}

// ─── Okasyon kuralları tablosu ────────────────────────────────────────────────

export const OCCASION_RULES: Record<OccasionId, OccasionRule> = {
  spor: {
    targetFormality:        [0, 3],
    pointTarget:            [3, 4],
    maxStatementAccessories: 0,
    maxAccessories:          0,
    minAccessories:          0,
    hardExcluded:           ['topuklu', 'clutch', 'maxi_elbise', 'midi_elbise', 'mini_elbise', 'gomlek', 'blazer', 'stiletto', 'dolgu_topuk', 'platform', 'takunya', 'abiye_canta', 'baget', 'el_cantasi', 'bustiyer', 'gomlek_elbise', 'triko_elbise', 'salopet', 'deri_pantolon', 'deri_ceket', 'panco', 'bros', 'jean', 'etek', 'pantolon', 'bluz', 'kazak', 'triko', 'hirka', 'tunik', 'polo', 'sandalet', 'babet', 'loafer', 'oxford', 'bot', 'cizme', 'bilek_bot', 'espadril', 'terlik', 'omuz_cantasi', 'tote', 'hasir_canta', 'kolye', 'kupe', 'fular', 'kaskol'],
    encouraged:             ['tayt', 'sort', 'tisort', 'hoodie', 'sweatshirt', 'sneaker', 'atlet', 'jogger', 'spor_cantasi'],
    requiredShoes:          ['sneaker'],
  },
  gunluk: {
    targetFormality:        [2, 6],
    pointTarget:            [4, 6],
    maxStatementAccessories: 1,
    maxAccessories:          2,
    minAccessories:          0,
    hardExcluded:           [],
    encouraged:             ['jean', 'tisort', 'bluz', 'sneaker', 'loafer'],
  },
  seyahat: {
    targetFormality:        [2, 6],
    pointTarget:            [4, 6],
    maxStatementAccessories: 1,
    maxAccessories:          2,
    minAccessories:          0,
    hardExcluded:           ['topuklu', 'maxi_elbise', 'clutch', 'stiletto', 'platform', 'abiye_canta', 'bustiyer'],
    encouraged:             ['pantolon', 'sneaker', 'loafer', 'bluz', 'tisort', 'bot', 'capraz_canta', 'sirt_cantasi'],
  },
  tatil: {
    targetFormality:        [1, 5],
    pointTarget:            [4, 6],
    maxStatementAccessories: 2,
    maxAccessories:          3,
    minAccessories:          0,
    hardExcluded:           ['blazer', 'topuklu', 'bot', 'mont', 'kaban', 'sweatshirt', 'hoodie', 'tayt', 'cizme', 'trenchkot', 'bilek_bot', 'puffer', 'parka', 'deri_ceket', 'stiletto', 'oxford', 'bere', 'eldiven', 'atki', 'jogger'],
    encouraged:             ['sort', 'sandalet', 'sapka', 'gomlek', 'bluz', 'mini_elbise', 'tote', 'espadril', 'hasir_canta', 'kapri', 'sort_tulum'],
  },
  brunch: {
    targetFormality:        [4, 7],
    pointTarget:            [5, 7],
    maxStatementAccessories: 1,
    maxAccessories:          2,
    minAccessories:          1,
    hardExcluded:           [],
    encouraged:             ['midi_elbise', 'etek', 'bluz', 'loafer', 'sandalet', 'gomlek_elbise', 'capraz_canta'],
  },
  is: {
    targetFormality:        [5, 9],
    pointTarget:            [5, 7],
    maxStatementAccessories: 1,
    maxAccessories:          2,
    minAccessories:          1,
    hardExcluded:           ['maxi_elbise', 'mini_elbise', 'sort', 'tayt', 'terlik', 'sapka', 'sweatshirt', 'hoodie', 'crop_top', 'atlet', 'bustiyer', 'jogger', 'kargo', 'spor_cantasi', 'sort_tulum', 'salopet', 'bere', 'platform', 'espadril'],
    encouraged:             ['blazer', 'gomlek', 'pantolon', 'topuklu', 'loafer', 'oxford', 'el_cantasi', 'gomlek_elbise', 'saat'],
    requiredShoes:          ['loafer', 'oxford', 'babet', 'topuklu', 'sneaker'],
  },
  date: {
    targetFormality:        [5, 8],
    pointTarget:            [6, 8],
    maxStatementAccessories: 1,
    maxAccessories:          3,
    minAccessories:          1,
    hardExcluded:           ['sort', 'tayt', 'terlik', 'sweatshirt', 'hoodie', 'sapka', 'jogger', 'kargo', 'spor_cantasi', 'bere'],
    encouraged:             ['midi_elbise', 'mini_elbise', 'topuklu', 'sandalet', 'etek', 'bluz', 'stiletto', 'capraz_canta'],
  },
  gece: {
    targetFormality:        [5, 9],
    pointTarget:            [6, 8],
    maxStatementAccessories: 1,
    maxAccessories:          3,
    minAccessories:          1,
    hardExcluded:           ['sort', 'tayt', 'terlik', 'sweatshirt', 'hoodie', 'sapka', 'sneaker', 'jogger', 'kargo', 'spor_cantasi', 'espadril', 'hasir_canta', 'bere', 'polo'],
    encouraged:             ['mini_elbise', 'midi_elbise', 'topuklu', 'bot', 'clutch', 'etek', 'stiletto', 'abiye_canta', 'baget'],
    requiredShoes:          ['topuklu', 'stiletto', 'dolgu_topuk', 'babet'],
  },
  davet: {
    targetFormality:        [7, 10],
    pointTarget:            [7, 9],
    maxStatementAccessories: 2,
    maxAccessories:          3,
    minAccessories:          2,
    hardExcluded:           ['sneaker', 'hoodie', 'sweatshirt', 'tayt', 'sort', 'jean', 'terlik', 'sapka', 'bandana', 'gozluk', 'tisort', 'crop_top', 'atlet', 'bustiyer', 'jogger', 'kargo', 'polo', 'spor_cantasi', 'hasir_canta', 'espadril', 'sirt_cantasi', 'bere', 'atki', 'jean_ceket', 'puffer', 'parka', 'bomber', 'salopet', 'sort_tulum'],
    encouraged:             ['maxi_elbise', 'midi_elbise', 'topuklu', 'clutch', 'abiye_canta', 'stiletto', 'bros'],
    requiredShoes:          ['topuklu', 'stiletto', 'dolgu_topuk', 'babet'],
  },
};

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

// Gece/akşam kanonik sinyalleri (formalite yakalayamıyor — dilden bağımsız)
const OCC_EVENING_SIGNALS  = ['sequin', 'satin', 'draped', 'shiny', 'metallic_thread', 'beaded', 'velvet'];
// Bu okazyonlar "gündüz/rahat" — gece parçaları buralara girmemeli
const DAYTIME_OCCASIONS: OccasionId[] = ['tatil', 'spor', 'gunluk', 'seyahat', 'brunch'];
// Gece karakterli ayakkabı sinyalleri (ofise uymaz)
const SHOE_EVENING_SIGNALS = ['patent', 'stiletto', 'satin', 'sequin', 'metallic_thread', 'beaded', 'shiny'];
// Spor/atletik sinyali — bu sinyali taşıyan parçalar SADECE 'spor' okazyonuna aittir.
// Ayakkabılar muaf: sneaker/loafer smart-casual'da (İş dahil) meşru.
const ATHLETIC_SIGNAL = 'athletic';

/**
 * Sadece dress-code / fonksiyonel çelişkileri filtreler (hardExcluded).
 * Geri kalan her şey getFormalityFit ile yumuşak cezalanır, elenmez.
 */
export function isItemAllowed(item: WardrobeItem, occasion: OccasionId): boolean {
  const sub = item.subCategory;
  if (!sub) return true;
  if (OCCASION_RULES[occasion].hardExcluded.includes(sub)) return false;
  const sg = resolveSignals(item);
  // Gündüz okazyonlarında, gece-sinyali taşıyan elbiseleri ele
  if (DAYTIME_OCCASIONS.includes(occasion) && item.category === 'dress_jumpsuit') {
    if (OCC_EVENING_SIGNALS.some((k) => sg.includes(k))) return false;
  }
  // İş: gece karakterli ayakkabıları ele (rugan/stiletto formalitesi yüksek olduğu için
  // formalite filtresine takılmıyor — kanonik sinyal gerekli, payetli elbise çözümünün aynısı)
  if (occasion === 'is' && item.category === 'shoes') {
    if (SHOE_EVENING_SIGNALS.some((k) => sg.includes(k))) return false;
  }
  // Spor parçaları (tayt, spor sütyeni, spor çantası vb.) SADECE 'spor' okazyonunda.
  // Ayakkabılar muaf: sneaker smart-casual'da meşru (İş/günlük).
  if (occasion !== 'spor' && item.category !== 'shoes' && sg.includes(ATHLETIC_SIGNAL)) {
    return false;
  }
  return true;
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

/** Dolapta bu okazyon için gerekli ayakkabı var mı? */
export function hasRequiredShoes(
  items: { category: string; subCategory?: string }[],
  occasion: OccasionId,
): boolean {
  const req = OCCASION_RULES[occasion]?.requiredShoes;
  if (!req || !req.length) return true;
  return items.some((i) => i.category === 'shoes' && i.subCategory && req.includes(i.subCategory));
}

/** Eksik ayakkabı türlerinin etiketleri (kullanıcıya "şunu ekle" demek için). */
export function requiredShoeLabels(occasion: OccasionId): string[] {
  return OCCASION_RULES[occasion]?.requiredShoes ?? [];
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

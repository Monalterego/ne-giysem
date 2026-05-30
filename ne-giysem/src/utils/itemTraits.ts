import type { WardrobeItem } from '../types';
import { isNeutral, isSaturated } from './colorUtils';

// ─── Formalite tablosu ────────────────────────────────────────────────────────

const FORMALITY: Record<string, Record<string, number>> = {
  upper: {
    tisort: 2, bluz: 6, gomlek: 7, kazak: 5, triko: 5,
    hirka: 4, yelek: 5, sweatshirt: 1, hoodie: 1, body: 5,
  },
  lower: {
    pantolon: 6, jean: 3, etek: 6, sort: 2, tayt: 1,
  },
  dress_jumpsuit: {
    mini_elbise: 5, midi_elbise: 7, maxi_elbise: 8, tulum: 6,
  },
  outer: {
    ceket: 6, blazer: 8, mont: 4, kaban: 6, trenchkot: 7, yagmurluk: 3,
  },
  shoes: {
    sneaker: 2, loafer: 6, bot: 5, cizme: 6, topuklu: 8,
    sandalet: 5, terlik: 1, babet: 5,
  },
  bag: {
    omuz_cantasi: 5, clutch: 8, tote: 4, bel_cantasi: 3,
    sirt_cantasi: 2, mini_canta: 6,
  },
  accessory: {
    kolye: 5, kupe: 5, bileklik: 5, yuzuk: 5, fular: 5,
    kaskol: 4, bandana: 3, kemer: 5, sapka: 4, gozluk: 5,
  },
};

const CATEGORY_DEFAULT: Record<string, number> = {
  upper: 4, lower: 4, dress_jumpsuit: 6,
  outer: 6, shoes: 4, bag: 4, accessory: 5,
};

const FABRIC_MOD: Record<string, number> = {
  silk: 1.5, satin: 1.5, velvet: 1.5,
  wool: 0.5, linen: 0.5,
  denim: -1, polyester: -0.5,
};

const PATTERN_MOD: Record<string, number> = {
  cicekli: -0.5, cizgili: -0.3, geometrik: -0.3,
};

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

/** 0-10 arasında formalite skoru döndürür. Yüksek = daha resmi. */
export function getFormality(item: WardrobeItem): number {
  const categoryTable = FORMALITY[item.category];
  const base = categoryTable?.[item.subCategory ?? ''] ?? CATEGORY_DEFAULT[item.category] ?? 5;
  const fabricMod  = FABRIC_MOD[item.fabric ?? '']  ?? 0;
  const patternMod = PATTERN_MOD[item.pattern ?? ''] ?? 0;
  return Math.max(0, Math.min(10, base + fabricMod + patternMod));
}

/**
 * Görsel ağırlık: 2 (statement) veya 1 (staple).
 * Aşağıdakilerden en az biri doğruysa statement:
 *  - Desenli parça (düz değil)
 *  - Dominant renk nötr DEĞİL ve doygun (saturation > 50)
 *  - İki veya daha fazla öne çıkan detay
 */
export function getVisualWeight(item: WardrobeItem): 1 | 2 {
  if (item.pattern && item.pattern !== 'duz') return 2;

  const dominant = item.colors[0];
  if (dominant && !isNeutral(dominant) && isSaturated(dominant)) return 2;

  if (item.details && item.details.length >= 2) return 2;

  return 1;
}

/** Görsel olarak öne çıkan (statement) parça mı? */
export function isStatement(item: WardrobeItem): boolean {
  return getVisualWeight(item) === 2;
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx ts-node src/utils/itemTraits.ts

if (require.main === module) {
  const examples: WardrobeItem[] = [
    {
      id: '1', userId: 'u1', originalImageUrl: '', processedImageUrl: '',
      category: 'upper', subCategory: 'bluz',
      colors: ['#E94560'], pattern: 'cicekli', fabric: 'silk',
      seasons: [], createdAt: '',
      // Beklenen: formality=7.0, weight=2, statement=true
      // Neden: base=6 + silk+1.5 + cicekli-0.5 = 7.0; cicekli→statement
    },
    {
      id: '2', userId: 'u1', originalImageUrl: '', processedImageUrl: '',
      category: 'shoes', subCategory: 'topuklu',
      colors: ['#1A1A1A'], pattern: 'duz', fabric: 'velvet',
      seasons: [], createdAt: '',
      // Beklenen: formality=9.5, weight=1, statement=false
      // Neden: base=8 + velvet+1.5 = 9.5; #1A1A1A nötr (düşük sat), duz desen, detay yok
    },
    {
      id: '3', userId: 'u1', originalImageUrl: '', processedImageUrl: '',
      category: 'lower', subCategory: 'jean',
      colors: ['#5B7EC0'], pattern: 'duz', fabric: 'denim',
      seasons: [], createdAt: '',
      // Beklenen: formality=2.0, weight=1, statement=false
      // Neden: base=3 + denim-1 = 2.0; #5B7EC0 s≈34 < 50 → doygun değil
    },
    {
      id: '4', userId: 'u1', originalImageUrl: '', processedImageUrl: '',
      category: 'outer', subCategory: 'blazer',
      colors: ['#FFFFFF'], pattern: 'cizgili', fabric: 'wool',
      seasons: [], details: ['dugmeli', 'kapsonlu'], createdAt: '',
      // Beklenen: formality=8.2, weight=2, statement=true
      // Neden: base=8 + wool+0.5 + cizgili-0.3 = 8.2; cizgili→statement
    },
    {
      id: '5', userId: 'u1', originalImageUrl: '', processedImageUrl: '',
      category: 'bag', subCategory: 'clutch',
      colors: ['#D4A017'], pattern: 'duz', fabric: 'satin',
      seasons: [], createdAt: '',
      // Beklenen: formality=9.5, weight=2, statement=true
      // Neden: base=8 + satin+1.5 = 9.5; #D4A017 altın sarısı → sat≈80 > 50 → statement
    },
  ];

  for (const item of examples) {
    const formality = getFormality(item);
    const weight    = getVisualWeight(item);
    const stmt      = isStatement(item);
    console.log(
      `[${item.subCategory ?? item.category}]` +
      `  formality=${formality.toFixed(1)}` +
      `  weight=${weight}` +
      `  statement=${stmt}`,
    );
  }
}

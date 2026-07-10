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
  // Zarif/resmi kumaşlar (+)
  silk:         1.5,  satin:       1.5,  velvet:      1.5,
  cashmere:     1.5,  chiffon:     1.0,  leather:     1.0,
  wool:         0.5,  linen:       0.5,  'faux-leather': 0.5,
  // Nötr
  knit:         0,    viscose:     0,    blend:       0,
  // Rahat/gündelik (-)
  denim:       -1,    polyester:  -0.5,
};

const PATTERN_MOD: Record<string, number> = {
  cicekli: -0.5, cizgili: -0.3, geometrik: -0.3,
};

// Türkçe fabric değeri → kanonik İngilizce (motor için köprü)
const TURKISH_TO_CANONICAL: Record<string, string> = {
  pamuk:    'cotton',      keten:    'linen',       ipek:     'silk',
  yun:      'wool',        kasmir:   'cashmere',    saten:    'satin',
  kadife:   'velvet',      deri:     'leather',     suni_deri: 'faux-leather',
  triko:    'knit',        sifon:    'chiffon',     viskon:   'viscose',
  denim:    'denim',       polyester: 'polyester',  karisim:  'blend',
  bilmiyorum: '',          unknown:  '',
};

// Eski kayıtlarda `signals` yok. Backfill tamamlanana kadar Türkçe metinden türet.
// Backfill sonrası bu fallback ölü kod olur; İngilizce isimlerde zaten eşleşmez.
const LEGACY_SIGNAL_RULES: Array<[string, string[]]> = [
  ['sequin',          ['payet', 'pullu']],
  ['satin',           ['saten']],
  ['velvet',          ['kadife']],
  ['draped',          ['drape']],
  ['metallic_thread', ['simli']],
  ['shiny',           ['parlak']],
  ['beaded',          ['taşlı', 'tasli']],
  ['evening_wear',    ['abiye', 'gece elbise']],
  ['structured',      ['straforlu']],
  ['patent',          ['rugan']],
  ['stiletto',        ['stiletto']],
  ['athletic',        ['spor', 'koşu', 'kosu', 'antrenman', 'performans', 'yoga',
                       'atletik', 'eşofman', 'esofman', 'bisikletçi', 'bisikletci', 'sweat']],
  ['tailored',        ['klasik', 'blazer', 'takım', 'takim', 'ofis', 'tailor']],
  ['strapless',       ['straplez']],
  ['one_shoulder',    ['tek omuz', 'tek_omuz']],
];

const LEGACY_NAME_FABRIC: Array<[string, string]> = [
  ['saten','satin'], ['kadife','velvet'], ['ipek','silk'], ['yün','wool'], ['yun','wool'],
  ['keten','linen'], ['kaşmir','cashmere'], ['kasmir','cashmere'], ['deri','leather'],
  ['şifon','chiffon'], ['sifon','chiffon'], ['viskon','viscose'], ['triko','knit'],
  ['karışım','blend'], ['karisim','blend'], ['pamuk','cotton'], ['denim','denim'],
  ['kot','denim'], ['polyester','polyester'],
];

// resolveSignals'tan ÖNCE tanımlı — resolveSignals kumaş güvenlik ağı için bunu çağırır.
function resolveFabric(item: WardrobeItem): string {
  const f = item.fabric ?? '';
  if (f && f !== 'unknown' && f !== 'bilmiyorum') {
    // Türkçe fabric değerini kanonik İngilizceye çevir; bilinmeyense olduğu gibi dön
    return TURKISH_TO_CANONICAL[f] ?? f;
  }
  // LEGACY: backfill öncesi kayıtlarda (signals boş) kumaşı İSİMDEN kurtar.
  // Backfill sonrası bu dal hiç çalışmaz; İngilizce isimlerde zaten eşleşmez.
  // Kumaş details'ten türetilmez — "Hasır tote"un detayındaki 'deri sap' yanıltır.
  if (!item.signals || item.signals.length === 0) {
    const name = (item.itemName ?? '').toLowerCase();
    for (const [kw, mapped] of LEGACY_NAME_FABRIC) {
      if (name.includes(kw)) return mapped;
    }
  }
  return '';
}

/**
 * Kanonik sinyaller. Üç kaynağın birleşimi:
 *  1. Vision'ın ürettiği `signals` (dilden bağımsız, birincil)
 *  2. Yapısal alanlardan türetilen güvenlik ağı (fabric — dilden bağımsız)
 *  3. LEGACY: vision hiç sinyal vermediyse Türkçe metinden türetme (backfill öncesi kayıtlar)
 */
export function resolveSignals(item: WardrobeItem): string[] {
  const out = new Set<string>(item.signals ?? []);

  // Güvenlik ağı: kumaş alanı zaten kanonik (satin/velvet) — dil fark etmez.
  // Vision `signals`'ı atlasa bile gece kumaşı yakalanır.
  const fab = resolveFabric(item);
  if (fab === 'satin')  out.add('satin');
  if (fab === 'velvet') out.add('velvet');

  // LEGACY: hiç sinyal yoksa (eski kayıt) Türkçe metinden türet.
  if (out.size === 0) {
    const blob = [(item.itemName ?? ''), ...(item.details ?? [])].join(' ').toLowerCase();
    for (const [sig, kws] of LEGACY_SIGNAL_RULES) {
      if (kws.some((k) => blob.includes(k))) out.add(sig);
    }
  }

  return [...out];
}

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

/** 0-10 arasında formalite skoru döndürür. Yüksek = daha resmi. */
export function getFormality(item: WardrobeItem): number {
  const categoryTable = FORMALITY[item.category];
  const base = categoryTable?.[item.subCategory ?? ''] ?? CATEGORY_DEFAULT[item.category] ?? 5;
  const fabricMod  = FABRIC_MOD[resolveFabric(item)] ?? 0;
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

  // ── (b) Kumaş-isim fallback doğrulaması ──────────────────────────────────
  console.log('\n── Kumaş-İsim Fallback ──────────────────────────────────────────────────');

  const satenFabric: WardrobeItem = {
    id: 'fb1', userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: 'dress_jumpsuit', subCategory: 'midi_elbise',
    colors: ['#CC3344'], pattern: 'duz', fabric: 'bilmiyorum',
    seasons: [], createdAt: '', itemName: 'Saten gece elbisesi',
    // Beklenen: fabric=bilmiyorum → isim taranır → 'saten'→satin → +1.5 bonus
    // base(midi_elbise)=7, +1.5 = 8.5
  };
  const noFabric: WardrobeItem = {
    id: 'fb2', userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: 'dress_jumpsuit', subCategory: 'midi_elbise',
    colors: ['#CC3344'], pattern: 'duz',
    seasons: [], createdAt: '', itemName: 'Düz gece elbisesi',
    // Beklenen: fabric yok, isimde kumaş anahtar kelimesi yok → +0
    // base(midi_elbise)=7
  };
  const withFabric: WardrobeItem = {
    id: 'fb3', userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: 'dress_jumpsuit', subCategory: 'midi_elbise',
    colors: ['#CC3344'], pattern: 'duz', fabric: 'satin',
    seasons: [], createdAt: '', itemName: 'Düz elbise',
    // Beklenen: fabric='satin' geçerli → +1.5 (fallback gerekmez)
    // base=7 + 1.5 = 8.5
  };

  console.log(`  saten (fabric=bilmiyorum, isim='Saten gece elbisesi') → ${getFormality(satenFabric).toFixed(1)}  (beklenen: 8.5)`);
  console.log(`  düz   (fabric=yok, isimsiz kumaş)                     → ${getFormality(noFabric).toFixed(1)}  (beklenen: 7.0)`);
  console.log(`  satin (fabric='satin', direkt)                         → ${getFormality(withFabric).toFixed(1)}  (beklenen: 8.5)`);
  console.log(`  Fallback ile direkt eşit: ${getFormality(satenFabric) === getFormality(withFabric) ? '✅ EVET' : '❌ HAYIR'}`);
}

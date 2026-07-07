import type { WardrobeItem } from '../types';
import type { OccasionId } from '../constants/occasions';

// ─── Tip ─────────────────────────────────────────────────────────────────────

type Register = 'athletic' | 'casual' | 'business' | 'evening';

// ─── Anahtar kelime listeleri ─────────────────────────────────────────────────

const ATHLETIC_KW = [
  'spor', 'tayt', 'bisikletçi', 'bisikletci', 'antrenman', 'performans',
  'koşu', 'kosu', 'yoga', 'atletik', 'eşofman', 'esofman', 'sweat',
];
const EVENING_KW = [
  'saten', 'abiye', 'gece', 'payet', 'drape', 'pul', 'simli', 'kadife', 'straforlu',
];
const BUSINESS_KW = ['klasik', 'blazer', 'takım', 'takim', 'tailor', 'ofis'];

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

/**
 * Parçanın bağlam register'ını döndürür.
 * Öncelik sırası: athletic > evening > business > casual.
 */
export function getRegister(item: WardrobeItem): Register {
  const name = (item.itemName ?? '').toLowerCase();
  const sub  = item.subCategory ?? '';
  if (ATHLETIC_KW.some((k) => name.includes(k)) || sub === 'tayt') return 'athletic';
  if (EVENING_KW.some((k) => name.includes(k)) || sub === 'clutch') return 'evening';
  // halter tek başına gece sinyali değil (yazlık plaj elbiselerinin klasiği) — sadece maxi ile birlikteyse gece
  if (item.neckline === 'halter' && sub === 'maxi_elbise') return 'evening';
  if (['blazer', 'gomlek', 'loafer'].includes(sub) || BUSINESS_KW.some((k) => name.includes(k))) return 'business';
  return 'casual';
}

// ─── Register × Okasyon uyum tablosu ─────────────────────────────────────────

const REGISTER_FIT: Record<OccasionId, Record<Register, number>> = {
  spor:    { athletic: 1.0, casual: 0.6, business: 0.3, evening: 0.2 },
  gunluk:  { athletic: 0.55, casual: 1.0, business: 0.8, evening: 0.5 },
  seyahat: { athletic: 0.7,  casual: 1.0, business: 0.8, evening: 0.4 },
  brunch:  { athletic: 0.4,  casual: 0.9, business: 0.9, evening: 0.7 },
  is:      { athletic: 0.2,  casual: 0.7, business: 1.0, evening: 0.45 },
  date:    { athletic: 0.3,  casual: 0.8, business: 0.8, evening: 1.0 },
  gece:    { athletic: 0.25, casual: 0.6, business: 0.75, evening: 1.0 },
  davet:   { athletic: 0.15, casual: 0.4, business: 0.7, evening: 1.0 },
  tatil:   { athletic: 0.55, casual: 1.0, business: 0.4, evening: 0.5 },
};

/**
 * Athletic anahtar kelime içermeyen sneaker = smart-casual.
 * Koşu/spor sneaker değil → iş/brunch/seyahatte yükseltilir.
 */
function isSmartSneaker(item: WardrobeItem): boolean {
  if ((item.subCategory ?? '') !== 'sneaker') return false;
  const name = (item.itemName ?? '').toLowerCase();
  return !ATHLETIC_KW.some((k) => name.includes(k));
}

/** 0–1 register-okasyon uyum skoru. 'all' → gunluk olarak çözülür. */
export function registerFit(item: WardrobeItem, occasion: OccasionId | 'all'): number {
  const occ: OccasionId = occasion === 'all' ? 'gunluk' : occasion;
  let base = REGISTER_FIT[occ][getRegister(item)];
  // Güneş gözlüğü: iç mekan / akşam okazyonlarına uymaz (ofiste, gecede takılmaz)
  if (item.subCategory === 'gozluk') {
    if (occ === 'is')   base = Math.min(base, 0.3);
    if (occ === 'gece') base = Math.min(base, 0.25);
    if (occ === 'date') base = Math.min(base, 0.35);
  }
  // Smart-casual sneaker yükseltmesi: loafer öncelikli kalır (0.82 < 1.0), ama seçenek açılır
  if (isSmartSneaker(item)) {
    if (occ === 'is')      base = Math.max(base, 0.82);
    if (occ === 'brunch')  base = Math.max(base, 0.9);
    if (occ === 'seyahat') base = Math.max(base, 0.9);
  }
  return base;
}

/**
 * Register tutarlılık skoru (0–1).
 * Tüm parçalar aynı register → 1.0; spor/iş karışımı → 0.75 (sert çelişki).
 */
export function registerCoherence(clothing: WardrobeItem[]): number {
  const regs = new Set(clothing.map(getRegister));
  if (regs.has('athletic') && (regs.has('evening') || regs.has('business'))) return 0.75;
  if (regs.has('evening') && regs.has('business')) return 0.85;
  if (regs.size === 1) return 1.0;
  return 0.92;
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/registerTheory.ts

if (require.main === module) {
  const wi = (
    name: string, subCategory: string, neckline?: string,
  ): WardrobeItem => ({
    id: Math.random().toString(36).slice(2),
    userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: 'upper', subCategory,
    colors: ['#1A1A1A'], pattern: 'duz', seasons: [], createdAt: '',
    itemName: name, neckline,
  });

  // ── (a) getRegister vakaları ──────────────────────────────────────────────
  console.log('\n── getRegister Vakaları ──────────────────────────────────────────────────');
  const regCases: Array<{ item: WardrobeItem; expected: Register }> = [
    { item: wi('Çapraz askılı spor büstiyer', 'tisort'), expected: 'athletic' },
    { item: wi('Saten gece elbisesi', 'midi_elbise'),    expected: 'evening'  },
    { item: wi('Klasik blazer', 'blazer'),               expected: 'business' },
    { item: wi('Basic tişört', 'tisort'),                expected: 'casual'   },
    { item: wi('Halter yaka elbise', 'mini_elbise', 'halter'), expected: 'evening' },
  ];
  for (const { item, expected } of regCases) {
    const got = getRegister(item);
    const ok  = got === expected;
    console.log(`  "${item.itemName}" → ${got}  ${ok ? '✅' : `❌ beklenen: ${expected}`}`);
  }

  // ── registerFit / registerCoherence ──────────────────────────────────────
  console.log('\n── registerFit Spot Check ────────────────────────────────────────────────');
  const spor  = wi('Koşu taytı', 'tayt');
  const blazer = wi('Ofis blazer', 'blazer');
  const saten  = wi('Saten abiye', 'midi_elbise');
  console.log(`  athletic + spor   = ${registerFit(spor,   'spor').toFixed(2)}  (beklenen: 1.00)`);
  console.log(`  business + is     = ${registerFit(blazer, 'is').toFixed(2)}  (beklenen: 1.00)`);
  console.log(`  evening  + is     = ${registerFit(saten,  'is').toFixed(2)}  (beklenen: 0.45)`);
  console.log(`  athletic + davet  = ${registerFit(spor,   'davet').toFixed(2)}  (beklenen: 0.15)`);

  console.log('\n── registerCoherence Vakaları ────────────────────────────────────────────');
  console.log(`  [casual, casual]          = ${registerCoherence([wi('bluz','bluz'), wi('jean','jean')]).toFixed(2)}  (beklenen: 1.00)`);
  console.log(`  [athletic, evening]       = ${registerCoherence([spor, saten]).toFixed(2)}  (beklenen: 0.75)`);
  console.log(`  [business, evening]       = ${registerCoherence([blazer, saten]).toFixed(2)}  (beklenen: 0.85)`);
  console.log(`  [casual, business]        = ${registerCoherence([wi('pantolon','pantolon'), blazer]).toFixed(2)}  (beklenen: 0.92)`);
}

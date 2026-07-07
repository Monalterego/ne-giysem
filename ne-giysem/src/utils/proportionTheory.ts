import type { WardrobeItem } from '../types';

// ─── Yardımcı hacim/silüet fonksiyonları ─────────────────────────────────────
// fit alanı eksikse: topVolume→1, bottomVolume→1, isCrop→false — ceza yok.

/** Üst hacim: 0=slim/crop, 1=normal, 2=oversized */
function topVolume(u: WardrobeItem): 0 | 1 | 2 {
  if (u.fit === 'oversized') return 2;
  if (u.fit === 'slim' || u.fit === 'crop') return 0;
  return 1;
}

/** Üst kırpık (crop) mı? */
function isCrop(u: WardrobeItem): boolean {
  return u.fit === 'crop';
}

/** Alt hacim: 0=slim/tayt, 1=normal, 2=oversized/wide */
function bottomVolume(l: WardrobeItem): 0 | 1 | 2 {
  if (l.fit === 'oversized') return 2;
  if (l.fit === 'slim' || l.subCategory === 'tayt') return 0;
  return 1;
}

/** Görsel ağırlıklı ayakkabı: sneaker, bot, çizme tabandan güçlü gözükür */
function shoeHeavy(s: WardrobeItem): boolean {
  return ['sneaker', 'bot', 'cizme'].includes(s.subCategory ?? '');
}

/** Uzun dış giyim (mont/kaban/trenchkot veya oversized) dikey dengeyi destekler */
function longlineOuter(o?: WardrobeItem): boolean {
  return !!o && (
    ['mont', 'kaban', 'trenchkot'].includes(o.subCategory ?? '') ||
    o.fit === 'oversized'
  );
}

function avg(...ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

/**
 * 0–1 oran/silüet uyum skoru.
 * Üç eksen: hacim dengesi (vol) + dikey üçler (vert) + ayakkabı dengesi (shoe).
 * fit/subCategory eksikse ilgili helper nötr değer döner — ceza uygulanmaz.
 */
export function proportionScore(core: WardrobeItem[], outer?: WardrobeItem): number {
  const upper = core.find((i) => i.category === 'upper');
  const lower = core.find((i) => i.category === 'lower');
  const dress = core.find((i) => i.category === 'dress_jumpsuit');
  const shoe  = core.find((i) => i.category === 'shoes');

  // ─── Elbise/tulum durumu ──────────────────────────────────────────────────
  if (!upper && dress && shoe) {
    const sub = dress.subCategory ?? '';
    const dressVert: number =
      sub === 'mini_elbise'                           ? 1.00 :
      sub === 'midi_elbise'                           ? 0.95 :
      (sub === 'maxi_elbise' || sub === 'tulum')      ? 0.85 :
      0.90;
    // Ağır ayakkabı uzun elbiseyle görsel denge kurar
    const shoeBal = (shoeHeavy(shoe) && ['maxi_elbise', 'midi_elbise'].includes(sub))
      ? 1.0
      : 0.95;
    return avg(dressVert, shoeBal);
  }

  // ─── Üst + alt + ayakkabı durumu ─────────────────────────────────────────
  if (upper && lower && shoe) {
    const tv = topVolume(upper);
    const bv = bottomVolume(lower);

    // a) Hacim dengesi — biri büyük+biri küçük ideal; çift-büyük çok kötü
    const vol: number =
      ((tv === 2 && bv <= 0) || (tv <= 0 && bv === 2)) ? 1.00 :
      (tv === 2 && bv === 2)                            ? 0.55 :
      (tv === 0 && bv === 0)                            ? 0.85 :
      0.90;

    // b) Dikey denge — crop veya longline outer görsel üçler kurar
    const vert: number =
      (isCrop(upper) || longlineOuter(outer)) ? 1.00 :
      (tv === 2 && bv <= 1)                   ? 0.90 :
      (tv === 1 && bv === 1)                  ? 0.80 :
      0.85;

    // c) Ayakkabı dengesi — ağır ayakkabı hacimsiz altla çakışır
    const shoeScore: number = shoeHeavy(shoe)
      ? (bv >= 1 ? 1.0 : 0.70)
      : (bv <= 1 ? 1.0 : 0.85);

    return Math.max(0, Math.min(1, avg(vol, vert, shoeScore)));
  }

  // Bilinmeyen çekirdek yapısı → nötr
  return 0.85;
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/proportionTheory.ts

if (require.main === module) {
  const item = (
    category: string, subCategory: string, fit?: string,
  ): WardrobeItem => ({
    id: Math.random().toString(36).slice(2),
    userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: category as WardrobeItem['category'], subCategory,
    colors: ['#1A1A1A'], pattern: 'duz', seasons: [], createdAt: '',
    fit,
  });

  const cases: Array<{ label: string; core: WardrobeItem[]; expected: string }> = [
    {
      label: 'oversized üst + slim jean + loafer',
      core: [item('upper', 'bluz', 'oversized'), item('lower', 'jean', 'slim'), item('shoes', 'loafer')],
      expected: 'YÜKSEK (~0.97)',
    },
    {
      label: 'oversized üst + oversized pantolon + loafer',
      core: [item('upper', 'bluz', 'oversized'), item('lower', 'pantolon', 'oversized'), item('shoes', 'loafer')],
      expected: 'DÜŞÜK (~0.75)',
    },
    {
      label: 'chunky sneaker + wide-leg + normal üst',
      core: [item('upper', 'bluz'), item('lower', 'pantolon', 'oversized'), item('shoes', 'sneaker')],
      expected: 'YÜKSEK (~0.92)',
    },
    {
      label: 'chunky sneaker + skinny + normal üst',
      core: [item('upper', 'bluz'), item('lower', 'pantolon', 'slim'), item('shoes', 'sneaker')],
      expected: 'DÜŞÜK (~0.82)',
    },
    {
      label: 'crop üst + oversized + topuklu (crop → vert=1.0)',
      core: [item('upper', 'bluz', 'crop'), item('lower', 'pantolon', 'oversized'), item('shoes', 'topuklu')],
      expected: 'YÜKSEK (~0.97)',
    },
  ];

  console.log('\n── Oran/Silüet Testi ─────────────────────────────────────────────────────');
  for (const { label, core, expected } of cases) {
    const sc = proportionScore(core);
    console.log(`  ${label}`);
    console.log(`    score=${sc.toFixed(3)}  (beklenen: ${expected})`);
  }
}

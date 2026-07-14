import type { WardrobeItem } from '../types';
import { hexToHsl, isNeutral } from './colorUtils';

// ─── pairScore ────────────────────────────────────────────────────────────────
// Kademeli uyum değerleri — "headroom" bırakır (nötr+nötr bile 1.0 değil)
// böylece renk kararları skor yelpazesine gerçekten yansır.

/**
 * İki hex renk arasındaki uyum skoru (0–1).
 * Her iki nötr    → 0.88 | Biri nötr → 0.85
 * Mono/analog ≤30 → base 0.92 | Komplementer 150-210 → 0.82
 * Triadik 110-130 → 0.72 | Çakışma → 0.40 | Geçersiz hex → 0.82
 * Kromatik çiftlerde S/V modifikatörü uygulanır (kaynaşma / tonal / çamur).
 */
export function pairScore(hex1: string, hex2: string): number {
  const n1 = isNeutral(hex1);
  const n2 = isNeutral(hex2);
  if (n1 && n2) return 0.88;
  if (n1 || n2) return 0.85;
  const hsl1 = hexToHsl(hex1);
  const hsl2 = hexToHsl(hex2);
  if (!hsl1 || !hsl2) return 0.82;
  const diff    = Math.abs(hsl1[0] - hsl2[0]);
  const hueDiff = Math.min(diff, 360 - diff);
  let base: number;
  if (hueDiff <= 30)                         base = 0.92;  // mono / analog
  else if (hueDiff >= 150 && hueDiff <= 210) base = 0.82;  // komplementer
  else if (hueDiff >= 110 && hueDiff <= 130) base = 0.72;  // triadik
  else                                        base = 0.40;  // çakışma

  // S/V modifikatörü — lightness, saturation proxy olarak kullanılır
  const sA = hsl1[1]; const sB = hsl2[1];  // saturation 0-100
  const vA = hsl1[2]; const vB = hsl2[2];  // lightness as value proxy 0-100
  const satDiff = Math.abs(sA - sB);
  const valDiff = Math.abs(vA - vB);
  let mod = 0;
  if (valDiff < 12 && satDiff < 12) mod -= 0.12;  // kaynaşma (düz, kontrastsız)
  else if (valDiff >= 25)           mod += 0.04;  // sağlıklı değer kontrastı (iyi tonal)
  if (satDiff > 55)                 mod -= 0.08;  // neon+soluk → çamurlu
  return Math.max(0.30, Math.min(1.0, base + mod));
}

// Parça-çifti renk skoru cache'i. generateCombos içinde aynı çift yüzlerce kez sorulur;
// id'ler kalıcı olduğundan simetrik (a.id,b.id) anahtarla memoize edilir. 5000'de temizlenir.
const _colorScoreCache = new Map<string, number>();

export function clearColorScoreCache(): void {
  _colorScoreCache.clear();
}

/** İki parça arasındaki ortalama renk uyum skoru (0–1). */
export function itemColorScore(a: WardrobeItem, b: WardrobeItem): number {
  if (!a.colors.length || !b.colors.length) return 0.82;
  const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
  const cached = _colorScoreCache.get(key);
  if (cached !== undefined) return cached;
  const scores = a.colors.flatMap((c1) => b.colors.map((c2) => pairScore(c1, c2)));
  const result = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  if (_colorScoreCache.size > 5000) _colorScoreCache.clear();
  _colorScoreCache.set(key, result);
  return result;
}

// ─── outfitColorScore ─────────────────────────────────────────────────────────

/**
 * Outfit-seviyesi renk dağılım skoru (0–1).
 * Dominant renkleri 60° hue kovalarına ayırır; benzersiz kova sayısına göre puanlar.
 * 0 renkli (tümü nötr) → 0.90 | 1 kova → 1.00 | 2 → 0.92 | 3 → 0.78 | ≥4 → 0.55
 */
export function outfitColorScore(items: WardrobeItem[]): number {
  const chromatic = items
    .map((i) => i.colors[0])
    .filter((hex): hex is string => !!hex && !isNeutral(hex));

  if (chromatic.length === 0) return 0.90;

  const families = new Set(
    chromatic
      .map((hex) => {
        const hsl = hexToHsl(hex);
        return hsl ? Math.floor(hsl[0] / 60) % 6 : -1;
      })
      .filter((f) => f !== -1),
  );

  const d = families.size;
  if (d === 1) return 1.00;
  if (d === 2) return 0.92;
  if (d === 3) return 0.78;
  return 0.55;
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/colorTheory.ts

if (require.main === module) {
  const wi = (hex: string): WardrobeItem => ({
    id: Math.random().toString(36).slice(2),
    userId: 'u', originalImageUrl: '', processedImageUrl: '',
    category: 'upper', subCategory: 'bluz',
    colors: [hex], pattern: 'duz', seasons: [], createdAt: '',
  });

  // ── (a) pairScore — S/V modifikatör vakaları ──────────────────────────────
  console.log('\n── pairScore S/V Modifikatör Vakaları ────────────────────────────────────');
  const psCases: Array<{ label: string; h1: string; h2: string; beklenen: string }> = [
    {
      label: 'Kaynaşma: aynı hue, aynı S/L (mono, mod -0.12)',
      h1: '#CC3344', h2: '#BB2F3F',
      beklenen: '~0.80 (base 0.92 − 0.12)',
    },
    {
      label: 'Tonal: aynı hue, belirgin L farkı (mono, mod +0.04)',
      h1: '#CC3344', h2: '#FFAAB0',
      beklenen: '~0.96 (base 0.92 + 0.04)',
    },
    {
      label: 'Neon+soluk: yüksek satDiff, mono hue (mod −0.08)',
      h1: '#FF0033', h2: '#CC8888',
      beklenen: '~0.84 (base 0.92 − 0.08)',
    },
    {
      label: 'Her ikisi nötr → sabit 0.88',
      h1: '#1A1A1A', h2: '#F5F5F5',
      beklenen: '0.88',
    },
    {
      label: 'Biri nötr → sabit 0.85',
      h1: '#1A1A1A', h2: '#E94560',
      beklenen: '0.85',
    },
  ];
  for (const { label, h1, h2, beklenen } of psCases) {
    console.log(`  ${label}`);
    console.log(`    pairScore=${pairScore(h1, h2).toFixed(3)}  (beklenen: ${beklenen})`);
  }

  // ── (b) outfitColorScore — dağılım vakaları ───────────────────────────────
  console.log('\n── outfitColorScore Dağılım Vakaları ─────────────────────────────────────');
  const osCases: Array<{ label: string; items: WardrobeItem[]; beklenen: string }> = [
    {
      label: 'Tümü nötr (siyah+beyaz+gri)',
      items: [wi('#1A1A1A'), wi('#FFFFFF'), wi('#888888')],
      beklenen: '0.90',
    },
    {
      label: 'Nötr zemin + 1 renk (kırmızı aksan)',
      items: [wi('#1A1A1A'), wi('#FFFFFF'), wi('#E94560')],
      beklenen: '1.00',
    },
    {
      label: '2 farklı hue kovası (kırmızı + yeşil)',
      items: [wi('#E94560'), wi('#1A1A1A'), wi('#44BB66')],
      beklenen: '0.92',
    },
    {
      label: '3 farklı hue kovası (kırmızı + yeşil + mavi)',
      items: [wi('#E94560'), wi('#44BB66'), wi('#4466CC')],
      beklenen: '0.78',
    },
    {
      label: '4+ farklı hue kovası (kaotik)',
      items: [wi('#E94560'), wi('#44BB66'), wi('#4466CC'), wi('#EEAA11')],
      beklenen: '0.55',
    },
  ];
  for (const { label, items, beklenen } of osCases) {
    console.log(`  ${label}`);
    console.log(`    outfitColorScore=${outfitColorScore(items).toFixed(2)}  (beklenen: ${beklenen})`);
  }
}

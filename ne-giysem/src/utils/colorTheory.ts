import type { WardrobeItem } from '../types';
import { hexToHsl, isNeutral } from './colorUtils';

// ─── pairScore ────────────────────────────────────────────────────────────────
// Kademeli uyum değerleri — "headroom" bırakır (nötr+nötr bile 1.0 değil)
// böylece renk kararları skor yelpazesine gerçekten yansır.

/**
 * İki hex renk arasındaki uyum skoru (0–1).
 * Her iki nötr    → 0.88 | Biri nötr → 0.85
 * Mono/analog ≤30 → 0.92 | Komplementer 150-210 → 0.82
 * Triadik 110-130 → 0.72 | Çakışma → 0.40 | Geçersiz hex → 0.82
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
  if (hueDiff <= 30)                    return 0.92;  // mono / analog
  if (hueDiff >= 150 && hueDiff <= 210) return 0.82;  // komplementer
  if (hueDiff >= 110 && hueDiff <= 130) return 0.72;  // triadik
  return 0.40;                                         // çakışma
}

/** İki parça arasındaki ortalama renk uyum skoru (0–1). */
export function itemColorScore(a: WardrobeItem, b: WardrobeItem): number {
  if (!a.colors.length || !b.colors.length) return 0.82;
  const scores = a.colors.flatMap((c1) => b.colors.map((c2) => pairScore(c1, c2)));
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

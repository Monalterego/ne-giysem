import type { WardrobeItem, Combo } from '../types';

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

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────

export function generateCombos(items: WardrobeItem[], maxCombos = 12): Combo[] {
  const uppers = items.filter((i) => i.category === 'upper');
  const lowers = items.filter((i) => i.category === 'lower');
  const shoes  = items.filter((i) => i.category === 'shoes');

  if (!uppers.length || !lowers.length || !shoes.length) return [];

  const results: Combo[] = [];

  for (const upper of uppers) {
    for (const lower of lowers) {
      for (const shoe of shoes) {
        // Üst-Alt uyumu en ağır; Alt-Ayakkabı önemli; Üst-Ayakkabı daha az kritik
        const ulScore = itemColorScore(upper, lower);
        const lsScore = itemColorScore(lower, shoe);
        const usScore = itemColorScore(upper, shoe);
        const raw     = ulScore * 0.45 + lsScore * 0.35 + usScore * 0.20;
        const score   = Math.min(100, Math.round(raw * 100));

        const label =
          score >= 80 ? 'Mükemmel Uyum' :
          score >= 65 ? 'İyi Kombin'    :
                        'Kabul Edilebilir';

        results.push({
          id: uid(),
          items: [upper, lower, shoe],
          score,
          label,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxCombos);
}

// Dolabın kombin üretmek için hangi kategorilerde eksik olduğunu döner
export function missingCategories(items: WardrobeItem[]): string[] {
  const missing: string[] = [];
  if (!items.some((i) => i.category === 'upper'))  missing.push('üst kıyafet');
  if (!items.some((i) => i.category === 'lower'))  missing.push('alt kıyafet');
  if (!items.some((i) => i.category === 'shoes'))  missing.push('ayakkabı');
  return missing;
}

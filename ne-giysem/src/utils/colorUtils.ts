// Hex renk kodlarından türetilen paylaşımlı yardımcı fonksiyonlar

/** Hex rengi HSL bileşenlerine dönüştürür: [hue 0-360, saturation 0-100, lightness 0-100] */
export function hexToHsl(hex: string): [number, number, number] | null {
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

/** Nötr renkler (siyah, beyaz, gri, bej, lacivert) her şeyle uyumlu */
export function isNeutral(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return true;
  const [h, s, l] = hsl;
  if (s < 15) return true;                                    // düşük doygunluk → nötr
  if (l > 90) return true;                                    // çok açık → kırık beyaz / krem
  if (h >= 200 && h <= 255 && s < 45 && l < 30) return true; // lacivert
  return false;
}

/** Sıcak renkler: kırmızı, turuncu, sarı, pembe (hue 0-60 veya 300-360) */
export function isWarmColor(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  const [h, s, l] = hsl;
  if (s < 15 || l > 90) return false;
  return h <= 60 || h >= 300;
}

/** Doygun renk mi? HSL saturation > eşik (varsayılan 50) */
export function isSaturated(hex: string, threshold = 50): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  return hsl[1] > threshold;
}

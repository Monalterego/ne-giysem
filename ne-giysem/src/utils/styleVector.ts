import type { StyleProfile } from '../types';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface StyleVector {
  colorBoldness:      number; // -1..+1: negatif=nötr/minimal, pozitif=renkli/cesur
  formalityShift:     number; // -1..+1: negatif=casual/rahat, pozitif=resmi/yapılı
  structureLooseness: number; // -1..+1: negatif=fitted/yapılandırılmış, pozitif=oversized/akışkan
}

// ─── Stil eğilimleri tablosu ─────────────────────────────────────────────────

const STYLE_TENDENCIES: Record<string, StyleVector> = {
  'Minimalist':          { colorBoldness: -0.7, formalityShift:  0.1, structureLooseness: -0.2 },
  'Old Money':           { colorBoldness: -0.5, formalityShift:  0.5, structureLooseness: -0.3 },
  'Quiet Luxury':        { colorBoldness: -0.6, formalityShift:  0.2, structureLooseness: -0.1 },
  'Smart Casual':        { colorBoldness: -0.2, formalityShift:  0.2, structureLooseness:  0   },
  'Clean Girl':          { colorBoldness: -0.4, formalityShift:  0,   structureLooseness: -0.1 },
  'Streetwear':          { colorBoldness:  0.6, formalityShift: -0.5, structureLooseness:  0.7 },
  'Athleisure':          { colorBoldness:  0.2, formalityShift: -0.7, structureLooseness:  0.5 },
  'Downtown Girl':       { colorBoldness:  0.1, formalityShift: -0.1, structureLooseness:  0.2 },
  'Coquette':            { colorBoldness:  0.5, formalityShift:  0,   structureLooseness: -0.2 },
  'Soft Girl':           { colorBoldness:  0.3, formalityShift: -0.2, structureLooseness:  0.1 },
  'Bohemian':            { colorBoldness:  0.4, formalityShift: -0.3, structureLooseness:  0.6 },
  'Cottagecore':         { colorBoldness:  0.2, formalityShift: -0.2, structureLooseness:  0.4 },
  'Coastal Grandmother': { colorBoldness: -0.1, formalityShift: -0.2, structureLooseness:  0.3 },
  'Dark Academia':       { colorBoldness:  0.1, formalityShift:  0.4, structureLooseness:  0.1 },
  'Y2K':                 { colorBoldness:  0.8, formalityShift: -0.4, structureLooseness:  0.3 },
  'Grunge Chic':         { colorBoldness:  0.3, formalityShift: -0.4, structureLooseness:  0.5 },
  'Mob Wife':            { colorBoldness:  0.7, formalityShift:  0.2, structureLooseness:  0.2 },
  'Avant-garde':         { colorBoldness:  0.6, formalityShift:  0.1, structureLooseness:  0.7 },
  'Preppy':              { colorBoldness:  0.2, formalityShift:  0.4, structureLooseness: -0.2 },
  'Gorpcore':            { colorBoldness:  0,   formalityShift: -0.5, structureLooseness:  0.5 },
};

const ZERO_VECTOR: StyleVector = { colorBoldness: 0, formalityShift: 0, structureLooseness: 0 };

// ─── Fonksiyon ────────────────────────────────────────────────────────────────

/**
 * Kullanıcının ağırlıklı stil listesinden tek bileşik vektör üretir.
 * Listede bulunmayan stiller sıfır vektör (nötr) katkı sağlar.
 * Profil yoksa veya ağırlık toplamı sıfırsa nötr vektör döner.
 */
export function computeStyleVector(profile?: StyleProfile): StyleVector {
  if (!profile?.styles?.length) return { ...ZERO_VECTOR };

  let totalWeight = 0;
  let cb = 0, fs = 0, sl = 0;

  for (const { name, weight } of profile.styles) {
    if (weight <= 0) continue;
    const t = STYLE_TENDENCIES[name] ?? ZERO_VECTOR;
    cb += t.colorBoldness      * weight;
    fs += t.formalityShift     * weight;
    sl += t.structureLooseness * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return { ...ZERO_VECTOR };
  return {
    colorBoldness:      cb / totalWeight,
    formalityShift:     fs / totalWeight,
    structureLooseness: sl / totalWeight,
  };
}

// ─── Manuel test bloğu ───────────────────────────────────────────────────────
// Kullanım: npx tsx src/utils/styleVector.ts

if (require.main === module) {
  const p = (styles: Array<{ name: string; weight: number }>): StyleProfile =>
    ({ styles, colorPalette: [] });

  console.log('\n── computeStyleVector Vakaları ──────────────────────────────────────────');

  const cases = [
    { label: 'Old Money (w=1)',            profile: p([{ name: 'Old Money',  weight: 1 }]) },
    { label: 'Streetwear (w=1)',           profile: p([{ name: 'Streetwear', weight: 1 }]) },
    { label: 'Min%60 + OldMoney%40',       profile: p([{ name: 'Minimalist', weight: 60 }, { name: 'Old Money', weight: 40 }]) },
    { label: 'Bohemian%50 + Streetwear%50',profile: p([{ name: 'Bohemian',   weight: 50 }, { name: 'Streetwear', weight: 50 }]) },
    { label: 'BilinmeyenStil (w=1)',        profile: p([{ name: 'BilinmeyenStil', weight: 1 }]) },
    { label: 'profile=undefined',           profile: undefined as unknown as StyleProfile },
  ];

  for (const { label, profile } of cases) {
    const v = computeStyleVector(profile);
    console.log(
      `  ${label.padEnd(38)} cb=${v.colorBoldness.toFixed(2).padStart(5)}` +
      `  fs=${v.formalityShift.toFixed(2).padStart(5)}` +
      `  sl=${v.structureLooseness.toFixed(2).padStart(5)}`,
    );
  }

  // Doğrulama
  const omVec = computeStyleVector(p([{ name: 'Old Money',  weight: 1 }]));
  const swVec = computeStyleVector(p([{ name: 'Streetwear', weight: 1 }]));
  console.log('\n  Old Money  formalityShift > 0:', omVec.formalityShift > 0 ? '✅' : '❌');
  console.log('  Streetwear colorBoldness    > 0:', swVec.colorBoldness > 0  ? '✅' : '❌');
  console.log('  Streetwear structureLooseness > 0:', swVec.structureLooseness > 0 ? '✅' : '❌');
}

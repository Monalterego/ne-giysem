import type { WardrobeItem } from '../types';
import type { OccasionId } from '../constants/occasions';
import { OCCASION_RULES } from './occasionRules';
import { isNeutral } from './colorUtils';

// ─── Tip ─────────────────────────────────────────────────────────────────────

type Occasion = OccasionId | 'all';

export interface ReasoningParams {
  items: WardrobeItem[];
  occasion: Occasion;
  colorHarmony: number;
  contextFit: number;
  prop: number;
  encCoverage: number;
}

// ─── Okasyon etiketleri ───────────────────────────────────────────────────────

const OCC_LABEL: Record<Occasion, string> = {
  all:     'günlük',
  gunluk:  'günlük',
  is:      'iş',
  brunch:  'brunch',
  gece:    'gece',
  date:    'date',
  davet:   'davet',
  spor:    'spor',
  seyahat: 'seyahat',
};

// ─── buildReasoning ───────────────────────────────────────────────────────────

/**
 * Kombinin en belirgin iki güçlü yönünü Türkçe kısa cümle olarak döndürür.
 * Üç aday madde üretilir (RENK, ORAN, OKASYON); strength'e göre en yüksek 2 seçilir.
 */
export function buildReasoning(p: ReasoningParams): string {
  const ruleKey: OccasionId = p.occasion === 'all' ? 'gunluk' : p.occasion as OccasionId;
  const core = p.items.filter((i) =>
    ['upper', 'lower', 'dress_jumpsuit', 'shoes'].includes(i.category),
  );

  const clauses: { text: string; strength: number }[] = [];

  // ── RENK ──────────────────────────────────────────────────────────────────
  const chromaticCount = core.filter((i) => {
    const dominant = i.colors[0];
    return dominant && !isNeutral(dominant);
  }).length;

  let renkText: string;
  if (chromaticCount === 0) {
    renkText = 'nötr ve temiz bir palet';
  } else if (chromaticCount === 1) {
    renkText = 'nötr zemine tek canlı aksan';
  } else {
    renkText = 'uyumlu renk geçişleri';
  }
  clauses.push({ text: renkText, strength: p.colorHarmony });

  // ── ORAN ──────────────────────────────────────────────────────────────────
  const hasOversizedUpper = core.some(
    (i) => ['upper', 'dress_jumpsuit'].includes(i.category) && i.fit === 'oversized',
  );
  const hasSlimLower = core.some(
    (i) => i.category === 'lower' && (i.fit === 'slim' || i.fit === 'skinny'),
  );
  const hasCrop = core.some((i) => i.fit === 'crop');

  let oranText: string | null = null;
  if (hasOversizedUpper && hasSlimLower) {
    oranText = 'hacimli ve dar parçaların dengeli oranı';
  } else if (hasCrop) {
    oranText = 'crop üst bel çizgisini öne çıkarıyor';
  } else if (p.prop > 0.85) {
    oranText = 'dengeli silüet';
  }
  if (oranText) {
    clauses.push({ text: oranText, strength: p.prop });
  }

  // ── OKASYON ───────────────────────────────────────────────────────────────
  const encouraged  = OCCASION_RULES[ruleKey].encouraged;
  const occLabel    = OCC_LABEL[p.occasion] ?? String(p.occasion);
  const matchedItem = core.find((i) => encouraged.includes(i.subCategory ?? ''));

  let okasyonText: string;
  let okasyonStrength: number;
  if (matchedItem) {
    const name     = matchedItem.itemName ?? matchedItem.subCategory ?? '';
    okasyonText    = `${name} ${occLabel} için ideal`;
    okasyonStrength = p.encCoverage;
  } else {
    okasyonText    = `${occLabel} için uygun`;
    okasyonStrength = p.contextFit * 0.5;
  }
  clauses.push({ text: okasyonText, strength: okasyonStrength });

  // ── Top 2 ─────────────────────────────────────────────────────────────────
  clauses.sort((a, b) => b.strength - a.strength);
  const joined = clauses.slice(0, 2).map((c) => c.text).join('; ');
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

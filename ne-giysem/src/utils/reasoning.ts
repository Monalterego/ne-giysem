import type { WardrobeItem } from '../types';
import type { OccasionId } from '../constants/occasions';
import { OCCASION_RULES } from './occasionRules';
import { isNeutral } from './colorUtils';

// ─── Tipler ───────────────────────────────────────────────────────────────────

type Occasion = OccasionId | 'all';

export interface ReasoningParams {
  items: WardrobeItem[];
  occasion: Occasion;
  colorHarmony: number;
  contextFit: number;
  prop: number;
  encCoverage: number;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

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

const SUBCATEGORY_TR: Record<string, string> = {
  tayt: 'tayt', sort: 'şort', tisort: 'tişört',
  hoodie: 'hoodie', sweatshirt: 'sweatshirt',
  sneaker: 'sneaker', jean: 'jean', bluz: 'bluz',
  pantolon: 'pantolon', loafer: 'loafer', sandalet: 'sandalet',
  etek: 'etek', blazer: 'blazer', gomlek: 'gömlek',
  topuklu: 'topuklu', bot: 'bot', babet: 'babet',
  mini_elbise: 'mini elbise', midi_elbise: 'midi elbise',
  maxi_elbise: 'maxi elbise', tulum: 'tulum',
  cizme: 'çizme', kaban: 'kaban', trenchkot: 'trençkot', clutch: 'clutch',
};

const DRESS_TEXT: Record<string, string> = {
  mini_elbise: 'mini elbiseyle dinamik bir görünüm',
  midi_elbise: 'midi elbiseyle zarif bir hat',
  maxi_elbise: 'maxi elbiseyle akıcı bir siluet',
  tulum:       'tek parça tulumla zahmetsiz görünüm',
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function subCategoryLabel(item: WardrobeItem): string {
  const sub = item.subCategory ?? '';
  return SUBCATEGORY_TR[sub] ?? sub.replace(/_/g, ' ');
}

// JS toUpperCase tuzağı: 'i' → 'I' (yanlış Türkçe); elle map gerekli.
function capitalizeFirst(str: string): string {
  if (!str) return str;
  const ch = str[0];
  const rest = str.slice(1);
  if (ch === 'i') return 'İ' + rest;
  if (ch === 'ı') return 'I' + rest;
  return ch.toUpperCase() + rest;
}

// ─── buildReasoning ───────────────────────────────────────────────────────────

/**
 * Öncelik sırasıyla clauselar toplanır; ilk 2 benzersiz seçilir.
 * Sıra: OKASYON → ORAN → ELBİSE betimi → RENK → DOLGU
 */
export function buildReasoning(p: ReasoningParams): string {
  const ruleKey: OccasionId = p.occasion === 'all' ? 'gunluk' : p.occasion as OccasionId;
  const core = p.items.filter((i) =>
    ['upper', 'lower', 'dress_jumpsuit', 'shoes'].includes(i.category),
  );
  const occLabel  = OCC_LABEL[p.occasion] ?? String(p.occasion);
  const encouraged = OCCASION_RULES[ruleKey].encouraged;

  const parts: string[] = [];

  // 1) OKASYON — yalnızca contextFit yeterliyse iddia edilir
  const enc = core.find((i) => encouraged.includes(i.subCategory ?? ''));
  if (enc && p.contextFit >= 0.7) {
    parts.push(`${subCategoryLabel(enc)} ${occLabel} için ideal`);
  }

  // 2) ORAN — yalnızca spesifik hacim/kesim kontrastı varsa
  if (parts.length < 2) {
    const hasOversizedUpper = core.some(
      (i) => ['upper', 'dress_jumpsuit'].includes(i.category) && i.fit === 'oversized',
    );
    const hasSlimLower = core.some(
      (i) => i.category === 'lower' && (i.fit === 'slim' || i.fit === 'skinny'),
    );
    const hasCrop = core.some((i) => i.fit === 'crop');

    if (hasOversizedUpper && hasSlimLower) {
      parts.push('hacimli ve dar parçaların dengeli oranı');
    } else if (hasCrop) {
      parts.push('crop üst bel çizgisini öne çıkarıyor');
    }
    // 'dengeli silüet' generic dolgusu kasıtlı olarak kaldırıldı
  }

  // 3) ELBİSE betimi — dress combo'larda oran yerine kullanılır
  if (parts.length < 2) {
    const dressItem = core.find(
      (i) => i.category === 'dress_jumpsuit' && i.subCategory && DRESS_TEXT[i.subCategory],
    );
    if (dressItem?.subCategory) {
      parts.push(DRESS_TEXT[dressItem.subCategory]);
    }
  }

  // 4) RENK
  if (parts.length < 2) {
    const chromaticCount = core.filter((i) => {
      const dominant = i.colors[0];
      return dominant && !isNeutral(dominant);
    }).length;

    if (chromaticCount === 0) {
      parts.push('nötr ve temiz bir palet');
    } else if (chromaticCount === 1) {
      parts.push('nötr zemine canlı bir aksan');
    } else {
      parts.push('uyumlu renk geçişleri');
    }
  }

  // 5) DOLGU — hâlâ 2'ye ulaşılamadıysa (ideal iddiasız, yumuşak)
  if (parts.length < 2) {
    parts.push(`${occLabel} için uygun`);
  }

  return capitalizeFirst(parts.slice(0, 2).join('; ')) + '.';
}

import type { WardrobeItem } from '../types';
import type { VisionResult } from './visionAnalysis';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface CompatibilityResult {
  verdict: string;
  reasons: string[];
  combos: WardrobeItem[][];
  missing: string[];
}

const CATEGORY_LABEL: Record<string, string> = {
  upper:          'Üst',
  lower:          'Alt',
  dress_jumpsuit: 'Elbise/Tulum',
  outer:          'Dış Giyim',
  shoes:          'Ayakkabı',
  bag:            'Çanta',
  accessory:      'Aksesuar',
};

export async function analyzeStoreCompatibility(
  vision: VisionResult,
  wardrobeItems: WardrobeItem[],
): Promise<CompatibilityResult> {
  if (!API_KEY) throw new Error('Anthropic API key eksik.');

  const displayItems = wardrobeItems.slice(0, 25);

  const itemList = displayItems
    .map((item) =>
      `[${item.id}] ${CATEGORY_LABEL[item.category] ?? item.category}` +
      `${item.subCategory ? ` (${item.subCategory})` : ''}` +
      ` | renkler: ${item.colors.slice(0, 2).join(', ') || 'bilinmiyor'}` +
      ` | mevsim: ${item.seasons.join(', ') || 'tümü'}`,
    )
    .join('\n');

  const scannedLines = [
    vision.itemName     ? `Ad: ${vision.itemName}`             : null,
    `Kategori: ${CATEGORY_LABEL[vision.category] ?? vision.category}`,
    vision.subcategory  ? `Alt kategori: ${vision.subcategory}` : null,
    vision.colors.length ? `Renkler: ${vision.colors.join(', ')}` : null,
    vision.pattern      ? `Desen: ${vision.pattern}`           : null,
    vision.fit          ? `Kesim: ${vision.fit}`               : null,
    vision.neckline     ? `Yaka: ${vision.neckline}`           : null,
    vision.sleeveLength ? `Kol boyu: ${vision.sleeveLength}`   : null,
    vision.details?.length ? `Detaylar: ${vision.details.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `Kullanıcı mağazada bir ürün tararken şu ürünü inceledi. Dolabına eklemeli mi?

TARANAN ÜRÜN:
${scannedLines}

MEVCUT DOLAP (${wardrobeItems.length} parça${wardrobeItems.length > 25 ? ', ilk 25 gösteriliyor' : ''}):
${itemList}

YALNIZCA geçerli JSON döndür, başka hiçbir metin yazma:
{
  "verdict": "Dolabına çok uygun" | "Zaten benzeri var" | "Eksik parçaları tamamlıyor",
  "reasons": ["2-3 kısa Türkçe cümle — neden bu kararı verdin"],
  "comboIds": [["id1","id2"], ["id3","id4","id5"]],
  "missing": ["bu ürünle daha iyi gidecek 1-2 eksik parça önerisi"]
}

comboIds: dolaptaki mevcut parçalardan (yukarıdaki köşeli parantez içindeki ID'leri kullan) en fazla 2 kombin önerisi, her kombinde 2-3 parça. Taranan ürünü dahil etme — yalnızca dolaptaki parçaları referans et.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API hatası: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const text: string = (json as any)?.content?.[0]?.text ?? '';
  if (!text) throw new Error('Claude API boş yanıt döndürdü.');

  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const raw = JSON.parse(clean);

  const combos: WardrobeItem[][] = ((raw.comboIds ?? []) as string[][])
    .map((idGroup) =>
      idGroup
        .map((id) => wardrobeItems.find((i) => i.id === id))
        .filter((i): i is WardrobeItem => !!i),
    )
    .filter((group) => group.length >= 2)
    .slice(0, 3);

  return {
    verdict: typeof raw.verdict === 'string' ? raw.verdict : 'Dolabına çok uygun',
    reasons: Array.isArray(raw.reasons)
      ? (raw.reasons as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 3)
      : [],
    combos,
    missing: Array.isArray(raw.missing)
      ? (raw.missing as unknown[]).filter((m): m is string => typeof m === 'string').slice(0, 3)
      : [],
  };
}

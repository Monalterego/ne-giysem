// ─── Kıyafet renk paleti (elle renk seçimi) ──────────────────────────────────
// UI rengi DEĞİL, parça verisi: wardrobe_items.colors'a yazılan hex'ler (vision'ın
// döndürdüğüyle aynı biçim) — colorTheory / colorUtils bunlarla çalışır.
// Bu yüzden theme.ts token'ı değil; constants/styles.ts'teki paletler gibi veri.
// Etiket: i18n garmentColor.<key>

export const GARMENT_SWATCHES: { key: string; hex: string }[] = [
  { key: 'black',     hex: '#1A1A1A' },
  { key: 'white',     hex: '#FFFFFF' },
  { key: 'cream',     hex: '#F3EBDD' },
  { key: 'beige',     hex: '#D8C3A5' },
  { key: 'gray',      hex: '#8E8E8E' },
  { key: 'brown',     hex: '#6F4E37' },
  { key: 'navy',      hex: '#1F2A44' },
  { key: 'blue',      hex: '#3A6EA5' },
  { key: 'lightBlue', hex: '#A7C7E7' },
  { key: 'green',     hex: '#3E6B48' },
  { key: 'olive',     hex: '#6B6B3A' },
  { key: 'red',       hex: '#B22222' },
  { key: 'burgundy',  hex: '#6D1A36' },
  { key: 'pink',      hex: '#E8A0B4' },
  { key: 'purple',    hex: '#6A4C93' },
  { key: 'yellow',    hex: '#E9C46A' },
  { key: 'orange',    hex: '#E07A2F' },
];

/** Vision ile aynı üst sınır (en fazla 3 dominant renk) */
export const MAX_ITEM_COLORS = 3;

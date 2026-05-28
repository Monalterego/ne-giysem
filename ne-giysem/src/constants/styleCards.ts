const BASE = 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/moodboards';

function urls(prefix: string, count: number, sep = ''): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${BASE}/${encodeURIComponent(prefix)}${sep}${i + 1}.png`,
  );
}

export interface StyleCardData {
  name: string;
  keywords: [string, string, string];
  images: string[];
}

export const STYLE_CARDS: StyleCardData[] = [
  { name: 'Minimalist',          keywords: ['Sade', 'Nötr', 'Zamansız'],              images: urls('Minimalist', 4) },
  { name: 'Old Money',           keywords: ['Zarif', 'Mütevazı', 'Rafine'],           images: urls('Old Money', 4) },
  { name: 'Quiet Luxury',        keywords: ['Sessiz', 'Kaliteli', 'Şık'],             images: urls('Quiet Luxury', 4) },
  { name: 'Smart Casual',        keywords: ['Dengeli', 'Profesyonel', 'Rahat'],       images: urls('Smart Casual', 4) },
  { name: 'Clean Girl',          keywords: ['Taze', 'Bakımlı', 'Doğal'],             images: urls('Clean Girl', 8) },
  { name: 'Streetwear',          keywords: ['Kentsel', 'Cesur', 'Edgy'],              images: urls('Streetwear', 4) },
  { name: 'Athleisure',          keywords: ['Sporlu', 'Dinamik', 'Modern'],           images: urls('Athleisure', 4) },
  { name: 'Downtown Girl',       keywords: ['Şehirli', 'Cool', 'Karanlık'],           images: urls('Downtown Girl', 4) },
  { name: 'Coquette',            keywords: ['Narin', 'Pembe', 'Romantik'],            images: urls('Coquette', 4) },
  { name: 'Soft Girl',           keywords: ['Pastel', 'Masum', 'Yumuşak'],            images: urls('Soft Girl', 4) },
  { name: 'Bohemian',            keywords: ['Özgür', 'Katmanlı', 'Toprak'],           images: urls('Bohemian', 4) },
  { name: 'Cottagecore',         keywords: ['Doğal', 'Kır', 'Sıcak'],                images: urls('Cottagecore', 4) },
  { name: 'Coastal Grandmother', keywords: ['Kıyı', 'Gevşek', 'Zarif'],              images: urls('Coastal Grandmother', 4) },
  { name: 'Dark Academia',       keywords: ['Entelektüel', 'Vintage', 'Mistik'],      images: urls('Dark Academia', 4) },
  { name: 'Y2K',                 keywords: ['Metalik', 'Nostalji', 'Cesur'],          images: urls('Y2K', 4, '_') },
  { name: 'Grunge Chic',         keywords: ['İsyankar', 'Rock', 'Karanlık'],          images: urls('Grunge Chic', 4) },
  { name: 'Mob Wife',            keywords: ['Dramatik', 'Güçlü', 'Lüks'],            images: urls('Mob Wife', 4) },
  { name: 'Avant-garde',         keywords: ['Deneysel', 'Sanatsal', 'Sınır Kırıcı'], images: urls('Avant-garde', 4) },
  { name: 'Preppy',              keywords: ['Klasik', 'Temiz', 'Hazırbulunuşluk'],   images: urls('Preppy', 4) },
  { name: 'Gorpcore',            keywords: ['Dışarı', 'Fonksiyonel', 'Doğa'],        images: urls('Gorpcore', 4) },
];

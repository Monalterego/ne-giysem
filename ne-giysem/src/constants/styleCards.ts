const BASE = 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/public/moodboards';

function urls(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${BASE}/${encodeURIComponent(prefix)}${i + 1}.png`,
  );
}

export interface StyleCardData {
  name: string;
  keywords: [string, string, string];
  images: string[];
}

export const STYLE_CARDS: StyleCardData[] = [
  { name: 'Minimalist',          keywords: ['Sade', 'Nötr', 'Zamansız'],              images: urls('Minimalist', 2) },
  { name: 'Old Money',           keywords: ['Zarif', 'Mütevazı', 'Rafine'],           images: urls('Old Money', 2) },
  { name: 'Quiet Luxury',        keywords: ['Sessiz', 'Kaliteli', 'Şık'],             images: urls('Quiet Luxury', 2) },
  { name: 'Smart Casual',        keywords: ['Dengeli', 'Profesyonel', 'Rahat'],       images: urls('Smart Casual', 2) },
  { name: 'Clean Girl',          keywords: ['Taze', 'Bakımlı', 'Doğal'],             images: urls('Clean Girl', 2) },
  { name: 'Streetwear',          keywords: ['Kentsel', 'Cesur', 'Edgy'],              images: urls('Streetwear', 2) },
  { name: 'Athleisure',          keywords: ['Sporlu', 'Dinamik', 'Modern'],           images: urls('Athleisure', 2) },
  { name: 'Downtown Girl',       keywords: ['Şehirli', 'Cool', 'Karanlık'],           images: urls('Downtown Girl', 2) },
  { name: 'Coquette',            keywords: ['Narin', 'Pembe', 'Romantik'],            images: urls('Coquette', 2) },
  { name: 'Soft Girl',           keywords: ['Pastel', 'Masum', 'Yumuşak'],            images: urls('Soft Girl', 2) },
  { name: 'Bohemian',            keywords: ['Özgür', 'Katmanlı', 'Toprak'],           images: urls('Bohemian', 2) },
  { name: 'Cottagecore',         keywords: ['Doğal', 'Kır', 'Sıcak'],                images: urls('Cottagecore', 2) },
  { name: 'Coastal Grandmother', keywords: ['Kıyı', 'Gevşek', 'Zarif'],              images: urls('Coastal Grandmother', 2) },
  { name: 'Dark Academia',       keywords: ['Entelektüel', 'Vintage', 'Mistik'],      images: urls('Dark Academia', 2) },
  { name: 'Y2K',                 keywords: ['Metalik', 'Nostalji', 'Cesur'],          images: urls('Y2K', 2) },
  { name: 'Grunge Chic',         keywords: ['İsyankar', 'Rock', 'Karanlık'],          images: urls('Grunge Chic', 2) },
  { name: 'Mob Wife',            keywords: ['Dramatik', 'Güçlü', 'Lüks'],            images: urls('Mob Wife', 2) },
  { name: 'Avant-garde',         keywords: ['Deneysel', 'Sanatsal', 'Sınır Kırıcı'], images: urls('Avant-garde', 2) },
  { name: 'Preppy',              keywords: ['Klasik', 'Temiz', 'Hazırbulunuşluk'],   images: urls('Preppy', 2) },
  { name: 'Gorpcore',            keywords: ['Dışarı', 'Fonksiyonel', 'Doğa'],        images: urls('Gorpcore', 2) },
];

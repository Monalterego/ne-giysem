export interface StyleData {
  name: string;
  turkishDesc: string;
  palette: [string, string, string];
  emoji: string;
}

export interface StyleGroup {
  groupName: string;
  groupEmoji: string;
  styles: StyleData[];
}

export const STYLE_GROUPS: StyleGroup[] = [
  {
    groupName: 'Zamansız',
    groupEmoji: '🤍',
    styles: [
      {
        name: 'Minimalist',
        turkishDesc: 'Sade, nötr, temiz çizgiler',
        palette: ['#F0EFE9', '#B0AFAA', '#2C2C2C'],
        emoji: '🤍',
      },
      {
        name: 'Old Money',
        turkishDesc: 'Klasik zerafet, mütevazı lüks',
        palette: ['#C4A97D', '#7C6035', '#1E2A3A'],
        emoji: '🎩',
      },
      {
        name: 'Quiet Luxury',
        turkishDesc: 'Logosuz, kaliteli, sessiz şıklık',
        palette: ['#E6DDD3', '#C2B3A5', '#4A3F38'],
        emoji: '✨',
      },
      {
        name: 'Smart Casual',
        turkishDesc: 'İş ve günlük arası denge',
        palette: ['#1B4986', '#D6DDE8', '#4A4A4A'],
        emoji: '👔',
      },
      {
        name: 'Clean Girl',
        turkishDesc: 'Doğal, parlak, bakımlı estetik',
        palette: ['#F8E8D8', '#DEBB9B', '#B07D50'],
        emoji: '💆‍♀️',
      },
    ],
  },
  {
    groupName: 'Günlük & Rahat',
    groupEmoji: '🧡',
    styles: [
      {
        name: 'Streetwear',
        turkishDesc: 'Kentsel, cesur sokak stili',
        palette: ['#0D0D0D', '#9E9E9E', '#FF4500'],
        emoji: '🧢',
      },
      {
        name: 'Athleisure',
        turkishDesc: 'Spor giyim her yerde şık',
        palette: ['#1A1A2E', '#00C9A7', '#E8E8E8'],
        emoji: '🏃‍♀️',
      },
      {
        name: 'Downtown Girl',
        turkishDesc: 'Şehirli, karanlık, cool kadın',
        palette: ['#1C1C1C', '#C4A882', '#6B2D2D'],
        emoji: '🌆',
      },
    ],
  },
  {
    groupName: 'Feminen',
    groupEmoji: '🌸',
    styles: [
      {
        name: 'Coquette',
        turkishDesc: 'Pembe, narin, romantik feminenlik',
        palette: ['#FFB3C6', '#FF6B9D', '#FF1461'],
        emoji: '🎀',
      },
      {
        name: 'Soft Girl',
        turkishDesc: 'Pastel renkler, masum estetik',
        palette: ['#FDDDE6', '#C8A4D4', '#F9C8D4'],
        emoji: '🌷',
      },
      {
        name: 'Bohemian',
        turkishDesc: 'Özgür ruh, akışkan katmanlar',
        palette: ['#C0622D', '#D4A055', '#6B3E2E'],
        emoji: '🌻',
      },
      {
        name: 'Cottagecore',
        turkishDesc: 'Kır evi romantizmi, doğallık',
        palette: ['#7DB87D', '#E8D5B7', '#C4827A'],
        emoji: '🌿',
      },
      {
        name: 'Coastal Grandmother',
        turkishDesc: 'Kıyı şehri zarif rahatı',
        palette: ['#4A6FA5', '#F5F0E8', '#BDB5A6'],
        emoji: '⛵',
      },
    ],
  },
  {
    groupName: 'Edgy',
    groupEmoji: '🖤',
    styles: [
      {
        name: 'Dark Academia',
        turkishDesc: 'Kitap, kahve, karanlık klasizm',
        palette: ['#2C1810', '#8B4513', '#D4C5A9'],
        emoji: '📚',
      },
      {
        name: 'Y2K',
        turkishDesc: "2000'ler nostalji, metalik pembe",
        palette: ['#FF69B4', '#87CEEB', '#BF40BF'],
        emoji: '💿',
      },
      {
        name: 'Grunge Chic',
        turkishDesc: 'Karamsar ama şık isyan',
        palette: ['#1A1A1A', '#5C5C5C', '#8B1A1A'],
        emoji: '🎸',
      },
      {
        name: 'Mob Wife',
        turkishDesc: 'Çarpıcı, dramatik, kürkler',
        palette: ['#0D0D0D', '#8B7355', '#C41E3A'],
        emoji: '🐆',
      },
      {
        name: 'Avant-garde',
        turkishDesc: 'Alışılmadık, deneysel tasarım',
        palette: ['#000000', '#E8E8E8', '#FF0040'],
        emoji: '🎭',
      },
    ],
  },
  {
    groupName: 'Diğer',
    groupEmoji: '🌿',
    styles: [
      {
        name: 'Preppy',
        turkishDesc: 'Okul kulübü şıklığı, klasik',
        palette: ['#1B3A8C', '#FFFFFF', '#C41E3A'],
        emoji: '🎓',
      },
      {
        name: 'Gorpcore',
        turkishDesc: 'Outdoor, fonksiyonel, doğa stili',
        palette: ['#3D4A2E', '#D4892C', '#8B7355'],
        emoji: '🏕️',
      },
    ],
  },
];

// İsme göre hızlı erişim için flat map
export const STYLE_DATA_MAP: Record<string, StyleData> = Object.fromEntries(
  STYLE_GROUPS.flatMap((g) => g.styles).map((s) => [s.name, s]),
);

export const ALL_STYLE_DATA: StyleData[] = STYLE_GROUPS.flatMap((g) => g.styles);

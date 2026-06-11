export const OCCASIONS = [
  {
    id: 'gunluk',
    label: 'Günlük',
    description: 'Market, kahve, günlük aktiviteler. Rahat ama şık.',
    icon: 'sun',
    styleGuide: 'Rahat, pratik, şık. Jean, basic tişört, sneaker uygun. Çok resmi veya çok spor parça kullanma.',
  },
  {
    id: 'is',
    label: 'İş',
    description: 'Ofis, toplantı, profesyonel ortam.',
    icon: 'briefcase',
    styleGuide: 'Profesyonel, temiz, güvenilir. Blazer, gömlek, pantolon, kalem etek. Loafer veya topuklu. Athleisure ve spor parça kesinlikle kullanma.',
  },
  {
    id: 'brunch',
    label: 'Brunch & Kahve',
    description: 'Hafta sonu buluşması, kahve keyfi.',
    icon: 'coffee',
    styleGuide: 'Rahat ama özenli. Midi etek, bluz, loafer veya düz sandalet. Feminen ama abartısız.',
  },
  {
    id: 'gece',
    label: 'Gece & Out',
    description: 'Bar, kulüp, night out.',
    icon: 'moon',
    styleGuide: 'Çarpıcı, cesur, gece uygun. Mini etek, saten bluz, topuklu veya bot. Koyu veya parlak renkler. Gündüz parçaları kullanma.',
  },
  {
    id: 'date',
    label: 'Date',
    description: 'Romantik akşam yemeği, özel buluşma.',
    icon: 'heart',
    styleGuide: 'Feminen, romantik, özel. Midi elbise, bluz+etek, topuklu. Zarif aksesuar. Spor parça kesinlikle kullanma.',
  },
  {
    id: 'davet',
    label: 'Düğün & Davet',
    description: 'Resmi etkinlik, gala, düğün.',
    icon: 'star',
    styleGuide: 'Şık, resmi, gösterişli. Maxi veya midi elbise, takım elbise. En özel parçaları kullan. Topuklu zorunlu.',
  },
  {
    id: 'spor',
    label: 'Spor & Aktif',
    description: 'Spor, yürüyüş, aktif gün.',
    icon: 'activity',
    styleGuide: 'Fonksiyonel, rahat, aktif. Tayt, spor tişört, hoodie. Sneaker zorunlu. Topuklu, blazer, resmi parça kullanma.',
  },
  {
    id: 'seyahat',
    label: 'Seyahat',
    description: 'Havalimanı, şehir turu, uzun yolculuk.',
    icon: 'map-pin',
    styleGuide: 'Rahat ama şık, pratik. Geniş paça pantolon, sneaker veya loafer, katmanlı giyim. Çok resmi veya çok dar parça kullanma.',
  },
  {
    id: 'tatil',
    label: 'Tatil & Plaj',
    description: 'Sahil, tatil, yazlık gezinti. Ferah ve rahat.',
    icon: 'umbrella',
    styleGuide: 'Ferah, hafif, yazlık. Keten gömlek, hafif elbise, şort, sandalet, hasır şapka ve çanta. Blazer, topuklu, bot, kalın kumaş kullanma.',
  },
] as const;

export type OccasionId = typeof OCCASIONS[number]['id'];

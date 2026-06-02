export type StyleCategory =
  | 'minimalist'
  | 'streetwear'
  | 'old_money'
  | 'smart_casual'
  | 'bohemian'
  | 'athleisure'
  | 'avant_garde';

export type ClothingCategory =
  | 'upper'
  | 'lower'
  | 'dress_jumpsuit'
  | 'outer'
  | 'shoes'
  | 'bag'
  | 'accessory';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export type Fabric =
  // İngilizce kanonik (eski kayıtlar için backwards compat)
  | 'cotton' | 'linen' | 'denim' | 'silk' | 'wool' | 'polyester'
  | 'viscose' | 'satin' | 'velvet' | 'blend' | 'unknown'
  // Türkçe değerler (yeni kayıtlar + vision AI çıktısı)
  | 'pamuk' | 'keten' | 'viskon' | 'yun' | 'kasmir' | 'ipek'
  | 'saten' | 'kadife' | 'deri' | 'suni_deri' | 'triko' | 'sifon'
  | 'karisim' | 'bilmiyorum';

export interface WardrobeItem {
  id: string;
  userId: string;
  originalImageUrl: string;
  processedImageUrl: string;
  category: ClothingCategory;
  subCategory?: string;
  colors: string[];
  pattern?: string;
  fabric?: Fabric;
  seasons: Season[];
  brand?: string;
  price?: number;
  // AI-detected detail fields
  itemName?: string;
  fit?: string;
  neckline?: string;
  sleeveLength?: string;
  details?: string[];
  createdAt: string;
}

export interface StyleProfile {
  styles: { name: string; weight: number }[];
  colorPalette: string[];
  tags?: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  styleProfile?: StyleProfile;
  isPremium: boolean;
  createdAt: string;
  // Fiziki profil (onboarding sırasında doldurulur)
  height?: number;
  age?: number;
  bodyType?: string;
  skinTone?: string;
  hairColor?: string;
  hairLength?: string;
  hairType?: string;
}

export interface Combo {
  id: string;
  items: WardrobeItem[];
  suggestedItems?: WardrobeItem[];
  score: number;
  occasion?: string;
  label: string;
  reasoning?: string;
  createdAt: string;
}

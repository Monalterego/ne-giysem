export type StyleCategory =
  | 'minimalist'
  | 'streetwear'
  | 'old_money'
  | 'smart_casual'
  | 'bohemian'
  | 'athleisure'
  | 'avant_garde';

export type ClothingCategory = 'upper' | 'lower' | 'outer' | 'shoes' | 'accessory';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export type Fabric =
  | 'cotton'
  | 'linen'
  | 'denim'
  | 'silk'
  | 'wool'
  | 'polyester'
  | 'viscose'
  | 'satin'
  | 'velvet'
  | 'blend'
  | 'unknown';

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
}

export interface Combo {
  id: string;
  items: WardrobeItem[];
  score: number;
  occasion?: string;
  label: string;
  createdAt: string;
}

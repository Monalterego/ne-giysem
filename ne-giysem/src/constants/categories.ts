import type { ClothingCategory } from '../types';
import { t } from '../i18n';

export interface SubCategoryEntry {
  label: string;
  value: string;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  subcategories: SubCategoryEntry[];
}

export const CATEGORY_META: Record<ClothingCategory, CategoryMeta> = {
  upper: {
    label: 'Üst',
    icon: 'shirt-outline',
    subcategories: [
      { label: 'Tişört',      value: 'tisort'      },
      { label: 'Bluz',        value: 'bluz'        },
      { label: 'Gömlek',      value: 'gomlek'      },
      { label: 'Kazak',       value: 'kazak'       },
      { label: 'Triko',       value: 'triko'       },
      { label: 'Hırka',       value: 'hirka'       },
      { label: 'Yelek',       value: 'yelek'       },
      { label: 'Sweatshirt',  value: 'sweatshirt'  },
      { label: 'Hoodie',      value: 'hoodie'      },
      { label: 'Body',        value: 'body'        },
    ],
  },
  lower: {
    label: 'Alt',
    icon: 'reorder-two-outline',
    subcategories: [
      { label: 'Pantolon', value: 'pantolon' },
      { label: 'Jean',     value: 'jean'     },
      { label: 'Etek',     value: 'etek'     },
      { label: 'Şort',     value: 'sort'     },
      { label: 'Tayt',     value: 'tayt'     },
    ],
  },
  dress_jumpsuit: {
    label: 'Elbise & Tulum',
    icon: 'person-outline',
    subcategories: [
      { label: 'Mini Elbise', value: 'mini_elbise' },
      { label: 'Midi Elbise', value: 'midi_elbise' },
      { label: 'Maxi Elbise', value: 'maxi_elbise' },
      { label: 'Tulum',       value: 'tulum'       },
    ],
  },
  outer: {
    label: 'Dış Giyim',
    icon: 'layers-outline',
    subcategories: [
      { label: 'Ceket',      value: 'ceket'      },
      { label: 'Blazer',     value: 'blazer'     },
      { label: 'Mont',       value: 'mont'       },
      { label: 'Kaban',      value: 'kaban'      },
      { label: 'Trençkot',   value: 'trenchkot'  },
      { label: 'Yağmurluk',  value: 'yagmurluk'  },
    ],
  },
  shoes: {
    label: 'Ayakkabı',
    icon: 'walk-outline',
    subcategories: [
      { label: 'Sneaker',  value: 'sneaker'  },
      { label: 'Loafer',   value: 'loafer'   },
      { label: 'Bot',      value: 'bot'      },
      { label: 'Çizme',    value: 'cizme'    },
      { label: 'Topuklu',  value: 'topuklu'  },
      { label: 'Sandalet', value: 'sandalet' },
      { label: 'Terlik',   value: 'terlik'   },
      { label: 'Babet',    value: 'babet'    },
    ],
  },
  bag: {
    label: 'Çanta',
    icon: 'bag-outline',
    subcategories: [
      { label: 'Omuz Çantası', value: 'omuz_cantasi' },
      { label: 'Clutch',       value: 'clutch'       },
      { label: 'Tote',         value: 'tote'         },
      { label: 'Bel Çantası',  value: 'bel_cantasi'  },
      { label: 'Sırt Çantası', value: 'sirt_cantasi' },
      { label: 'Mini Çanta',   value: 'mini_canta'   },
    ],
  },
  accessory: {
    label: 'Aksesuar',
    icon: 'diamond-outline',
    subcategories: [
      { label: 'Kolye',    value: 'kolye'    },
      { label: 'Küpe',     value: 'kupe'     },
      { label: 'Bileklik', value: 'bileklik' },
      { label: 'Yüzük',   value: 'yuzuk'    },
      { label: 'Fular',    value: 'fular'    },
      { label: 'Kaşkol',  value: 'kaskol'   },
      { label: 'Bandana',  value: 'bandana'  },
      { label: 'Kemer',    value: 'kemer'    },
      { label: 'Şapka',    value: 'sapka'    },
      { label: 'Gözlük',  value: 'gozluk'   },
    ],
  },
};

export const CATEGORY_ORDER: ClothingCategory[] = [
  'upper', 'lower', 'dress_jumpsuit', 'outer', 'shoes', 'bag', 'accessory',
];

/** Kanonik kategori value'sundan çevrilmiş etiket. Örn: catLabel('upper') → 'Top'/'Üst' */
export function catLabel(value: string): string {
  return t(`cat.${value}`, { defaultValue: value });  // anahtar yoksa ham value döner
}

/** Kanonik alt-kategori value'sundan çevrilmiş etiket. Örn: subcatLabel('bluz') → 'Blouse'/'Bluz' */
export function subcatLabel(value: string): string {
  return t(`subcat.${value}`, { defaultValue: value });  // anahtar yoksa ham value döner
}

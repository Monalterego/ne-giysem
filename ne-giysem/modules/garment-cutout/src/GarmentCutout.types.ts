// Kesim desteklenmiyor nedeni:
//   'os'               iOS 17 altı (Vision VNGenerateForegroundInstanceMaskRequest yok)
//   'simulator'        iOS simülatörü (Vision kesimi çalışmıyor)
//   'no-play-services' Android'de Google Play hizmetleri yok / güncel değil (ML Kit modeli oradan iner)
//   'no-module'        native modül bu binary'de yok (Expo Go, web, eski build)
//   'error'            destek kontrolü hata verdi
export type CutoutUnsupportedReason = 'os' | 'simulator' | 'no-play-services' | 'no-module' | 'error';

export type CutoutSupport =
  | { supported: true }
  | { supported: false; reason: CutoutUnsupportedReason };

/** Beyaz zemin JPEG, uygulama cache'inde (file://). Kayıttan / vazgeçmeden sonra silinmeli. */
export type CutoutResult = { uri: string; width: number; height: number };

/** Native red kodları (Promise reject) */
export const CutoutErrorCode = {
  /** Android: ML Kit modeli Play hizmetlerinden henüz inmedi — sonra yeniden denenebilir */
  modelDownloading: 'ERR_MODEL_DOWNLOADING',
  unsupported:      'ERR_UNSUPPORTED',
  failed:           'ERR_CUTOUT',
} as const;

import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { CutoutResult, CutoutSupport } from './GarmentCutout.types';

declare class GarmentCutoutModule extends NativeModule<Record<never, never>> {
  isSupported(): Promise<CutoutSupport>;
  /** Özne bulunamazsa null */
  cutout(uri: string): Promise<CutoutResult | null>;
  /** Saydam PNG → beyaz zemin JPEG */
  flattenOnWhite(uri: string): Promise<CutoutResult>;
}

// Modül yoksa (Expo Go, web, modülsüz eski binary) null — çağıranlar "desteklenmiyor" sayar
export default requireOptionalNativeModule<GarmentCutoutModule>('GarmentCutout');

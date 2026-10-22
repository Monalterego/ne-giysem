import { Alert, InteractionManager } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Picker sonrası Alert. iOS'ta galeri (PHPicker) promise'i sayfa kapanma animasyonu
 * bitmeden çözülür; o anda gelen Alert.alert sunulamaz ve SESSİZCE düşer. Etkileşim
 * + kısa gecikme sonrası göster ki kullanıcı açıklamasız kalmasın.
 */
export function alertAfterPicker(title: string, message: string): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => Alert.alert(title, message), 350);
  });
}

// ─── Yükleme öncesi görsel normalizasyonu (Upload + Scan ortak) ──────────────
// Galeri HEIC / 12–48 MP verebilir; Poof yalnızca PNG/JPG/WEBP kabul eder ve proxy'ler
// base64'ü MAX_IMAGE_B64 ile sınırlar. Her görsel yapay zekâ yoluna girmeden önce:
//   uzun kenar ≤ 1400 px (küçükse büyütülmez) + JPEG + base64.
// Picker'ın kendi base64'ü KULLANILMAZ: galeride tam çözünürlüklü (MB'larca) olabilir.

export const MAX_EDGE = 1400;
/** bg-removal-proxy / anthropic-proxy MAX_IMAGE_B64 ile aynı (sunucuda 413) */
export const MAX_UPLOAD_B64 = 2_000_000;
// Sınır aşılırsa ikinci deneme
const FALLBACK_EDGE = 1000;

export type ImagePrepReason = 'manipulate-failed' | 'no-base64' | 'too-large';

export class ImagePrepError extends Error {
  constructor(public readonly reason: ImagePrepReason, detail: string) {
    super(`image-prep ${reason}: ${detail}`);
    this.name = 'ImagePrepError';
  }
}

/** Uzun kenarı `edge`'e indiren resize; boyut bilinmiyorsa genişliğe göre, küçükse hiç */
function resizeAction(edge: number, width?: number, height?: number): ImageManipulator.Action[] {
  if (!width || !height) return [{ resize: { width: edge } }];
  if (Math.max(width, height) <= edge) return [];
  return [{ resize: width >= height ? { width: edge } : { height: edge } }];
}

async function render(
  uri: string, actions: ImageManipulator.Action[], compress: number,
): Promise<ImageManipulator.ImageResult> {
  try {
    return await ImageManipulator.manipulateAsync(uri, actions, {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
  } catch (e) {
    console.warn('[imageNormalize] manipulateAsync başarısız', { uri: uri.slice(0, 80), actions }, e);
    throw new ImagePrepError('manipulate-failed', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Görseli JPEG + uzun kenar ≤ 1400 + base64'e çevirir. Hata ya da sınır aşımında
 * ImagePrepError fırlatır — çağıran kullanıcıya mesaj gösterir, sessizce dönmez.
 */
export async function toUploadJpeg(
  uri: string, width?: number, height?: number,
): Promise<{ uri: string; base64: string; width: number; height: number }> {
  let out = await render(uri, resizeAction(MAX_EDGE, width, height), 0.85);
  if (!out.base64) {
    console.warn('[imageNormalize] base64 dönmedi', { uri: uri.slice(0, 80), w: out.width, h: out.height });
    throw new ImagePrepError('no-base64', `${out.width}x${out.height}`);
  }

  if (out.base64.length > MAX_UPLOAD_B64) {
    console.warn('[imageNormalize] sınır aşıldı, küçültülüyor', { len: out.base64.length, w: out.width, h: out.height });
    out = await render(out.uri, resizeAction(FALLBACK_EDGE, out.width, out.height), 0.7);
    if (!out.base64) throw new ImagePrepError('no-base64', `${out.width}x${out.height} (2)`);
    if (out.base64.length > MAX_UPLOAD_B64) {
      console.warn('[imageNormalize] ikinci denemede de sınır aşıldı', { len: out.base64.length });
      throw new ImagePrepError('too-large', String(out.base64.length));
    }
  }

  console.log('[imageNormalize] hazır', {
    in: width && height ? `${width}x${height}` : '?', out: `${out.width}x${out.height}`, b64: out.base64.length,
  });
  return { uri: out.uri, base64: out.base64, width: out.width, height: out.height };
}

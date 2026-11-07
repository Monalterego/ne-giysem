import { callEdge, edgeError, EdgeError, isAiConsentError } from './edgeFunctions';
import { withAiReconsent } from './aiConsent';
import { useConsentStore } from '../store/useConsentStore';
import { toUploadJpeg } from '../utils/imageNormalize';
import {
  cutoutSupport, cutoutGarment, flattenOnWhite, hasCutoutModule,
} from '../../modules/garment-cutout';

// ─── Kıyafet görseli: FASHN packshot + cihaz üstü kesim (adım 8-10) ──────────
// Packshot: garment-image edge function (kota, iade ve FASHN orada). FASHN
// background-remove hiçbir dalda yok; packshot olmazsa cihaz kesimi, o da yoksa
// olduğu gibi. Görsel hiçbir yolda storage'a geçici dosya olarak yazılmaz.

const POLL_MS             = 2_000;
// Packshot süresi belgelenmedi — değer önerisi; geç gelen sonuç yok sayılır
const PACKSHOT_TIMEOUT_MS = 90_000;

export type PackshotOutcome =
  /** JPEG base64 (önek yok) */
  | { kind: 'ok'; base64: string }
  /** Packshot hakkı doldu (402) — yenilenince "stüdyo kalitesine yükselt" */
  | { kind: 'quota'; limit: number | null; resetAt: string | null }
  /** Başarısız / içerik denetimi / zaman aşımı / ağ — sunucu hakkı iade etti (zaman aşımı hariç) */
  | { kind: 'failed'; reason: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Packshot iste ve sonucu bekle. Hata fırlatmaz — her durum PackshotOutcome.
 * İzin metni eskiyse güncel metin sorulur (withAiReconsent), onaylanırsa yeniden denenir.
 */
export async function requestPackshot(
  input: { imageB64: string } | { itemId: string },
): Promise<PackshotOutcome> {
  let jobId: string;
  try {
    const res = await withAiReconsent(async () => {
      const r = await callEdge('garment-image', {
        action: 'start',
        ...('imageB64' in input ? { image_b64: input.imageB64 } : { item_id: input.itemId }),
      });
      if (r.status === 402 || r.ok) return r;   // 402 = kota doldu (hata değil)
      throw await edgeError(r);
    });
    const body = await res.json().catch(() => ({})) as {
      job_id?: string; limit?: number | null; reset_at?: string | null;
    };
    if (res.status === 402) {
      return { kind: 'quota', limit: body.limit ?? null, resetAt: body.reset_at ?? null };
    }
    if (!body.job_id) return { kind: 'failed', reason: 'no-job-id' };
    jobId = body.job_id;
  } catch (err) {
    // İzin başka yerde geri çekilmiş → yerel durumu tazele; parça kesimle kaydedilir
    if (isAiConsentError(err)) useConsentStore.getState().refresh();
    return { kind: 'failed', reason: err instanceof EdgeError ? err.code : 'network' };
  }

  const deadline = Date.now() + PACKSHOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    let res: Response;
    try {
      res = await callEdge('garment-image', { action: 'status', job_id: jobId });
    } catch {
      continue;   // geçici ağ kopması — deadline'a kadar yokla
    }
    if (!res.ok) {
      if (res.status >= 500) continue;   // sunucu iade etmez, iş sürüyor olabilir
      return { kind: 'failed', reason: (await edgeError(res)).code };
    }
    const s = await res.json().catch(() => null) as {
      status?: string; image_b64?: string; mime?: string; error?: { name?: string | null };
    } | null;
    if (s?.status === 'completed' && typeof s.image_b64 === 'string' && s.image_b64) {
      try {
        return { kind: 'ok', base64: await toJpegBase64(s.image_b64, s.mime ?? 'image/jpeg') };
      } catch (err) {
        console.warn('[packshot] çıktı JPEG\'e çevrilemedi:', err);
        return { kind: 'failed', reason: 'convert' };
      }
    }
    if (s?.status === 'failed') {
      // ContentModerationError (mayo, iç giyim) dahil — sunucu hakkı iade etti
      return { kind: 'failed', reason: s.error?.name ?? 'failed' };
    }
  }
  return { kind: 'failed', reason: 'timeout' };
}

/** Packshot çıktısı → JPEG base64. Saydamlık varsa (PNG/WebP) beyaz zemine birleştirilir. */
async function toJpegBase64(b64: string, mime: string): Promise<string> {
  if (mime === 'image/jpeg') return b64;
  const dataUri = `data:${mime};base64,${b64}`;
  if (hasCutoutModule) {
    const flat = await flattenOnWhite(dataUri);
    return (await toUploadJpeg(flat.uri, flat.width, flat.height)).base64;
  }
  // Modülsüz binary (eski build / web): manipulator doğrudan JPEG'e çevirir — saydam
  // alanların rengi platforma bağlı
  console.warn('[packshot] saydam çıktı, flattenOnWhite yok → doğrudan JPEG');
  return (await toUploadJpeg(dataUri)).base64;
}

/**
 * Cihaz üstü kesim → JPEG base64 (beyaz zemin). Desteklenmiyor / özne yok / hata → null.
 * Görsel cihazdan çıkmaz (yapay zekâ izni gerekmez).
 */
export async function cutoutToJpegBase64(
  uri: string,
): Promise<string | null> {
  const support = await cutoutSupport();
  if (!support.supported) {
    console.log('[cutout] desteklenmiyor:', support.reason);
    return null;
  }
  try {
    const out = await cutoutGarment(uri);
    if (!out) {
      console.log('[cutout] özne bulunamadı');
      return null;
    }
    return (await toUploadJpeg(out.uri, out.width, out.height)).base64;
  } catch (err) {
    // Android ERR_MODEL_DOWNLOADING dahil — olduğu gibi kaydedilir
    console.warn('[cutout] başarısız:', (err as { code?: string })?.code ?? err);
    return null;
  }
}

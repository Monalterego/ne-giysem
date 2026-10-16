import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Private storage görselleri ──────────────────────────────────────────────
// DB'de bucket içi yol saklanır (<uid>/<dosya>). Eski kayıtlarda tam public URL
// olabilir — ikisi de kabul edilir. Görüntüleme için 1 saatlik signed URL,
// FASHN'a giden görseller için 10 dakikalık (FASHN gönderilen URL'leri saklıyor).

export type PrivateBucket = 'avatars' | 'wardrobe-items' | 'mannequin-cache';

const OBJECT_BASE = 'https://bdvrgbylirftuxmrpbea.supabase.co/storage/v1/object/';

const DISPLAY_TTL_S     = 60 * 60;          // görüntüleme
const FASHN_TTL_S       = 10 * 60;          // FASHN'a giden
const REFRESH_MARGIN_MS = 5 * 60 * 1000;    // bitişe 5 dk kala yenile

type Entry = { url: string; expiresAt: number };

// `${bucket}/${path}` → imzalı URL
const cache    = new Map<string, Entry>();
// Aynı anda iki ekran aynı yolu istemesin — süren imzalama sözü
const inflight = new Map<string, Promise<void>>();

const keyOf  = (bucket: PrivateBucket, path: string) => `${bucket}/${path}`;
const isData = (v: string) => /^data:/i.test(v);
const isHttp = (v: string) => /^https?:\/\//i.test(v);
const fresh  = (e?: Entry) => !!e && e.expiresAt - REFRESH_MARGIN_MS > Date.now();

/**
 * DB değeri → bucket içi yol + varsa sorgu (örn. avatar'ın ?v= sürümü).
 * Bizim storage'ımızda değilse (data:, cdn.fashn.ai, başka bucket, boş) → null.
 */
function stripToRef(bucket: PrivateBucket, value: string | null | undefined): string | null {
  if (!value || isData(value)) return null;
  if (!isHttp(value)) return value;   // yeni kayıt: zaten yol
  for (const kind of ['public', 'sign']) {
    const prefix = `${OBJECT_BASE}${kind}/${bucket}/`;
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return null;                        // harici URL
}

/** DB değeri → imzalanacak yol (sorgusuz). Bizim storage'ımızda değilse null. */
export function toStoragePath(bucket: PrivateBucket, value: string | null | undefined): string | null {
  const ref = stripToRef(bucket, value);
  return ref ? ref.split('?')[0] : null;
}

/**
 * Toplu imzala: önbellekte taze olmayan yollar TEK createSignedUrls çağrısıyla.
 * Başka bir çağrının zaten imzalamakta olduğu yollar için o çağrı beklenir.
 * Döner: önbellekte yeni bir şey oldu mu (yeniden çizim gerekir mi).
 */
export async function signImages(
  bucket: PrivateBucket,
  values: (string | null | undefined)[],
): Promise<boolean> {
  const paths = [...new Set(values.map((v) => toStoragePath(bucket, v)).filter((p): p is string => !!p))];
  const waitFor: Promise<void>[] = [];
  const toSign: string[] = [];
  for (const p of paths) {
    const k = keyOf(bucket, p);
    if (fresh(cache.get(k))) continue;
    const pending = inflight.get(k);
    if (pending) waitFor.push(pending);
    else toSign.push(p);
  }
  if (!toSign.length && !waitFor.length) return false;

  if (toSign.length) {
    const job = (async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(toSign, DISPLAY_TTL_S);
      if (error) { console.warn(`[storage] ${bucket} imzalanamadı:`, error.message); return; }
      const expiresAt = Date.now() + DISPLAY_TTL_S * 1000;
      for (const r of data ?? []) {
        if (r.path && r.signedUrl && !r.error) cache.set(keyOf(bucket, r.path), { url: r.signedUrl, expiresAt });
        else if (r.error) console.warn(`[storage] ${bucket}/${r.path}:`, r.error);
      }
    })();
    for (const p of toSign) inflight.set(keyOf(bucket, p), job);
    waitFor.push(job.finally(() => { for (const p of toSign) inflight.delete(keyOf(bucket, p)); }));
  }
  await Promise.all(waitFor);
  return true;
}

/**
 * expo-image kaynağı (senkron, önbellekten). cacheKey = bucket/yol(+?v=) — imzalı
 * URL'nin token'ı her saat değişse de disk önbelleği korunur.
 * Henüz imzalanmamış eski public URL olduğu gibi döner (bucket public iken çalışır).
 */
export function imageSource(
  bucket: PrivateBucket,
  value: string | null | undefined,
): { uri: string; cacheKey?: string } | undefined {
  if (!value) return undefined;
  if (isData(value)) return { uri: value };
  const ref = stripToRef(bucket, value);
  if (!ref) return isHttp(value) ? { uri: value } : undefined;   // harici (cdn.fashn.ai)
  const cacheKey = `${bucket}/${ref}`;
  const hit = cache.get(keyOf(bucket, ref.split('?')[0]));
  if (hit) return { uri: hit.url, cacheKey };
  if (isHttp(value)) return { uri: value, cacheKey };
  return undefined;
}

// ─── Dolap parçası kısayolları ───────────────────────────────────────────────

type ItemImages = { thumbUrl?: string; processedImageUrl: string };

/** Liste/kart: varsa thumbnail, yoksa asıl görsel */
export const itemThumbSource = (i: ItemImages) =>
  imageSource('wardrobe-items', i.thumbUrl ?? i.processedImageUrl);

/** Lightbox/detay: asıl görsel */
export const itemImageSource = (i: ItemImages) =>
  imageSource('wardrobe-items', i.processedImageUrl);

/** Bir ekrandaki parçaların imzalanacak tüm değerleri (tek createSignedUrls için) */
export const itemImageRefs = (items: ItemImages[]) =>
  items.flatMap((i) => [i.thumbUrl, i.processedImageUrl]);

/** Görüntüleme için tek imzalı URL (lightbox, paylaşım vb.). Önbellekten ya da imzalayarak. */
export async function displayUrl(bucket: PrivateBucket, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  await signImages(bucket, [value]);
  return imageSource(bucket, value)?.uri ?? null;
}

/**
 * Ekran kancası: verilen değerleri tek çağrıda imzalar, bitişe 5 dk kala yeniler.
 * Döner: sürüm sayacı — memo'lu bileşenlere prop olarak geçirilirse yeni URL'lerle çizilir.
 */
export function useSignedImages(bucket: PrivateBucket, values: (string | null | undefined)[]): number {
  const [version, setVersion] = useState(0);
  const depKey = values.filter(Boolean).join('|');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const changed = await signImages(bucket, values);
      if (cancelled) return;
      if (changed) setVersion((v) => v + 1);

      // En erken bitecek imzanın 5 dk öncesinde yeniden çalış
      let earliest = Infinity;
      for (const v of values) {
        const p = toStoragePath(bucket, v);
        const e = p ? cache.get(keyOf(bucket, p)) : undefined;
        if (e) earliest = Math.min(earliest, e.expiresAt - REFRESH_MARGIN_MS);
      }
      if (earliest !== Infinity) timer = setTimeout(run, Math.max(earliest - Date.now(), 30_000));
    };
    run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // values içeriği depKey ile temsil ediliyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, depKey]);

  return version;
}

/**
 * FASHN'a gidecek görsel: 10 dk'lık tek kullanımlık imza (önbelleğe alınmaz).
 * Harici URL (önceki katmanın FASHN çıktısı) olduğu gibi döner.
 */
export async function signedUrlForFashn(bucket: PrivateBucket, value: string | null | undefined): Promise<string> {
  const path = toStoragePath(bucket, value);
  if (!path) {
    if (value && isHttp(value)) return value;
    throw new Error(`image-ref-invalid:${bucket}`);
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, FASHN_TTL_S);
  if (error || !data?.signedUrl) throw new Error(`sign-failed:${bucket}:${error?.message ?? ''}`);
  return data.signedUrl;
}

/**
 * Nesne var mı? storage-js 2.105.4 `exists`: kimlikli HEAD /object/<bucket>/<yol>
 * (private bucket'ta da çalışır); 400/404 → false, diğer hatalarda fırlatır → false sayılır.
 */
export async function storageExists(bucket: PrivateBucket, value: string | null | undefined): Promise<boolean> {
  const path = toStoragePath(bucket, value);
  if (!path) return false;
  try {
    const { data } = await supabase.storage.from(bucket).exists(path);
    return data === true;
  } catch {
    return false;
  }
}

/** Çıkışta: başka kullanıcının imzalı URL'leri bellekte kalmasın. */
export function clearSignedUrlCache(): void {
  cache.clear();
}

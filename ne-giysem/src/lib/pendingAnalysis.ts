import type { VisionResult } from '../utils/visionAnalysis';

// ─── Ekleme ekranında erken başlatılan kıyafet analizi ───────────────────────
// Claude analizi orijinal fotoğraf üzerinde, packshot ve cihaz kesimiyle paralel
// başlar (UploadScreen); sonucu UploadDetail anahtarla alır. Promise navigasyon
// parametresine konamadığı için tek yuvalı modül değişkeni. Yuva yeni seçimde ya da
// discardAnalysis ile boşalır (take boşaltmaz: StrictMode'da efekt iki kez çalışabilir).

let slot: { key: string; promise: Promise<VisionResult> } | null = null;

export function startAnalysis(key: string, run: () => Promise<VisionResult>): void {
  const promise = run();
  promise.catch(() => { /* hata alanın (UploadDetail) işi — yakalanmamış uyarısı olmasın */ });
  slot = { key, promise };
}

/** Bu anahtarla başlatılmış analiz; yoksa null (çağıran kendisi analiz eder) */
export function takeAnalysis(key: string | undefined): Promise<VisionResult> | null {
  return key && slot?.key === key ? slot.promise : null;
}

export function discardAnalysis(): void {
  slot = null;
}

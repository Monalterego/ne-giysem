import { navigationRef } from '../navigation/navigationRef';
import { useConsentStore, aiStatus } from '../store/useConsentStore';

// ─── Yapay zekâ izni (Apple 5.1.2(i)) ────────────────────────────────────────
// İlk kıyafet eklemeden / ilk "Uyar mı?" taramasından önce tam ekran AiConsent
// açılır; ekran kararı resolveAiConsent ile geri bildirir.
//   'granted'   → İzin ver
//   'declined'  → Şimdi değil (kaydedildi; elle akış / tarama kapalı)
//   'dismissed' → karar verilmeden kapandı (kayıt yok; işlem iptal)

export type AiConsentResult = 'granted' | 'declined' | 'dismissed';

let pending: ((r: AiConsentResult) => void) | null = null;

/** Ekran kapanırken bir kez çağrılır */
export function resolveAiConsent(result: AiConsentResult): void {
  const cb = pending;
  pending = null;
  cb?.(result);
}

/** İzin ekranını aç ve kararı bekle (Profil → Gizlilik'ten de) */
export function openAiConsent(): Promise<AiConsentResult> {
  if (!navigationRef.isReady()) return Promise.resolve('dismissed');
  resolveAiConsent('dismissed');   // önceki bekleyen varsa kapat
  return new Promise((resolve) => {
    pending = resolve;
    navigationRef.navigate('AiConsent');
  });
}

/**
 * Yükleme / tarama öncesi: karar zaten verilmişse ekranı açmadan döner.
 * Rıza durumu okunamadıysa önce bir kez okumayı dener; yine okunamazsa ekran açılır
 * (yanlışlıkla izin varsayılmaz — sunucu da 403 ile korur).
 */
export async function ensureAiDecision(): Promise<AiConsentResult> {
  const store = useConsentStore.getState();
  if (!store.loaded) await store.refresh();
  const status = aiStatus(useConsentStore.getState().records);
  if (status === 'granted')  return 'granted';
  if (status === 'declined') return 'declined';
  return openAiConsent();
}

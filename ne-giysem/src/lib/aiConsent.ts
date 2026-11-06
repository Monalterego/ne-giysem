import { navigationRef } from '../navigation/navigationRef';
import { useConsentStore, aiStatus, needsAiReconsent } from '../store/useConsentStore';
import { EdgeError, isConsentOutdatedError } from './edgeFunctions';

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

/**
 * Yapay zekâ çağrısı (bg-removal-proxy / anthropic-proxy). Sunucu onaylanan metni eski
 * bulursa (403 consent-version-outdated) güncel metinle izin ekranı açılır; onay
 * verilirse çağrı BİR KEZ yeniden yapılır (işlem kaldığı yerden sürer). Onay verilmezse
 * 'ai-consent-required' fırlatılır → çağıranın mevcut "izin yok" yolu (elle akış /
 * tarama kapalı) çalışır.
 */
export async function withAiReconsent<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!isConsentOutdatedError(err)) throw err;
    await useConsentStore.getState().refresh();
    const decision = await openAiConsent();
    if (decision !== 'granted') throw new EdgeError(403, 'ai-consent-required');
    return call();
  }
}

// Açılışta bir kez sorulur — "Şimdi değil" kaydedilir; karar verilmeden kapatılırsa
// bu oturumda yeniden açılmaz (ilk ekleme / taramada ensureAiDecision yine sorar)
let launchPromptShown = false;

/**
 * Uygulama açılışı: izin verilmiş ama onaylanan metnin ana sürümü eskiyse güncel
 * metni göster (Main yığını hazırken çağrılır — AiConsent ekranı orada).
 */
export function promptAiReconsentOnLaunch(): void {
  if (launchPromptShown) return;
  const { loaded, records } = useConsentStore.getState();
  if (!loaded || !needsAiReconsent(records)) return;
  launchPromptShown = true;
  void openAiConsent();
}

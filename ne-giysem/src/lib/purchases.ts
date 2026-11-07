import { NativeModules, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../constants/premium';

// ─── RevenueCat SDK sarmalayıcısı — GÜVENLİK AĞI ─────────────────────────────
// Bu dosya OTA ile react-native-purchases native modülü OLMAYAN build'lere de gidebilir.
// SDK modülü üst seviyede NativeEventEmitter kurduğu için native modül yokken statik
// import açılışta çökertebilir → yalnızca native modül varsa ve try/catch içinde require.
// Native modül yoksa / anahtar tanımsızsa / configure hata verirse: available() = false,
// tüm çağrılar 'unavailable' döner, uygulama çalışmaya devam eder.
//
// Plan ve limitlerin kaynağı SUNUCU (get_usage) — buradaki CustomerInfo karar vermez.

type PurchasesModule = typeof import('react-native-purchases');
type PurchasesSdk = PurchasesModule['default'];

let sdk: PurchasesSdk | null = null;
let errorCodes: PurchasesModule['PURCHASES_ERROR_CODE'] | null = null;
// iOS deneme uygunluğu "uygun" değeri (INTRO_ELIGIBILITY_STATUS); yüklenemezse null → deneme yok
let eligibleStatus: number | null = null;
let configured = false;

/** Public SDK anahtarı (EAS env → bundle'a gömülür). Statik erişim şart: Expo inline eder. */
function apiKey(): string | null {
  const key = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
      : undefined;
  return key && key.trim().length > 0 ? key.trim() : null;
}

function loadSdk(): PurchasesSdk | null {
  if (sdk) return sdk;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  // Native modül bu build'de yoksa SDK'yı hiç yükleme (Expo Go "preview" moduna da düşmesin)
  if (!NativeModules.RNPurchases) return null;
  try {
    const mod = require('react-native-purchases') as PurchasesModule;
    sdk = mod.default;
    errorCodes = mod.PURCHASES_ERROR_CODE ?? null;
    eligibleStatus = mod.INTRO_ELIGIBILITY_STATUS?.INTRO_ELIGIBILITY_STATUS_ELIGIBLE ?? null;
    return sdk;
  } catch (e) {
    console.warn('[purchases] SDK yüklenemedi:', e);
    return null;
  }
}

/** Açılışta bir kez. Başarısızsa false — premium satın alma "şu an kullanılamıyor". */
export function configurePurchases(): boolean {
  if (configured) return true;
  const key = apiKey();
  const p = loadSdk();
  if (!key || !p) {
    console.warn(`[purchases] devre dışı — ${!key ? 'anahtar yok' : 'native modül yok'}`);
    return false;
  }
  try {
    p.configure({ apiKey: key });
    configured = true;
  } catch (e) {
    console.warn('[purchases] configure başarısız:', e);
  }
  return configured;
}

/** Satın alma / geri yükleme bu cihazda yapılabilir mi? */
export function purchasesAvailable(): boolean {
  return configured && sdk !== null;
}

/** Oturum açıldı → RevenueCat app_user_id = Supabase uid (webhook bu kimliği bekler). */
export async function identifyPurchaser(uid: string): Promise<void> {
  if (!purchasesAvailable()) return;
  try {
    await sdk!.logIn(uid);
  } catch (e) {
    console.warn('[purchases] logIn başarısız:', e);
  }
}

/** Çıkış / hesap silme → anonim kullanıcıya dön. Anonimken logOut hata verir → atla. */
export async function resetPurchaser(): Promise<void> {
  if (!purchasesAvailable()) return;
  try {
    if (!(await sdk!.isAnonymous())) await sdk!.logOut();
  } catch (e) {
    console.warn('[purchases] logOut başarısız:', e);
  }
}

export interface PaywallPackages {
  monthly: PurchasesPackage | null;
  annual:  PurchasesPackage | null;
}

/** Offerings.current'taki aylık + yıllık paket. Kullanılamıyorsa / hata → null. */
export async function loadPaywallPackages(): Promise<PaywallPackages | null> {
  if (!purchasesAvailable()) return null;
  try {
    const offerings = await sdk!.getOfferings();
    const current = offerings.current;
    if (!current) return { monthly: null, annual: null };
    return { monthly: current.monthly ?? null, annual: current.annual ?? null };
  } catch (e) {
    console.warn('[purchases] getOfferings başarısız:', e);
    return null;
  }
}

/**
 * Mağazada aktif entitlement var mı (SDK önbelleği). Yalnızca sunucu senkronu
 * gecikirken / get_usage okunamazken gate'i açmak için — limitler yine sunucuda.
 */
export async function sdkHasEntitlement(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  try {
    const info: CustomerInfo = await sdk!.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch (e) {
    console.warn('[purchases] getCustomerInfo başarısız:', e);
    return false;
  }
}

/** Ücretsiz deneme süresi (gün) — yalnızca hafta / gün birimleri; başka birim → null */
function periodDays(unit: unknown, count: unknown): number | null {
  const n = typeof count === 'number' && count > 0 ? count : null;
  if (!n) return null;
  if (unit === 'DAY')  return n;
  if (unit === 'WEEK') return n * 7;
  return null;
}

/**
 * Paketin ücretsiz denemesi BU KULLANICI için geçerliyse gün sayısı, değilse null.
 * Kaynak mağaza (kodda süre yok):
 *   iOS     : product.introPrice (fiyat 0) + checkTrialOrIntroductoryPriceEligibility.
 *             Yalnızca durum ELIGIBLE ise deneme var; INELIGIBLE (daha önce kullanmış),
 *             UNKNOWN (belirlenemedi) ve NO_INTRO_OFFER_EXISTS → null.
 *   Android : defaultOption'ın ücretsiz fazı (fiyatı 0). Play, kullanıcının uygun
 *             olmadığı teklifleri paketle döndürmez → teklif yoksa deneme yok.
 * Uygunluk bilinemiyorsa (hata, enum yok) null → paywall deneme vaat etmez.
 */
export async function freeTrialDays(pkg: PurchasesPackage | null): Promise<number | null> {
  if (!pkg || !purchasesAvailable()) return null;
  // SDK tipleri platforma göre farklı alanlar taşıyor → yalnızca okunan alanlar
  const product = pkg.product as any;
  try {
    if (Platform.OS === 'android') {
      const phase = product?.defaultOption?.freePhase;
      if (!phase || phase.price?.amountMicros !== 0) return null;
      return periodDays(phase.billingPeriod?.unit, phase.billingPeriod?.value);
    }
    const intro = product?.introPrice;
    if (!intro || intro.price !== 0) return null;
    const days = periodDays(intro.periodUnit, intro.periodNumberOfUnits);
    if (!days) return null;
    if (eligibleStatus === null) return null;
    const eligibility = await sdk!.checkTrialOrIntroductoryPriceEligibility([product.identifier]);
    return eligibility?.[product.identifier]?.status === eligibleStatus ? days : null;
  } catch (e) {
    console.warn('[purchases] deneme bilgisi okunamadı:', e);
    return null;
  }
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'pending' | 'network' | 'error' | 'unavailable';

function classifyError(e: unknown): Exclude<PurchaseOutcome, 'success' | 'unavailable'> {
  const err = e as { userCancelled?: boolean | null; code?: string } | null;
  const codes = errorCodes;
  // Sabitler yüklenemediyse SDK'nın string kodları: 1 iptal, 10 ağ, 20 bekleyen ödeme
  const cancelled = codes?.PURCHASE_CANCELLED_ERROR ?? '1';
  const network   = codes?.NETWORK_ERROR            ?? '10';
  const pending   = codes?.PAYMENT_PENDING_ERROR    ?? '20';
  if (err?.userCancelled || err?.code === cancelled) return 'cancelled';
  if (err?.code === pending) return 'pending';
  if (err?.code === network) return 'network';
  return 'error';
}

export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) return 'unavailable';
  try {
    await sdk!.purchasePackage(pkg);
    return 'success';
  } catch (e) {
    const outcome = classifyError(e);
    if (outcome !== 'cancelled') console.warn('[purchases] purchasePackage:', outcome, e);
    return outcome;
  }
}

export type RestoreOutcome = 'restored' | 'nothing' | 'network' | 'error' | 'unavailable';

/** 'restored' = mağazada aktif entitlement var; nihai plan yine sunucudan okunur. */
export async function restore(): Promise<RestoreOutcome> {
  if (!purchasesAvailable()) return 'unavailable';
  try {
    const info: CustomerInfo = await sdk!.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] ? 'restored' : 'nothing';
  } catch (e) {
    const outcome = classifyError(e);
    console.warn('[purchases] restorePurchases:', outcome, e);
    return outcome === 'network' ? 'network' : 'error';
  }
}

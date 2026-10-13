import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

// Google'ı bir kez yapılandır (modül yüklenince)
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export type SocialResult = {
  user: { id: string; email: string | null; created_at: string };
  /** Apple SADECE ilk yetkilendirmede isim verir; sonraki girişlerde null. */
  fullName: string | null;
};

/** Apple girişi yalnızca iOS'ta var (Android'de expo-apple-authentication yok). */
export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try { return await AppleAuthentication.isAvailableAsync(); } catch { return false; }
}

/** Kullanıcı iptal ederse null döner (hata DEĞİL — sessizce yoksay). */
export async function signInWithApple(): Promise<SocialResult | null> {
  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return null;   // kullanıcı vazgeçti
    throw e;
  }

  if (!credential.identityToken) throw new Error('NO_TOKEN');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('NO_TOKEN');

  // ⚠️ KRİTİK: Apple ismi SADECE ilk seferde gönderir. Şimdi yakalamazsak sonsuza dek kaybolur.
  const fn = credential.fullName;
  const fullName = fn?.givenName
    ? [fn.givenName, fn.familyName].filter(Boolean).join(' ')
    : null;

  return {
    user: { id: data.user.id, email: data.user.email ?? null, created_at: data.user.created_at },
    fullName,
  };
}

/** Kullanıcı iptal ederse null döner. */
export async function signInWithGoogle(): Promise<SocialResult | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let res: any;
  try {
    res = await GoogleSignin.signIn();
  } catch (e: any) {
    // SIGN_IN_CANCELLED — sürüme göre kod ya da string
    if (e?.code === 'SIGN_IN_CANCELLED' || e?.code === '-5' || e?.code === 12501) return null;
    throw e;
  }

  // Sürüm farkı: yeni sürümler { type, data: { idToken } }, eskiler { idToken }
  if (res?.type === 'cancelled') return null;
  const idToken = res?.data?.idToken ?? res?.idToken ?? null;
  const gUser   = res?.data?.user   ?? res?.user   ?? null;
  if (!idToken) throw new Error('NO_TOKEN');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('NO_TOKEN');

  return {
    user: { id: data.user.id, email: data.user.email ?? null, created_at: data.user.created_at },
    fullName: gUser?.name ?? null,
  };
}

/**
 * Hesabı kalıcı olarak siler (App Store 5.1.1(v) / Google Play).
 * Kullanıcı Apple onay ekranında vazgeçerse 'cancelled' döner (hata DEĞİL).
 * Google yapılandırması bu modülde olduğu için burada duruyor.
 */
export async function deleteAccount(): Promise<'deleted' | 'cancelled'> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('no-session');
  const providers = (user.identities ?? []).map((i) => i.provider);

  // a) Apple: iOS'ta taze tek kullanımlık kod al (izin İSTEME — boş scope)
  let appleAuthCode: string | undefined;
  if (Platform.OS === 'ios' && providers.includes('apple')) {
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      appleAuthCode = cred.authorizationCode ?? undefined;
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return 'cancelled';   // vazgeçti
      // başka hata: kod olmadan devam — silme yine yapılmalı (Apple TN3194)
    }
  }

  // b) Google: cihazdaki erişimi iptal et — en iyi çaba
  if (providers.includes('google')) {
    try { await GoogleSignin.revokeAccess(); } catch {}
    try { await GoogleSignin.signOut(); } catch {}
  }

  // c) Sunucu: storage + auth kullanıcısı (tablolar cascade)
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: appleAuthCode ? { appleAuthCode } : {},
  });
  if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? 'delete-failed');

  // d) Yerel temizlik — kullanıcı sunucuda yok, global signOut başarısız olur → 'local'.
  // Hesap zaten silindi; buradaki bir hata kullanıcıya "silinemedi" diye yansımamalı.
  try { await supabase.auth.signOut({ scope: 'local' }); } catch (e) {
    console.warn('[deleteAccount] local signOut:', e);
  }
  return 'deleted';
}

import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { useUserStore } from './src/store/useUserStore';
import { useFavoritesStore } from './src/store/useFavoritesStore';
import { clearSignedUrlCache } from './src/lib/storageUrls';
import { initI18n, getLocale } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { configurePurchases, identifyPurchaser, resetPurchaser } from './src/lib/purchases';
import { usePlanStore } from './src/store/usePlanStore';
import { useConsentStore } from './src/store/useConsentStore';

// RevenueCat — native modül / anahtar yoksa sessizce devre dışı (lib/purchases güvenlik ağı)
configurePurchases();

/** Oturum açık: RevenueCat kimliğini bağla, planı ve rıza durumlarını sunucudan oku */
function onSessionUser(uid: string): void {
  identifyPurchaser(uid);
  usePlanStore.getState().refresh();
  useConsentStore.getState().refresh();
}

export default function App() {
  // i18n hazır olmadan render etme — çeviriler ilk boyamadan önce yüklenmeli
  const [i18nReady, setI18nReady] = useState(false);
  // Dil değişince tüm ağacı remount etmek için store'daki locale'i izle
  const locale = useUserStore((s) => s.locale);
  useEffect(() => {
    initI18n().then(() => {
      useUserStore.getState().setUserLocale(getLocale());  // store'u i18n ile hizala
      setI18nReady(true);
    });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] auth event:', event, '| user:', session?.user?.id ?? null);

      // Sadece ilgili event'ler işleniyor — TOKEN_REFRESHED, USER_UPDATED vb. yoksayılır
      if (event === 'SIGNED_OUT') {
        console.log('[App] SIGNED_OUT → logout()');
        useUserStore.getState().logout();
        // Mahremiyet: aynı cihazda sonraki kullanıcının fetch'i başarısız olursa öncekinin favorileri görünmesin
        useFavoritesStore.getState().reset();
        clearSignedUrlCache();   // önceki kullanıcının imzalı URL'leri bellekte kalmasın
        usePlanStore.getState().reset();
        useConsentStore.getState().reset();
        resetPurchaser();
        return;
      }

      if (event === 'INITIAL_SESSION' && session?.user) {
        // Uygulama açılışında mevcut oturum — profiles tablosundan profil çek
        const u = session.user;
        onSessionUser(u.id);
        supabase
          .from('profiles')
          // avatar_url/weight eksikti: soğuk açılışta avatar "yok" görünüyordu
          .select('name, avatar_url, height, weight, age, body_type, skin_tone, hair_color, hair_length, hair_type, age_confirmed_at, sensitive_consent_at')
          .eq('id', u.id)
          .maybeSingle()
          .then(({ data: profile }: { data: { name: string; avatar_url: string | null; height: number | null; weight: number | null; age: number | null; body_type: string | null; skin_tone: string | null; hair_color: string | null; hair_length: string | null; hair_type: string | null; age_confirmed_at: string | null; sensitive_consent_at: string | null } | null }) => {
            console.log('[App] INITIAL_SESSION setUser — name:', profile?.name ?? '(yok)');
            const { setUser, setPhysicalProfile, setOnboarded } = useUserStore.getState();
            setUser({
              id: u.id,
              email: u.email ?? '',
              name: profile?.name ?? '',
              createdAt: u.created_at,
              avatarUrl: profile?.avatar_url ?? undefined,
              // Profil okunamadıysa undefined bırak → AgeGate kendisi okur
              ageConfirmedAt:     profile ? profile.age_confirmed_at : undefined,
              sensitiveConsentAt: profile ? profile.sensitive_consent_at : undefined,
            });
            // Alanlar tek tek boş olabilir — herhangi biri doluysa yükle
            if (profile && [profile.height, profile.weight, profile.age, profile.body_type, profile.skin_tone,
                            profile.hair_color, profile.hair_length, profile.hair_type].some((v) => v != null)) {
              setPhysicalProfile({
                height:     profile.height      ?? undefined,
                weight:     profile.weight      ?? undefined,
                age:        profile.age         ?? undefined,
                bodyType:   profile.body_type   ?? undefined,
                skinTone:   profile.skin_tone   ?? undefined,
                hairColor:  profile.hair_color  ?? undefined,
                hairLength: profile.hair_length ?? undefined,
                hairType:   profile.hair_type   ?? undefined,
              });
            }
            setOnboarded(true);
          });
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Login sonrası — isOnboarded'a dokunma, ekranlar yönetiyor
        // (LoginScreen setOnboarded(true), SignupScreen onboarding'e yönlendiriyor)
        const u = session.user;
        onSessionUser(u.id);
        const { user: current, setUser } = useUserStore.getState();
        if (!current) {
          // Sadece store henüz boşsa set et (LoginScreen zaten doldurmuşsa üzerine yazma)
          console.log('[App] SIGNED_IN fallback setUser — id:', u.id);
          setUser({
            id: u.id,
            email: u.email ?? '',
            name: '',
            createdAt: u.created_at,
          });
        } else {
          console.log('[App] SIGNED_IN — store zaten dolu, atlanıyor');
        }
        return;
      }

      console.log('[App] event yoksayıldı:', event);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ön plana gelişte plan/kullanımı tazele (abonelik mağazada iptal/yenilenmiş olabilir)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useUserStore.getState().isAuthenticated) {
        usePlanStore.getState().refresh();
        // Açılışta okunamadıysa (çevrimdışı) tekrar dene — rıza kapısı buna bağlı
        if (!useConsentStore.getState().loaded) useConsentStore.getState().refresh();
      }
    });
    return () => sub.remove();
  }, []);

  // i18n yüklenirken boş değil, splash + uygulama ile aynı #FAFAFA — açılış kesintisiz akar
  if (!i18nReady) return <View style={{ flex: 1, backgroundColor: '#FAFAFA' }} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer key={locale} ref={navigationRef}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

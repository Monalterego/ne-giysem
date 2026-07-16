import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { useUserStore } from './src/store/useUserStore';
import { initI18n, getLocale } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';

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
        return;
      }

      if (event === 'INITIAL_SESSION' && session?.user) {
        // Uygulama açılışında mevcut oturum — profiles tablosundan profil çek
        const u = session.user;
        supabase
          .from('profiles')
          .select('name, height, age, body_type, skin_tone, hair_color, hair_length, hair_type')
          .eq('id', u.id)
          .maybeSingle()
          .then(({ data: profile }: { data: { name: string; avatar_url: string | null; height: number | null; age: number | null; body_type: string | null; skin_tone: string | null; hair_color: string | null; hair_length: string | null; hair_type: string | null } | null }) => {
            console.log('[App] INITIAL_SESSION setUser — name:', profile?.name ?? '(yok)');
            const { setUser, setPhysicalProfile, setOnboarded } = useUserStore.getState();
            setUser({
              id: u.id,
              email: u.email ?? '',
              name: profile?.name ?? '',
              isPremium: false,
              createdAt: u.created_at,
              avatarUrl: profile?.avatar_url ?? undefined,
            });
            if (profile?.height != null) {
              setPhysicalProfile({
                height:     profile.height      ?? undefined,
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
        const { user: current, setUser } = useUserStore.getState();
        if (!current) {
          // Sadece store henüz boşsa set et (LoginScreen zaten doldurmuşsa üzerine yazma)
          console.log('[App] SIGNED_IN fallback setUser — id:', u.id);
          setUser({
            id: u.id,
            email: u.email ?? '',
            name: '',
            isPremium: false,
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

  // i18n yüklenirken boş/siyah değil, splash'le aynı beyaz — açılış kesintisiz akar
  if (!i18nReady) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer key={locale}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

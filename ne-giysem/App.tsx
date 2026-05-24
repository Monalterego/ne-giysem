import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { useUserStore } from './src/store/useUserStore';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && session?.user) {
        // Uygulama açılışında mevcut oturum tespit edildi — onboarding atla
        const { setUser, setOnboarded } = useUserStore.getState();
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? '',
          isPremium: false,
          createdAt: session.user.created_at,
        });
        setOnboarded(true);
      } else if (event === 'SIGNED_OUT') {
        useUserStore.getState().logout();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

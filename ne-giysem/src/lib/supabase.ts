import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Realtime kullanılmıyor (channel/postgres_changes çağrısı yok). supabase-js'te
// "realtime.enabled" diye bir seçenek yok; istemci soket'i ancak ilk .channel()
// çağrısında açar, yani kapatmak için ayar gerekmez.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

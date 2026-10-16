import { useWardrobeStore } from '../store/useWardrobeStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useUserStore } from '../store/useUserStore';
import { clearSignedUrlCache } from './storageUrls';

/**
 * Çıkış / hesap silme sonrası ortak yerel temizlik — Profil (çıkış, hesap silme)
 * ve AgeGate (18 yaş altı hesap silme) aynı fonksiyonu çağırır.
 * logout() en son: RootNavigator onboarding'e geçer.
 */
export function clearLocalSession(): void {
  useWardrobeStore.getState().setItems([]);
  useFavoritesStore.getState().reset();   // App SIGNED_OUT da sıfırlar; çevrimdışı signOut event üretmezse diye burada da
  clearSignedUrlCache();
  useUserStore.getState().logout();
}

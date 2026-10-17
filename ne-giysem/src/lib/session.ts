import { useWardrobeStore } from '../store/useWardrobeStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useUserStore } from '../store/useUserStore';
import { usePlanStore } from '../store/usePlanStore';
import { clearSignedUrlCache } from './storageUrls';
import { resetPurchaser } from './purchases';

/**
 * Çıkış / hesap silme sonrası ortak yerel temizlik — Profil (çıkış, hesap silme)
 * ve AgeGate (18 yaş altı hesap silme) aynı fonksiyonu çağırır.
 * logout() en son: RootNavigator onboarding'e geçer.
 */
export function clearLocalSession(): void {
  useWardrobeStore.getState().setItems([]);
  useFavoritesStore.getState().reset();   // App SIGNED_OUT da sıfırlar; çevrimdışı signOut event üretmezse diye burada da
  clearSignedUrlCache();
  usePlanStore.getState().reset();
  resetPurchaser();   // RevenueCat anonim kullanıcıya döner (sonraki hesap önceki aboneliği görmesin)
  useUserStore.getState().logout();
}

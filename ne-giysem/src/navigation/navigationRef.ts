import { createNavigationContainerRef } from '@react-navigation/native';
import type { PaywallReason, RootStackParamList } from './types';

// İç içe navigator'lar ve modal'lar (tab → stack → modal) paywall'u tek yerden açsın
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openPaywall(reason: PaywallReason = 'generic'): void {
  if (navigationRef.isReady()) navigationRef.navigate('Paywall', { reason });
}

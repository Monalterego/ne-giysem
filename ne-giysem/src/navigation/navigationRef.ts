import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// İç içe navigator'lar ve modal'lar (tab → stack → modal) kök rotalara tek yerden ulaşsın
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

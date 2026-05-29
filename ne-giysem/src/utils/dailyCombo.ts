import type { WardrobeItem, Combo } from '../types';
import type { WeatherData } from './weatherService';
import { generateCombosAI } from './comboEngine';
import type { UserProfileInput } from './comboEngine';

export type { UserProfileInput };

export async function generateDailyCombo(
  items: WardrobeItem[],
  userProfile: UserProfileInput,
  weather?: WeatherData | null,
): Promise<Combo | null> {
  if (!items.length) return null;
  try {
    const results = await generateCombosAI(items, userProfile, weather ?? undefined, 'gunluk', 0, []);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

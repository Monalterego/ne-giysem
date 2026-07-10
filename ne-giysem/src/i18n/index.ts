import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tr from './locales/tr.json';
import en from './locales/en.json';

const i18n = new I18n({ tr, en });
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

const STORAGE_KEY = '@sestina_locale';

/** Cihaz dilini algılar (tr/en); desteklenmeyen dillerde en'e düşer. */
function deviceLocale(): 'tr' | 'en' {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return code === 'tr' ? 'tr' : 'en';
}

/** Başlangıçta çağrılır: kayıtlı tercih varsa onu, yoksa cihaz dilini kullanır. */
export async function initI18n(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    i18n.locale = (saved === 'tr' || saved === 'en') ? saved : deviceLocale();
  } catch {
    i18n.locale = deviceLocale();
  }
}

/** Kullanıcı dil değiştirince çağrılır; kalıcı kaydeder. */
export async function setLocale(locale: 'tr' | 'en'): Promise<void> {
  i18n.locale = locale;
  try { await AsyncStorage.setItem(STORAGE_KEY, locale); } catch {}
}

export function getLocale(): 'tr' | 'en' {
  return (i18n.locale as 'tr' | 'en') ?? 'tr';
}

/** Çeviri fonksiyonu. t('home.greeting') gibi. */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export default i18n;

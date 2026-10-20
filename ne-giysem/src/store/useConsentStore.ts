import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { CONSENT_VERSIONS } from '../constants/consent';
import type { ConsentKind, TryOnConsentKind } from '../constants/consent';
import type { User } from '../types';

export interface ConsentRecord {
  granted: boolean;
  textVersion: string;
  at: string;
}

export type ConsentMap = Partial<Record<ConsentKind, ConsentRecord>>;

export interface ConsentState {
  /** false: henüz okunmadı (kapılar ve kararlar beklesin) */
  loaded: boolean;
  /** kind → en son kayıt; anahtar yoksa henüz sorulmadı */
  records: ConsentMap;
  /** Sunucudan güncel durumları oku (my_consents). Hata → loaded false kalır */
  refresh: () => Promise<void>;
  /** Yeni satır ekle (yalnız ekleme) ve yerel durumu güncelle. Hata fırlatır */
  record: (uid: string, kind: ConsentKind, granted: boolean) => Promise<ConsentRecord>;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>((set) => ({
  loaded: false,
  records: {},

  refresh: async () => {
    const { data, error } = await supabase.rpc('my_consents');
    if (error) {
      console.warn('[consents] okunamadı:', error.message);
      return;
    }
    const records: ConsentMap = {};
    for (const [kind, v] of Object.entries((data ?? {}) as Record<string, any>)) {
      if (!(kind in CONSENT_VERSIONS)) continue;
      records[kind as ConsentKind] = {
        granted:     v?.granted === true,
        textVersion: String(v?.text_version ?? ''),
        at:          String(v?.created_at ?? ''),
      };
    }
    set({ loaded: true, records });
  },

  record: async (uid, kind, granted) => {
    const { data, error } = await supabase
      .from('consent_events')
      .insert({ user_id: uid, kind, granted, text_version: CONSENT_VERSIONS[kind] })
      .select('granted, text_version, created_at')
      .single();
    if (error) throw error;
    const rec: ConsentRecord = {
      granted:     data.granted === true,
      textVersion: data.text_version,
      at:          data.created_at,
    };
    set((s) => ({ records: { ...s.records, [kind]: rec } }));
    return rec;
  },

  reset: () => set({ loaded: false, records: {} }),
}));

/** Güncel durum = en son kayıt; kayıt yoksa izin yok */
export function isGranted(records: ConsentMap, kind: ConsentKind): boolean {
  return records[kind]?.granted === true;
}

/** 'undecided' → hiç sorulmadı (izin ekranı gösterilmeli) */
export function aiStatus(records: ConsentMap): 'granted' | 'declined' | 'undecided' {
  const r = records.ai_processing;
  if (!r) return 'undecided';
  return r.granted ? 'granted' : 'declined';
}

/**
 * Mevcut kullanıcı kapısı (ConsentGate): elindeki veriye göre eksik açık rızalar.
 * Avatar var ama 'tryon_photo' yok → fotoğraf; fiziksel alan var ama 'tryon_physical'
 * yok → fiziksel bilgi. Eski tek rıza (sensitive_consent_at) ikisini ayrı kapsamadığı
 * için sayılmaz.
 */
export function requiredTryOnConsents(user: User | null | undefined, records: ConsentMap): TryOnConsentKind[] {
  if (!user) return [];
  const out: TryOnConsentKind[] = [];
  if (user.avatarUrl && !isGranted(records, 'tryon_photo')) out.push('tryon_photo');
  const hasPhysical = [user.height, user.weight, user.age, user.bodyType, user.skinTone,
                       user.hairColor, user.hairLength, user.hairType].some((v) => v != null);
  if (hasPhysical && !isGranted(records, 'tryon_physical')) out.push('tryon_physical');
  return out;
}

/** Aydınlatma bu sürümüyle okundu mu? (metin değişince yeniden "Okudum" istenir) */
export function noticeRead(records: ConsentMap): boolean {
  const r = records.notice_shown;
  return !!r && r.granted && r.textVersion === CONSENT_VERSIONS.notice_shown;
}

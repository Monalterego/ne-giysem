import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { CONSENT_VERSIONS, majorVersion } from '../constants/consent';
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

/**
 * Kaydın metin sürümü güncelle nasıl ilişkili:
 *   'current' aynı · 'minor' yalnız alt sürüm farklı (geçerli, not gösterilir)
 *   'major'   ana sürüm farklı ya da biçim dışı (geçersiz, yeniden sorulur)
 */
export function versionState(rec: ConsentRecord | undefined, kind: ConsentKind): 'current' | 'minor' | 'major' {
  if (!rec) return 'current';
  if (rec.textVersion === CONSENT_VERSIONS[kind]) return 'current';
  const mine = majorVersion(rec.textVersion);
  return mine !== null && mine === majorVersion(CONSENT_VERSIONS[kind]) ? 'minor' : 'major';
}

/**
 * Güncel durum = en son kayıt. İzin sayılması için o kayıt granted OLMALI ve ana
 * sürümü güncel ana sürümle aynı olmalı (alt sürüm farkı sorun değil).
 */
export function isGranted(records: ConsentMap, kind: ConsentKind): boolean {
  const r = records[kind];
  return r?.granted === true && versionState(r, kind) !== 'major';
}

/** 'undecided' → hiç sorulmadı ya da onaylanan metnin ana sürümü eskidi (izin ekranı gösterilmeli) */
export function aiStatus(records: ConsentMap): 'granted' | 'declined' | 'undecided' {
  const r = records.ai_processing;
  if (!r) return 'undecided';
  if (!r.granted) return 'declined';
  return isGranted(records, 'ai_processing') ? 'granted' : 'undecided';
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

/** Aydınlatma güncel ana sürümüyle okundu mu? (ana sürüm değişince yeniden "Okudum" istenir) */
export function noticeRead(records: ConsentMap): boolean {
  return isGranted(records, 'notice_shown');
}

// ─── Rıza türleri ve metin sürümleri (tek yer) ───────────────────────────────
// consent_events.kind / text_version (014_privacy_consent.sql).
// Bir rıza metnini (tr.json / en.json) değiştirirsen ilgili sürümü de artır —
// kayıt, kullanıcının hangi metni onayladığını gösterir.

export type ConsentKind = 'notice_shown' | 'ai_processing' | 'tryon_photo' | 'tryon_physical';

/** Sanal denemenin iki ayrı açık rızası */
export type TryOnConsentKind = 'tryon_photo' | 'tryon_physical';

export const CONSENT_VERSIONS: Record<ConsentKind, string> = {
  notice_shown:   'tryon-notice-2026-10-20',
  ai_processing:  'ai-processing-2026-10-20',
  tryon_photo:    'tryon-photo-2026-10-20',
  tryon_physical: 'tryon-physical-2026-10-20',
};

export const TRYON_CONSENT_KINDS: TryOnConsentKind[] = ['tryon_photo', 'tryon_physical'];

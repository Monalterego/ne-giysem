// ─── Rıza türleri ve metin sürümleri (tek yer) ───────────────────────────────
// consent_events.kind / text_version (014_privacy_consent.sql).
// Sürüm biçimi "ana.alt". Bir rıza metnini (tr.json / en.json) değiştirirsen:
//   • ANA'yı artır  → kapsam değişti (yeni veri, yeni alıcı, yeni amaç): eski onay
//                     geçersiz sayılır, kullanıcıya yeniden sorulur (isGranted false)
//   • ALT'ı artır   → yazım / netleştirme: yeniden sorulmaz, Gizlilik ekranında not
// Kayıt, kullanıcının hangi metni onayladığını gösterir.

export type ConsentKind = 'notice_shown' | 'ai_processing' | 'tryon_photo' | 'tryon_physical';

/** Sanal denemenin iki ayrı açık rızası */
export type TryOnConsentKind = 'tryon_photo' | 'tryon_physical';

export const CONSENT_VERSIONS: Record<ConsentKind, string> = {
  notice_shown:   '1.0',
  ai_processing:  '1.1',   // 1.1: model eğitimi cümlesi "sağlayıcıların beyanına göre" (kapsam aynı)
  tryon_photo:    '1.0',
  tryon_physical: '1.0',
};

/** "ana.alt" → ana; biçim dışı (eski tarihli sürümler) → null = hiçbir ana sürüme eşit değil */
export function majorVersion(v: string | null | undefined): number | null {
  const m = /^(\d+)\.(\d+)$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
}

export const TRYON_CONSENT_KINDS: TryOnConsentKind[] = ['tryon_photo', 'tryon_physical'];

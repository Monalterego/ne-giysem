# Teknik ve İdari Güvenlik Tedbirleri

**Sürüm:** 1.0 · **Tarih:** 22 Ekim 2026 · **Dayanak:** KVKK m. 12 · **Kaynak:** `data-inventory.md`
Kod referansları `ne-giysem/` altındaki yollardır (`1ae49a9` sonrası). `[?]` = kodda doğrulanamayan, veri sorumlusunun teyit etmesi gereken nokta.

---

## 1. Erişim yetkileri (kişiler)

| Sistem | Erişimi olan | 2FA | Not |
|---|---|---|---|
| Supabase projesi (panel, SQL, secrets) | Yalnızca veri sorumlusu | [?] | service_role anahtarı panelde ve edge function ortamında |
| GitHub (`Monalterego/ne-giysem`, `sestina-web`) | Yalnızca veri sorumlusu | [?] | Secret repoda yok (bölüm 5) |
| Expo / EAS (derleme, OTA) | Yalnızca veri sorumlusu | [?] | EAS ortam değişkenlerinde `EXPO_PUBLIC_*` |
| Google hesabı (Drive yedekleri, Gmail) | Yalnızca veri sorumlusu | [?] | Kişisel hesap |
| Cloudflare (DNS, e-posta yönlendirme) | Yalnızca veri sorumlusu | [?] | |
| Sağlayıcı panelleri (Anthropic, FASHN, Poof, RevenueCat, Apple Developer, Google Cloud) | Yalnızca veri sorumlusu | [?] | |

- **Yetki ilkesi:** üçüncü kişiye erişim verilmez. Verilirse (ör. ileride çalışan / danışman) en az yetki, kişisel hesap ve gizlilik taahhüdü uygulanır, bu tablo güncellenir ve `verbis-degerlendirmesi.md` bölüm 5 tetiklenir.
- **Cihaz:** geliştirme bilgisayarında disk şifrelemesi [?], ekran kilidi [?].

## 2. Veritabanı erişim kuralları (RLS)

Her kullanıcı tablosunda RLS açık; istemci (`authenticated`) yalnızca kendi satırına erişir. Sunucuya özel tablolarda policy yok ve `anon` / `authenticated` yetkileri geri alınmış.

| Tablo | İstemci erişimi | Referans |
|---|---|---|
| `profiles` | Kendi satırı; UPDATE yalnızca izinli kolonlarda | `supabase/migrations/001_initial.sql:19-29`; kolon bazlı UPDATE `006_server_side_quota.sql` (profiles bölümü), `011_privacy_hardening.sql:20` |
| `style_profiles`, `wardrobe_items`, `combos` | Kendi satırları (CRUD) | `001_initial.sql:46-60`, `:92-106`, `:128-142` |
| `favorite_combos` | Kendi satırları (okuma / ekleme / silme) | `supabase/schema/public_2026-10-15.sql:281-293` (panelden eklenmiş; migration'da yok) |
| `entitlements` | Yalnız okuma, kendi satırı | `013_premium_entitlements.sql:45-58` |
| `consent_events` | Okuma + yalnızca 4 kolonla ekleme; UPDATE / DELETE yok | `014_privacy_consent.sql:51-71` |
| `tryon_renders`, `api_usage` | Yok (yalnızca service_role) | `006_server_side_quota.sql:46-48`, `:59-60` |
| `ops_events` | Yok | `007_ops_events.sql:27-30` |
| `deletion_log` | Yok | `014_privacy_consent.sql:129-131` |
| SECURITY DEFINER fonksiyonlar | `execute` yalnızca gereken role verilmiş; varsayılan yetkiler geri alınmış | `006`, `013`, `014` sonlarındaki revoke / grant blokları |

## 3. Özel depolar ve imzalı bağlantılar

- `avatars`, `wardrobe-items`, `mannequin-cache` bucket'ları **özel**: `010_private_buckets.sql:15`.
- Dosya yolu `<uid>/…`; sahip dışı silme engelli: `011_privacy_hardening.sql:24-31`.
- Tüm storage policy'leri ve bucket ayarları (22.10.2026 ölçümü) birebir repoda: `supabase/migrations/018_storage_policies_snapshot.sql`. Okuma / yükleme / güncelleme yalnızca sahibin `<uid>/` klasöründe.
- **Bilinen zayıflıklar (düzeltilmedi):**
  - Private bucket'larda `file_size_limit` / `allowed_mime_types` yok; oturum açmış kullanıcı kendi klasörüne her türden ve boyutta dosya yükleyebilir.
  - `wardrobe-items` ve `mannequin-cache` policy'leri `public` rolüne tanımlı; anon için `auth.uid()` null olduğundan açık değil.
  - `wardrobe-items`'ta UPDATE policy'si yok.
  - `moodboards` herkese açık bucket; policy yok, listeleme ve yükleme kapalı.
  - Ayrıntı: 018 sonundaki notlar.
- Görüntüleme yalnızca imzalı bağlantıyla, **1 saat**: `src/lib/storageUrls.ts:13`, `:72`.
- FASHN'a giden bağlantı **10 dakika**: `src/lib/storageUrls.ts:14`, `:175`.
- Verilerimi indir bağlantıları 1 saat: `supabase/functions/export-my-data/index.ts:16`.
- fashn-proxy yalnızca kullanıcının kendi depo yolunu ya da kendi FASHN çıktısını kabul ediyor: `supabase/functions/fashn-proxy/index.ts:46-55`, `:101`.

## 4. Sunucu tarafı kontroller

| Kontrol | Referans |
|---|---|
| Her proxy'de kullanıcı doğrulaması (`auth.getUser`; yalnızca anon key yetmez) | `supabase/functions/_shared/auth.ts:29` |
| Yapay zekâ izni yoksa 403 | `bg-removal-proxy/index.ts:34`, `anthropic-proxy/index.ts:80` |
| Sanal deneme rızası yoksa 403 (start: biri; run: manken → fiziksel, avatar → fotoğraf) | `fashn-proxy/index.ts:143-144`, `:208` |
| Rıza kararı fonksiyonu (son satır) | `014_privacy_consent.sql:76` (`consent_granted`) |
| Anthropic isteği beyaz listeyle yeniden kuruluyor (model, token, görsel sayısı / boyutu) | `anthropic-proxy/index.ts` (`sanitizeMessages`) |
| FASHN model / girdi beyaz listesi, maliyet sabitleri | `fashn-proxy/index.ts` (`ALLOWED_INPUTS`, `PINNED_VALUES`) |
| Boyut tavanı ve günlük kullanım tavanları | `bg-removal-proxy/index.ts:9-11`, `:39-41`; `export-my-data/index.ts:68` (günde 3) |
| Kota ve plan sınırları sunucuda (istemci atlayamaz) | `013_premium_entitlements.sql` (`start_tryon`, `start_scan`, trigger'lar) |
| RevenueCat webhook kimliği: paylaşılan secret | `supabase/functions/revenuecat-webhook/index.ts:46` |
| İstemci tarafı ön kontroller (ek katman; asıl karar sunucuda) | `src/screens/main/CombosScreen.tsx:627-629`, `src/screens/main/UploadScreen.tsx:59`, `src/screens/main/ScanScreen.tsx:65` |
| Yükleme öncesi JPEG'e yeniden kodlama, ≤1400 px | `src/utils/imageNormalize.ts:21-23`, `:65-75`; seçici `exif: false` (`UploadScreen.tsx:72`) |

## 5. Anahtar yönetimi

**Sunucu secret'ları** — yalnızca Supabase edge function ortamında (`supabase secrets set`), repoda ve istemcide yok:

| Secret | Kullanıldığı yer |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (otomatik) | `_shared/auth.ts:24`, `delete-account/index.ts:172` |
| `ANTHROPIC_API_KEY` | `anthropic-proxy/index.ts:122` |
| `POOF_API_KEY` | `bg-removal-proxy/index.ts:54` |
| `FASHN_API_KEY` | `fashn-proxy/index.ts:113` |
| `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_ENTITLEMENT_ID` | `_shared/revenuecat.ts:23`, `:27` |
| `REVENUECAT_WEBHOOK_SECRET` | `revenuecat-webhook/index.ts:46` |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY` | `delete-account/index.ts:57-60` |
| `DELETION_LOG_PEPPER` — silme kaydı özeti (HMAC anahtarı); **değiştirilmez**, parola yöneticisinde ayrıca saklanır | `delete-account/index.ts` (`subjectHash`); geri yükleme RPC'sine parametre olarak (`017_deletion_subject_hash.sql`) |

**İstemcide bulunan anahtarlar** (`EXPO_PUBLIC_*`, derlemeye gömülür — herkes okuyabilir):

| Anahtar | Niteliği | Referans |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Herkese açık olacak şekilde tasarlanmış; güvenlik RLS'ye ve sunucu kontrollerine dayanır | `src/lib/supabase.ts:4-5` |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | RevenueCat herkese açık SDK anahtarı | `src/lib/purchases.ts:24-26` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `_IOS_CLIENT_ID` | OAuth istemci kimliği (gizli değil) | `src/lib/socialAuth.ts:8-9` |
| **`EXPO_PUBLIC_OPENWEATHER_API_KEY`** | **Üçüncü taraf API anahtarı cihazda.** Kişisel veri riski yok, ama kota kötüye kullanımı riski var. Web metni buna göre düzeltildi (yalnızca Anthropic / FASHN / Poof anahtarları sunucuda). Öneri: proxy'ye taşı ya da OpenWeather'da kullanım sınırı koy | `src/utils/weatherService.ts:3` |

**Repo kuralları:** `.env` ve `.env*.local` git dışında (`ne-giysem/.gitignore`); yalnızca `.env.example` (değersiz) repoda. Git geçmişinde `sk-ant-`, `FASHN_API_KEY=`, `POOF_API_KEY=` ve service_role JWT kalıbı **bulunmadı** (`git log -S`, 22.10.2026). Tek `sk_` eşleşmesi yorum satırı (`0e29a79`).

**Yeni secret ekleme / değiştirme:** `supabase secrets set AD=değer` → ilgili function'ı `supabase functions deploy` ile yeniden yayınla → bu tabloyu güncelle. Değer hiçbir zaman commit mesajına, issue'ya, sohbet / AI aracı geçmişine ya da ekran görüntüsüne konmaz.

## 6. Sızan anahtar yenileme kaydı

**Sızma şüphesi = sızmış kabul edilir.** Adımlar: sağlayıcıda iptal et → yeni anahtar → `supabase secrets set` → deploy → kayıt → `veri-ihlali-mudahale-proseduru.md` bölüm 3 değerlendirmesi.

| Tarih | Anahtar | Nasıl açığa çıktı | İptal / yenileme tarihi | Yeni anahtar nerede | Kişisel veri etkisi | Yapan |
|---|---|---|---|---|---|---|
| ≤ 2026-06-05 | `EXPO_PUBLIC_ANTHROPIC_API_KEY` | İstemci derlemesine gömülüydü; `a91eaf7` ile kaldırıldı ve sunucuya taşındı | **Yenilendi** (beyan, ≤ 22.10.2026; kesin tarih [?]) | Supabase secret `ANTHROPIC_API_KEY` | Eski anahtar geçersiz; kullanıcı verimize erişim sağlamaz | HCD |
| ≤ 2026-06-05 | `EXPO_PUBLIC_REMOVEBG_API_KEY` | İstemci derlemesi; `204de19` ile kaldırıldı (Poof'a geçildi) | **İptal edildi** (beyan) | — (remove.bg kullanılmıyor) | Yok | HCD |
| ≤ 2026-07-08 | `EXPO_PUBLIC_FASHN_API_KEY` | İstemci derlemesi; `70e4db4` ile kaldırıldı | **Yenilendi; eski anahtar geçersiz** (beyan) | Supabase secret `FASHN_API_KEY` | Eski anahtarla geçmiş işler artık sorgulanamaz | HCD |
| geçmiş | OpenAI API anahtarı | Geçmiş kod (`cf3d402`: anahtar cihaz loguna yazılıyordu) | **İptal edildi** (beyan) | — (kullanılmıyor) | Yok | HCD |
| geçmiş | Replicate API anahtarı | Geçmiş kod (`b3c1f3e`, IDM-VTON) | **İptal edildi** (beyan) | — (kullanılmıyor) | Yok | HCD |
| sürekli | `EXPO_PUBLIC_OPENWEATHER_API_KEY` | Tasarım gereği istemcide | — | — | Yok (yalnızca kota) | — |

Kesin iptal / yenileme tarihleri sağlayıcı panellerinden alınıp yazılmalı [?].

## 6a. Diğer tedbirler

- İletim: tüm bağlantılar HTTPS (Supabase, sağlayıcılar).
- Veri minimizasyonu: Poof / Anthropic'e yalnızca küçültülmüş kıyafet fotoğrafı; konum cihazda ~1 km'ye yuvarlanır (`src/utils/weatherService.ts:12-13`).
- Analitik, reklam ve izleme SDK'sı yok (`ne-giysem/package.json`).
- Log'lar 1 gün (Supabase Free plan); hata mesajlarında kullanıcı kimliği dışında kişisel veri yazılmaz [?] (tam denetim yapılmadı).
- Yedekler AES-256, fotoğraf içermez; parola ayrı tutulur (`saklama-imha-politikasi.md` bölüm 4).

## 7. Gözden geçirme

Yılda bir kez ve her yeni sağlayıcı, secret ya da tablo eklendiğinde güncellenir.

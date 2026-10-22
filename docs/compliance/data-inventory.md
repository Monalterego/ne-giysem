# Veri Envanteri — Sestina (Ne Giysem)

**Durum:** 22 Ekim 2026 (ek: 016, yedek yeri, e-posta alıcıları; notice 2.0; iç dokümanlar) · kaynak: `ne-giysem` main (1474d3d + 015 + 016) · hazırlayan: kod incelemesi
**İlgili iç dokümanlar:** `verbis-degerlendirmesi.md`, `ozel-nitelikli-veri-siniflandirmasi.md`, `saklama-imha-politikasi.md`, `veri-ihlali-mudahale-proseduru.md`, `basvuru-proseduru.md`, `basvuru-kayit-defteri-sablonu.md`, `guvenlik-tedbirleri.md`
**Kural:** Web metinleri (sestina-web: gizlilik, aydınlatma, açık rıza, başvuru, hesap silme, koşullar) bu tablodan türetilir. Kod değişince önce bu dosya güncellenir.

Gösterim:
- **[kod]** = davranış kodda doğrulandı (dosya yolu verildi).
- **[beyan]** = sağlayıcının kendi beyanı (politika / doküman); biz doğrulayamayız. Metinlerde "sağlayıcının beyanına göre" kalıbıyla yazılır.
- **[org]** = kodda olmayan, işletme süreci (geliştiricinin bildirdiği).
- **[?]** = açık nokta; bkz. bölüm 5.

Veri sorumlusu: Hasan Can Demircan (bireysel geliştirici) · support@sestinaapp.com

---

## 1. Veri akışı tablosu

| # | İşleme faaliyeti | Veri kategorisi | Amaç | Hukuki sebep (KVKK) | Toplama yöntemi | Alıcı (tüzel kişi · ülke · rol) | Saklama süresi | Silme yolu | Rıza / tercih bağlantısı | Kod kaynağı |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hesap oluşturma, giriş (e-posta) | Kimlik/iletişim: e-posta, ad; şifre (Supabase Auth'ta hash'li); 18 yaş onay zamanı | Hesap, giriş, yaş sınırı | m. 5/2-c | Kayıt / giriş / yaş ekranında kullanıcı girer | Supabase, Inc. · ABD şirketi, proje bölgesi AB (Frankfurt) [?] · veri işleyen | Hesap süresince. Hesap silinince anında; DB yedeklerinde en fazla 30 gün [org] | Profil → Hesabımı Sil (anında) · e-posta (30 gün) | — | `profiles`, `auth.users`; `SignupScreen`, `AgeGateScreen` |
| 2 | Apple / Google ile giriş | Sağlayıcı kimlik tokenı, e-posta, ad (Apple ilk girişte); Google girişinde ad ve profil resmi bağlantısı (`auth.users` meta verisi) | Hesap doğrulama | m. 5/2-c | Sağlayıcıdan | Apple Inc. · ABD / Google LLC · ABD · ayrı veri sorumlusu; token doğrulama Supabase'de | Hesap süresince (`auth.users`, `auth.identities`) | Hesap silmede Apple refresh token iptali (sunucu) + Google erişim iptali (cihaz, en iyi çaba) [kod] | — | `lib/socialAuth.ts`, `functions/delete-account` |
| 3 | Stil profili | Seçilen stiller ve ağırlıklar | Kombin önerisi | m. 5/2-c | Onboarding seçimi | Supabase · veri işleyen | Hesap süresince | Hesap silme (cascade) | — | `style_profiles` |
| 4 | Dijital dolap — fotoğraf | Kıyafet görseli (≤1000 px JPEG) + 400 px önizleme | Dolap, kombin kartı | m. 5/2-c | Kamera / galeri; yüklemeden önce JPEG'e çevrilir, uzun kenar ≤1400 px [kod] | Supabase Storage (`wardrobe-items`, özel bucket) · veri işleyen | Parça silinene ya da hesap silinene kadar. **Fotoğraflar yedeklenmez** [org] | Parçayı sil (dosya + o parçalı try-on'lar) · hesap silme | `ai_processing` varsa arka planı kaldırılmış görsel; yoksa fotoğraf olduğu gibi | `UploadScreen`, `UploadDetailScreen`, `utils/imageNormalize.ts`, `lib/privacyActions.ts` |
| 5 | Dijital dolap — bilgiler | Kategori, alt kategori, renk (hex), desen, mevsim, kumaş, ad, kesim, yaka, kol, detaylar, sinyaller | Dolap, kombin motoru | m. 5/2-c | `ai_processing` varsa yapay zekâ çıkarır, kullanıcı düzeltir; yoksa kullanıcı seçer | Supabase · veri işleyen | Parça / hesap silinene kadar; DB yedeklerinde ≤30 gün | Parçayı sil · hesap silme | `ai_processing` | `wardrobe_items` |
| 6 | Arka plan kaldırma | Kıyafet veya ürün fotoğrafı (JPEG, ≤1400 px, ≤2 MB base64) | Arka plan kaldırma | m. 5/2-c — **yapay zekâ izni uygulama içi tercihtir, işleme şartı değildir** | Ekleme / tarama anında, sunucu proxy'si üzerinden | Dumpling Software UG (haftungsbeschränkt) "Poof" · Almanya · veri işleyen [?] | Bizde saklanmaz (yanıt istemciye döner). Sağlayıcının beyanına göre bellekte işlenir, sonuçtan hemen sonra silinir [beyan] | — | `ai_processing` yoksa sunucu **403** döner, istek gitmez [kod] | `functions/bg-removal-proxy`, `_shared/consent.ts` |
| 7 | Kıyafet / ürün özellik tanıma | Arka planı kaldırılmış fotoğraf + sabit prompt | Kategori, renk, desen, mevsim tanıma | m. 5/2-c (izin = tercih) | Ekleme / tarama anında, proxy üzerinden | Anthropic, PBC · ABD · veri işleyen [?] | Sağlayıcının beyanına göre API girdi/çıktıları 30 gün içinde silinir, varsayılan olarak eğitimde kullanılmaz [beyan] | — | `ai_processing` yoksa 403 [kod] | `functions/anthropic-proxy`, `utils/visionAnalysis.ts` |
| 8 | Stil DNA adı | Seçilen stil adları ve ağırlıkları (metin) | Stil kartına ad | m. 5/2-c (izin = tercih) | Onboarding sonucu | Anthropic, PBC · ABD · veri işleyen | #7 ile aynı [beyan] | — | `ai_processing` yoksa çağrı yapılmaz, yerel ad [kod] | `StyleResultScreen` |
| 9 | "Uyar mı?" taraması | Ürün fotoğrafı; aylık tarama sayısı | Ürünün dolapla uyumu | m. 5/2-c (izin = tercih); sayaç m. 5/2-f | Kamera / galeri | Poof (#6) + Anthropic (#7) | Fotoğraf sunucuda saklanmaz [kod]; sayaç #20 | — | `ai_processing` yoksa ekran kapalı + sunucu 403 [kod] | `ScanScreen`, `StoreResultScreen`, `start_scan()` |
| 10 | URL ile ürün okuma | Ürün sayfası URL'i | Ürün görselini almak | — | **PASİF**: arayüzde kapalı ("Yakında") | Sunucumuz mağaza sayfasını çeker | — | — | — | `functions/fetch-product`, `ScanScreen` (alan `editable={false}`) |
| 11 | Profil fotoğrafı (sanal deneme) | Tam boy fotoğraf — **içerik ve kullanıma göre özel nitelikli olabilir (m. 6, kılık-kıyafet)** | Sanal deneme | **Açık rıza** (m. 5/1; özel nitelikliyse m. 6/2) | Galeriden seçim | Supabase Storage (`avatars`, özel) · veri işleyen | Kaldırana / rızayı geri çekene / hesabı silene kadar | Fotoğrafı kaldır · rızayı geri çek · hesap silme | `tryon_photo` (önce `notice_shown`) | `ProfilePhotoScreen`, `privacyActions.removeAvatarAndTryOns` |
| 12 | Fiziksel profil | Boy, kilo, yaş, vücut tipi, ten rengi, saç rengi/uzunluğu/tipi (yalnız seçilen alanlar) [?] | Yapay manken üretimi | **Açık rıza** (m. 5/1) | Fiziksel profil ekranı | Supabase · veri işleyen | Rıza geri çekilene / hesap silinene kadar; DB yedeklerinde ≤30 gün | Rızayı geri çek (alanlar NULL + manken) · hesap silme | `tryon_physical` (önce `notice_shown`) | `PhysicalProfileScreen`, `privacyActions.removePhysicalData` |
| 13 | Sanal deneme üretimi | Fotoğraf veya manken + kıyafet görselleri (10 dk imzalı URL); fotoğraf yoksa fiziksel profilden metin tarif | Try-on görseli üretmek | **Açık rıza** | Kullanıcı try-on başlatınca | FASHN LTD · Birleşik Krallık; alt işleyenler ABD, Singapur, Malezya, Endonezya, AB · veri işleyen [?] | Sağlayıcının beyanına göre çıktılar 3 gün sonra silinir; istek kaydında URL'ler kalır (bizim URL'ler 10 dk'da geçersiz) [beyan] | — | start: `tryon_photo` ∨ `tryon_physical`; manken üretimi: `tryon_physical`; avatar görseli: `tryon_photo` — yoksa **403** [kod]; istemci de önceden sorar | `functions/fashn-proxy`, `CombosScreen`, `utils/virtualModel.ts` |
| 14 | Sanal deneme görselleri | Yapay manken (`base_mannequin.png`), try-on sonuçları — özel nitelikli olabilir (#11) | Görüntüleme, önbellek, paylaşım | **Açık rıza** | FASHN çıktısı depomuza kopyalanır | Supabase Storage (`mannequin-cache`, özel) | İlgili parça / fotoğraf / rıza / hesap silinene kadar | Parça sil (adında parça id geçenler) · fotoğraf rızası (avatar kaynaklı) · fiziksel rıza (`_m.jpg` + manken) · hesap silme | `tryon_photo` / `tryon_physical` | `CombosScreen`, `lib/privacyActions.ts` |
| 15 | Sanal deneme kota kaydı | Render zamanı, çağrı sayısı, FASHN işlem kimlikleri, çıktı URL'leri | Kota, kötüye kullanımın önlenmesi | m. 5/2-f (plan sınırı için m. 5/2-c) | Otomatik | Supabase | Hesap süresince; hesap silinince cascade | Hesap silme | — | `tryon_renders` (006, 008, 013) |
| 16 | Kombinler, takvim, favoriler | Giyildi / planlandı kayıtları, puan, favori imzaları | Geçmiş ve planlama | m. 5/2-c | Kullanıcı işlemi | Supabase | Hesap süresince | Tek tek silme · hesap silme | — | `combos`, `favorite_combos` |
| 17 | Hava durumu | Konum, cihazda 2 ondalığa (~1 km) yuvarlanır; izin yoksa "Istanbul" | Hava durumuna göre öneri | m. 5/2-c | Cihaz konumu (yalnız ön planda, düşük doğruluk) | OpenWeather Ltd · Birleşik Krallık · istek doğrudan cihazdan [?] | Bizde saklanmaz [kod]. Sağlayıcının beyanına göre API isteklerinde IP ve parametreleri saklamaz [beyan] | — | iOS konum izni | `utils/weatherService.ts` (OpenWeather API anahtarı **istemcide**: `:3`) |
| 18 | Abonelik | Ürün, mağaza, dönem türü, bitiş, yenileme; RevenueCat'te uygulama kullanıcı kimliği (= auth uid) | Premium, plan sınırları | m. 5/2-c | Mağaza satın alması → RevenueCat → webhook / sync | RevenueCat, Inc. · ABD · veri işleyen; Apple / Google ödeme için ayrı veri sorumlusu | Hesap süresince (`entitlements`); hesap silmede RevenueCat abone kaydı silinir (en iyi çaba) [kod] | Hesap silme | — | `entitlements`, `functions/revenuecat-webhook`, `sync-entitlement`, `_shared/revenuecat.ts` |
| 19 | Rıza ve izin kayıtları | Tür, verildi/verilmedi, metin sürümü, zaman (yalnız ekleme) | Rızanın ispatı, kararın uygulanması | m. 5/2-ç | Rıza / izin ekranları | Supabase | Hesap süresince; hesap silinince cascade [?] | Hesap silme | Tümü | `consent_events` (014), `constants/consent.ts` |
| 20 | Günlük kullanım sayaçları | Kullanıcı kimliği + işlev (`anthropic`, `bg`, `store_scan`, `export`) + gün + sayı | Kötüye kullanım, tavanlar, aylık tarama hakkı | m. 5/2-f (tarama hakkı m. 5/2-c) | Otomatik | Supabase | **13 ay** (`purge_retention`, pg_cron [?]); hesap silmede cascade | Otomatik / hesap silme | — | `api_usage` (006, 014) |
| 21 | Operasyon kayıtları | Servis kesintisi olayları; kullanıcı kimliği içermez | Hizmet sürekliliği | m. 5/2-f | Otomatik | Supabase | **12 ay** (`purge_retention`) | Otomatik | — | `ops_events` (007) |
| 22 | Hesap silme kaydı | Silme zamanı, kanal (`app` / `email` / `under18`), silinen veri türleri, RevenueCat / Apple adımlarının sonucu; `subject_hash` = HMAC-SHA256(`DELETION_LOG_PEPPER`, user_id) — yedekten geri yüklemede silinmiş hesabı yeniden silmek için, kullanıcı kimliğinin geri döndürülemeyen özeti (017). Kullanıcı kimliği veya e-posta alanı yok; **anonim sayılmaz** (pepper'a sahip veri sorumlusu bilinen bir kimliği eşleştirebilir) | Silmenin yapıldığının ispatı | m. 5/2-ç · Silme/Yok Etme Yönetmeliği m. 7/3 | `delete-account` otomatik; e-posta talepleri elle eklenir | Supabase · yalnızca service_role | **En az 3 yıl, sonra silinir** (015) | Otomatik | — | `deletion_log` (014, 015, 017), `functions/delete-account`, `purge_restored_deleted_accounts()` |
| 23 | Sunucu kayıtları (log) | Edge function logları: kullanıcı kimliği, hata metinleri; silme anında silinen kullanıcının kimliği | Hata ayıklama, güvenlik | m. 5/2-f | Otomatik | Supabase | **1 gün** (Free plan) [org] | Otomatik | — | `functions/*` (`console.log` / `console.error`) |
| 24 | Kimlik doğrulama denetim kayıtları | Giriş / çıkış / token olayları, **IP adresi** | Güvenlik, kötüye kullanımın önlenmesi | m. 5/2-f | Otomatik (Supabase Auth) | Supabase · veri işleyen | Supabase auth log'unda 1 gün (Free plan); `auth.audit_log_entries` tablosunda **en fazla 90 gün** (016, `purge_retention`). Tablo `auth.users`'a bağlı değil → hesap silinince cascade ile gitmez, 90 gün kuralına tabi. Tablonun dolu olup olmadığı ölçülmedi [?] | Otomatik | — | `auth.audit_log_entries`, 016 |
| 25 | Veritabanı yedekleri | DB'nin tamamı (fotoğraflar hariç) | Felaket kurtarma | m. 5/2-f | Haftalık, elle, AES-256 ile şifreli [org] | Google LLC (Google Drive) · ABD · veri sorumlusunun kişisel hesabı; rol [?] | **En fazla 30 gün** [org] | Süre dolunca yedek elle silinir [org] | — | — (otomatik yedek yok — Free plan) |
| 26 | Verilerimi indir | Profil, stil, dolap meta, kombinler, favoriler, rıza geçmişi, abonelik + 1 saatlik fotoğraf linkleri | KVKK m. 11 erişim / taşınabilirlik | m. 5/2-ç | Profil → Verilerimi indir (günde 3) | Kullanıcının seçtiği uygulama (paylaşım menüsü) | Bizde saklanmaz; linkler 1 saat | — | — | `functions/export-my-data`, `privacyActions.exportMyData` |
| 27 | Uygulama güncellemeleri | İşletim sistemi, kurulum başına rastgele kimlik | OTA güncelleme | m. 5/2-c / 5/2-f | Otomatik (expo-updates) | 650 Industries, Inc. (Expo) · ABD · veri işleyen [?] | Sağlayıcının beyanına göre [beyan] | — | — | `app.json` → `updates.url` |
| 28 | Destek ve başvuru yazışmaları | E-posta adresi, içerik, başvuru kimlik bilgileri (ad-soyad, TCKN / pasaport, adres); kayıtlı adres dışından gelen başvurularda kayıtlı adrese gönderilen doğrulama kodu ve yanıtı | Taleplere ve KVKK başvurularına yanıt, başvuranın kimliğinin doğrulanması | m. 5/2-ç, 5/2-c | support@sestinaapp.com | Cloudflare, Inc. · ABD · e-posta yönlendirme; Google LLC (Gmail) · ABD · e-posta kutusu; roller [?] | Talep kapanışından **2 yıl** [org] | Süre dolunca elle | — | — |
| 29 | Cihazda tutulanlar | Oturum (Supabase), dil, dolap görünümü | Uygulamanın çalışması | — (cihazda) | AsyncStorage | — | Çıkış / uygulamayı kaldırma | Çıkış, kaldırma | — | `lib/supabase.ts`, `i18n/index.ts`, `WardrobeScreen` |
| 30 | Paylaşım | Kombin kartı / try-on görseli bağlantısı | Kullanıcının paylaşması | Kullanıcının kendi işlemi | Paylaşım menüsü | Kullanıcının seçtiği uygulama | Bizim linkimiz 1 saat; depoya kaydedilemediyse FASHN linki (#13) | — | — | `CombosScreen` |

---

## 2. Rıza ve tercih kayıtları (`consent_events`)

| Kayıt türü | Niteliği | Metin sürümü (kod) | Ne zaman sorulur | Geri çekme / red sonucu | Sunucu kontrolü |
|---|---|---|---|---|---|
| `ai_processing` | **Uygulama içi tercih / izin — KVKK işleme şartı değil**; hukuki sebep m. 5/2-c | `1.1` | İlk kıyafet eklemeden ve ilk taramadan önce | Mevcut veri silinmez; yeni parçalar elle eklenir; tarama kapanır | bg-removal-proxy, anthropic-proxy → 403 |
| `notice_shown` | Aydınlatmanın gösterildiğinin kaydı ("Okudum") | `2.0` (özel nitelikli veri paragrafı) | Sanal deneme rızalarından önce; 2.0'dan önceki sürümü okuyana rıza penceresi bir sonraki açıldığında yeniden | — | — |
| `tryon_photo` | **Açık rıza** | `1.0` | Profil fotoğrafını ilk kez yüklemeden ve bu rıza olmadan try-on başlatmadan önce | Fotoğraf + fotoğrafla üretilen try-on'lar silinir | fashn-proxy → 403 |
| `tryon_physical` | **Açık rıza** | `1.0` | Fiziksel profili ilk kez kaydetmeden ve fotoğrafsız try-on'dan önce | Fiziksel alanlar + manken + mankenle üretilen try-on'lar silinir | fashn-proxy → 403 |

Sürüm biçimi `ana.alt`. Ana sürüm değişirse eski onay geçersiz sayılır ve yeniden sorulur; alt sürüm farkında yalnız Gizlilik ekranında not gösterilir (istemci kuralı; sunucu sürüme bakmaz). `profiles.sensitive_consent_at` yalnız geriye dönük uyumluluk için tutulan bir ayna; karar bu tablodan okunur.

---

## 3. Alıcılar

| Tüzel kişi | Ülke | Rol (değerlendirme) | İlgili satırlar | Saklama / eğitim — kaynak |
|---|---|---|---|---|
| Supabase, Inc. | ABD şirketi; proje bölgesi AB / Frankfurt [?] | Veri işleyen | 1–5, 11–16, 18–25 | Free plan: log 1 gün, otomatik yedek yok — supabase.com/pricing |
| Anthropic, PBC | ABD | Veri işleyen | 7, 8, 9 | privacy.claude.com [beyan] |
| Dumpling Software UG (haftungsbeschränkt) — Poof | Almanya | Veri işleyen | 6, 9 | poof.bg/privacy [beyan] |
| FASHN LTD | Birleşik Krallık (+ alt işleyenler) | Veri işleyen | 13 | docs.fashn.ai, fashn.ai/legal/subprocessors [beyan] |
| OpenWeather Ltd | Birleşik Krallık | Belirsiz — istek doğrudan cihazdan [?] | 17 | openweather.co.uk/privacy-policy [beyan] |
| RevenueCat, Inc. | ABD | Veri işleyen | 18 | revenuecat.com/privacy [beyan] |
| 650 Industries, Inc. (Expo) | ABD | Veri işleyen [?] | 27 | expo.dev/privacy [beyan] |
| Apple Inc. / Google LLC | ABD | Ayrı veri sorumlusu (giriş, mağaza) | 2, 18 | Kendi politikaları |
| Cloudflare, Inc. | ABD | E-posta yönlendirme — veri işleyen [?] | 28 | Sağlayıcı koşulları [beyan] |
| Google LLC (Gmail, Google Drive) | ABD | E-posta kutusu ve yedek depolama; veri sorumlusunun **kişisel** hesabı — rol [?] | 25, 28 | Sağlayıcı koşulları [beyan] |
| Yetkili kamu kurumları | Türkiye | Talep hâlinde | — | Hukuki yükümlülük |

Tüzel kişi adları mevcut web metinlerinden alındı; sözleşme veya veri işleme sözleşmesi (DPA) ile teyit edilmedi.

---

## 4. Teknik ve ek güvenlik önlemleri (özellikle #11–#14)

- Fotoğraf bucket'ları özel; satır düzeyinde erişim kuralları (RLS) ve storage policy'leri yalnız `<uid>/` klasörüne izin veriyor (010, 011).
- Görüntüleme yalnız 1 saatlik imzalı bağlantıyla; FASHN'a giden bağlantılar 10 dakika geçerli.
- Rıza kararı sunucuda da uygulanıyor (fashn-proxy, bg-removal-proxy, anthropic-proxy).
- Rıza geri çekilince ilgili veri ve türevleri siliniyor.
- Üçüncü taraf API anahtarları yalnız sunucuda; kota ve rıza kayıtları istemciden değiştirilemiyor.
- Fotoğraflar yedeklere girmiyor; veritabanı yedekleri AES-256 ile şifreli [org].

Bu önlemlerin Kurul'un özel nitelikli veriler için aradığı "yeterli önlemler"i (2018/10 sayılı karar) karşılayıp karşılamadığı ayrıca değerlendirilmeli; politika, eğitim ve erişim yetkisi gibi idari önlemler kodda yok.

---

## 5. Açık noktalar (karar / teyit gerekli)

1. **Supabase proje bölgesi:** Metinler "Frankfurt" diyor; kodda proje adresinden bölge görünmüyor. Supabase panelinden teyit edilmeli.
2. ~~Auth denetim kayıtları — silme yetkisi~~ — çözüldü (22.10.2026): `purge_retention()` → `auth_audit = 0`, yetki var. Kalan bilgi notu: `auth_audit = 0` "90 günden eski satır yok" demek; tablonun tamamen boş olup olmadığı ayrıca ölçülmedi. Metinlerdeki "en fazla 90 gün" ifadesi iki durumda da doğru.
3. ~~Auth meta verisi~~ — çözüldü: Google girişinde ad ve profil resmi bağlantısı metinlere eklendi (#2).
4. ~~Yedeklerin saklandığı yer~~ — çözüldü: Google Drive, ABD, AES-256 (#25). Açık kalan: kişisel Google hesabında Google'ın rolü (veri işleyen mi?) ve hesap güvenliği (2FA vb.) belgelenmeli.
5. ~~E-posta sağlayıcısı~~ — çözüldü: Cloudflare (yönlendirme) + Gmail (#28). Açık kalan: rol nitelemeleri.
6. **Rıza kayıtları hesapla birlikte siliniyor (#19):** Hesap silinince ispat kaydı da gidiyor (cascade). Hesap silme sonrası rızanın ispat ihtiyacı varsa saklama ayrı kararlaştırılmalı.
7. **Ten rengi (#12):** Metinlere "ırk / etnik köken bakımından özel nitelikli veri sayılabilir" eklendi. Açık kalan: (a) vücut tipi / kilo için sağlık çağrışımı değerlendirilmedi. ~~(b) uygulama içi aydınlatma~~ — çözüldü: `consent.specialBody`, `notice_shown` 2.0.
8. ~~pg_cron~~ — çözüldü (22.10.2026): pg_cron etkin, 014–016 uygulandı, `purge_retention()` ölçüldü. 13 ay / 12 ay / 3 yıl / 90 gün süreleri otomatik uygulanıyor. 017–018 henüz uygulanmadı.
9. **Rol değerlendirmeleri:** Anthropic, Poof, FASHN, Expo ve OpenWeather için "veri işleyen" nitelemesi sağlayıcı koşullarına dayanıyor; DPA imzalı mı, teyit edilmeli.
10. **EXIF:** Görseller yeniden kodlanıyor ve seçici `exif: false` ile çağrılıyor. Kaydedilen JPEG'de konum EXIF'i kalmadığı cihazda doğrulanmadı; metinlerde iddia edilmiyor.
11. ~~Başvuru doğrulama kodu biçimi / süresi~~ — çözüldü: 6 haneli rastgele, 7 gün, yalnızca kayıtlı adrese (`basvuru-proseduru.md` bölüm 4). Süreç elle işliyor [org].
12. **Apple "E-postamı Gizle" adreslerine gönderim (#28):** Apple yönlendirme adreslerine yalnızca Apple Developer'da kayıtlı gönderen alan adı / adresinden gelen e-postayı iletir. Cloudflare Email Routing yalnızca alım yapar; support@ adına gönderim (Gmail "farklı gönder" + SPF / DKIM) kurulumu doğrulanmadı. Kurulmadıysa web metnindeki doğrulama kodu vaadi Apple kullanıcıları için çalışmaz.
13. **OpenWeather API anahtarı istemcide (#17):** `src/utils/weatherService.ts:3`. Web metni "yalnızca Anthropic / FASHN / Poof anahtarları sunucuda" olarak daraltıldı.
14. ~~Geçmişte istemcide bulunan anahtarlar~~ — çözüldü (veri sorumlusu beyanı, 22.10.2026): Anthropic ve FASHN anahtarları yenilendi, eski FASHN anahtarı geçersiz; OpenAI, Replicate ve remove.bg anahtarları iptal edildi (`guvenlik-tedbirleri.md` bölüm 6). Not: OpenAI ve Replicate şu anki kodda kullanılmıyor; git geçmişinde kullanılmışlar (Replicate: `b3c1f3e`; OpenAI: `cf3d402` — o commit API anahtarını cihaz loguna yazıyordu). Anahtarlar iptal edildiği için ek işlem yok; geçmişte bu sağlayıcılara gönderilmiş veri olup olmadığı (test dönemi, gerçek kullanıcı var mıydı) veri sorumlusunca değerlendirilmeli.
15. ~~Storage policy'leri repoda yok~~ — çözüldü: 22.10.2026 ölçümü `018_storage_policies_snapshot.sql`'e birebir alındı. Dosya boyutu / MIME sınırı ve `public` rol `019_storage_limits.sql` ile kapatıldı (jpeg/png/webp, 10 MB, `authenticated`; 018'i geçersiz kılar). Kalan: `wardrobe-items`'ta UPDATE yok.
16. ~~Mevcut rıza sahiplerine notice 2.0~~ — çözüldü: rızası geçerli ama aydınlatmanın güncel ana sürümünü okumamış kullanıcıya ConsentGate açılışta yalnızca "Aydınlatma metni güncellendi" adımını gösterir; rızalar yeniden sorulmaz (`needsNoticeUpdate`, `SensitiveConsentModal` `noticeOnly`).
17. **`DELETION_LOG_PEPPER` (#22):** Supabase secret olarak tanımlanmalı ve parola yöneticisinde yedeklenmeli. Tanımlanana kadar `subject_hash` null yazılır (`ops_events: deletion_pepper_missing`). 017'den önceki silme kayıtlarında özet yok.

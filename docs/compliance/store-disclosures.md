# Mağaza Gizlilik Beyanları — Taslak

**Sürüm:** 0.1 (taslak) · **Tarih:** 23 Ekim 2026 · **Kaynak:** `data-inventory.md` (#1–#30) + kod (`ne-giysem/` main, `5c32096`)
**Kapsam:** App Store Connect → App Privacy ve Google Play Console → Data safety. Mağaza arayüzündeki sırayla, doldurulmaya hazır cevaplar.
**Kural:** Envanter değişince önce `data-inventory.md`, sonra bu dosya, sonra iki form güncellenir. Formlar gizlilik politikasıyla (sestina-web `gizlilik` / `privacy`) çelişmemeli; Google beyanı uygulama ve politikayla karşılaştırır.

Gösterim: **[T#]** = tartışmalı karar, gerekçesi bölüm D'de. `#n` = envanter satırı.

---

## 0. Kodda doğrulananlar (23.10.2026)

| Konu | Bulgu | Kaynak |
|---|---|---|
| Reklam / analitik / izleme SDK'sı | **Yok.** Bağımlılıklarda Firebase, Sentry, Amplitude, Mixpanel, Segment, AppsFlyer, Adjust, Facebook SDK yok; `src/` ve `supabase/functions/` içinde de çağrı yok | `ne-giysem/package.json` |
| ATT / IDFA / reklam kimliği | `NSUserTrackingUsageDescription` yok; `AD_ID` izni yok; RevenueCat'te `collectDeviceIdentifiers` çağrılmıyor | `app.json`, `src/lib/purchases.ts` |
| RevenueCat kimliği | `Purchases.logIn(uid)`: app user ID = Supabase auth UUID. E-posta / ad / attribute gönderilmiyor | `src/lib/purchases.ts:74` |
| Konum | Yalnızca ön planda, `Accuracy.Low`, iOS `NSLocationDefaultAccuracyReduced`, Android yalnızca `ACCESS_COARSE_LOCATION` (`ACCESS_FINE_LOCATION` engelli). Koordinat cihazda 2 ondalığa yuvarlanır, **doğrudan cihazdan** OpenWeather'a (HTTPS) gider; sunucumuza ve veritabanına yazılmaz, kullanıcı kimliği eklenmez | `src/utils/weatherService.ts:6-14`, `:62`; `src/store/useWardrobeStore.ts:137-141` |
| Aktarımda şifreleme | Kodda `http://` çağrısı yok; Supabase, proxy'ler, OpenWeather, RevenueCat, Expo hepsi HTTPS | `grep "http://" src supabase/functions` → 0 |
| Expo güncelleme | `expo-updates` → `u.expo.dev`; işletim sistemi + kurulum başına rastgele kimlik (#27) | `app.json` → `updates.url` |
| Giriş yöntemleri | E-posta + şifre (ad zorunlu), Google (iOS + Android), Apple (yalnızca iOS) | `SignupScreen.tsx:107`, `lib/socialAuth.ts:20` |

**Sonuç:** İzleme (Apple "tracking") **yok**; veri satışı / reklam amaçlı paylaşım **yok**.

---

## A. Apple — App Privacy

### A1. Giriş sorusu

| Soru | Cevap |
|---|---|
| Do you or your third-party partners collect data from this app? | **Yes, we collect data from this app** |

Apple tanımı: veri cihazdan çıkıp geliştiriciye **veya** üçüncü taraf ortağa (Supabase, Poof, Anthropic, FASHN, RevenueCat, OpenWeather, Expo) gidiyorsa "collected". Cihazdan doğrudan OpenWeather'a giden konum da dahil.

### A2. Veri türleri (arayüz sırası)

Tüm satırlarda **Used for tracking: No**. Amaçlar Apple listesinden: *Third-Party Advertising, Developer's Advertising or Marketing, Analytics, Product Personalization, App Functionality, Other Purposes*. Apple'a göre güvenlik ve kötüye kullanımın önlenmesi App Functionality'dir.

| Grup | Veri türü | Topla? | Amaç | Linked to user? | Envanter | Not |
|---|---|---|---|---|---|---|
| Contact Info | Name | **Yes** | App Functionality | Yes | #1, #2 | E-posta kaydında zorunlu; Apple / Google'dan gelebilir |
| | Email Address | **Yes** | App Functionality | Yes | #1, #2 | Apple "E-postamı Gizle" adresi de e-postadır |
| | Phone Number | No | | | | |
| | Physical Address | No | | | | Başvurudaki adres e-postayla, uygulama dışında (#28) |
| | Other User Contact Info | No | | | | |
| Health & Fitness | Health | **No** [T1] | | | #12 | Boy / kilo / vücut tipi → Other Data |
| | Fitness | No | | | | |
| Financial Info | Payment Info | No | | | #18 | Ödemeyi Apple alır |
| | Credit Info | No | | | | |
| | Other Financial Info | No | | | | |
| Location | Precise Location | No | | | #17 | 2 ondalık, düşük doğruluk |
| | Coarse Location | **Yes** [T5] | App Functionality | **No** | #17 | Doğrudan OpenWeather'a |
| Sensitive Info | Sensitive Info | **Yes** [T2] | App Functionality | Yes | #12 | Ten rengi; saç tipi |
| Contacts | Contacts | No | | | | |
| User Content | Emails or Text Messages | No | | | | |
| | Photos or Videos | **Yes** [T3] | App Functionality | Yes | #4, #9, #11, #13, #14 | Kıyafet, profil fotoğrafı, tarama fotoğrafı, manken / try-on görselleri |
| | Audio Data | No | | | | `RECORD_AUDIO` engelli |
| | Gameplay Content | No | | | | |
| | Customer Support | **No** [T9] | | | #28 | E-postayla, uygulama dışında |
| | Other User Content | **Yes** | App Functionality | Yes | #3, #5, #16 | Stil profili, dolap bilgileri, kombinler, takvim, favoriler |
| Browsing History | Browsing History | No | | | #10 | URL ile ürün okuma pasif |
| Search History | Search History | No | | | | |
| Identifiers | User ID | **Yes** [T7] | App Functionality | Yes | #1, #18, #20 | Supabase UUID; RevenueCat'e gider |
| | Device ID | **Yes** [T8] | App Functionality | **No** | #27 | Expo kurulum kimliği |
| Purchases | Purchase History | **Yes** [T6] | App Functionality | Yes | #18 | RevenueCat + `entitlements` |
| Usage Data | Product Interaction | **Yes** [T4] | App Functionality | Yes | #15, #20 | Günlük kullanım sayaçları, try-on kota kaydı |
| | Advertising Data | No | | | | |
| | Other Usage Data | No | | | | |
| Diagnostics | Crash Data | No | | | | Crash SDK'sı yok [T10] |
| | Performance Data | No | | | | |
| | Other Diagnostic Data | No [T10] | | | #23 | Sunucu logu cihazdan toplanmıyor |
| Surroundings | Environment Scanning | No | | | | |
| Body | Hands / Head | No | | | | |
| Other Data | Other Data Types | **Yes** [T1] | App Functionality | Yes | #1, #12, #19 | Boy, kilo, yaş, vücut tipi, saç rengi / uzunluğu; 18 yaş onay zamanı; rıza kayıtları |

### A3. Beklenen özet (ürün sayfasında görünecek)

- **Data Used to Track You:** yok
- **Data Linked to You:** Contact Info, Sensitive Info, User Content, Identifiers (User ID), Purchases, Usage Data, Other Data
- **Data Not Linked to You:** Location (Coarse), Identifiers (Device ID)

---

## B. Google Play — Data safety

### B1. Veri toplama ve güvenlik (arayüz sırası)

| Soru | Cevap | Gerekçe |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Bölüm B2 |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | Tüm bağlantılar HTTPS (bölüm 0). OpenWeather isteği de `https://api.openweathermap.org` |
| Which of the following methods of account creation does your app support? | **Username and password** (e-posta + şifre) ve **OAuth** (Google ile giriş) | Android'de Apple ile giriş yok (`socialAuth.ts:20`) |
| Account deletion URL (Delete account URL) | `https://sestinaapp.com/delete-account` | Uygulama dışından silme talebi: adımlar + e-posta yolu. TR: `https://sestinaapp.com/hesap-silme` |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **Yes** | Parça silme, profil fotoğrafını kaldırma, rıza geri çekme (fiziksel profil + manken). Web sayfası bölüm 6 |
| Data deletion URL (isteğe bağlı alan) | `https://sestinaapp.com/delete-account` | Aynı sayfa, bölüm 6 "Deleting some data without deleting your account" |
| Uygulama içi hesap silme | Var: Profil → Hesabımı Sil (anında) | `functions/delete-account` |
| Independent security review (isteğe bağlı rozet) | **Hayır / boş bırak** | MASA değerlendirmesi yapılmadı |
| UPI / Families ile ilgili sorular | Uygulanmaz | 18 yaş sınırı (#1); hedef kitle çocuk değil |

### B2. Veri türleri

**Sharing (paylaşım) — hepsi No.** Google tanımında aşağıdakiler "sharing" sayılmaz ve bu tabloda uygulanmıştır:
- Bizim adımıza ve talimatımızla çalışan **servis sağlayıcılara** aktarım: Supabase, Poof, Anthropic, FASHN, RevenueCat, OpenWeather, Expo.
- **Kullanıcının başlattığı** aktarım: paylaşım menüsü (#30), Verilerimi indir (#26).
- Apple / Google'ın giriş için kendi topladığı veri (biz alıcıyız, aktaran değil).

Amaç seçenekleri: *App functionality, Analytics, Developer communications, Advertising or marketing, Fraud prevention, security, and compliance, Personalization, Account management*.

| Kategori | Veri türü | Collected | Shared | Ephemeral? | Required / Optional | Amaç | Envanter |
|---|---|---|---|---|---|---|---|
| Location | Approximate location | **Yes** [T5] | No | **Yes** | Optional | App functionality | #17 |
| | Precise location | No | | | | | `ACCESS_FINE_LOCATION` engelli |
| Personal info | Name | **Yes** | No | No | Required | App functionality, Account management | #1, #2 |
| | Email address | **Yes** | No | No | Required | App functionality, Account management | #1, #2 |
| | User IDs | **Yes** [T7] | No | No | Required | App functionality, Account management, Fraud prevention, security, and compliance | #1, #18, #20 |
| | Address | No | | | | | |
| | Phone number | No | | | | | |
| | Race and ethnicity | **Yes** [T2] | No | No | Optional | App functionality | #12 (ten rengi, saç tipi) |
| | Political or religious beliefs | No | | | | | |
| | Sexual orientation | No | | | | | |
| | Other info | **Yes** [T1] | No | No | Optional | App functionality | #12 (yaş, boy, kilo, vücut tipi, saç) |
| Financial info | User payment info | No | | | | | Ödemeyi Google alır |
| | Purchase history | **Yes** [T6] | No | No | Optional | App functionality | #18 |
| | Credit score / Other financial info | No | | | | | |
| Health and fitness | Health info | **No** [T1] | | | | | → Other info |
| | Fitness info | No | | | | | |
| Messages | Emails / SMS or MMS / Other in-app messages | No | | | | | #28 uygulama dışında [T9] |
| Photos and videos | Photos | **Yes** [T3] | No | No | Optional | App functionality | #4, #9, #11, #13, #14 |
| | Videos | No | | | | | |
| Audio files | Voice or sound recordings / Music files / Other audio files | No | | | | | |
| Files and docs | Files and docs | No | | | | | |
| Calendar | Calendar events | No | | | | | Uygulama içi takvim cihaz takvimine erişmez; kombin kayıtları "Other user-generated content" |
| Contacts | Contacts | No | | | | | |
| App activity | App interactions | **Yes** [T4] | No | No | Required | App functionality, Fraud prevention, security, and compliance | #15, #20 |
| | In-app search history | No | | | | | |
| | Installed apps | No | | | | | |
| | Other user-generated content | **Yes** | No | No | Optional | App functionality | #3, #5, #16 |
| | Other actions | No | | | | | |
| Web browsing | Web browsing history | No | | | | | |
| App info and performance | Crash logs / Diagnostics / Other app performance data | No [T10] | | | | | |
| Device or other IDs | Device or other IDs | **Yes** [T8] | No | No | Required | App functionality | #27 |

**Ephemeral notu:** Fotoğraf türünde tarama fotoğrafı (#9) ve Poof / Anthropic'e giden kopyalar geçici işlenir, ama dolap ve profil fotoğrafları saklandığı için tür olarak "ephemeral = No". Konumda sunucumuz yok; Google'ın tanımındaki "yalnızca bellekte işlenip isteğe yanıt verecek kadar tutulur" koşulu OpenWeather'ın beyanına dayanır [beyan].

---

## C. Formlara girilecek URL'ler

| Alan | TR | EN | Nerede girilir |
|---|---|---|---|
| Gizlilik politikası | `https://sestinaapp.com/gizlilik` | `https://sestinaapp.com/privacy` | App Store Connect → App Privacy → Privacy Policy URL (dil başına: TR / EN yerelleştirme); Play Console → App content → Privacy policy (tek alan: **EN** önerilir, sayfada TR bağlantısı var) |
| Hesap silme | `https://sestinaapp.com/hesap-silme` | `https://sestinaapp.com/delete-account` | Play → Data safety → Delete account URL (**EN**); App Store'da zorunlu alan yok, uygulama içi silme var (Guideline 5.1.1(v)) |
| Kullanım koşulları | `https://sestinaapp.com/kosullar` | `https://sestinaapp.com/terms` | App Store: abonelik için EULA / açıklama bağlantısı |
| Destek | `support@sestinaapp.com` · `https://sestinaapp.com` | aynı | App Store Connect → Support URL (`https://sestinaapp.com`); Play → Store settings → Contact details → Email |

- Yollar uygulamadaki `src/constants/legal.ts` ile aynı (uzantısız). Dosyalar sestina-web'de `*.html` olarak var (`gizlilik.html`, `privacy.html`, `hesap-silme.html`, `delete-account.html`).
- **Canlı erişim doğrulanmadı:** kurumsal ağ proxy'si (FortiClient) sertifikayı değiştirdiği için sayfalar buradan açılamadı. Göndermeden önce dört URL'nin uzantısız hâliyle 200 döndüğü bir tarayıcıda kontrol edilmeli; açılmazsa `.html` uzantılı hâli girilir.

---

## D. Tartışmalı kararlar ve gerekçeler

| # | Konu | Karar | Gerekçe | Muhafazakâr alternatif |
|---|---|---|---|---|
| T1 | Boy, kilo, yaş, vücut tipi (#12) | Apple: **Other Data**, Health değil. Play: **Personal info → Other info**, Health info değil | Apple Health tanımı "sağlık veya tıbbi veri" (HealthKit, klinik kayıt vb.); Play Health info "tıbbi kayıt, semptom gibi sağlık bilgisi". Burada amaç kıyafet / manken ölçüsü; HealthKit / Health Connect yok, tanı ya da sağlık amacı yok | `ozel-nitelikli-veri-siniflandirmasi.md`'de kilo / vücut tipi için sağlık çağrışımı **değerlendirilmedi** (bölüm 5 #7a). Hukuki görüş "sağlık verisi" derse iki formda da Health seçilir; Apple'da 5.1.3 kuralları (reklamda kullanmama, iCloud'da tutmama) zaten karşılanıyor |
| T2 | Ten rengi, saç tipi (#12) | Apple: **Sensitive Info: Yes**. Play: **Race and ethnicity: Yes** | KVKK dokümanlarımız ve gizlilik politikası ten rengini "ırk / etnik köken bakımından özel nitelikli sayılabilir" diye niteliyor; formlar bununla tutarlı olmalı. Saç tipi ("afro") etnik çağrışım taşıyabilir | — (zaten muhafazakâr). "Hayır" seçmek politika metniyle çelişir |
| T3 | Profil fotoğrafı, try-on / manken görselleri, tarama fotoğrafı | Apple: **Photos or Videos: Yes**, linked. Play: **Photos: Yes**, optional | Kullanıcının fotoğrafı ve ondan üretilen görseller depomuzda, hesaba bağlı. Manken / try-on görselleri sunucuda üretilir ama kullanıcı fotoğrafından / tarifinden türer ve hesapla saklanır. Yüz geometrisi çıkarılmıyor → Biometric yok | — |
| T4 | Kullanım sayaçları, try-on kota kaydı (#15, #20) | Apple: **Product Interaction: Yes**, App Functionality. Play: **App interactions: Yes**, App functionality + Fraud prevention | İşlev başına günlük sayım "kullanıcının uygulamayla etkileşimi". Analitik için kullanılmıyor, kota ve kötüye kullanımın önlenmesi için | Sayaçlar sunucuda üretildiği için "toplanmıyor" denebilir; ama kullanıcıya bağlı ve 13 ay tutuluyor → beyan etmek daha savunulabilir |
| T5 | Konum (#17) | Apple: **Coarse Location: Yes, Not linked**. Play: **Approximate location: Yes, ephemeral, optional** | Cihazdan üçüncü tarafa çıkıyor → collected. 2 ondalık (~1 km) Apple'ın "3+ ondalıktan düşük çözünürlük" coarse tanımına uyuyor. Kullanıcı kimliği eklenmiyor, bizde saklanmıyor, OpenWeather beyanına göre saklanmıyor → not linked / ephemeral | OpenWeather IP'yi görür; IP'yi kimlikle eşleştirme yapılmıyor. "Linked" seçmek gereksiz şekilde fazla beyan olur |
| T6 | Satın alma (#18) | Apple: **Purchase History: Yes**, App Functionality, linked. Play: **Purchase history: Yes**, optional | RevenueCat kendi dokümanında Purchase History'yi topladığını belirtiyor; kayıt Supabase UUID'ye bağlı. Analytics seçilmedi: RevenueCat panosu kullanıcı davranışını değerlendirmek için kullanılmıyor | RevenueCat Charts ile ürün kararları verilirse Apple'da **Analytics** de eklenir |
| T7 | Kullanıcı kimliği (#1, #18) | Apple: **User ID: Yes**, linked. Play: **User IDs: Yes**, required | RevenueCat'e özel app user ID (= Supabase UUID) gönderiliyor; RevenueCat dokümanı bu durumda User ID beyanını istiyor | — |
| T8 | Expo kurulum kimliği (#27) | Apple: **Device ID: Yes, Not linked**. Play: **Device or other IDs: Yes**, required | Play tanımı uygulama kurulum kimliklerini açıkça kapsıyor (örnek: Firebase installation ID). Apple'ın "device-level ID" tanımına tam uymayabilir, ama iki formu tutarlı tutmak ve fazla beyan etmek, eksik beyandan daha güvenli. Hesapla eşleştirilmiyor → not linked | Apple'da "No" savunulabilir (donanım / reklam kimliği değil); Expo'nun güncel gizlilik rehberiyle teyit edilmeli |
| T9 | Destek yazışmaları (#28) | Apple: **Customer Support: No**. Play: beyan yok | Yazışma uygulama içinden değil, kullanıcının e-posta istemcisinden. Apple'ın "isteğe bağlı açıklama" ölçütleri (seyrek, birincil işlevle ilgisiz, kullanıcı başlatır, kimliği açıkça gösterir) karşılanıyor | Uygulamaya destek formu eklenirse Apple: Customer Support, Play: Other in-app messages beyan edilir |
| T10 | Teşhis / IP | Crash / diagnostics: **No**. IP ayrı beyan edilmez | Cihazda crash veya performans SDK'sı yok; sunucu logları (#23) ve auth denetim kayıtlarındaki IP (#24) cihazdan "teşhis verisi" olarak toplanmıyor, güvenlik için sunucuda oluşuyor. İki mağazada da IP için ayrı tür yok; IP'den konum çıkarılmıyor | Crash raporlama (ör. Sentry) eklenirse Crash Data / Crash logs beyan edilir |

**Bilinçli olarak beyan edilmeyenler:** Google girişindeki profil resmi bağlantısı (Google'dan gelen URL; fotoğraf cihazdan toplanmıyor, hesapta metin olarak duruyor — Name / Email ile aynı kaynağın parçası). URL ile ürün okuma (#10, pasif; açılırsa Apple Browsing History değil, Other User Content olarak gözden geçirilir).

---

## E. Envanterle çelişkiler / dikkat edilecekler

1. **Hesap silme sayfasında e-posta süresi iki farklı yazıyor (sestina-web, TR ve EN):** bölüm 2 "talebin **doğrulandıktan** sonra en geç 30 gün içinde", bölüm 5 "talebini **aldıktan** sonra en geç 30 gün içinde". `basvuru-proseduru.md` bölüm 4 süreyi doğrulamadan başlatıyor [hukuki teyit gerekli]. Play'e silme URL'si verilmeden önce bölüm 5 tek ifadeye indirilmeli. (Bu repo dışı, sestina-web düzeltmesi.)
2. **Konum izni:** envanter #17 "Rıza / tercih bağlantısı" sütununda yalnızca "iOS konum izni" yazıyordu; Android'de de `ACCESS_COARSE_LOCATION` isteniyor. Envanterde düzeltildi.
3. **Envanterde olup formda ayrı tür karşılığı olmayanlar:** IP (#24), sunucu logları (#23), yedekler (#25), silme kaydı (#22), yazışmalar (#28). Bilinçli karar (T9, T10); formda eksik değil.
4. **Gizlilik politikası "Expo: rastgele kurulum kimliği"** diyor; formda Device ID beyan ediliyor (T8). Çelişki değil, ama politika "cihaz kimliği toplamıyoruz" gibi bir ifade eklenirse çelişir.

---

## F. Gönderim öncesi kontrol listesi

- [ ] URL'ler tarayıcıda 200 (bölüm C).
- [ ] Hesap silme sayfasındaki süre ifadesi tekleştirildi (E1).
- [ ] T1 için hukuki görüş alındıysa Health / Health info kararı güncellendi.
- [ ] RevenueCat'in güncel "Apple App Privacy" ve "Google Play Data Safety" sayfaları formla karşılaştırıldı (bu taslak: Purchase History + User ID).
- [ ] Expo'nun `expo-updates` için güncel gizlilik rehberi T8 ile karşılaştırıldı.
- [ ] Yeni SDK eklenirse (analitik, crash, push) bu dosya ve iki form güncellenir.

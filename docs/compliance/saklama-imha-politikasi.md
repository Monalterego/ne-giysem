# Kişisel Veri Saklama ve İmha Politikası

**Sürüm:** 1.2 · **Son güncelleme:** 5 Kasım 2026 · **Sorumlu:** Hasan Can Demircan (veri sorumlusu; tüm roller)
**Kaynak:** `data-inventory.md` · **Dayanak:** KVKK m. 7; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik ("Yönetmelik")

Not: Yönetmelik m. 5 uyarınca politika hazırlama yükümlülüğü sicile kayıtla yükümlü veri sorumluları içindir. Veri sorumlusu bundan istisnadır (`verbis-degerlendirmesi.md`); bu politika iyi uygulama olarak tutulur.

---

## 1. Kayıt ortamları

| Ortam | İçerik | Konum |
|---|---|---|
| Supabase Postgres | Hesap, dolap meta verisi, kombinler, rıza kayıtları, sayaçlar, silme kaydı | Supabase, Inc.; proje bölgesi AB / Frankfurt (`eu-central-1`) |
| Supabase Storage (özel bucket'lar) | `wardrobe-items`, `avatars`, `mannequin-cache` | Aynı |
| Supabase log'ları | Edge function ve auth log'ları | Aynı; 1 gün (Free plan) |
| Veritabanı yedekleri | Haftalık DB dökümü (fotoğraflar yok) | Veri sorumlusunun kişisel Google Drive'ı ("Sestina Yedekler"), AES-256 (gpg) |
| E-posta | Destek ve başvuru yazışmaları | Cloudflare (yönlendirme) → Gmail |
| Kullanıcı cihazı | Oturum, dil, görünüm tercihi | Cihaz (bizim kontrolümüzde değil) |
| Üçüncü taraflar | Poof, Anthropic, FASHN, RevenueCat, Expo, OpenWeather | Sağlayıcıların beyan ettiği süreler |

## 2. Saklama süreleri ve imha yöntemi

| Veri (envanter #) | Süre | İmha yöntemi | Nasıl tetiklenir |
|---|---|---|---|
| Hesap, stil, dolap, kombinler, favoriler, abonelik, kota kayıtları, rıza kayıtları (#1–5, 15, 16, 18, 19) | Hesap süresince | **Silme** (DB satırı + depo dosyası) | Hesap silme: `delete-account` → depo temizliği + `auth.admin.deleteUser` (cascade) |
| Tek parça ve ilgili try-on görselleri (#4, #14) | Kullanıcı silene kadar | Silme | Uygulamada parça silme (`privacyActions.deleteWardrobeItemFiles`) |
| Profil fotoğrafı ve ondan türeyen görseller (#11, #14) | Kaldırma / rıza geri çekme / hesap silme | Silme | `privacyActions.removeAvatarAndTryOns` |
| Fiziksel profil, manken ve mankenli görseller (#12, #14) | Rıza geri çekme / hesap silme | Silme (alanlar NULL, dosyalar silinir) | `privacyActions.removePhysicalData` |
| Günlük kullanım sayaçları (#20) | **13 ay** | Silme | Otomatik, günlük (bölüm 3) |
| Operasyon kayıtları (#21) | **12 ay** | Silme | Otomatik, günlük |
| Hesap silme kaydı (#22) — `subject_hash` (geri döndürülemeyen özet) dahil | **En az 3 yıl, sonra silinir** (Yönetmelik m. 7/3) | Silme | Otomatik, günlük |
| Auth denetim kayıtları, IP dahil (#24) | **En fazla 90 gün** | Silme | Otomatik, günlük (016) |
| Sunucu log'ları (#23) | **1 gün** | Sağlayıcı tarafında silme | Supabase Free plan |
| Veritabanı yedekleri (#25) | **En fazla 30 gün** | Silme (Drive'dan kalıcı silme, çöp kutusu dahil) | **Elle**, haftalık (bölüm 4) |
| Destek ve başvuru yazışmaları (#28) | Talep kapanışından **2 yıl** | Silme (Gmail'den kalıcı silme) | **Elle**, aylık kontrol (bölüm 5) |
| Başvuru kayıt defteri | Başvuru kapanışından **2 yıl** (yazışmalarla aynı) | Silme | Elle, aylık kontrol |
| Sağlayıcılara iletilen veriler | Sağlayıcının beyan ettiği süre | Sağlayıcı siler | Bizim kontrolümüz dışında |

## 3. Otomatik temizlik

- **Fonksiyon:** `public.purge_retention()` — tanım: `014_privacy_consent.sql`, `015_deletion_log_retention.sql`, son hâli `016_auth_audit_retention.sql`. Dönüş değeri: silinen satır sayıları (`api_usage`, `ops_events`, `deletion_log`, `auth_audit`).
- **Zamanlama:** pg_cron işi `sestina_retention_purge`, her gün 03:17 UTC (`014_privacy_consent.sql`, sondaki `do` bloğu).
- **Periyot:** Yönetmelik m. 11 uyarınca periyodik imha süresi 6 ayı aşamaz; günlük çalıştırma bu sınırın içinde.
- **Kontrol (ayda bir):**
  ```sql
  select jobname, active from cron.job where jobname = 'sestina_retention_purge';
  select start_time, status, return_message from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'sestina_retention_purge')
   order by start_time desc limit 5;
  ```
  `auth_audit = -1` dönüyorsa auth tablosunu silme yetkisi yoktur; satırlar elle ya da Supabase desteğiyle silinir ve imha kaydına yazılır.
- **Doğrulandı (22.10.2026):** pg_cron etkin, 014–016 uygulandı; `purge_retention()` çalıştırıldı, `auth_audit = 0` (silinecek eski satır yok), auth tablosunu silme yetkisi var.

## 4. Elle yedek prosedürü (haftalık)

**Durum:** ilk yedek **23.10.2026**'da alındı; AES-256 (gpg simetrik), Google Drive "Sestina Yedekler" klasörü; şifre çözme testi başarılı. Aşağıdaki Codespace komutları **05.11.2026**'da uçtan uca doğrulandı.

1. **Zamanlama:** her pazartesi.
2. **Döküm:** yalnızca veritabanı (şema + veri) — Supabase CLI `supabase db dump`, GitHub Codespace'te. **Storage (fotoğraflar) yedeklenmez.**
3. **Şifreleme:** döküm, Drive'a yüklenmeden **önce** Codespace'te AES-256 ile şifrelenir (gpg simetrik). Yedek parolası iPhone **Parolalar** uygulamasında tutulur; Drive'da, e-postada, repoda, komut satırında ve kabuk geçmişinde tutulmaz (`read -s` ile alınır).
4. **Yükleme:** şifreli dosya veri sorumlusunun kişisel Google Drive hesabındaki **"Sestina Yedekler"** klasörüne yüklenir. Dosya adında tarih olur, kişisel veri olmaz (ör. `sestina-db-2026-11-05.tar.gz.gpg`).
5. **Temizlik:** şifresiz dosyalar, şifre çözme doğrulandıktan sonra; şifreli kopya, Drive'a yüklendikten **sonra** Codespace'ten ve indirildiği cihazdan (İndirilenler + geri dönüşüm kutusu dahil) silinir.
6. **30 gün kuralı:** yükleme sırasında 30 günden eski yedekler Drive'dan silinir ve **çöp kutusundan da** kalıcı olarak boşaltılır.
7. **Asla:** yedekler (şifreli ya da şifresiz) **git deposuna** konmaz (`*.gpg` `.gitignore`'da; döküm klasörü `~/yedek` repo dışında), e-postayla gönderilmez, paylaşılan bağlantıyla açılmaz.
8. **Kayıt:** her yedek, her silme ve her aksama (atlanan hafta, başarısız döküm / doğrulama) imha kaydına (bölüm 6) bir satır olarak yazılır.
9. **Hesap güvenliği:** Google hesabında iki adımlı doğrulama açık (`guvenlik-tedbirleri.md` bölüm 1).

**Parolaların yeri:** DB şifresi, yedek parolası ve `DELETION_LOG_PEPPER` yalnızca iPhone **Parolalar** uygulamasında tutulur (pepper ayrıca Supabase secret'ı olarak). Bu belgede "Parolalar" bu uygulamayı ifade eder.

### Komutlar (Codespace, 05.11.2026'da doğrulandı)

Tüm adımlar **aynı terminalde** sırayla çalıştırılır (`$D` değişkeni adımlar arasında kullanılır). Gizli değerler komuta, dosyaya ya da kabuk geçmişine yazılmaz; `read -s` ile ekrana yansımadan alınır ve işten sonra `unset` edilir.

**a. Hazırlık** — çalışma klasörü repo dışında:

```bash
mkdir -p ~/yedek
D=$(date +%F)
```

**b. Döküm** — Codespace'te IPv6 olmadığı için doğrudan bağlantı yerine **Session pooler** (IPv4) kullanılır: `aws-1-eu-central-1.pooler.supabase.com:5432`, kullanıcı `postgres.bdvrgbylirftuxmrpbea`.

```bash
read -s -p "DB şifresi (Parolalar): " P; echo
U="postgresql://postgres.bdvrgbylirftuxmrpbea:${P}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
npx supabase db dump --db-url "$U" -f ~/yedek/schema-$D.sql
npx supabase db dump --db-url "$U" --data-only -f ~/yedek/data-$D.sql
unset P U
```

Şifre `@ : / ? #` gibi karakterler içeriyorsa bağlantı dizesinde yüzde kodlaması gerekir.

**c. Kontrol** — dökümdeki `wardrobe_items` satır sayısı canlı veritabanıyla eşit olmalı. CLI veriyi `COPY` olarak değil, tablo başına **tek, çok satırlı `INSERT`** olarak yazar (her satır `(` ile başlayan ayrı bir satır):

```bash
awk '/^INSERT INTO "public"."wardrobe_items"/{f=1; next} f && /^[[:space:]]*\(/{n++} f && /;[[:space:]]*$/{f=0} END{print n+0}' ~/yedek/data-$D.sql
```

Supabase SQL Editor'da:

```sql
select count(*) from wardrobe_items;
```

İki sayı eşit değilse döküm tekrarlanır; aksama kayda yazılır.

**d. Şifreleme** — iki dosya paketlenir, paket AES-256 ile şifrelenir. Parola here-string ile gpg'nin standart girdisine verilir:

```bash
tar czf ~/yedek/sestina-db-$D.tar.gz -C ~/yedek schema-$D.sql data-$D.sql
read -s -p "Yedek parolası (Parolalar): " K; echo
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --symmetric --cipher-algo AES256 \
  -o ~/yedek/sestina-db-$D.tar.gz.gpg ~/yedek/sestina-db-$D.tar.gz <<< "$K"
unset K
```

**e. Doğrulama** — parola Parolalar'dan **ikinci kez, ayrıca kopyalanarak** girilir. Böylece Parolalar'da saklanan değerin şifrelemede kullanılan parolayla aynı olduğu kanıtlanır. Çözülen paketin sha256'sı orijinal paketinkiyle **aynı** olmalı:

```bash
read -s -p "Yedek parolası — Parolalar'dan YENİDEN kopyala: " K; echo
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt \
  -o ~/yedek/kontrol-$D.tar.gz ~/yedek/sestina-db-$D.tar.gz.gpg <<< "$K"
unset K
sha256sum ~/yedek/sestina-db-$D.tar.gz ~/yedek/kontrol-$D.tar.gz
```

Özetler farklıysa ya da şifre çözme hata verirse şifresiz dosyalar silinmez; adım d'den tekrarlanır.

**f. Şifresiz dosyaları sil:**

```bash
rm ~/yedek/schema-$D.sql ~/yedek/data-$D.sql ~/yedek/sestina-db-$D.tar.gz ~/yedek/kontrol-$D.tar.gz
```

**g. İndirme ve yükleme** — Codespace dosya gezgini yalnızca çalışma alanındaki dosyaları indirebildiği için `.gpg` geçici olarak repo klasörüne taşınır; `*.gpg` kuralıyla git dışında kaldığı doğrulanır:

```bash
mv ~/yedek/sestina-db-$D.tar.gz.gpg /workspaces/ne-giysem/ne-giysem/
cd /workspaces/ne-giysem && git check-ignore -v ne-giysem/sestina-db-$D.tar.gz.gpg
```

Çıktıda `*.gpg` kuralı görünmeli (boş çıktı = dosya git'e girebilir; devam etme). Sonra:

1. Dosya gezgininden indir → Drive "Sestina Yedekler"e yükle → Drive'da göründüğünü ve boyutun aynı olduğunu kontrol et.
2. Codespace'ten sil:
   ```bash
   rm /workspaces/ne-giysem/ne-giysem/sestina-db-$D.tar.gz.gpg && ls -A ~/yedek
   ```
   `ls` çıktısı boş olmalı.
3. İndirilen cihazdan sil (İndirilenler + geri dönüşüm kutusu / çöp kutusu).
4. İmha kaydına (bölüm 6) yedek satırını yaz; 30 günden eski yedekleri Drive'dan ve Drive çöp kutusundan sil, onları da kaydet.

**Etki:** hesap silen kullanıcının DB kayıtları en fazla 30 gün yedekte kalabilir; metinlerde bu böyle yazılıdır.

## 4a. Yedekten geri yükleme prosedürü

Geri yükleme yalnızca veri kaybı / bozulma hâlinde yapılır. Yedek, alındığı tarihten **sonra** silinmiş hesapları da içerir. Bu hesaplar geri yükleme biter bitmez, uygulama trafiğe açılmadan önce yeniden silinir.

**Dayanak:** `deletion_log.subject_hash` = HMAC-SHA256(`DELETION_LOG_PEPPER`, user_id). `delete-account` her silmede yazar (`017_deletion_subject_hash.sql`).

1. **Hazırlık:** Bakım duyurusu yapılır. Edge function'lar geçici olarak kapatılabilir; en azından yeni kayıt ve giriş beklenmez.
2. **Şifre çöz ve geri yükle:** Drive'daki şifreli döküm yerel makinede ya da Codespace'te açılır (parola: iPhone Parolalar) ve Supabase'e yüklenir. Şifresiz döküm iş bitince yerelden silinir.
3. **`deletion_log`'u koru:** Geri yükleme `deletion_log` tablosunu da yedekteki hâline döndürür; yedekten sonraki silme satırları kaybolur. Bu yüzden geri yüklemeden **önce** canlı veritabanından `deletion_log` dışa aktarılır (`copy (select * from deletion_log) to stdout` / CSV), geri yüklemeden **sonra** eksik satırlar geri eklenir. Canlı veritabanı tamamen kaybolduysa bu adım yapılamaz; o durumda en güncel yedekteki `deletion_log` kullanılır ve aradaki silmeler hesap silme e-postaları / log'lardan elle belirlenir [?].
4. **Yeniden silme:** service_role ile çağrılır. Pepper SQL Editor'a yazılmaz, ortam değişkeninden verilir:
   ```bash
   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/purge_restored_deleted_accounts" \
     -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" -d "{\"p_pepper\": \"$DELETION_LOG_PEPPER\"}"
   ```
   Dönüş: `matched`, `auth_users`, `public_rows`, `storage_objects`. `auth.users` ve `profiles`'ta özeti silme kaydında bulunan hesaplar silinir (cascade + doğrudan public tablolar + varsa storage meta verisi).
5. **RevenueCat:** yedekte RevenueCat bilgisi yoktur; abone kayıtları silme anında zaten silinmiştir. Ek işlem gerekmez.
6. **Fotoğraflar:** yedeklenmediği için geri gelmez. Geri yüklenen ve silinmemiş kullanıcıların fotoğraf kayıtları dosyasız kalabilir; uygulama bunları görsel yok olarak gösterir.
7. **Kayıt:** imha kaydına "geri yükleme — yedek tarihi, `matched` sayısı, yapan" satırı yazılır.
8. **Doğrulama:**
   ```sql
   select count(*) from auth.users u
    where encode(extensions.hmac(u.id::text, '<pepper>', 'sha256'), 'hex')
          in (select subject_hash from deletion_log);
   ```
   Sonuç 0 olmalı. Pepper yalnızca bu tek sorgu için, iPhone Parolalar uygulamasından kopyalanır.

**Pepper yönetimi:** `DELETION_LOG_PEPPER` en az 32 rastgele bayttır (ör. `openssl rand -hex 32`). Supabase secret'ı olarak ve ayrıca iPhone Parolalar uygulamasında tutulur; repoda, kodda ve veritabanında yer almaz. **Değiştirilmez** — değişirse eski silme kayıtları eşleşmez. Kaybolursa geri yükleme eşleştirmesi yapılamaz. 017'den önceki silme kayıtlarında `subject_hash` yoktur; bu kayıtlar için 3. adımdaki elle belirleme uygulanır.

**Not (05.11.2026):** Lansman öncesi, pepper'ın kopyası bulunmadığı için yenilendi. O tarihte `deletion_log`'da yalnızca 1 test silme kaydı vardı; bu kayıt yeni pepper ile eşleşmez. Lansmandan sonra pepper değiştirilmez.

## 5. Elle imha kontrolleri (aylık)

| Kontrol | İşlem |
|---|---|
| Gmail | Kapanışından 2 yıl geçmiş destek / başvuru yazışmalarını kalıcı sil (çöp kutusu dahil) |
| Başvuru kayıt defteri | 2 yılı geçen satırları sil |
| Drive | 30 günden eski yedek kalmadığını doğrula |
| pg_cron | Bölüm 3'teki sorgular |
| Cihazda kalıntı | Codespace'te (`~/yedek`, `/workspaces/ne-giysem/ne-giysem/*.gpg`) ve indirme yapılan cihazda döküm / dışa aktarım dosyası kalmadığını doğrula |

## 6. İmha kaydı

- **Otomatik silmeler:** `cron.job_run_details` (her çalıştırmanın dönüş değeri) + hesap silmeler için `deletion_log`.
- **Elle işlemler:** kayıt Google Drive'daki **"Sestina İmha ve Yedek Kaydı"** e-tablosunda tutulur — yedek klasörünün ("Sestina Yedekler") **dışında**, böylece yedek silinirken kayıt etkilenmez. Bu dosyada tutulmaz (kişisel veri içerebilir).
- **Kayda yazılanlar:** her elle silme, **her alınan yedek** ve **her aksama** (atlanan haftalık yedek, başarısız döküm, satır sayısı ya da sha256 uyuşmazlığı, gecikmiş silme) — aksama satırında neden ve yapılan düzeltme de yazılır.

Sütunlar (örnek satırlar):

| Tarih | Tür | Ortam | Kapsam (tür ve adet; kişi adı yazılmaz) | Yöntem | Gerekçe / not | Yapan |
|---|---|---|---|---|---|---|
| 2026-__-__ | Yedek | Drive | 1 DB yedeği; `wardrobe_items` sayısı eşleşti; sha256 eşleşti | gpg AES-256 | Haftalık | HCD |
| 2026-__-__ | Silme | Drive | 1 DB yedeği (2026-__-__) | Kalıcı silme (çöp kutusu dahil) | 30 gün doldu | HCD |
| 2026-__-__ | Aksama | — | Haftalık yedek alınmadı | — | Neden + telafi tarihi | HCD |

Kayıtlar **en az 3 yıl** saklanır (Yönetmelik m. 7/3).

## 7. Gözden geçirme

Bu politika şu durumlarda güncellenir: yılda bir kez; yeni bir veri işleme faaliyeti, sağlayıcı ya da Supabase planı değişikliği olduğunda; `data-inventory.md` değiştiğinde.

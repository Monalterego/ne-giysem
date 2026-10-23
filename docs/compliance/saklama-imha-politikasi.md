# Kişisel Veri Saklama ve İmha Politikası

**Sürüm:** 1.1 · **Tarih:** 23 Ekim 2026 · **Sorumlu:** Hasan Can Demircan (veri sorumlusu; tüm roller)
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

**Durum:** ilk yedek **23.10.2026**'da alındı; AES-256 (gpg simetrik), Google Drive "Sestina Yedekler" klasörü; şifre çözme testi başarılı.

1. **Zamanlama:** her pazartesi.
2. **Döküm:** yalnızca veritabanı (roller + şema + veri) — Supabase CLI `supabase db dump`. **Storage (fotoğraflar) yedeklenmez.**
3. **Şifreleme:** döküm, Drive'a yüklenmeden **önce** yerel makinede AES-256 ile şifrelenir (`gpg --symmetric --cipher-algo AES256`). Parola bir parola yöneticisinde tutulur; Drive'da, e-postada, repoda ve komut satırında (`--passphrase`) tutulmaz — gpg parolayı terminalde sorar.
4. **Yükleme:** şifreli dosya veri sorumlusunun kişisel Google Drive hesabındaki **"Sestina Yedekler"** klasörüne yüklenir. Dosya adında tarih olur, kişisel veri olmaz (ör. `sestina-db-2026-10-26.tar.gz.gpg`).
5. **Yerel temizlik:** şifresiz döküm, şifreleme doğrulandıktan sonra; şifreli kopya, Drive'a yüklendiği görüldükten **sonra** silinir. Döküm başka bir cihaza indirildiyse (ör. şifre çözme testi için) **o cihazdan da** silinir (İndirilenler klasörü ve çöp kutusu dahil).
6. **30 gün kuralı:** yükleme sırasında 30 günden eski yedekler Drive'dan silinir ve **çöp kutusundan da** kalıcı olarak boşaltılır.
7. **Asla:** yedekler (şifreli ya da şifresiz) **git deposuna** konmaz (`*.gpg` `.gitignore`'da; döküm klasörü repo dışında), e-postayla gönderilmez, paylaşılan bağlantıyla açılmaz.
8. **Kayıt:** her yedek ve her silme, imha kaydına (bölüm 6) bir satır olarak yazılır.
9. ~~**Hesap güvenliği:** Google hesabında iki adımlı doğrulama açık olmalı~~ — açık (23.10.2026, `guvenlik-tedbirleri.md` bölüm 1).

**Haftalık komut bloğu** (Git Bash / bash; `ne-giysem/` içinden, `supabase link` yapılmış hâlde). Her adım `&&` ile bağlı: biri başarısız olursa sonrakiler çalışmaz, hiçbir şey silinmez. Döküm repo **dışındaki** `~/sestina-yedek/` klasörüne yazılır.

```bash
D=$(date +%F) && W="$HOME/sestina-yedek" && B="sestina-db-$D" \
&& mkdir -p "$W/$B" \
&& supabase db dump --linked --role-only -f "$W/$B/roles.sql" \
&& supabase db dump --linked -f "$W/$B/schema.sql" \
&& supabase db dump --linked --data-only --use-copy -f "$W/$B/data.sql" \
&& tar -C "$W" -czf "$W/$B.tar.gz" "$B" \
&& gpg --pinentry-mode loopback --symmetric --cipher-algo AES256 -o "$W/$B.tar.gz.gpg" "$W/$B.tar.gz" \
&& gpg --pinentry-mode loopback --decrypt "$W/$B.tar.gz.gpg" | cmp - "$W/$B.tar.gz" \
&& rm -rf "$W/$B" "$W/$B.tar.gz" \
&& echo "Şifre çözme testi geçti. Şimdi $W/$B.tar.gz.gpg dosyasını Drive > Sestina Yedekler'e yükle." \
&& read -r -p "Dosya Drive'da görünüyor ve boyutu aynı mı? (evet yaz): " OK \
&& [ "$OK" = "evet" ] \
&& rm "$W/$B.tar.gz.gpg" \
&& echo "Tamam: $B yüklendi, yerel kopyalar silindi. İmha kaydına satır yaz; 30 günden eski yedekleri sil."
```

- `cmp` adımı şifreli dosyanın aynı parolayla açılıp orijinalle bayt bayt eşleştiğini doğrular; eşleşmezse şifresiz döküm silinmez.
- "evet" dışında bir yanıt (veya Ctrl+C) zinciri durdurur; şifreli kopya yerelde kalır, yükleme tamamlanınca `rm` elle çalıştırılır.
- Blok sonunda `ls "$HOME/sestina-yedek"` boş olmalı (bölüm 5, "Cihazda kalıntı").

**Etki:** hesap silen kullanıcının DB kayıtları en fazla 30 gün yedekte kalabilir; metinlerde bu böyle yazılıdır.

## 4a. Yedekten geri yükleme prosedürü

Geri yükleme yalnızca veri kaybı / bozulma hâlinde yapılır. Yedek, alındığı tarihten **sonra** silinmiş hesapları da içerir. Bu hesaplar geri yükleme biter bitmez, uygulama trafiğe açılmadan önce yeniden silinir.

**Dayanak:** `deletion_log.subject_hash` = HMAC-SHA256(`DELETION_LOG_PEPPER`, user_id). `delete-account` her silmede yazar (`017_deletion_subject_hash.sql`).

1. **Hazırlık:** Bakım duyurusu yapılır. Edge function'lar geçici olarak kapatılabilir; en azından yeni kayıt ve giriş beklenmez.
2. **Şifre çöz ve geri yükle:** Drive'daki şifreli döküm yerel makinede açılır ve Supabase'e yüklenir. Şifresiz döküm iş bitince yerelden silinir.
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
   Sonuç 0 olmalı. Pepper yalnızca bu tek sorgu için, parola yöneticisinden kopyalanır.

**Pepper yönetimi:** `DELETION_LOG_PEPPER` en az 32 rastgele bayttır (ör. `openssl rand -hex 32`). Supabase secret'ı olarak ve ayrıca parola yöneticisinde tutulur; repoda, kodda ve veritabanında yer almaz. **Değiştirilmez** — değişirse eski silme kayıtları eşleşmez. Kaybolursa geri yükleme eşleştirmesi yapılamaz. 017'den önceki silme kayıtlarında `subject_hash` yoktur; bu kayıtlar için 3. adımdaki elle belirleme uygulanır.

## 5. Elle imha kontrolleri (aylık)

| Kontrol | İşlem |
|---|---|
| Gmail | Kapanışından 2 yıl geçmiş destek / başvuru yazışmalarını kalıcı sil (çöp kutusu dahil) |
| Başvuru kayıt defteri | 2 yılı geçen satırları sil |
| Drive | 30 günden eski yedek kalmadığını doğrula |
| pg_cron | Bölüm 3'teki sorgular |
| Cihazda kalıntı | Yerel diskte döküm / dışa aktarım dosyası kalmadığını doğrula |

## 6. İmha kaydı

- **Otomatik silmeler:** `cron.job_run_details` (her çalıştırmanın dönüş değeri) + hesap silmeler için `deletion_log`.
- **Elle silmeler:** her biri aşağıdaki tabloya yazılır. Kayıt bu dosyada değil, veri sorumlusunun yerelinde ya da Drive'da tutulur (kişisel veri içerebilir).

| Tarih | Ortam | Silinen (tür ve adet; kişi adı yazılmaz) | Yöntem | Gerekçe | Yapan |
|---|---|---|---|---|---|
| 2026-__-__ | Drive | 1 DB yedeği (2026-__-__) | Kalıcı silme | 30 gün doldu | HCD |

Kayıtlar **en az 3 yıl** saklanır (Yönetmelik m. 7/3).

## 7. Gözden geçirme

Bu politika şu durumlarda güncellenir: yılda bir kez; yeni bir veri işleme faaliyeti, sağlayıcı ya da Supabase planı değişikliği olduğunda; `data-inventory.md` değiştiğinde.

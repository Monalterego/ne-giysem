# Kişisel Veri Saklama ve İmha Politikası

**Sürüm:** 1.0 · **Tarih:** 22 Ekim 2026 · **Sorumlu:** Hasan Can Demircan (veri sorumlusu; tüm roller)
**Kaynak:** `data-inventory.md` · **Dayanak:** KVKK m. 7; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik ("Yönetmelik")

Not: Yönetmelik m. 5 uyarınca politika hazırlama yükümlülüğü sicile kayıtla yükümlü veri sorumluları içindir. Veri sorumlusu bundan istisnadır (`verbis-degerlendirmesi.md`); bu politika iyi uygulama olarak tutulur.

---

## 1. Kayıt ortamları

| Ortam | İçerik | Konum |
|---|---|---|
| Supabase Postgres | Hesap, dolap meta verisi, kombinler, rıza kayıtları, sayaçlar, silme kaydı | Supabase, Inc.; proje bölgesi AB / Frankfurt [?] |
| Supabase Storage (özel bucket'lar) | `wardrobe-items`, `avatars`, `mannequin-cache` | Aynı |
| Supabase log'ları | Edge function ve auth log'ları | Aynı; 1 gün (Free plan) |
| Veritabanı yedekleri | Haftalık DB dökümü (fotoğraflar yok) | Veri sorumlusunun kişisel Google Drive'ı, AES-256 |
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
| Hesap silme kaydı (#22) | **En az 3 yıl, sonra silinir** (Yönetmelik m. 7/3) | Silme | Otomatik, günlük |
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
- **[?]** pg_cron'un projede etkin olduğu ve 014–016'nın çalıştırıldığı doğrulanmadı. Doğrulanana kadar bu süreler fiilen uygulanmıyor sayılır; ayda bir `select public.purge_retention();` elle çalıştırılır.

## 4. Elle yedek prosedürü (haftalık)

1. **Zamanlama:** her pazartesi.
2. **Döküm:** yalnızca veritabanı (şema + veri) — Supabase CLI `supabase db dump` veya panelden. **Storage (fotoğraflar) yedeklenmez.**
3. **Şifreleme:** döküm, Drive'a yüklenmeden **önce** yerel makinede AES-256 ile şifrelenir (ör. `7z a -mhe=on -p` ya da `gpg --symmetric --cipher-algo AES256`). Parola bir parola yöneticisinde tutulur; Drive'da, e-postada veya repoda tutulmaz.
4. **Yükleme:** şifreli dosya veri sorumlusunun kişisel Google Drive hesabındaki ayrı bir klasöre yüklenir. Dosya adında tarih olur, kişisel veri olmaz (ör. `sestina-db-2026-10-26.7z`).
5. **Yerel temizlik:** şifresiz döküm ve şifreli kopya yerel diskten silinir.
6. **30 gün kuralı:** yükleme sırasında 30 günden eski yedekler Drive'dan silinir ve **çöp kutusundan da** kalıcı olarak boşaltılır.
7. **Asla:** yedekler (şifreli ya da şifresiz) **git deposuna** konmaz, e-postayla gönderilmez, paylaşılan bağlantıyla açılmaz.
8. **Kayıt:** her yedek ve her silme, imha kaydına (bölüm 6) bir satır olarak yazılır.
9. **Hesap güvenliği:** Google hesabında iki adımlı doğrulama açık olmalı [?].

**Etki:** hesap silen kullanıcının DB kayıtları en fazla 30 gün yedekte kalabilir; metinlerde bu böyle yazılıdır.

**Geri yükleme:** bir yedekten geri yükleme yapılırsa, yedek tarihinden sonra silinen hesaplar `deletion_log` ile karşılaştırılarak geri yükleme sonrası **yeniden silinir**. `deletion_log` kimlik içermediği için eşleştirme **yapılamaz** [?]; bu nedenle geri yükleme yalnızca felaket durumunda yapılır ve hukuki görüş alınır.

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

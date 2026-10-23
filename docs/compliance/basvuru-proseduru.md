# İlgili Kişi Başvuru Prosedürü

**Sürüm:** 1.0 · **Tarih:** 22 Ekim 2026 · **Sorumlu:** Hasan Can Demircan
**Dayanak:** KVKK m. 11, 13, 14; Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ ("Tebliğ")
**Kamuya açık metin:** sestinaapp.com/basvuru · /requests — bu prosedürle birebir tutarlı tutulur
**Kayıt:** `basvuru-kayit-defteri-sablonu.md`

---

## 1. Kanal

- **Adres:** support@sestinaapp.com. Cloudflare Email Routing ile veri sorumlusunun Gmail kutusuna yönlenir.
- **Geçerli başvuru (Tebliğ m. 5/1):** veri sorumlusuna önceden bildirilmiş ve veri sorumlusunun sisteminde kayıtlı e-posta adresinden, yani hesaba kayıtlı e-posta adresinden gelen e-posta.
- **Kayıtlı adres dışından gelen e-posta:** doğrulama kodu süreci (bölüm 4). Kod kayıtlı adresten yanıtlanınca başvuru işleme alınır.
- **Kapsam dışı kanallar:** KEP, posta, noter, telefon, sosyal medya ve uygulama mağazası yorumları başvuru kanalı olarak ilan edilmemiştir. Bu yollarla gelen talep, ilgili kişiye e-posta kanalını bildiren bir yanıtla karşılanır; kanıtlanabilir bir yazılı başvuru gelirse hukuki görüş alınır.
- **Uygulama içi self-servis:** Verilerimi indir, düzenleme, izinleri geri çekme ve hesap silme. Bunlar başvuru sayılmaz, deftere yazılmaz.

## 2. Başvuruda aranan bilgiler (Tebliğ m. 5/2)

| Bilgi | Zorunlu |
|---|---|
| Ad, soyad | Evet |
| T.C. vatandaşı: T.C. kimlik no · Yabancı: uyruk + pasaport no veya varsa kimlik no | Evet |
| Tebligata esas yerleşim yeri veya iş yeri adresi | Evet |
| Varsa bildirime esas e-posta, telefon, faks | Varsa |
| Talep konusu | Evet |
| İmza | Yalnızca yazılı (ıslak imzalı) başvuruda; e-posta başvurusunda aranmaz |

**Eksik bilgi:** başvuru reddedilmez; eksiklik e-postayla bir kez istenir ve 30 günlük süre **tam başvurunun alındığı tarihten** başlar [hukuki teyit gerekli].

**Kimlik bilgileri:** TCKN / pasaport no yalnızca başvuruyu sonuçlandırmak için kullanılır. Kayıt defterine **yazılmaz**; yazışmada kalır ve yazışmayla birlikte 2 yıl sonra silinir.

## 3. Alma ve kayıt

1. Gelen her başvuruya defterde bir satır açılır: `B-YYYY-NNN`.
2. **Alındı yanıtı** 2 iş günü içinde gönderilir: başvuru numarası, son yanıt tarihi (alış + 30 gün) ve gerekiyorsa eksik bilgi ya da doğrulama kodu.
3. Gönderen adres, Supabase → Authentication → Users'ta aranır:
   - **Kayıtlı ise** doğrulama tamamdır.
   - **Kayıtlı değilse** bölüm 4 uygulanır.

## 4. Doğrulama kodu

| Kural | Değer |
|---|---|
| Ne zaman | Başvuru, hesaba kayıtlı adres dışından geldiğinde |
| Kime | **Yalnızca hesaba kayıtlı e-posta adresine** — başvurudaki adrese değil. Başvuran hangi hesap için başvurduğunu (kayıtlı e-postayı) belirtir; belirtilen adres Supabase'de yoksa "hesap bulunamadı" yanıtı verilir ve hesabın var olup olmadığı açıklanmaz |
| Kod | **6 haneli rastgele sayı**, kriptografik rastgelelikle üretilir (ör. `python -c "import secrets; print(f'{secrets.randbelow(10**6):06d}')"`). Ardışık, tarih tabanlı veya tekrar kullanılan kod yok |
| Geçerlilik | Gönderimden itibaren **7 gün** |
| Doğrulama | Kod, kayıtlı adresten gelen yanıtta aynen yer alırsa başvuru işleme alınır |
| Süre dolarsa / kod yanlışsa | Başvuru doğrulanmamış sayılır, yeni kod istenebilir; en fazla 3 deneme |
| Saklama | Kod, doğrulanana ya da süresi dolana kadar defterde tutulur, sonra silinir (yalnızca "doğrulandı / süresi doldu" kalır) |
| Doğrulama tamamlanana kadar | Veri paylaşılmaz, silme yapılmaz |
| 30 günlük süre | **Doğrulamanın tamamlandığı tarihten** başlar [hukuki teyit gerekli] |

**Apple "E-postamı Gizle":** kayıtlı adres `…@privaterelay.appleid.com` biçimindedir. Kod bu adrese gönderilir ve Apple kullanıcının gerçek adresine iletir; kullanıcının yanıtı yine yönlendirme adresinden gelir.

**Ön koşul — kuruldu (23.10.2026):** Apple, yönlendirme adreslerine yalnızca Apple Developer hesabında "Sign in with Apple for Email Communication" altında **kayıtlı gönderen alan adı / adreslerinden** gelen e-postaları iletir.

| Parça | Durum |
|---|---|
| Alım | Cloudflare Email Routing → Gmail |
| Gönderim | support@sestinaapp.com, Gmail "farklı gönder" ile **Gmail SMTP** (uygulama şifresi) |
| SPF | `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all` |
| Apple Developer | `sestinaapp.com` alan adı ve `support@sestinaapp.com` kayıtlı; SPF doğrulandı |

Kod her zaman **support@sestinaapp.com adına** gönderilir (Gmail'de "Gönderen" alanı kontrol edilir); kişisel Gmail adresinden giden e-postayı Apple iletmez. SPF kaydı ya da Gmail gönderim ayarı değişirse Apple Developer'daki doğrulama yeniden kontrol edilir.

## 5. Yanıt

- **Süre:** en geç **30 gün** (KVKK m. 13/2).
- **Ücret:** ücretsiz. Tebliğ'deki ücret istisnası (10 sayfayı aşan yazılı yanıt / kayıt ortamı maliyeti) **uygulanmaz**; politika olarak tüm yanıtlar ücretsizdir.
- **Biçim:** e-postayla, kayıtlı adrese. Veri kopyası isteniyorsa önce kullanıcıya "Profil → Verilerimi indir" yolu hatırlatılır. Uygulamaya erişemeyen kullanıcı için `export-my-data` çıktısına eşdeğer bir JSON hazırlanır: service role ile, ilgili kullanıcının satırları. Fotoğraflar 1 saatlik imzalı bağlantılarla verilir.
- **Talep türüne göre işlem:**

| Talep | İşlem | Referans |
|---|---|---|
| Bilgi / erişim (m. 11/a–ç) | Envanterdeki ilgili satırlar + veri kopyası | `data-inventory.md` |
| Aktarılan üçüncü kişiler (m. 11/ç) | Alıcı tablosu | `data-inventory.md` bölüm 3 |
| Düzeltme (m. 11/d) | Panelden düzeltme ya da kullanıcıya uygulama içi yol | — |
| Silme (m. 11/e) | Tüm hesap: `delete-account` akışına eşdeğer — depo + auth kullanıcısı + RevenueCat + `deletion_log` satırı (`source = 'email'`, elle) | `014_privacy_consent.sql` (elle ekleme örneği) |
| Üçüncü kişilere bildirim (m. 11/f) | Sağlayıcılara iletilmiş veri varsa, beyan ettikleri süreleri bildir; gerekiyorsa sağlayıcıdan silme iste | Gizlilik Politikası bölüm 6 |
| Otomatik analize itiraz (m. 11/g) | Yapay zekâ çıktısı yalnızca öneri; hukuki ya da benzeri önemli etki doğuran otomatik karar yok — açıklama ve elle düzeltme yolu | — |
| Zararın giderilmesi (m. 11/ğ) | Hukuki danışmana ilet | — |

- **Ret:** gerekçe yazılı bildirilir. Ret, eksik yanıt ya da süresinde yanıt verilmemesi hâlinde ilgili kişi, yanıtı öğrendiği tarihten itibaren **30 gün** ve her hâlde başvuru tarihinden itibaren **60 gün** içinde Kurul'a şikâyet edebilir (KVKK m. 14). Bu bilgi ret yanıtına yazılır.

## 6. Kapanış

- Defterde yanıt tarihi, sonucu ve yapılan işlemler kaydedilir.
- Yazışma Gmail'de "KVKK / B-YYYY-NNN" etiketiyle tutulur; kapanıştan **2 yıl** sonra silinir (`saklama-imha-politikasi.md`).

## 7. Şablon yanıtlar (kısa)

- **Alındı:** "Başvurun B-… numarasıyla alındı. En geç [tarih] tarihine kadar yanıtlayacağız."
- **Doğrulama kodu (kayıtlı adrese):** "Sestina hesabın için support@sestinaapp.com adresine başka bir adresten veri başvurusu yapıldı. Başvuru sana aitse bu e-postayı yanıtla ve şu kodu yaz: ______ (7 gün geçerli). Sana ait değilse bu e-postayı yok sayabilirsin; hesabınla ilgili hiçbir işlem yapılmaz."
- **Eksik bilgi:** "Başvurunu sonuçlandırabilmemiz için Tebliğ m. 5 uyarınca şu bilgiler gerekiyor: … ."

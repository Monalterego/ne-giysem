# Veri İhlali Müdahale Prosedürü

**Sürüm:** 1.0 · **Tarih:** 22 Ekim 2026 · **Sorumlu:** Hasan Can Demircan (tek kişi; tüm roller)
**Dayanak:** KVKK m. 12/5; Kurul'un 24.01.2019 tarihli ve 2019/10 sayılı Kararı (ihlal bildirimi usul ve esasları) [teyit edilmeli]
**Kaynak:** `data-inventory.md`, `guvenlik-tedbirleri.md`

**İhlal:** Kişisel verilerin kanuni olmayan yollarla başkaları tarafından elde edilmesi. Bu, yetkisiz erişim, sızan anahtar, yanlış yapılandırılmış erişim kuralı, kaybolan cihaz veya yedek ve sağlayıcı tarafındaki ihlal gibi durumları kapsar.

---

## 0. Zaman çizelgesi

| Saat (T = ihlalin öğrenildiği an) | Adım |
|---|---|
| T + 0 | Kayıt aç; sınırla (bölüm 2) |
| T + 24 saat | Değerlendirmeyi bitir (bölüm 3) |
| **T + 72 saat** | **Kurul'a bildirim** (bölüm 4). Eksik bilgi varsa bilinenlerle bildir, sonra tamamla |
| Makul en kısa süre | İlgili kişilere bildirim (bölüm 5) |
| Kapanış | İhlal kaydını tamamla, önlemleri uygula (bölüm 6) |

## 1. Tespit — kaynaklar

- Supabase log'ları (1 gün saklanıyor — **hemen dışa aktar**) ve `ops_events`.
- Anormal kullanım: `api_usage`'da ani artış, beklenmeyen 403 / 401 yoğunluğu, FASHN / Anthropic / Poof faturasında beklenmeyen artış.
- Sağlayıcı bildirimi (e-posta) — bölüm 7.
- Kullanıcı bildirimi: support@sestinaapp.com.
- Repo / derleme taraması: bir secret'ın commit'e, OTA paketine veya ekran görüntüsüne girmesi.

## 2. Sınırlama (ilk saat)

| Durum | Hemen |
|---|---|
| Sızan sunucu secret'ı (`ANTHROPIC_API_KEY`, `FASHN_API_KEY`, `POOF_API_KEY`, `REVENUECAT_*`, `APPLE_PRIVATE_KEY`) | Sağlayıcı panelinden anahtarı iptal et ve yenile → `supabase secrets set …` → ilgili edge function'ları yeniden deploy et. `guvenlik-tedbirleri.md` bölüm 6'ya yaz |
| Sızan `SUPABASE_SERVICE_ROLE_KEY` | Supabase panelinden JWT secret / API anahtarlarını yenile (tüm oturumlar düşer); edge function'ları yeniden deploy et; istemci anon anahtarı değiştiyse yeni derleme / OTA |
| Erişim kuralı (RLS / storage policy) hatası | Hatalı policy'yi kaldır veya düzelt; etkilenen bucket'ı geçici olarak tamamen kapat |
| Supabase hesabının ele geçirilmesi | Parola + 2FA yenile, oturumları kapat, erişim token'larını iptal et |
| Google hesabı (Drive yedekleri, Gmail) ele geçirilmesi | Parola + 2FA, oturumları kapat; Drive paylaşımlarını kontrol et; yedek şifreleme parolasının ayrı tutulduğunu doğrula |
| Kaybolan / çalınan bilgisayar | Supabase, Google, GitHub, Expo, sağlayıcı oturumlarını uzaktan kapat; yerelde şifresiz döküm olup olmadığını değerlendir |
| Kanıt | Log'ları dışa aktar (Supabase log'u 1 gün sonra kaybolur), ekran görüntüsü al, zaman damgalarını not et |

## 3. Değerlendirme (24 saat içinde)

Şu sorulara yazılı yanıt verilir:

1. Ne oldu, ne zaman başladı, ne zaman fark edildi, ne zaman durduruldu?
2. Hangi veri kategorileri etkilendi? `data-inventory.md` satır numaralarıyla. **Özel nitelikli veri var mı** (#11, #12, #14)?
3. Kaç kişi etkilendi (yaklaşık)? Kaç kayıt?
4. Veri şifreli miydi (ör. yedekler AES-256), erişilebilir durumda mıydı?
5. Olası sonuçlar: kimlik avı, ifşa, ayrımcılık riski (özel nitelikli veri), maddi zarar.
6. Sağlayıcı kaynaklı mı? (bölüm 7)

**Bildirim kararı:** KVKK m. 12/5'te eşik yok — kişisel verinin başkalarınca elde edildiği her durum Kurul'a bildirilir. Bildirmeme kararı ancak verinin elde edilmediğinin **kanıtlanabildiği** durumlarda verilir (ör. şifreli yedek, parola sızmadı) ve gerekçesiyle kayda geçer.

## 4. Kurul'a bildirim (en geç 72 saat)

- **Kanal:** Kurul'un internet sitesindeki **Kişisel Veri İhlali Bildirim Formu** [kanal ve form teyit edilmeli].
- **İçerik:** formdaki başlıklar — veri sorumlusu ve irtibat, ihlalin tarihi / tespit tarihi, nasıl gerçekleştiği, etkilenen veri kategorileri ve kişi sayısı, olası sonuçlar, alınan ve alınacak önlemler, ilgili kişilere bildirim yapılıp yapılmadığı.
- **72 saat aşılırsa:** gecikmenin gerekçesi bildirime eklenir.
- **Bilgi eksikse:** bilinenlerle zamanında bildir; eksikler öğrenildikçe ek bildirimle tamamla.
- **Yurt dışı:** AB / AEA veya Birleşik Krallık'taki kullanıcılar etkilendiyse, ilgili otoriteye bildirim yükümlülüğü ayrıca değerlendirilir [?].

## 5. İlgili kişilere bildirim

- **Ne zaman:** etkilenen kişiler belirlendikten sonra makul olan en kısa sürede.
- **Nasıl:** hesaba kayıtlı e-posta adresine doğrudan. Adresi bilinmeyen ya da çok sayıda kişi varsa sestinaapp.com'da duyuru ve uygulama içi bildirim.
- **İçerik — sade dille:**
  - ne oldu, ne zaman;
  - hangi verileri etkiledi;
  - olası sonuçlar;
  - aldığımız önlemler;
  - kişinin alabileceği önlemler (ör. parola değiştirme, şüpheli e-postalara dikkat);
  - iletişim: support@sestinaapp.com.
- **Şablon:** "Konu: Sestina hesabınla ilgili güvenlik bildirimi — [tarih]'te … nedeniyle … verilerine yetkisiz erişim oldu / olmuş olabilir. Etkilenen veriler: … . Yaptıklarımız: … . Önerimiz: … . Sorularını support@sestinaapp.com adresine yazabilirsin."

## 6. Kayıt (ihlal kayıt defteri)

Her ihlal ve **bildirilmeyen her olay**, veri sorumlusunun Drive'ında ya da yerelinde (repoda değil) aşağıdaki alanlarla kayda geçer:

| Alan | Açıklama |
|---|---|
| No | İ-2026-001 |
| Tespit tarihi / saati | |
| Başlangıç ve bitiş | |
| Kaynak | Kendi sistemimiz / sağlayıcı (adı) |
| Etkilenen veri kategorileri | Envanter # numaralarıyla |
| Özel nitelikli veri | Evet / Hayır |
| Etkilenen kişi sayısı | |
| Sınırlama adımları | |
| Kurul bildirimi | Tarih / saat, form numarası; bildirilmediyse gerekçe |
| İlgili kişilere bildirim | Tarih, kanal, kişi sayısı |
| Kök neden | |
| Kalıcı önlemler | Commit / migration referansları |
| Kapanış tarihi | |

Kayıtlar **en az 3 yıl** saklanır.

## 7. Sağlayıcı kaynaklı ihlaller

| Sağlayıcı | Rol | İhlal bildirimi taahhüdü | Bilgi alma kanalı |
|---|---|---|---|
| Supabase, Inc. | Barındırma | DPA'ya göre [?] | Panel → Support; güvenlik sayfası [?] |
| Anthropic, PBC | Kıyafet tanıma | Ticari koşullar / DPA [?] | [?] |
| Dumpling Software UG (Poof) | Arka plan kaldırma | [?] | [?] |
| FASHN LTD | Sanal deneme | [?] | [?] |
| RevenueCat, Inc. | Abonelik | DPA'ya göre [?] | [?] |
| 650 Industries, Inc. (Expo) | OTA | [?] | [?] |
| Google LLC | Drive (yedek), Gmail | Kişisel hesap koşulları [?] | Google hesap güvenlik uyarıları |
| Cloudflare, Inc. | E-posta yönlendirme | [?] | [?] |
| OpenWeather Ltd | Hava durumu (anahtar cihazda) | [?] | [?] |

**Sağlayıcıdan ihlal bildirimi gelince:**
1. Bildirimi kayda ekle.
2. Yazılı olarak şunları iste: etkilenen veri kategorileri, bizim kullanıcılarımızın etkilenip etkilenmediği, zaman aralığı, alınan önlemler.
3. 72 saatlik süre, **bizim öğrendiğimiz andan** başlar; sağlayıcıdan yanıt beklemeden bilinenlerle Kurul'a bildir.
4. İlgili anahtarları yenile (bölüm 2).

## 8. İletişim listesi

| Kim | Kanal |
|---|---|
| Veri sorumlusu | Hasan Can Demircan — support@sestinaapp.com; telefon [doldurulacak] |
| Kişisel Verileri Koruma Kurumu | kvkk.gov.tr — Veri İhlali Bildirim Formu [teyit edilmeli] |
| Hukuki danışman | Av. Nadire [soyad ve iletişim doldurulacak] |
| Supabase | Panel → Support |
| Sağlayıcı güvenlik iletişimleri | Bölüm 7 tablosu [doldurulacak] |

## 9. Tatbikat

Yılda bir kez masa başı tatbikat yapılır; senaryo olarak sızan `FASHN_API_KEY` ve yanlış storage policy kullanılır. Süre ölçülür, prosedür güncellenir.

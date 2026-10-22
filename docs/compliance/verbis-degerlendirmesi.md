# VERBİS Kayıt Yükümlülüğü Değerlendirmesi

**Tarih:** 22 Ekim 2026 · **Veri sorumlusu:** Hasan Can Demircan (bireysel geliştirici) · **Kaynak:** `data-inventory.md`
**Sonuç:** Veri Sorumluları Siciline (VERBİS) kayıt yükümlülüğünden **istisna**.
**Durum:** Hukuki görüş için taslak; Kurul metinleri resmî kaynaktan ayrıca teyit edilmeli (bölüm 5).

---

## 1. Dayanak

- **KVKK m. 16/2:** Kurul, belirlediği objektif kriterlere göre sicile kayıt zorunluluğuna istisna getirebilir.
- **Kurul'un 19.07.2018 tarihli ve 2018/87 sayılı Kararı** — **04.09.2025 tarihli ve 2025/1572 sayılı Kararla** değişik hâli. İstisna kapsamındakiler:
  - **(A)** Yıllık çalışan sayısı **50'den az** ve yıllık mali bilanço toplamı **100 milyon TL'den az** olan, ana faaliyet konusu özel nitelikli kişisel veri işleme **olmayan** gerçek veya tüzel kişi veri sorumluları;
  - **(B)** Ana faaliyet konusu özel nitelikli kişisel veri işleme **olmakla birlikte**, yıllık çalışan sayısı **10'dan az** ve yıllık mali bilanço toplamı **10 milyon TL'den az** olan gerçek veya tüzel kişi veri sorumluları.
- **Uygulama esasları — Kurul'un 25.12.2025 tarihli ve 2025/2393 sayılı Kararı** (kamuoyu duyurusu 12.01.2026):
  - Bilanço esasına göre defter tutanlarda "yıllık çalışan sayısı" ve "yıllık mali bilanço toplamı" kriterleri **birlikte** aranır.
  - Bilanço esasına göre defter **tutmayanlarda**, mali bilanço toplamı bulunmadığından **yalnızca "yıllık çalışan sayısı" kriteri** esas alınır.

## 2. Olgular

| Kriter | Durum | Kaynak |
|---|---|---|
| Veri sorumlusunun niteliği | Gerçek kişi, bireysel geliştirici | Gizlilik Politikası bölüm 1 |
| Çalışan | **Yok (0)** | Veri sorumlusunun beyanı |
| Defter | **Bilanço esasına göre defter tutulmuyor** | Veri sorumlusunun beyanı |
| Mali bilanço toplamı | Yok (bilanço esası yok) | — |
| Özel nitelikli veri | Sanal deneme özelliğinde işlenebilir (profil fotoğrafı, sanal deneme görselleri: kılık-kıyafet; ten rengi: ırk/etnik köken). İsteğe bağlı bir özellik; açık rızaya dayanıyor | `ozel-nitelikli-veri-siniflandirmasi.md` |

## 3. Değerlendirme

1. Bilanço esasına göre defter tutulmadığından 2025/2393 sayılı uygulama esasları gereği **yalnızca çalışan sayısı kriteri** uygulanır.
2. Çalışan sayısı 0'dır.
3. "Ana faaliyet konusu özel nitelikli veri işleme" sorusu bu durumda **sonucu değiştirmez**:
   - Uygulamanın ana faaliyeti özel nitelikli veri işleme değilse (A) uygulanır: 0 < 50 → istisna.
   - Ana faaliyet olarak nitelendirilse bile (B) uygulanır: 0 < 10 → istisna.
   - Görüş olarak: ana faaliyet dijital dolap ve kombin önerisidir; özel nitelikli veri yalnızca isteğe bağlı sanal deneme özelliğinde, açık rızayla işlenebilir. Bu, ana faaliyet olmadığı yönünde değerlendirilebilir; ancak yukarıdaki nedenle bu nitelendirme şu an belirleyici değildir.
4. **Sonuç:** VERBİS'e kayıt yükümlülüğü yoktur.

## 4. Kapsam sınırı

İstisna yalnızca **sicile kayıt ve bildirim** yükümlülüğünü kapsar. KVKK'nın diğer yükümlülükleri aynen devam eder:
- aydınlatma (m. 10),
- veri güvenliği (m. 12),
- ilgili kişi başvuruları (m. 11, 13),
- yurt dışına aktarım (m. 9),
- ihlal bildirimi (m. 12/5),
- silme / imha (m. 7).

Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik'teki **saklama ve imha politikası** hazırlama yükümlülüğü (m. 5) sicile kayıtla yükümlü olanlar içindir. Buna rağmen politika iyi uygulama olarak hazırlanmıştır (`saklama-imha-politikasi.md`).

## 5. Yeniden değerlendirme tetikleyicileri

Aşağıdakilerden biri gerçekleşirse bu değerlendirme **30 gün içinde** yenilenir. Yönetmelik, yükümlülüğün doğduğu tarihten itibaren 30 günlük kayıt süresi tanır.

| Tetikleyici | Neden önemli |
|---|---|
| **İlk çalışanın işe alınması** | Çalışan sayısı izlenmeye başlar. Ana faaliyet özel nitelikli sayılırsa eşik **10**, sayılmazsa **50**. Çalışan sayısı, tamamlanmış bir yılın 12 ayından en az 7'sinde Muhtasar ve Prim Hizmet Beyannamesi'nde bildirilen sayıya göre belirlenir [teyit edilmeli]. |
| **Şirketleşme** (ör. limited / anonim şirket) | Veri sorumlusu değişir (tüzel kişi). Bilanço esasına geçilirse **bilanço kriteri de devreye girer**; (B) kapsamında eşik **10 milyon TL**. |
| **Bilanço esasına geçiş** (gerçek kişi olarak) | Aynı şekilde bilanço kriteri uygulanır. |
| **Ürün değişikliği:** özel nitelikli veri işlemenin ana faaliyet hâline gelmesi (ör. sanal deneme / beden analizi merkezî özellik olursa, sağlık verisi işlenmeye başlanırsa) | (A) yerine (B) eşikleri uygulanır. |
| **Kurul kararlarında değişiklik** | Eşikler veya uygulama esasları yeniden belirlenebilir. |

Değerlendirme her yıl ocak ayında, kararlarda değişiklik olup olmadığı kontrol edilerek gözden geçirilir.

## 6. Teyit edilmesi gerekenler

- 2025/1572 kararının Resmî Gazete yayım tarihi. İkincil kaynaklarda 01.10.2025 geçiyor; resmî duyuruda tarih yok.
- Çalışan sayısının hesaplanma yöntemi (7/12 ay kuralı) resmî duyuruda yer almıyor; ikincil kaynaklardan alındı.
- Çalışan yokluğu ve defter türü veri sorumlusunun beyanıdır; mali müşavir teyidiyle dosyaya eklenmeli.

**Kaynaklar:**
- [KVKK — 2025/1572 sayılı Kararın Uygulama Esaslarına İlişkin Kamuoyu Duyurusu](https://www.kvkk.gov.tr/Icerik/8577/kisisel-verileri-koruma-kurulunun-04-09-2025-tarihli-ve-2025-1572-sayili-kararinin-uygulama-esaslarina-iliskin-kamuoyu-duyurusu)
- [Erdem & Erdem — VERBİS istisna kriteri değişikliği](https://www.erdem-erdem.av.tr/bilgi-bankasi/verbis-kayit-yukumlulugune-iliskin-istisna-kriteri-degistirildi)
- [Hukuki Haber — 2025/1572 sayılı karar değerlendirmesi](https://www.hukukihaber.net/kisisel-verileri-koruma-kurulunun-04092025-tarihli-ve-20251572-sayili-karari-isiginda-verbis-kayit-yukumlulugunun-istisna-kapsaminda-degisimi)

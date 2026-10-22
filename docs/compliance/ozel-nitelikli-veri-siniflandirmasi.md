# Özel Nitelikli Veri Sınıflandırması

**Tarih:** 22 Ekim 2026 · **Kaynak:** `data-inventory.md` (satır numaraları `#n`) · **Dayanak:** KVKK m. 6

KVKK m. 6/1'deki özel nitelikli kişisel veriler: ırk, etnik köken, siyasi düşünce, felsefi inanç, din, mezhep veya diğer inançlar, kılık ve kıyafet, dernek / vakıf / sendika üyeliği, sağlık, cinsel hayat, ceza mahkûmiyeti ve güvenlik tedbirleri ile biyometrik ve genetik veriler.

**Yaklaşım:** Bir verinin özel nitelikli olup olmadığı, içeriğine ve kullanım biçimine göre değerlendirilir. Şüpheli durumlarda veri özel nitelikli sayılır ve işleme açık rızaya dayandırılır.

Kod referansları `ne-giysem/` altındaki yollardır; satır numaraları `1ae49a9` sonrası duruma göredir.

---

## 1. İşlev bazında tablo

| İşlev (envanter) | Veri | Özel nitelikli olabilir mi? | Gerekçe | İşleme şartı | Ek önlemler (kodda) |
|---|---|---|---|---|---|
| Profil fotoğrafı (#11) | Tam boy kişi fotoğrafı | **Evet — kılık ve kıyafet**; içeriğe göre ayrıca din / inanç (başörtüsü vb.), sağlık (görünür durum) | Fotoğraf kişinin giyimini gösterir; sanal deneme amacı giyimi göstermektir | Açık rıza (`tryon_photo`) | Rıza olmadan yükleme yok: `src/screens/main/profile/ProfilePhotoScreen.tsx:46`. Özel bucket `avatars` (`supabase/migrations/010_private_buckets.sql:15`). 1 saatlik imzalı görüntüleme (`src/lib/storageUrls.ts:13`). FASHN'a 10 dakikalık bağlantı (`src/lib/storageUrls.ts:14`, `:175`). Sunucu rıza kontrolü: `supabase/functions/fashn-proxy/index.ts:143`, `:208`. Geri çekmede silme: `src/lib/privacyActions.ts:75`, `:143` |
| Sanal deneme görselleri (#14) | Fotoğraf ya da manken üzerinde kıyafet görseli | **Evet — kılık ve kıyafet** (fotoğraf kaynaklıysa kişinin kendisi) | Görselin amacı kişinin giyimini göstermek | Açık rıza (`tryon_photo` / `tryon_physical`) | Özel bucket `mannequin-cache` (`010:15`). İmzalı bağlantı (`storageUrls.ts:13`). Kaynak rızası geri çekilince ilgili görseller silinir: fotoğraf `privacyActions.ts:75`; manken `privacyActions.ts:97`. Parça silinince o parçalı görseller silinir: `privacyActions.ts:51` |
| Fiziksel profil — ten rengi (#12) | Ten rengi seçimi | **Evet — ırk / etnik köken** | Ten rengi ırk veya etnik köken çağrışımı taşıyabilir | Açık rıza (`tryon_physical`) | Rıza olmadan kayıt yok: `src/screens/onboarding/PhysicalProfileScreen.tsx:211`. Sunucu rıza kontrolü (manken üretimi): `fashn-proxy/index.ts:208`. Geri çekmede silme: `privacyActions.ts:97` |
| Fiziksel profil — vücut tipi, boy, kilo, yaş (#12) | Seçimler / sayılar | **Değerlendirilmedi** — vücut tipi ve kilo, sağlık verisi çağrışımı açısından [?] | Tek başına tanı içermez; kilo / beden bilgisinin sağlık verisi sayılıp sayılmadığı hukuki görüş gerektirir | Açık rıza (`tryon_physical`) — sonuç değişmez | Ten rengi ile aynı |
| Fiziksel profil — saç rengi, uzunluğu, tipi (#12) | Seçimler | Düşük olasılık; saç tipi ("afro") etnik köken çağrışımı taşıyabilir [?] | — | Açık rıza (`tryon_physical`) | Ten rengi ile aynı |
| Yapay manken (#14) | Fiziksel profilden üretilen görsel | **Evet — ırk / etnik köken** (ten rengi tarifi yansır), kılık-kıyafet | Manken, kullanıcının ten rengi ve fiziğine benzetilir | Açık rıza (`tryon_physical`) | `privacyActions.ts:97` (manken ve `_m.jpg` silinir) |
| FASHN'a aktarım (#13) | Fotoğraf / manken bağlantısı, kıyafet görselleri, manken tarifi | Yukarıdakilerle aynı | — | Açık rıza; yurt dışına aktarım [?] (bölüm 3) | 10 dakikalık bağlantı (`storageUrls.ts:14`). Proxy yalnızca kullanıcının kendi depo yolunu kabul eder: `fashn-proxy/index.ts:46-55`. Rıza kontrolü `:143`, `:208` |
| Kıyafet fotoğrafı (#4) | Yalnız kıyafet | Kural olarak **hayır**; fotoğrafta kişi görünürse kılık-kıyafet | Fotoğraf rehberi düz zeminde, kişisiz çekimi önerir | m. 5/2-c | Özel bucket, imzalı bağlantı. Kişi içeren fotoğraf için ek kontrol **yok** [?] |
| Yapay zekâ analizi — Poof, Anthropic (#6, #7) | Kıyafet / ürün fotoğrafı | Kural olarak hayır (#4 ile aynı) | — | m. 5/2-c (izin = tercih) | Sunucu izin kontrolü: `bg-removal-proxy/index.ts:34`, `anthropic-proxy/index.ts:80` |
| Stil profili (#3) | Stil adları ve ağırlıkları | Hayır | Felsefi / dini inanç göstergesi değil | m. 5/2-c | — |
| Konum (#17) | ~1 km'ye yuvarlanmış koordinat | Hayır | — | m. 5/2-c | Cihazda yuvarlama: `src/utils/weatherService.ts:12-13` |

## 2. Ortak önlemler

| Önlem | Kodda |
|---|---|
| Aydınlatma ile açık rıza ayrı; "Okudum" olmadan kutu işaretlenemez | `src/components/SensitiveConsentModal.tsx` |
| Rızalar ayrı ayrı ve yalnız eklenebilir şekilde kaydedilir | `supabase/migrations/014_privacy_consent.sql:51-71` (RLS, kolon bazlı INSERT, UPDATE / DELETE yok) |
| Metin sürümü; ana sürüm değişince yeniden sorma | `src/constants/consent.ts:15-18`, `src/store/useConsentStore.ts:73`, `:84` |
| Mevcut verisi olup rızası olmayan kullanıcıya kapı | `src/navigation/RootNavigator.tsx:27`, `src/store/useConsentStore.ts:103` |
| Depoda sahip dışı silme / erişim yok | `011_privacy_hardening.sql:24-31` (DELETE). SELECT / INSERT / UPDATE storage policy'leri **repoda yok** [?] |
| Hesap silmede tüm depo dosyaları | `supabase/functions/delete-account/index.ts:115` |
| Yedeklerde fotoğraf yok | [org] — kodda yok |

## 3. Açık noktalar

1. **Vücut tipi ve kilo:** sağlık verisi sayılıp sayılmadığına dair hukuki görüş yok.
2. **Kıyafet fotoğrafında kişi:** kişi görünmesi teknik olarak engellenmiyor; yalnızca rehberde öneri var. Yapay zekâ izni olan kullanıcıda böyle bir fotoğraf Poof ve Anthropic'e de gider.
3. **Yurt dışına aktarım (KVKK m. 9):** FASHN Birleşik Krallık ve alt işleyenler — özel nitelikli verinin yurt dışına aktarım dayanağı (standart sözleşme / bildirim) bu dokümanın kapsamı dışında; hukuki değerlendirme gerekiyor.
4. **Storage policy'leri:** okuma / yükleme / güncelleme policy'leri panelden elle eklenmiş; repoda yok, kodla doğrulanamıyor.
5. **Kurul'un 31.01.2018 tarihli ve 2018/10 sayılı kararındaki "yeterli önlemler":** idari önlemler (politika, eğitim, gizlilik taahhüdü) tek kişilik yapıda belgelenmeli; kodda karşılığı yok.

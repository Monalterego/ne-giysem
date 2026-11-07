# Packshot geçişi: inceleme ve uygulama planı

Tarih: 2026-11-05 · Kapsam: `ne-giysem` (bu depo) + `sestina-web` · Kod değişikliği yok, yalnızca inceleme.

Yollar depo köküne göredir (`ne-giysem/...` = uygulama kodu). **[doğrulanmadı]** işaretli maddeler repoda ya da ölçümde teyit edilemedi; dış kaynağa veya tahmine dayanır.

---

## Kararlar (05.11.2026)

Bu kararlar aşağıdaki bölümlerde açık bırakılan soruları kapatır. Çelişki varsa **bu bölüm geçerlidir**. "d. Uygulama sırası" bunlara göre yeniden düzenlendi.

1. **"Uyar mı?" taraması:** arka plan kaldırılmaz. Orijinal fotoğraf doğrudan Claude'a gönderilir ve tarama fotoğrafı saklanmaz. Taramada Poof ve FASHN çağrısı yok (e, açık soru 1 kapandı).
2. **Orijinal görsel kalıcı saklanmaz.** Kullanıcı packshot'ı onaylayana ya da reddedene kadar tutulur, karar verilince silinir. "Orijinali kullan" seçilirse saklanan görsel FASHN background-remove çıktısıdır. Böylece `image_url` artık orijinal değil, temiz görselin yolu olur (b.1'deki `image_url = _orig.jpg` önerisi geçersiz). `_orig.jpg` geçici bir dosyadır (e, açık soru 2 kapandı).
3. **Mevcut kullanıcılar için geçiş mantığı yazılmayacak.** Gerçek kullanıcı yok, yalnızca test hesapları var. Yeni limitler lansmandan önce uygulanacak, hak tanıma yok (b.5'teki "mevcut kullanıcıların sayaçları" maddesi ve e, açık soru 3 kapandı).
4. **Cihaz üstü arka plan kaldırma lansman sonrasına ertelendi**: expo-segmentation olgun değil ve native build gerektiriyor.
   - Lansmanda ücretsiz plandaki 4. ve sonraki parçalar **olduğu gibi** kaydedilir, arka planları kaldırılmaz.
   - Ekleme ekranında "düz zemine ser, iyi ışıkta çek" ipucu gösterilir.
   - Arka plan kaldırma başarısız olduğunda da aynı davranış uygulanır: parça orijinal fotoğrafla kaydedilir.
   - Bu adım sıradan çıkarıldı, bkz. "Lansman sonrası" (e, açık soru 4 kapandı).
5. **Yapay zekâ izni:** metin FASHN'ı da sayacak şekilde güncellenir, `ai_processing` sürümü **2.0**'a çıkar ve izin kullanıcılardan yeniden istenir.
   - Sunucu izin **sürümünü** de kontrol eder: `garment-image`, `anthropic-proxy`, `fashn-proxy`. Eski ana sürüm 403 döner.
   - fashn-proxy'nin kontrol ettiği türler `tryon_photo` / `tryon_physical`. Sürüm kontrolü bunlar için de geçerli olur (şu an hepsi 1.0).
6. **Claude ile ayrı sadakat kontrolü yok.** Kontrolü kullanıcı yapar: packshot'ı onaylar ya da reddeder.

---

## a. Mevcut durum özeti

### a.1 Kıyafet yükleme hattı

**Sıra (yapay zekâ izni varsa, native):**

1. `UploadScreen.pick`, önce `ensureAiDecision()` çağırır (`ne-giysem/src/screens/main/UploadScreen.tsx:59`). İzin yoksa `manual` moda geçer.
2. Picker'dan dönen görsel `toUploadJpeg` ile JPEG'e çevrilir: uzun kenar ≤ 1400 px, base64 ≤ 2.000.000 (`UploadScreen.tsx:121`, `ne-giysem/src/utils/imageNormalize.ts:21-23`).
3. **Poof:** `removeBackground` → `callEdge('bg-removal-proxy', { image_b64 })` (`UploadScreen.tsx:36-45`, çağrı `:143`). Proxy Poof'a `format=jpg`, `channels=rgb`, `bg_color=#ffffff` gönderir ve sonucu `result_b64` olarak döndürür (`ne-giysem/supabase/functions/bg-removal-proxy/index.ts:46-67`).
4. `UploadDetail` ekranına **yalnızca işlenmiş base64** gider (`UploadScreen.tsx:164`).
5. **Anthropic:** `analyzeClothingImage(processedBase64)` (`ne-giysem/src/screens/main/UploadDetailScreen.tsx:125`) → `callEdge('anthropic-proxy', …)` (`ne-giysem/src/utils/visionAnalysis.ts:232`). Yani Claude analizi **Poof çıktısı üzerinde** yapılıyor, orijinal üzerinde değil.
6. Kaydet: 1000 px JPEG → `wardrobe-items/<uid>/<uuid>.jpg` ve 400 px önizleme → `<uid>/<uuid>_thumb.jpg` (`UploadDetailScreen.tsx:233-275`). Ardından `wardrobe_items` INSERT (`:282-301`).

Web'de Poof atlanır (`UploadScreen.tsx:143`). İzin yoksa fotoğraf olduğu gibi kaydedilir, analiz de yapılmaz (`UploadScreen.tsx:135-139`, `UploadDetailScreen.tsx:123`).

**"Uyar mı?" taraması da aynı hattı kullanıyor:** `ScanScreen.tsx:35-48` Poof'u çağırır. `StoreResultScreen.tsx:167` Claude'u Poof çıktısıyla çağırır. Poof kalkınca tarama da etkilenir (bkz. e, açık soru 1).

**Saklama:**

| Ne | Nerede |
|---|---|
| Bucket | `wardrobe-items`, private (`ne-giysem/supabase/migrations/010_private_buckets.sql:17`). MIME jpeg/png/webp, 10 MB (`019_storage_limits.sql:30-32`) |
| `image_url` | `<uid>/<uuid>.jpg` (`UploadDetailScreen.tsx:255`) |
| `processed_image_url` | **Aynı yol** (`UploadDetailScreen.tsx:256`). Yorum: "original ve processed aynı veri olduğu için iki kopya gereksizdi" (`:248`) |
| `thumb_url` | `<uid>/<uuid>_thumb.jpg` (`:274`). Sütun şema anlık görüntüsünde var (`ne-giysem/supabase/schema/public_2026-10-15.sql:131`) ama onu ekleyen bir migration repoda yok |
| DB'deki biçim | URL değil, bucket içi yol (`009_storage_paths.sql:3`) |

**Orijinal şu an saklanmıyor.** Yapay zekâ izni varsa yalnızca Poof çıktısı saklanır. Web metni de bunu söylüyor: `sestina-web/gizlilik.html:65`, `privacy.html:65`.

**api_usage sayaçları** (tablo: `006_server_side_quota.sql:51-57`, `bump_usage`: `:248-264`; gün = `current_date`, Supabase'de UTC, `:246`):

| fn | Nerede artıyor | Tavan | Not |
|---|---|---|---|
| `bg` | `bg-removal-proxy/index.ts:41` | 150/gün (`:9`) | Poof çağrısından **önce** artar, Poof hatasında geri alınmaz |
| `anthropic` | `anthropic-proxy/index.ts:115` | 150/gün (`:11`) | Çağrıdan önce artar. İstemcinin yeniden denemesi (`visionAnalysis.ts:257-259`) ikinci kez artırır |
| `store_scan` | `start_scan` (`013_premium_entitlements.sql:303-306`) | Aylık (aşağıda) | İstemci `spendScan` ile çağırır |

**anthropic-proxy:**

- İzin listesindeki modeller: `claude-sonnet-5`, `claude-sonnet-4-5-20250929` (`ne-giysem/supabase/functions/anthropic-proxy/index.ts:13`).
- Model adı istemcide tanımlı. Vision: `model: 'claude-sonnet-5'`, `max_tokens: 4096`, `output_config: { effort: 'low' }` (`visionAnalysis.ts:198-205`). Stil DNA: `claude-sonnet-4-5-20250929` (`ne-giysem/src/screens/onboarding/StyleResultScreen.tsx:63`).
- **İstek şeması** (sunucu yeniden kurar, `anthropic-proxy/index.ts:85-112`):
  - `model` izin listesinden
  - `max_tokens` ≤ 4096
  - `messages`: en çok 4, en çok 1 görsel; görsel base64 jpeg/png/webp ve ≤ 2.000.000 karakter; metin toplamı ≤ 20.000
  - `system` (string, isteğe bağlı)
  - `output_config.effort` yalnızca `"low"`
  - `tools`, `metadata` vb. alanlar iletilmez
- **Yanıt:** Anthropic gövdesi aynen geçer (`:142-145`). İstemci `content[0].text`'i okur, ilk `{` ile son `}` arasını JSON olarak ayrıştırır (`visionAnalysis.ts:236-248`).
- **JSON alanları:** `category`, `subcategory`, `name`, `fit`, `neckline`, `sleeve`, `details`, `signals`, `colors`, `pattern`, `fabric`, `season` (`visionAnalysis.ts:111-144`).

### a.2 Sanal deneme zinciri

**Akış** (`ne-giysem/src/screens/main/CombosScreen.tsx:621-790`):

1. İstemci rıza ön kontrolünü yapar.
2. Cache kontrolü: `mannequin-cache/<uid>/<parça id'leri>_<mankenSürümü>.jpg` (`:671-685`). Cache isabeti **kotadan düşmez**.
3. `startTryOn()` (`:688`).
4. Manken kaynağı seçilir: avatar → kayıtlı manken (`profiles.mannequin_url`) → `model-create` (`:712-746`). Yeni üretilen manken `mannequin-cache/<uid>/base_mannequin.png`'ye kopyalanır (`:735-739`).
5. `generateVirtualModelImage` (`:749`).
6. Sonuç cache'e yüklenir (`:759-765`).

**Katman sırası ve kategori** (`ne-giysem/src/utils/virtualModel.ts`):

- `FASHN_CATEGORY`: upper → `tops`, lower → `bottoms`, dress_jumpsuit → `one-pieces`, **outer → `tops`** (`:234-239`).
- `LAYER_ORDER`: lower/dress 1, upper 2, outer 3 (`:241-246`).
- **Dış giyim tespiti** iki yoldan yapılır:
  - DB kategorisi `outer` olan parçalar (Claude'un `dis` değeri, `visionAnalysis.ts:38`)
  - Yelek: kombinde iki `upper` varsa ve biri `subCategory === 'yelek'` ise yelek 2.5. katmana alınır (`virtualModel.ts:248-268`)
- Ayakkabı, çanta ve aksesuar elenir. Kombinde elbise varsa üst ve alt parçalar atlanır (`:270-276`).

**tryon-v1.6 isteği** (`virtualModel.ts:296-311`):

| Parametre | Değer |
|---|---|
| `mode` | `'quality'` |
| `category` | `tops` / `bottoms` / `one-pieces` (bilinmeyen için `tops`) |
| `segmentation_free` | `false` |
| `garment_photo_type` | `'auto'` |
| `seed` | Rastgele |
| `output_format` | `'jpeg'` |
| `moderation_level` | **Gönderilmiyor.** Sunucu izin listesinde de yok (`fashn-proxy/index.ts:27-28`) → FASHN varsayılanı. Dokümana göre varsayılan `permissive` **[doğrulanmadı — dış kaynak]** |
| `return_base64` | **Gönderilmiyor, izin listesinde yok** → çıktı FASHN CDN URL'i |

**Ayakkabı adımı, tryon-max** (`virtualModel.ts:350-360`): `resolution: '1k'` (sunucuda sabit, `fashn-proxy/index.ts:33-35`), `generation_mode: 'quality'` (sabit değil), `prompt: 'shoes worn on feet'`.

**Ara çıktıların aktarımı:**

- Her katmanın çıktısı **FASHN CDN URL'i** olarak bir sonraki katmanın `model_image`'ı olur (`virtualModel.ts:289-297`). Ayakkabı adımına da aynı yolla geçer (`:353`).
- Proxy bu URL'i `user_owns_output` ile doğrular (`fashn-proxy/index.ts:99-106`). Bunun için `status completed` anında `https://` ile başlayan çıktılar `tryon_renders.output_urls`'e yazılır (`:292-300`, `006:184-218`).
- Kıyafet görselleri storage'dan 10 dk'lık imzalı URL ile gider (`ne-giysem/src/lib/storageUrls.ts:169-178`).
- Bizim storage'a yalnızca **temel manken** ve **son sonuç** yazılır.

**mannequin-cache:**

- `base_mannequin.png`: yapay manken.
- `<uid>/<imza>_<sürüm>.jpg`: kombin sonuç cache'i. Avatar değişince `?v=` sürümüyle anahtar değişir (`CombosScreen.tsx:671-675`).
- Parça silinince ilgili cache dosyaları da silinir (`ne-giysem/src/lib/privacyActions.ts:63-67`).

**Kota:**

| Konu | Nerede |
|---|---|
| Limitler (ücretsiz 3, premium 8) | `start_tryon`: `c_free_limit = 3`, `c_premium_limit = 8` (`013_premium_entitlements.sql:143-144`) |
| Ücretsiz plan penceresi | Ömür boyu (`:164-166`) |
| Premium plan penceresi | Istanbul takvim ayı (`:159-162`) |
| Sayım | `tryon_used` (`013:116-130`): `failed_at is null` ve (`succeeded_at` dolu **ya da** son 30 dk'da açılmış) render'lar |
| Ne zaman düşüyor | **İstek başında, rezervasyonla.** `start` bir `tryon_renders` satırı açar (`013:179`). Bu satır 30 dk boyunca sayılır, ilk try-on katmanı tamamlanınca kalıcı olur (`complete_prediction` → `mark_render_success`, `006:184-205`, `008:144-165`) |
| İade | `/run`'da OutOfCredits ya da 5xx (`fashn-proxy/index.ts:234-242`). `/status failed` ve hiçbir katman tamamlanmamışsa (`:301-323`) |
| Render başına çağrı bütçesi | `c_max_runs = 6` (`008_render_refund.sql:107`) |
| `model-create` | Kotadan ayrıca düşmez ama aynı render'ın çağrı bütçesine dahildir |

### a.3 Limitler: nerede tanımlı, nerede zorlanıyor

| Limit | Sunucu (zorlayan) | Sunucuda tekrarlanan sabit | İstemci |
|---|---|---|---|
| Dolap 50 (ücretsiz) | `enforce_wardrobe_limit` trigger, `c_free_limit = 50` (`013:200`) | `get_usage` sabit `50` (`013:362`) | Ön kontrol `guardWardrobeAdd` (`ne-giysem/src/lib/premiumGate.ts:14-22`). Yarış durumunda trigger hatası yakalanır (`UploadDetailScreen.tsx:309-314`) |
| Try-on 3 ömür boyu / 8 ay | `start_tryon` (`013:143-144`) | `get_usage` sabit `8` ve `3` (`013:367`, `:371`) | Yedek metin `FREE_RENDER_LIMIT = 3` (`CombosScreen.tsx:54`), Paywall yedeği `?? 3` (`ne-giysem/src/screens/main/PaywallScreen.tsx:118`) |
| "Uyar mı?" 3/ay | `start_scan`, `c_free_limit = 3` (`013:273`). **İstemci çağırıyor**, atlanabilir (`013:264` notu) | `get_usage` sabit `3` (`013:376`) | `guardScan` (`premiumGate.ts:25-33`), `spendScan` (`:41-54`). RPC hatası sonucu engellemez |
| Planlama (yalnızca premium) | `enforce_planning_premium` trigger (`013:231-257`) | — | — |
| Günlük tavanlar | `bg` 150, `anthropic` 150 (proxy sabitleri) | — | — |
| Render çağrı bütçesi | `c_max_runs = 6` (`008:107`) | — | — |

İstemci limitleri tek kaynak olarak `get_usage`'tan okur (`ne-giysem/src/store/usePlanStore.ts:166`). Yani istemcide limit sayısı yok, yalnızca yedek metinler var. **Değerler SQL'de üç ayrı yerde sabit:** zorlayan fonksiyon, `get_usage` ve önceki migration'ların eski kopyaları (006/008'deki `start_tryon`'lar 013 ile değiştirildi).

### a.4 Kredi bitmesi ve harcama sınırı (madde 9)

| Sağlayıcı | Sunucu ne yapıyor | Kullanıcı ne görüyor |
|---|---|---|
| **Anthropic** | 402 ya da gövdede "credit balance" → `ops_events`'e `anthropic_out_of_credits` + 503 (`anthropic-proxy/index.ts:134-139`) | **Ekleme:** 503 kullanıcıya gösterilecek hata sayılmıyor (`visionAnalysis.ts:6-8`) → istemci bir kez daha dener (ikinci `anthropic` sayacı) → `failed:true` → "AI bulamadı, sen seç" ve elle doldurma (`UploadDetailScreen.tsx:128-131`). **Tarama:** `failed` sonuç da `.then`'e düşer, `spendScan` **hakkı harcar** ve varsayılan `category:'upper'` ile sonuç gösterilir. `StoreResultScreen.tsx:167-178`'de `failed` kontrolü yok (hata) |
| **Poof** | Kredi/kota biçimi bilinmiyor. Yanıt `{"error":"Poof error <status>"}` + aynı status ile geçer, 503'e çevrilmez, ops kaydı yok (`bg-removal-proxy/index.ts:58-64`) | `friendlyError` mesajda `poof` geçtiği için **"Bu fotoğraf formatı desteklenmiyor"** gösterir (`ne-giysem/src/utils/errorMessage.ts:41-42`), yani yanıltıcı. Yüklemede ekran sıfırlanır ve parça **hiç eklenemez** (`UploadScreen.tsx:152-156`). Poof 429 dönerse "Sanal deneme şu an yoğun" metni çıkabilir (`errorMessage.ts:33`) |
| **FASHN /run** | `{"error":"OutOfCredits"}` (ölçülmüş biçim, 429) → ops kaydı + render iadesi + 503 (`fashn-proxy/index.ts:232-239`) | "Sanal deneme şu an kullanılamıyor" (`CombosScreen.tsx:784-785`). Kota düşmez |
| **FASHN /status** | 503, iade yok (`fashn-proxy/index.ts:281-285`) | İstemci 5xx'te 240 sn yoklamaya devam eder (`virtualModel.ts:152-156`), sonra "FASHN zaman aşımı" → `friendlyError` genel "Bir şeyler ters gitti". Render 30 dk sonra sayımdan düşer (succeeded_at boş kaldıysa) |

**Harcama sınırı:**

- Kodda global (tüm kullanıcılar) harcama tavanı **yok**. Yalnızca kullanıcı başına günlük sayaçlar ve kotalar var.
- `ops_events` kaydının bir bildirime (e-posta vb.) bağlı olup olmadığı **[doğrulanmadı]**: repoda yalnızca tablo ve 10 dk tekrar bastırma var (`007_ops_events.sql`).
- Sağlayıcı panellerinde harcama limiti / otomatik yükleme ayarı **[doğrulanmadı]**.

---

## b. Önerilen tasarım

### b.1 Packshot entegrasyonu (madde 4)

**Hangi edge function?** Yeni bir `garment-image` fonksiyonu önerilir; `fashn-proxy` genişletilmemeli. Gerekçe:

- `fashn-proxy`, `render_id` zorunluluğu, `tryon_renders` bütçesi ve try-on rızalarıyla (`tryon_photo` / `tryon_physical`) sıkı bağlı (`fashn-proxy/index.ts:165-220`).
- Packshot try-on değil. Bağlı olduğu izin `ai_processing`, kendi sayacı ve hata/fallback mantığı var.
- Ortak parçalar `_shared/fashn.ts`'e taşınmalı: `FASHN_BASE`, `isOutOfCredits`, `/run` + `/status` çağrısı.

**Önerilen API:**

- `action:'start'`, `{ kind:'packshot'|'bg-remove', image_ref }` → `{ id }`
- `action:'status'`, `{ id }` → `{ status, image_b64? }`
- İstemci yoklar (mevcut `runFashn` deseni, `virtualModel.ts:115-182`). Sunucu içinde yoklamak edge function süre sınırına takılabilir. Packshot süresi **[doğrulanmadı]**.
- `image_ref`: kullanıcının `wardrobe-items/<uid>/…` orijinal yolu. Sunucu 10 dk'lık imzalı URL üretip FASHN'a verir. Böylece ~2 MB base64 istek gövdesinde taşınmaz ve sahiplik kontrolü `isOwnStorageUrl` mantığıyla aynı kalır.
- Packshot girdileri: `product_image` (imzalı URL), `output_format:'jpeg'`, `return_base64:true`. `resolution` / `aspect_ratio` / `generation_mode` sunucuda sabitlenmeli (maliyet). Geçerli değerleri **[doğrulanmadı]**, FASHN dokümanından alınmalı.
- Prediction id'nin kullanıcıya ait olduğu kaydedilmeli; aksi halde başkasının id'siyle `status` çağrılabilir. Yeni küçük tablo: `garment_jobs(id, user_id, prediction_id, kind, created_at)`.

**Akış:**

1. Görsel seçilir → `toUploadJpeg` (mevcut).
2. Orijinal `wardrobe-items/<uid>/<uuid>_orig.jpg` olarak yüklenir. Yeni adım; satır henüz yok.
3. **Paralel olarak:**
   - (a) Claude analizi **orijinal** base64 üzerinde (mevcut `analyzeClothingImage`, girdisi değişir).
   - (b) `garment-image start packshot`.
4. Packshot tamamlanınca **orijinal ve packshot yan yana** gösterilir.
   - "Bu benim kıyafetim" → packshot temiz görsel olur.
   - "Orijinali kullan" → `garment-image start bg-remove` (FASHN background-remove, 1 kredi) → temiz görsel.
5. Claude ile sadakat kontrolü **yapılmaz** (karar gereği).
6. Kaydet: temiz görsel 1000 px + 400 px önizleme (mevcut kod `UploadDetailScreen.tsx:233-275`), `image_url = _orig.jpg`, `processed_image_url = <uuid>.jpg`.
7. Vazgeçilirse `_orig.jpg` silinir. Uygulama kapanırsa yetim kalabilir; periyodik temizlik gerekir (açık soru).

**Not:** Claude prompt'u zaten "gerçek kullanıcı fotoğrafı" varsayıyor (`visionAnalysis.ts:71-77`). Yine de arka planlı orijinalde doğruluk değişebilir; b.4'teki test betiği bunu da ölçmeli.

**Şema** (yeni migration, öneri):

- `wardrobe_items.image_source text null`, CHECK ile `'packshot' | 'fashn_bg' | 'device' | 'original'`. Null = eski (Poof) parça.
- `image_url` artık gerçek orijinal yolu, `processed_image_url` temiz görsel. Mevcut silme kodu üç yolu ayrı ayrı topluyor (`privacyActions.ts:57-61`), yani ek değişiklik gerektirmez. Hesap silme tüm bucket klasörünü temizliyor (`delete-account/index.ts:39`) **[klasör bazlı silme ayrıntısı doğrulanmadı]**.
- **Mevcut parçalar:** dokunulmaz. Orijinalleri yok (`image_url = processed_image_url`), yeniden işlenemez. İsteğe bağlı olarak "yeniden çek" önerisi gösterilebilir.

**Ücretsiz plan "ilk 3 parça packshot" sayacı:**

- Sunucuda `api_usage` `fn='packshot'`, gün bazlı, ömür boyu toplam.
- Parça silmek hakkı **geri vermemeli**; aksi halde sil-ekle ile sınırsız packshot alınır.
- Sayaç **başarıdan sonra** artırılmalı, ya da start'ta rezerve edilip hata durumunda iade edilmeli (try-on'daki model).

**Hata durumları:**

| Durum | Sunucu | Kullanıcı | Kayıt |
|---|---|---|---|
| OutOfCredits (`{"error":"OutOfCredits"}`, 429) | `reportOpsEvent` + 503, packshot hakkı düşmez | "Stüdyo görseli şu an oluşturulamıyor" + seçenekler: cihazda arka plan kaldırma (destekleniyorsa) ya da olduğu gibi kaydet | `image_source='device'` ya da `'original'` |
| ContentModerationError (`status:'failed'`, `error.name`; mayo/iç giyim) — FASHN bu adı döndürüyor mu **[doğrulanmadı]** | Hak düşmez | "Bu parça için stüdyo görseli oluşturulamadı" → otomatik `bg-remove` dene. background-remove'un da moderasyon yapıp yapmadığı **[doğrulanmadı]**; o da reddederse olduğu gibi | `'fashn_bg'` / `'original'` |
| Zaman aşımı (istemci ~90 sn, değer önerisi) | — | "Uzun sürdü" + "Orijinali kullan" / "Tekrar dene". Geç gelen sonuç yok sayılır | `'original'` ya da `'fashn_bg'` |
| Kategori/analiz hatası (Claude) | Mevcut | Mevcut elle doldurma | Değişmez |

İlke: **parça her durumda kaydedilebilmeli.** Bugünkü Poof hatası parçayı tamamen engelliyor (a.4). Bu davranış düzeltilmeli.

**Packshot görselleriyle try-on:**

- `garment_photo_type`: parça bazında. `image_source === 'packshot'` → `'flat-lay'`, aksi halde `'auto'` (`virtualModel.ts:302`).
- `category:'auto'`: katman **sırası** bizim kategoriye göre belirlendiği için sıralama değişmez, yalnızca FASHN'a giden değer değişir. Önerim: önce `'auto'` ile A/B (aynı 10 kombin), özellikle elbise ve uzun üstler. `category` değeri sunucuda sabitlenmediği için proxy değişikliği gerekmez.
- `/v1/run` `category:'auto'`'yu tryon-v1.6'da kabul ediyor mu **[doğrulanmadı]**.

### b.2 Cihaz üstü arka plan kaldırma (madde 5)

| Konu | Bulgu |
|---|---|
| Hazır kütüphane | `expo-segmentation` (v0.1.0): iOS Vision + Android ML Kit, `removeBackground` API'si. **Çok yeni, düşük indirme sayısı**, bakım durumu **[doğrulanmadı]**. Expo Go'da çalışmaz, dev/EAS build gerekir. Olgun bir RN/Expo alternatifi bulunamadı (tek arama yapıldı) |
| Yazmak gerekirse | Yerel Expo Module (Swift: `VNGenerateForegroundInstanceMaskRequest` + Kotlin: ML Kit Subject Segmentation) + `expo-module.config.json`. Config plugin yalnızca Android Play services bağımlılığı / meta-data için gerekir **[doğrulanmadı]** |
| Minimum iOS | Uygulama sürüm belirtmiyor (`ne-giysem/app.json`, `expo-build-properties`'te `deploymentTarget` yok) → SDK 56 varsayılanı **iOS 16.4** (Expo SDK tablosu). Vision API iOS **17+** istiyor → **iOS 16.4–16.x cihazlar desteklenmez** |
| Minimum Android | SDK 56 `minSdkVersion` değeri teyit edilemedi **[doğrulanmadı]**. Tabloda "Android 7+" yazıyor. ML Kit Subject Segmentation API 24+ diyor, uyumlu görünüyor. Model Google Play services üzerinden **isteğe bağlı indiriliyor**; Play services olmayan cihazlarda çalışmaz |
| Geri dönüş | Çalışma zamanında destek kontrolü. Desteklenmiyorsa "olduğu gibi kaydet" (ücretsiz) ya da FASHN background-remove (1 kredi). Hangisi seçileceği maliyet kararı (açık soru 4) |
| Boyut / EAS | iOS'ta Vision sistem framework'ü, ek boyut yok denecek kadar az. Android'de model APK'ya gömülmüyor (unbundled) **[doğrulanmadı]**. EAS build süresine etkisi önemsiz |
| OTA mı? | **Hayır, yeni native build gerekir.** `runtimeVersion.policy = appVersion` (`app.json`). JS tarafı native modülü çağırırsa eski binary'lerde çöker. Uygulama sürümü artırılmalı (1.0.1 → 1.1.0), böylece yeni JS yalnızca yeni binary'ye gider. JS'de `requireOptionalNativeModule` ile koruma da eklenmeli |

### b.3 Try-on düzeltmeleri (madde 6)

**Dış giyimi çıkarmak (en temiz yol, yalnızca istemci, OTA):**

- `selectAndOrderGarments`'ta (`virtualModel.ts:257-277`) `outer`'ı filtrele, `FASHN_CATEGORY.outer`'ı kaldır (`:238`), `VEST_LAYER` mantığını sil (`:248-268`).
- Yelek için karar gerekir: tek üstse normal üst olarak kalabilir. İki üst varsa yelek **elenir** (öneri).
- `comboSignatureForCache` (`:325-331`) dış giyimi içeriyor. Değiştirilmezse aynı kombin için eski (ceketli) cache isabet verir. İmzaya da `outer` filtresi eklenmeli ya da cache anahtarına sürüm eklenmeli (`CombosScreen.tsx:675`).
- Kombin kartında "ceket denemeye dahil değil" notu `modelHasExtras` desenine eklenebilir (`CombosScreen.tsx:633`).

**`segmentation_free: false` neden?**

- Commit `48417fb` (2026-08-03, "fashn parametreleri dokumantasyonla hizalandi").
- Yorum: "false → orijinal kıyafet düzgün kaldırılır (alt parça binme sorunu)" (`virtualModel.ts:305`). Ölçüm kaydı repoda yok.
- `true` denemesi için kodda tek satır değişir. Proxy izin listesinde zaten var (`fashn-proxy/index.ts:28`).
- Risk: manken iç çamaşırlı (`virtualModel.ts:198`) olduğundan sorun daha çok **katmanlar arası** (önceki katmanın kıyafeti) çıkar.
- Test: aynı 10 kombin, iki değer, aynı seed. Seed şu an rastgele (`:308`); test için sabitlenmeli.

**Ayakkabı `'quality'` → `'balanced'`:**

- Değişiklik `virtualModel.ts:357` (ve test bloğu `:442`).
- Sunucu tarafında sabitleme: `PINNED_VALUES['tryon-max'].generation_mode`, `fashn-proxy/index.ts:33-35`.
- **Sıra önemli:** önce sunucu `['quality','balanced']` kabul eder. OTA yayıldıktan sonra yalnızca `['balanced']` kalır; aksi halde eski istemciler 400 alır.

**Her yerde `return_base64: true` (etki):**

- **Zincir kırılır:**
  - `complete_prediction` yalnızca `https://` çıktıları kaydeder (`fashn-proxy/index.ts:295-296`).
  - Bir sonraki katmanın `model_image`'ı `user_owns_output` ile doğrulanamaz (`:102-105`) → `image-not-allowed:model_image`.
  - İstemci ayrıca son URL'i `fetch` ediyor (`CombosScreen.tsx:752`) ve `profiles.mannequin_url`'e FASHN URL'i yazıyor (`:730-745`).
- **Önerilen çözüm:** proxy `status completed` anında base64'ü `mannequin-cache/<uid>/tmp/<render>_<n>.jpg`'ye yazar ve istemciye **storage yolu** döner. Sonraki katman bu yolu `isOwnStorageUrl` ile zaten kabul eder (`STORAGE_BUCKETS` içinde `mannequin-cache` var, `:38`). Geçici dosyalar render sonunda silinir. `output_urls` / `user_owns_output` zamanla gereksizleşir.
- Base64'ü doğrudan bir sonraki `model_image` olarak geri göndermek de mümkün olabilir (FASHN base64 girdi kabul ediyor mu **[doğrulanmadı]**). Ama sahiplik kontrolü kaybolur, istek gövdesi büyür.
- **Boyut:** 1k JPEG ~200–600 KB → base64 ~0,3–0,8 MB **[doğrulanmadı, ölçülmeli]**. Bu yalnızca `completed` yanıtında gelir; ara yoklamalar küçük kalır.
- **Edge function limitleri** (Supabase bellek ~256 MB, duvar saati ve CPU süresi planına göre): **[doğrulanmadı — Supabase dokümanından teyit edilmeli]**. Base64 decode + storage upload birkaç MB için sorun olmamalı. Asıl risk CPU süresi; ölçülmeli.
- Kazanç: FASHN sunucusunda çıktı saklanmaz. Bu uyum metinlerinde "FASHN görselleri üç gün sonra siler" ifadesini değiştirir (bkz. c).

### b.3b Adım 5 uygulandı (06.11.2026): `return_base64` + ara çıktılar bizim storage'da

Commit'ler: `39e7351` (sunucu), `805bc7f` (OTA).

**FASHN dokümanı:**
- `return_base64: true` → çıktı CDN URL'i yerine `data:image/<jpeg|png>;base64,...` döner ([tryon-v1.6](https://docs.fashn.ai/api-reference/tryon-v1-6), [tryon-max](https://docs.fashn.ai/api-reference/tryon-max), [model-create](https://docs.fashn.ai/api-reference/model-create)).
- *"Outputs are available for up to 60 minutes instead of the standard three-day window. Request history contains only a … placeholder."*
- [Veri saklama sayfası](https://docs.fashn.ai/api-overview/data-retention-privacy):
  - Base64 çıktı 60 dk sonra `"_expired"` döner. URL çıktısı (varsayılan) üç gün sonra silinir.
  - URL ile gönderilen girdiler: yalnızca işlem için indirilir, URL metni istek kaydında kalır.
  - İstek kayıtları otomatik silinmez; silme yalnızca legal@fashn.ai'ye prediction id'leriyle yazılarak yapılır.
  - Ayrıca bir CDN kopyası kalıp kalmadığı **[doğrulanamadı — dokümanda yok]**.
- [DPA yayımlanmış](https://fashn.ai/legal/dpa): §6.1 talimatla silme *"without undue delay"*, §6.2 sözleşme sonunda silme/iade. **Gün sayısı yok**; 60 dk / 3 gün yalnızca doküman sayfasında.
- Supabase [edge function limitleri](https://supabase.com/docs/guides/functions/limits):
  - Bellek 256 MB; CPU 2 sn (async I/O hariç); duvar saati Free'de 150 sn.
  - İstek/yanıt gövdesi sınırı yazmıyor.

**Akış:**

| Adım | Ne olur | Kod |
|---|---|---|
| `run` | Sunucu `return_base64: true` ekler. İstemci gönderemez (izin listesinde yok → 400). tryon-max `output_format` `['jpeg']` olarak sabitlendi (önceden png gelip `.jpg` adıyla saklanıyordu) | `fashn-proxy/index.ts:38-51`, `:349` |
| `status` completed | Önce `complete_prediction` (değişmedi). Sonra base64 çözülüp yazılır:<br>• try-on katmanı → `mannequin-cache/<uid>/tmp_<render>_<prediction>.<ext>`<br>• model-create → `<uid>/base_mannequin.png`<br>Yanıt: 10 dk imzalı URL + `path`. Storage hatası → 503 (istemci yoklamaya devam eder, sonraki completed'da yeniden yazılır). Okunamayan çıktı → 410 | `:411-425`, `persistOutput` `:119-170` |
| Sonraki katman | İmzalı URL `model_image` olur; `isOwnStorageUrl` kabul eder | `virtualModel.ts:307-345` |
| `finish` | `render_id` bu kullanıcının olmalı; `final_path` `<uid>/tmp_<render_id>_…` olmalı, `cache_key` `v2_….jpg` desenine uymalı (aksi 400). Sunucu kopyalar (`v2_` cache anahtarı) ve render'ın `tmp_` dosyalarını siler. Kopyalama hatası → 503, istemci eski yola (indir + yükle) düşer | `fashn-proxy/index.ts:457-500`, `CombosScreen.tsx:783-819` |
| Hata | İstemci catch'te `finish`'i yalnızca silme için çağırır | `CombosScreen.tsx:823` |
| `start` | 1 saatten eski `tmp_` dosyaları silinir | `fashn-proxy/index.ts:271-273` |
| Gizlilik işlemleri | Parça silme, fotoğraf kaldırma ve fiziksel veri silme `tmp_` dosyalarını da siler. Hesap silme zaten `<uid>/` kökünü siler (bu yüzden alt klasör kullanılmadı) | `privacyActions.ts:19, 68, 116` |
| Log | `[fashn-proxy] output saved {bytes, b64_chars, decode_ms, upload_ms, cpu_ms}`. `cpu_ms` = istek başından beri işçi CPU'su (`process.cpuUsage`). Ortam sunmuyorsa `null`. `decode_ms` senkron olduğu için doğrudan CPU'dur | `:72-76`, `:158-165` |

- `output_urls` / `user_owns_output` bu adımda kaldı (FASHN https dönerse eski yol çalışır). Kaldırma ayrı adım.
- Kredi değişmez.
- Depolama: kalıcı yük değişmez. Deneme başına 1–3 ara dosya birkaç saniye–dakika kalır.
- Egress: FASHN ara dosyaları bizden indirir; son görselde istemci indirmesi kalkar. Gerçek boyutlar loglardan okunacak **[ölçülmedi]**.

**`"_expired"` gelirse ne olur (kota/iade koduna dokunulmadı, mevcut davranış):**

1. **Ne zaman:** FASHN base64 çıktıyı tamamlandıktan sonra 60 dk tutar. İstemci 2 sn'de bir yoklar ve completed'ı görünce durur. 240 sn sonra da vazgeçer (`virtualModel.ts:65-66`). Dolayısıyla `_expired`'a normal akışta ulaşılmaz. Ulaşmanın tek yolu completed'dan 60 dk sonra status çağrılması; ayrıca `register_run` 30 dk penceresi (`006:131-141`) render'ı zaten kapatır.
2. **Olursa:**
   - `status` completed dalında `complete_prediction` çıktıdan **önce** çağrılır (`fashn-proxy/index.ts:413-416`). Try-on katmanıysa `mark_render_success` render'ı başarılı işaretler (`008_render_refund.sql:151-153`).
   - Ardından çıktı data URI ya da https değilse 410 `output-unavailable` döner (`:421-424`). İstemci bunu genel "tekrar dene" mesajı olarak gösterir: `errorMessage.ts`'te 410'a özel eşleme yok.
3. **Hak yanar, iade yok.** İade yalnızca iki durumda var: `/run`'da OutOfCredits veya 5xx (`:361` ve sonrası, `refundAndUnavailable` `:86-91`), ya da `/status` **failed** ve hiçbir katman tamamlanmamışsa (`:426-447`). completed dalında iade yolu yok.
4. **Benzer durum:** storage'a yazma kalıcı olarak başarısız olursa (503'ler) istemci 240 sn sonra zaman aşımına düşer. Render ilk completed'da başarılı işaretlendiği için hak yine yanar. Bu, bugünkü "FASHN görseli indirilemedi" (`CombosScreen` `imageDownloadError`) davranışıyla aynı.
5. `_expired`'ın tam biçimi (çıktı dizisinde metin mi, ayrı bir durum mu) **[doğrulanmadı]**. Ayrı bir `status` değeri gelirse proxy aynen geçirir; istemci 240 sn'de zaman aşımına düşer.

### b.3a Profil fotoğrafı: tam boy ön kontrolü (öneri, uygulanmadı)

**Sorun:** yüz odaklı bir selfie FASHN'da PoseError verdi (5 Kasım ölçümü). Hata yalnızca try-on sırasında ortaya çıkıyor. Adım 4'te tepki tarafı çözüldü: "Yapay mankenle dene" seçeneği. Ama yükleme anında bir kontrol yok: fotoğraf seçilir, 1200 px JPEG'e çevrilir ve kontrolsüz yüklenir (`ne-giysem/src/screens/main/profile/ProfilePhotoScreen.tsx:95-119`).

| Seçenek | Maliyet | Uygunluk |
|---|---|---|
| **İstemcide en-boy oranı** (`asset.width/height`, `ProfilePhotoScreen.tsx:101`): oran < ~1,3 (kare/yatay) ise "tam boy değil gibi görünüyor" uyarısı + "yine de kullan" | 0. Ağ çağrısı yok | Kaba bir filtre: dikey bir yüz selfie'sini yakalayamaz. Ama kare selfie ve yatay kırpmaları yakalar. OTA ile gider |
| **Cihaz üstü vücut pozu** (iOS Vision `VNDetectHumanBodyPoseRequest`, Android ML Kit Pose Detection): ayak bileği ve kalça noktaları görünüyor mu? | 0 kredi, veri cihazdan çıkmaz | En isabetli ve en mahremiyet dostu yol. **Native modül gerekir** → arka plan kaldırmayla aynı lansman sonrası build. Hazır Expo kütüphanesi **[doğrulanmadı]** |
| **Claude analizi** (anthropic-proxy) | Görsel başına bir Sonnet çağrısı (tutar **[doğrulanmadı]**) | **Önerilmez:** yapay zekâ izni metni "Kendi fotoğrafın … gönderilmez" diyor (`tr.json` `aiConsent.whatBody`, `:846`). `tryon_photo` rızası da alıcı olarak yalnızca FASHN'ı sayıyor. Kullanmak rıza metni değişikliği ve yeni bir alıcı demek |
| **FASHN** | Ayrı bir doğrulama uç noktası bilinmiyor **[doğrulanmadı]**. Poz kontrolü yalnızca try-on içinde (kredi + kota) | Ön kontrol için uygun değil. Mevcut tepkisel akış (adım 4) yeterli |

**Öneri:** lansmanda en-boy oranı uyarısı (adım 4b, OTA, maliyet 0) ve adım 4'teki tepkisel akış. Lansman sonrasında cihaz üstü poz kontrolü, arka plan kaldırmayla aynı native build'de.

**Açık nokta:** PoseError'ın `/status` "failed" olarak mı, yoksa `/run` 4xx olarak mı geldiği ölçülmedi. İlk durumda render iade ediliyor. İkincisinde render 30 dk açık sayılıyor ve hemen ardından yapılan yapay manken denemesi limit kenarındaki ücretsiz kullanıcıda reddedilebilir. FASHN function logundan (`[fashn-proxy] prediction failed` ya da `upstream /run 4xx`) doğrulanmalı.

### b.4 Daha ucuz analiz modeli: test planı (madde 7)

**Model değişikliği nereden yapılır?**

1. Sunucu izin listesi `anthropic-proxy/index.ts:13`. **Önce** bu deploy edilir, yoksa yeni model 400 alır.
2. İstemci `visionAnalysis.ts:198` (OTA).
3. `output_config.effort:'low'` yeni modelde destekleniyor mu kontrol edilmeli **[doğrulanmadı]**. Desteklenmiyorsa istemci alanı göndermemeli.
4. Daha esnek seçenek: model adını sunucu tarafına almak (istemci `model` göndermez, proxy b.5'teki ayar tablosundan okur). Model değişikliği o zaman build/OTA gerektirmez.

**Karşılaştırma betiği (yazılmayacak, plan):**

- **Ön hazırlık:** `buildPrompt` ve `parseVisionResponse` RN'ye bağlı `i18n` import ediyor (`visionAnalysis.ts:3`). Bunlar saf bir modüle (`src/utils/visionPrompt.ts`, locale parametreli) taşınmalı. Böylece betik ve uygulama aynı prompt'u kullanır. Taşıma ayrıca OTA ile gider.
- **Konum:** `ne-giysem/scripts/vision-compare.ts`, `npx tsx` ile **geliştirici makinesinde** çalışır. Anthropic API'ye doğrudan bağlanır; anahtar yerel ortam değişkeninden okunur, repoya yazılmaz. Proxy kullanılmaz: kullanıcı sayaçları ve izin kontrolü test verisine karışmasın.
- **Veri:** 20 **test** fotoğrafı (kullanıcı verisi değil, ekibin kendi çektikleri). Kategori dağılımı dengeli olmalı: üst, alt, elbise/tulum, dış, ayakkabı, çanta, aksesuar; zor örnekler de dahil (katlanmış şort, tulum, saten, payet). Her biri iki varyant: arka planlı orijinal + packshot. Fotoğraflar repo dışında tutulur (`.gitignore`). Elle etiketlenmiş `ground-truth.csv` hazırlanır.
- **Çalıştırma:** her görsel × 2 model × 3 tekrar (tutarlılık için). Aynı prompt, `max_tokens 4096`.
- **Ölçütler:**
  - category doğruluğu (en kritik), subcategory doğruluğu
  - pattern, fabric
  - seasons: Jaccard
  - colors: hex kümeleri arası CIEDE2000 eşleşmesi (eşik ~10)
  - signals: Jaccard, ayrıca `evening_wear` / `athletic` kaçırma oranı
  - JSON parse hatası / `failed` oranı
  - tekrarlar arası tutarlılık
  - gecikme, input/output token, görsel başına maliyet
- **Çıktı:** satır başına CSV + özet Markdown (scratch klasörüne, commit edilmez).
- **Karar eşiği** (öneri): kategori doğruluğu düşüşü ≤ 1/20 ve `failed` artışı yoksa geçiş.

### b.5 Limitleri sunucu ayar tablosuna taşımak (madde 3)

**En az riskli yol: tek migration, davranış değişmeden.**

1. `app_limits(key text primary key, free_value int null, premium_value int null, updated_at timestamptz)`. RLS açık, anon/authenticated'a hiçbir yetki yok.
2. Satırlar **bugünkü değerlerle** eklenir: `wardrobe` 50/null, `tryon` 3/8, `scan` 3/null. Hedef limitler için `packshot` ve `tryon_shoes` anahtarları da eklenir ama henüz okunmaz.
3. `limit_for(key, is_premium) returns int` (security definer, `coalesce(tablodaki, sabit)`). Tablo boş ya da satır silinmişse bugünkü sabite düşer.
4. `start_tryon`, `get_usage`, `enforce_wardrobe_limit`, `start_scan` `create or replace` ile `limit_for`'u kullanır. Sabitlerin üç kopyası (`013:143-144, 200, 273, 362, 367, 371, 376`) tek kaynağa iner.
5. Doğrulama: deploy öncesi ve sonrası `get_usage` çıktısı aynı olmalı.

Sonrasında limit değişikliği yalnızca `update app_limits …` olur; build gerektirmez. İstemci metinleri sayıyı `get_usage`'tan alıyor. Yalnızca yedek sabitler (`CombosScreen.tsx:54`, `PaywallScreen.tsx:118`) ve CLAUDE.md'deki tablo elle güncellenir.

**Uygulandı (adım 2):** `ne-giysem/supabase/migrations/020_app_limits.sql`. Anahtarlar: `free.wardrobe_max` 50, `free.tryon_lifetime` 3, `premium.tryon_monthly` 8, `free.scan_monthly` 3. NULL = sınırsız. Premium dolap ve tarama sınırsızlığı fonksiyonlardaki `is_premium` dalında kaldı, tabloda değil. İstemci tabloyu okumuyor; sayılar `get_usage`'tan geliyor.

**İstemcide sabit yazılı limitler — adım 15'te güncellenecek** (adım 2'de değiştirilmedi):

| Yer | Değer | Not |
|---|---|---|
| `ne-giysem/src/screens/main/CombosScreen.tsx:54` | `FREE_RENDER_LIMIT = 3` | 402 yanıtında limit yoksa yedek |
| `ne-giysem/src/screens/main/PaywallScreen.tsx:112` | `usage?.scan.limit ?? 3` | Yedek |
| `ne-giysem/src/screens/main/PaywallScreen.tsx:118` | `usage?.tryon.limit ?? 3` | Yedek |
| `ne-giysem/src/i18n/locales/tr.json:906, 909, 910, 912` / `en.json` aynı satırlar | `rowWardrobeFree` "50 parça", `rowTryonFree` "3 (ömür boyu)", `rowTryonPremium` "8 / ay", `rowScanFree` "3 / ay" | **Paywall karşılaştırma tablosu sabit metin**: `app_limits` değişince kendiliğinden güncellenmez. Adım 15'te ya metinler güncellenir ya da `get_usage`'tan beslenen parametreli metne çevrilir (`%{limit}`) |
| `ne-giysem/src/lib/premiumGate.ts:57, 59`, `ne-giysem/src/screens/main/ProfileScreen.tsx:53, 57` | "23/50", "1/3" | Yalnızca yorumlardaki örnekler; davranışı etkilemez |
| `CLAUDE.md`, Monetizasyon tablosu | 50 / 3 / 8 / 3 | Proje dokümanı |

İstemci `tryon.limit` değerini `number` olarak bekliyor (`ne-giysem/src/store/usePlanStore.ts:139`). `app_limits`'te bir deneme limiti NULL (sınırsız) yapılırsa istemci tarafı önce bunu desteklemeli **[doğrulanmadı — null için ekran davranışı test edilmedi]**.

**Mevcut kullanıcıların sayaçları:**

- Sayım mantığı değişmediği için yeni limit **geriye dönük** uygulanır.
- **Premium 8 → 5:** bu ay 6–8 kullanmış kullanıcı ay sonuna kadar kilitlenir, "6/5" görür (`ProfileScreen.tsx:61` `fmt`). Geçiş ay başına denk getirilmeli ya da gösterim `min(used, limit)` ile sınırlanmalı.
- **Ücretsiz 3 → 1:** 1–3 deneme yapmış ücretsiz kullanıcılar ömür boyu kilitlenir. Hak tanıma (grandfathering) kararı gerekir (açık soru 3).
- **"Ayakkabısız deneme" (ücretsiz):** sunucuda zorlanmalı. `start_tryon` render satırına `plan` / `allow_shoes` yazar; `fashn-proxy` `run`'da `tryon-max` isteğini ücretsiz render için 403 ile reddeder. İstemcide de ayakkabı adımı atlanır ve "ayakkabılar Premium'da" notu gösterilir. `c_max_runs` aynı kalabilir.
- **Dolap 50 ve tarama 3** değişmiyor.

---

## c. Uyum değişiklikleri listesi (madde 8)

### c.1 "Poof" / arka plan kaldırma geçen yerler

**Kod (ne-giysem):**

- `supabase/functions/bg-removal-proxy/index.ts` (tamamı; `POOF_URL :13`, `POOF_API_KEY :54`)
- `src/screens/main/UploadScreen.tsx:36-45, 66, 117, 134, 142-156` (yorumda eski "Remove.bg" `:142`)
- `src/screens/main/ScanScreen.tsx:35-48, 123, 128`
- `src/screens/main/StoreResultScreen.tsx:162`
- `src/screens/main/AiConsentScreen.tsx:71`
- `src/utils/errorMessage.ts:40-42`
- `src/utils/imageNormalize.ts:16, 22`
- `src/lib/edgeFunctions.ts:7, 22`
- `src/lib/premiumGate.ts:36`
- `src/lib/privacyActions.ts:159`
- `supabase/functions/_shared/consent.ts:24`
- `supabase/migrations/014_privacy_consent.sql:7` (yorum)

**Çeviriler** (`src/i18n/locales/tr.json` ve `en.json`, aynı satırlar):

- `errors.bgRemoveFailed :581`
- `scan.removingBg :596`
- `scan.disabledBody :614`
- `upload.bgCleaned :628`, `upload.bgCleanedWeb :629`
- `upload.photoGuideIntro :633`
- `aiConsent.poofName :834`, `aiConsent.poofPurpose :835`, `aiConsent.declineBody :841`
- `privacy.aiBody :849`

**Proje dokümanı:** `CLAUDE.md:11, 134` (Remove.bg/rembg/SAM; zaten güncel değil).

**docs/compliance:**

- `data-inventory.md:24, 26, 27, 29, 58, 73, 93, 112, 116`
- `store-disclosures.md:35, 105, 145`
- `guvenlik-tedbirleri.md:21, 65, 70, 84, 100, 122`
- `ozel-nitelikli-veri-siniflandirmasi.md:25, 44`
- `saklama-imha-politikasi.md:20`
- `veri-ihlali-mudahale-proseduru.md:24, 33, 103`

**sestina-web:**

- `acik-riza.html:44, 46, 52` / `consent.html:44, 46, 52`
- `aydinlatma.html:53, 117, 135, 139-142` / `notice.html:53, 117, 135, 139-142`
- `gizlilik.html:65, 115, 136-137, 144, 149, 168, 203, 220, 232-236, 293` / `privacy.html` aynı satırlar
- `hesap-silme.html:55` / `delete-account.html:55`
- `kosullar.html:47, 96, 122` / `terms.html:47, 96, 122`. Bu sayfalar "arka plan kaldırma" işlevinden bahsediyor; işlev kalacağı için sağlayıcı adı yoksa yalnızca kontrol yeterli.

**Mağaza beyanları:** `store-disclosures.md`'deki üçüncü taraf listesi (`:35`, `:105`) ve ephemeral notu (`:145`). Mağaza konsollarına girilen değerlerin kendisi **[doğrulanmadı]**, repoda yok.

### c.2 Yapay zekâ izin metni

- `aiConsent` anahtarları şu an **iki sağlayıcı** sayıyor: Poof (Almanya, arka plan) ve Anthropic (ABD, özellik tanıma) (`tr.json:830, 834-837`, `en.json` aynı). `privacy.aiBody` (`:849`) de aynı ikisini sayıyor.
- **Sürüm:** `CONSENT_VERSIONS.ai_processing = '1.1'` (`src/constants/consent.ts:16`). Kural: ana sürüm = kapsam değişikliği (yeni alıcı), yeniden sorulur (`consent.ts:3-7`).
- **Yeniden sorma akışı:**
  - İstemci `isGranted` ana sürüm farklıysa false döner, `aiStatus` `'undecided'` olur (`src/store/useConsentStore.ts:155-166`).
  - Sonraki kıyafet ekleme / taramada `ensureAiDecision` izin ekranını açar (`src/lib/aiConsent.ts:64-71`).
  - Kayıt `consent_events`'e yeni `text_version` ile yazılır (`useConsentStore.ts:120-126`).
- **Boşluk:**
  - Sunucu sürümü kontrol etmiyor (`supabase/functions/_shared/consent.ts:49-50`). OTA'yı almamış eski bir istemci 1.1 onayıyla FASHN'a fotoğraf gönderebilir; yeni `garment-image` fonksiyonu **ana sürüm ≥ 2** şartını sunucuda aramalı.
  - Ana sürüm değişince istemci yalnızca ekleme/tarama anında sorar. Proaktif bir "metin güncellendi" ekranı yok (aydınlatma için var: `needsNoticeUpdate`, `useConsentStore.ts:194-197`).
- FASHN'ın yeni alıcı olarak eklenmesi **ana sürüm 2.0** gerektirir. Poof'un çıkarılması tek başına alt sürüm olurdu.

### c.3 FASHN'ın her yüklemede devreye girmesi neyi değiştirir (yalnızca liste)

- **data-inventory.md**
  - #4: orijinal artık saklanıyor; `image_source`
  - #6: Poof satırı → FASHN packshot / background-remove; saklama `return_base64` ile "FASHN'da saklanmaz" (beyan); istek kaydında imzalı URL kalabilir
  - #7: Claude girdisi artık arka planlı orijinal
  - #9: tarama sağlayıcısı
  - #13: FASHN'ın amacı try-on dışına genişliyor; rıza dayanağı `ai_processing` (tercih) ile try-on açık rızası ayrımı
  - İzin tablosu `:58` sürüm 2.0
  - Sağlayıcı tablosu `:73-74` (Poof çıkar, FASHN rolleri #6 + #13)
  - `:93`, `:112`, `:116`
- **store-disclosures.md:** üçüncü taraf listeleri (`:35`, `:105`). Photos "collected" zaten Yes, tür değişmez. Ephemeral notu (`:145`). Saklanan orijinal yeni bir saklama, ama beyan türü aynı.
- **gizlilik / privacy:**
  - `:65`: "orijinal yalnızca arka plan kaldırma için işlenir" ifadesi artık yanlış
  - `:115`: günlük sayaçlar (`bg` → `packshot`)
  - `:136-137, 144, 149`: amaç tablosu
  - `:168`: "Poof'a ve Anthropic'e iletmez"
  - `:170`: FASHN model eğitimi beyanı
  - `:203`, `:220-236`: sağlayıcı tablosu
  - `:293`: Almanya'dan Poof çıkar; FASHN'ın ülkeleri zaten listede
- **aydınlatma / notice:** `:53` amaç, `:117` alıcılar, `:135-146` alıcı tablosu (Poof satırı çıkar, FASHN amacına "kıyafet görseli hazırlama" eklenir).
- **açık rıza / consent:** `:44, 46, 52`. Yapay zekâ izni bölümü FASHN'ı da saymalı. Try-on rıza bölümleri değişmez.
- **hesap-silme / delete-account:** `:55` Poof cümlesi çıkar. FASHN'ın "üç gün sonra siler" ifadesi `return_base64` kullanılan çağrılar için güncellenir.
- **guvenlik-tedbirleri.md:**
  - `:20-21`: Poof hesabı kapanır, `POOF_API_KEY` secret'ı silinir
  - `:65`: 403 satırına `garment-image`
  - `:69-70`: izin listesi / tavanlar
  - `:84`: `POOF_API_KEY` satırı çıkar
  - `:100`, `:122`: veri minimizasyonu
- Ayrıca `ozel-nitelikli-veri-siniflandirmasi.md:25, 44` (kıyafet fotoğrafında kişi görünmesi artık FASHN'a da gider), `saklama-imha-politikasi.md:20`, `veri-ihlali-mudahale-proseduru.md:24, 33, 103`.

### c.4 Adım 5'in (return_base64 + ara çıktılar) metinlere etkisi — 7. adımda yapılacak (yalnızca liste)

> **Uygulandı (07.11.2026)** — adım 6 + 7 ile birlikte; bkz. d, "Adım 6 + 7" bölümü. Aşağıdaki liste tarihsel kayıt olarak bırakıldı.

Bu adımda metin değiştirilmedi. Satır numaraları 06.11.2026 haliyle:

- **`docs/compliance/saklama-imha-politikasi.md`**
  - `:15` mannequin-cache içeriğine try-on ara çıktıları (`tmp_`)
  - `:20` ve `:38` FASHN süresi: base64 çıktı 60 dk; istek kaydı otomatik silinmez
  - Bölüm 2: "try-on ara çıktıları — deneme bitince, en geç 1 saat — silme — `finish` + `start` temizliği" satırı
  - `:27-29` gizlilik işlemleri `tmp_` dosyalarını da siler
  - Bölüm 3 (otomatik temizlik): `start`'taki 1 saat temizliği
- **`sestina-web/gizlilik.html` + `privacy.html`**
  - `:115` "sonuç bağlantıları": artık FASHN URL'i kaydedilmiyor (`output_urls` boş kalır)
  - `:126` "sonuç depomuza kaydedilemediyse paylaşılan bağlantı FASHN'ın kendi bağlantısıdır … üç gün": geçersiz (paylaşım zaten kapalı; gösterilen bağlantı bizim ara dosyamız)
  - `:228` "üretilen görseller üç gün sonra silinir" → 60 dk; istek kaydı notu
- **`sestina-web/hesap-silme.html` + `delete-account.html`**
  - `:55` "FASHN ürettiği görselleri üç gün sonra siler"
  - FASHN istek kayıtlarının silinmesi prediction id ister; hesap silmede `tryon_renders` cascade ile gidiyor. Bu kayıt silme talebi akışında dikkate alınmalı.
- **`docs/compliance/data-inventory.md`**
  - `:33` (#13) saklama süresi
  - `:34` (#14) "FASHN çıktısı depomuza kopyalanır" → sunucu yazar; ara çıktılar
  - `:35` (#15) "çıktı URL'leri"
  - `:112` DPA artık yayımlanmış ([fashn.ai/legal/dpa](https://fashn.ai/legal/dpa)); imza/kabul durumu teyit
- **Diğer uyum dokümanları**
  - `docs/compliance/ozel-nitelikli-veri-siniflandirmasi.md:23`: FASHN'a giden bağlantılar artık ara dosyalar için de bizim storage'ımız
  - `docs/compliance/guvenlik-tedbirleri.md:58` (sahiplik: imzalı ara dosya; `user_owns_output` yedek) ve `:69` (sabit `return_base64`, tryon-max `output_format`)
- **Değişmesi gerekmeyenler:**
  - Açık rıza metinleri (`acik-riza.html:67`, `consent.html:67`, `tr.json:815`): "10 dakika geçerli bağlantı" doğru kalıyor
  - Aydınlatma metni süre içermiyor
  - Rıza sürümü değişmez

---

## d. Uygulama sırası

Kararlar (05.11.2026) bölümüne göre yeniden düzenlendi. Her adım tek başına test edilebilir. Etiketler: **[sunucu]** = migration / edge function / veri, **[OTA]** = `eas update`, **[native]** = yeni EAS build + mağaza. Lansmana kadar **native adım yok**.

Gerçek kullanıcı olmadığı için (Karar 3) eski istemci uyumluluğu için ara adımlara gerek yok. Sunucu ve OTA değişiklikleri aynı gün yayınlanabilir. Test hesaplarının yeni OTA'yı alması yeterlidir.

| # | Adım | Etiket | Nasıl test edilir |
|---|---|---|---|
| 1 | Hata düzeltmeleri: Poof hatasında parça orijinal fotoğrafla eklenir; "poof" artık format hatası sayılmaz; başarısız tarama hak yakmaz (İş 2, ayrı commit) | OTA | Bkz. commit notu: geçersiz Poof anahtarıyla ekleme; "Uyar mı?" ile analiz hatası |
| 2 | `app_limits` + `limit_for`; 4 fonksiyon tabloya bağlanır, **değerler bugünkülerle aynı**. Dosya: `ne-giysem/supabase/migrations/020_app_limits.sql` (geri alma SQL'i dosyanın sonunda) | sunucu | Test kullanıcısında uygulama öncesi ve sonrası `get_usage` çıktısı birebir aynı olmalı; tablodaki değer değişince `limit_for` ve `get_usage` yeni sayıyı göstermeli; satır silinince sabite dönmeli |
| 3 | `_shared/fashn.ts` çıkarımı; tryon-max `generation_mode` doğrudan `['balanced']` olarak sabitlenir + istemci `virtualModel.ts:357` `'balanced'` (birlikte) | sunucu + OTA | `quality` gönderen istek 400 almalı; yeni paketle ayakkabılı deneme çalışmalı |
| 4 | Try-on: dış giyim elenir (`isOuter`: kategori `outer` + hırka/yelek), sonuçta "dış giyim gösterilmiyor" notu, try-on cache'i ayrı ve sürümlü imzaya geçer (`v2_`; favori imzası değişmez). Fotoğraf varken de kaynak sorulur (kendi fotoğrafım / yapay manken). Fotoğrafta PoseError → "Yapay mankenle dene" | OTA | Ceketli kombin: FASHN panelinde ceket satırı olmamalı, `runs_used` bir azalmalı, eski cache isabet vermemeli; fotoğraflı hesapta seçim penceresi; yüz odaklı fotoğrafla PoseError → yapay manken önerisi |
| 4b | Profil fotoğrafı ön kontrolü, ucuz sürüm (b.3a): yüklemede en-boy oranı uyarısı + "yine de kullan" | OTA | Kare/yatay selfie → uyarı; dikey tam boy → uyarı yok; maliyet 0 |
| 5 | ✅ (06.11.2026, `39e7351` + `805bc7f`) fashn-proxy'de `return_base64` + ara çıktılar `mannequin-cache/<uid>/tmp_<render>_<prediction>.<ext>` (alt klasör değil — hesap silme yalnızca kökü listeliyor); `finish` eylemi; tryon-max `output_format: 'jpeg'`. Ayrıntı b.3b, metin listesi c.4 (adım 7'de) | sunucu + OTA | 3 katman + ayakkabı: FASHN URL'i istemciye hiç gelmemeli; geçici dosyalar silinmeli; `output saved` logunda boyut ve CPU |
| 6 | ✅ (07.11.2026, `e58de94`; ayrıntı "Adım 6 + 7" bölümü) **Sunucuda izin sürümü kontrolü** (Karar 5): `consent_granted` ya da `_shared/consent.ts` en son kaydın `text_version` ana sürümünü sunucu tarafı tablo/sabitle (`ai_processing` → 2, `tryon_*` → 1) karşılaştırır. Eski sürüm 403 döner. `anthropic-proxy`, `fashn-proxy` ve (adım 8'deki) `garment-image` kullanır. `bg-removal-proxy` da (silinene kadar) aynı kontrolü alır | sunucu | 1.1 onaylı test hesabı: proxy'ler 403 `ai-consent-required` döndürmeli; 2.0 onayından sonra 200; try-on 1.0 rızalarıyla çalışmaya devam etmeli |
| 7 | ✅ (07.11.2026, `faf897f` + web `draft` `3a98c9f`; Poof geçiş süresince listede kaldı, 13. adımda çıkar → 2.1) İzin metni ve sürüm (Karar 5): tr/en `aiConsent` (Poof çıkar, FASHN eklenir), `privacy.aiBody`, `CONSENT_VERSIONS.ai_processing = '2.0'`; web sayfaları ve compliance dokümanları (c bölümü, adım 5'in etkisi c.4) | OTA + web + docs (adım 6 ile **aynı gün**) | 1.1 onaylı hesap: ilk eklemede izin ekranı yeniden açılmalı; `consent_events`'te 2.0 satırı; web sayfalarında Poof geçmemeli |
| 8 | `garment-image` fonksiyonu (packshot + background-remove, `garment_jobs`, packshot sayacı, adım 6'daki sürüm kontrolü); istemci henüz çağırmıyor | sunucu | Test kullanıcısıyla curl: başarılı, moderasyon (mayo), OutOfCredits (sahte anahtar), sahiplik (başkasının id'si → 403), 1.1 izinle 403 |
| 9 | `wardrobe_items.image_source` migration (`'packshot' \| 'fashn_bg' \| 'original'`; `'device'` lansman sonrası) | sunucu | Sütun null'able; mevcut uygulama etkilenmez |
| 10 | Yeni yükleme akışı (Karar 2, 4, 6): geçici `_orig.jpg` yükle → Claude(orijinal) ∥ packshot → yan yana seçim → onay: packshot / ret: FASHN background-remove → karar verilince `_orig.jpg` silinir. Ücretsiz plan 4.+ parça: packshot yok, orijinal olduğu gibi + "düz zemine ser, iyi ışıkta çek" ipucu. Hata durumunda: orijinal olduğu gibi | OTA | Ücretsiz: 3 parça packshot, 4. parça olduğu gibi + ipucu; premium: tüm parçalar packshot; onay/ret/zaman aşımı/moderasyon/OutOfCredits; kayıttan sonra storage'da `_orig.jpg` kalmamalı; vazgeçince de silinmeli |
| 11 | `segmentation_free: true` denemesi — packshot'lı parçalarla, adım 10'dan sonra. Yöntem: fashn-proxy'de **yalnızca belirli test kullanıcı kimlikleri için** `segmentation_free: true` gönderen geçici sunucu bayrağı (secret, örn. `FASHN_SEGFREE_TEST_UIDS`, ya da `app_limits` benzeri bir ayar). Proxy, istemcinin gönderdiği değeri bu kullanıcılar için ezer. Dev build gerekmez. Deneme bitince bayrak ve kod kaldırılır, sonuca göre değer kalıcı yapılır | sunucu | Aynı 10 kombin, bayrak açık ve kapalı test hesabıyla; function logunda gönderilen değer; görsel karşılaştırma tablosu. Bayrak dışındaki kullanıcıların isteği değişmemeli |
| 12 | ✅ kod (07.11.2026, `f990376`; yayın bekliyor, ayrıntı "Adım 12 + 13" bölümü) "Uyar mı?" Poof’suz (Karar 1): `ScanScreen` arka plan kaldırmaz, orijinal base64 `StoreResult`'a ve Claude'a gider | OTA | Tarama: `bg` sayacı artmamalı; sonuç ekranı orijinali göstermeli; storage'a dosya yazılmamalı |
| 13 | ✅ kod (07.11.2026, `891e7ba` + web `draft` `226a6ab`; deploy/secret silme veri sorumlusunda) Poof kaldırma: `bg-removal-proxy` deploy'dan silinir, `POOF_API_KEY` secret'ı silinir, Poof hesabı kapanır, kod/çeviri temizliği (c.1) | sunucu + OTA | Adım 10 ve 12 test hesaplarında doğrulandıktan sonra; `grep -i poof` yalnızca tarihsel dokümanlarda sonuç vermeli |
| 14 | Ucuz model testi (b.4): önce prompt'un saf modüle taşınması, betik yerelde. Karar 2'ye göre test görselleri **orijinal + packshot** | OTA + yerel | Rapor; geçerse önce `ALLOWED_MODELS` (sunucu), ardından `visionAnalysis.ts:198` (OTA) |
| 15 | ✅ kod (07.11.2026, H1–H6; yayın bekliyor, ayrıntı "15.9 Uygulama durumu"). **Yerine geçti: "Adım 15 tasarım" (07.11.2026, hard paywall + deneme).** Eski tanım: Hedef limitler (Karar 3, geçişsiz): `app_limits` değerleri (ücretsiz: dolap 50, packshot 3, deneme 1 ayakkabısız, tarama 3/ay; premium: sınırsız dolap ve packshot, deneme 5/ay ayakkabılı); ücretsizde ayakkabı zorlaması (`start_tryon` render'a plan yazar, `fashn-proxy` tryon-max'i 403'ler); **istemcideki sabit sayılar ve paywall metinleri** (b.5, "İstemcide sabit yazılı limitler"); CLAUDE.md tablosu | sunucu + OTA | Ücretsiz: tryon-max 403, ayakkabısız sonuç, 2. deneme reddi; premium: 5/ay, 6.'da yenilenme tarihi; paywall karşılaştırma tablosu yeni değerleri göstermeli; test hesaplarının sayaçları sıfırlanarak |
| 15a | **Yerine geçti: "Adım 15 tasarım", 15.5–15.6.** Eski tanım: **Kalan hak göstergesi** (15'in alt maddesi): try-on ve "Uyar mı?" için kalan/toplam hak `get_usage`'dan okunup gösterilecek. Yerler: deneme butonu yanında ve "Uyar mı?" ekranında. Metinler (TR + EN): premium "Bu ay X / Y deneme hakkın kaldı", ücretsiz "X ücretsiz deneme hakkın var" (toplam hak), hak bitince "Z tarihinde yenilenir" (premium) ya da paywall'a yönlendirme (ücretsiz). Açık rezervasyonlar (son 30 dk) kullanılmış sayıldığı için göstergeyle tutarlı olmalı | OTA | Premium ve ücretsiz test hesabında gösterge `get_usage` ile aynı sayıyı vermeli; deneme başlayınca (açık rezervasyon) ve iade sonrası güncellenmeli; hak bitince premium'da yenilenme tarihi, ücretsizde paywall; TR ve EN metinler |

### Adım 6 + 7 (07.11.2026): sunucuda izin sürümü kontrolü + izin metni 2.0

**Commit'ler:**
- `e58de94` sunucu
- `faf897f` OTA
- web: `sestina-web` `draft` dalında `3a98c9f`; `main`'e birleştirilince yayına çıkar
- uyum dokümanları + bu rapor: ayrı docs commit'i

**Kararlar (07.11.2026):**
1. **Poof geçiş süresince listede kalır.** Kıyafet ekleme ve tarama hâlâ Poof kullanıyor. 13. adımda Poof çıkar ve sürüm **2.1** olur: alıcı çıkarılıyor, yeniden onay istenmez.
2. **Saklama cümlesi istenen hâliyle iç dokümana girdi.** Altına bir açık nokta eklendi: manken tarifi (metin) FASHN istek kaydında kalıyor mu **[doğrulanmadı]**; ayrıca imzalı bağlantının yolunda uid var. FASHN'dan yazılı teyit alınacak. Web metinleri "talep gönderilmez" demiyor.
3. **fashn-proxy plandaki gibi.** `tryon_*` için en düşük sürüm 1, yani try-on davranışı bugün değişmez. 2.0 şartı yalnızca `ai_processing`'de.

**Değişen dosyalar:**

| Katman | Dosya:satır | Ne |
|---|---|---|
| sunucu | `supabase/functions/_shared/consent.ts:20` | `MIN_CONSENT_MAJOR` (tek yer: `ai_processing` 2, `tryon_*` 1) |
| sunucu | `_shared/consent.ts:36` | `consentState` (son kayıt → `granted` / `outdated` / `missing`) |
| sunucu | `_shared/consent.ts:68` | `aiConsentGate` |
| sunucu | `anthropic-proxy/index.ts:81`, `bg-removal-proxy/index.ts:35` | `aiConsentGate` → 403 `ai-consent-required` / `consent-version-outdated` |
| sunucu | `fashn-proxy/index.ts:271-281` (start), `:350-363` (run) | Aynı durumlar, try-on rızaları için |
| OTA | `src/constants/consent.ts:18` | `ai_processing: '2.0'` |
| OTA | `src/lib/aiConsent.ts:54` | `withAiReconsent`: 403 outdated → izin ekranı → onaylanırsa çağrı bir kez yeniden |
| OTA | `src/lib/aiConsent.ts:74` | `promptAiReconsentOnLaunch`; çağrıldığı yer `src/navigation/MainTabNavigator.tsx:28` (açılışta bir kez) |
| OTA | `src/store/useConsentStore.ts:98` | `needsAiReconsent` |
| OTA | `src/lib/edgeFunctions.ts:28` | `isConsentOutdatedError` |
| OTA | `UploadScreen.tsx:149`, `ScanScreen.tsx:125`, `:154`, `UploadDetailScreen.tsx:128`, `StoreResultScreen.tsx:174` | Yapay zekâ çağrıları `withAiReconsent` ile sarıldı |
| OTA | `src/utils/visionAnalysis.ts:256` | Outdated hatası yeniden denenmez, yukarı fırlatılır |
| OTA | `src/utils/errorMessage.ts:14`, `CombosScreen.tsx:844` | Mesaj; try-on'da rıza durumu tazelenir |
| OTA | `AiConsentScreen.tsx:72` | FASHN satırı |
| OTA | `tr.json` / `en.json` `:851`, `:858`, `:870`, `:607` | `whatBody`, `fashnPurpose`, `privacy.aiBody`, `errors.consentOutdated` |
| docs | `docs/compliance/saklama-imha-politikasi.md` | Sürüm 1.3. Ara çıktılar satırı, FASHN notu (istenen cümle + açık nokta), bölüm 3 temizlik |
| docs | `data-inventory.md` | #6, #7, #13, #14, #15; izin tablosu (2.0, sunucu kontrolü); alıcılar; madde 9 (DPA) |
| docs | `ozel-nitelikli-veri-siniflandirmasi.md:23` | FASHN aktarımı |
| docs | `guvenlik-tedbirleri.md` | Sürüm 1.2. Bölüm 3 (sahiplik, `return_base64`), bölüm 4 (403'ler, `MIN_CONSENT_MAJOR`, `DEFAULT_VALUES`) |
| web | `acik-riza.html` / `consent.html` | 2.0 metni, sürüm tablosu ve notu |
| web | `gizlilik.html` / `privacy.html` | Kota kaydı, not (paylaşım, ara görseller), amaç tablosu (FASHN satırı, Poof geçiş), izin paragrafı (FASHN + eski sürüm), FASHN sağlayıcı satırı (60 dk, DPA), Poof satırı |
| web | `hesap-silme.html` / `delete-account.html` | FASHN saklama cümlesi |
| web | `aydinlatma.html` / `notice.html` | FASHN amaçları, Poof geçiş |

Tüm web sayfalarında yürürlük tarihi **7 Kasım 2026** olarak ayarlandı; yayın günü farklıysa güncellenmeli.

**Yayın sırası: OTA → web → sunucu**
1. **OTA** (`eas update`).
   - Yeni metin ve 2.0 kaydı gelir.
   - 1.x onaylı kullanıcıya açılışta ya da ilk yapay zekâ işleminde yeniden sorulur.
   - Eski sunucu her geçerli onayı kabul ettiği için bu aşamada kırılma olmaz.
2. **Web:** `sestina-web` `draft` → `main`.
   - Uygulama içindeki bağlantılar yeni metni göstersin; OTA ile aynı gün.
3. **Sunucu:** `npx supabase functions deploy anthropic-proxy bg-removal-proxy fashn-proxy --project-ref bdvrgbylirftuxmrpbea`.
   - **Neden en son:** OTA'yı almamış bir bundle 403 `consent-version-outdated`'i tanımaz.
     - Kıyafet eklemede bunu sağlayıcı hatası sayar: parça arka planıyla kaydedilir, analiz düşer.
     - Taramada genel hata gösterir.
     - Yeniden onay verse bile `1.1` yazar.
   - Deploy'dan önce test hesaplarının OTA'yı aldığı (yeni metni gördüğü) doğrulanmalı.

**Test (3 madde):**
1. **Açılışta yeniden onay (OTA sonrası, eski sunucu):** 1.1 onaylı test hesabıyla uygulamayı aç.
   - İzin ekranı açılmalı: FASHN satırı ve "Kendi fotoğrafın Claude'a (Anthropic) gönderilmez" cümlesi görünmeli.
   - Onayla. `consent_events`'te `ai_processing` / `2.0` satırı oluşmalı; kıyafet ekleme normal çalışmalı.
2. **403 ve kaldığı yerden devam (sunucu deploy sonrası):**
   - Uygulama açıkken SQL ile test hesabına `ai_processing` / `1.1` / `granted` satırı ekle.
   - Kıyafet ekle. Arka plan adımında izin ekranı açılmalı.
   - **Onay:** işlem aynı fotoğrafla sürmeli ve `2.0` satırı oluşmalı.
   - **"Şimdi değil":** elle akışa düşmeli.
   - "Uyar mı?" taramasında aynı davranış beklenir.
   - curl ile `anthropic-proxy` → 403 `{"error":"consent-version-outdated","kinds":["ai_processing"]}`.
3. **Try-on ve web:**
   - 1.0 try-on rızalı hesapta deneme değişmeden çalışmalı (fashn-proxy 403 vermemeli).
   - Web `draft` önizlemesi: açık rıza sayfasında 2.0; gizlilik, hesap silme ve aydınlatma sayfalarında "üç gün" ifadesi geçmemeli, "60 dakika" geçmeli.

**Demo hesabı** (`demo@sestinaapp.com`; SQL Editor'de, sunucu deploy'undan önce ya da sonra):
```sql
insert into public.consent_events (user_id, kind, granted, text_version)
select id, 'ai_processing', true, '2.0' from auth.users where email = 'demo@sestinaapp.com';

-- kontrol: her tür için en son kayıt
select distinct on (kind) kind, granted, text_version, created_at
  from public.consent_events
 where user_id = (select id from auth.users where email = 'demo@sestinaapp.com')
 order by kind, id desc;
```
- Try-on rızaları (`tryon_photo` / `tryon_physical` 1.0) bu değişiklikten etkilenmez. Kontrol sorgusunda `granted = true` görünmüyorsa inceleme ekibi try-on'da rıza penceresini görür.
- Bu satır kişinin kendisi tarafından verilmemiş bir onay kaydıdır; yalnızca bizim demo hesabımız için kullanılır.

### Açık iş (koşullu): FASHN'a gitmeden bırakılan rezervasyonun iadesi

**Ne zaman açılır:** kapalı testte `runs_used = 0`, `succeeded_at` ve `failed_at` boş `tryon_renders` satırları sık görülürse. Bunlar rezerve edilip FASHN'a hiç ulaşmayan denemelerdir; hak 30 dk kilitli kalır.

**Tespit:**
```sql
select user_id, id, created_at from tryon_renders
 where runs_used = 0 and succeeded_at is null and failed_at is null
 order by created_at desc;
```
Id'ler fashn-proxy loglarında aranır: 400 satırları `render_id` içerir; 403/426 satırları `user=` ve saatle bulunur. Log yoksa istemci `run` göndermemiştir (ağ, uygulamanın kapatılması, istemcide hata).

**Yapılan (06.11.2026, (A), yalnızca OTA):** FASHN gerektirmeyen kontroller `startTryOn`'dan önceye alındı. Bu kontroller:
- profil fotoğrafının ve parça görsellerinin bizim storage'da olması (imzalamadan)
- kayıtlı mankenin varlığı ve model kaynağının belirlenmesi

Bunlar başarısızsa rezervasyon açılmaz (`CombosScreen.tsx`, `handleVirtualModel` 2.–3. adımlar).

**Yapılmayan (B):**
- **Migration:** `cancel_unused_render(p_user, p_render)`.
  - Render satırını `for update` ile kilitler.
  - `runs_used = 0` ve `succeeded_at` / `failed_at` boşsa **mevcut `fail_render`'ı** çağırır.
  - `start_tryon` / `register_run` / `fail_render` değişmez.
- **fashn-proxy:** `cancel` eylemi; render'ın sahipliği kontrol edilir.
- **OTA:** catch bloğunda `activeRender` varsa en iyi çabayla `cancel`.
- **Neden kilit + `runs_used = 0`:**
  - `register_run` rezervasyonu FASHN çağrısından önce alır (`fashn-proxy/index.ts:352`). Kilitsiz bir `cancel`, eşzamanlı bir `run` ile yarışırsa iade edilmiş render'da FASHN işi yine biter; kötü niyetli istemci kotasız katman alır.
  - Kilitle birlikte `register_run` bekler ve `failed_at` doluysa artırmaz.
- **Kapsam dışı:** PoseError `/run` 4xx olarak gelirse `runs_used = 1` olur ve bu yolla serbest kalmaz.

### Lansman sonrası

| Adım | Etiket | Nasıl test edilir |
|---|---|---|
| Profil fotoğrafı cihaz üstü vücut pozu kontrolü (b.3a): iOS Vision `VNDetectHumanBodyPoseRequest`, Android ML Kit Pose Detection. Arka plan kaldırmayla aynı native build'e girer | **native** | Yüz odaklı selfie → yüklemede uyarı; tam boy fotoğraf → geçer; desteklenmeyen cihazda adım 4b'deki oran kontrolüne düşer |
| Cihaz üstü arka plan kaldırma (Karar 4): ücretsiz plandaki 4.+ parçalar için iOS Vision (iOS 17+) / Android ML Kit Subject Segmentation. Olgun kütüphane yoksa kendi Expo modülümüz yazılır. Uygulama sürümü artırılır (`runtimeVersion: appVersion`). `image_source = 'device'` | **native** | iOS 17+ ve 16.x cihaz, Play services'li / servissiz Android; desteklenmeyen cihazda "olduğu gibi" fallback |

---

## Adım 8-10 tasarım (07.11.2026) — onay bekliyor

Bu bölüm yalnızca tasarım; kod yazılmadı. **Kararlar (07.11.2026)** aşağıdaki kurallarla, "Kararlar (05.11.2026)" bölümünün **4. maddesinin yerine geçer** (cihaz üstü kesim artık lansmanda):

- `garment-image` = FASHN packshot (1 kredi). "Orijinali kullan" → FASHN background-remove (1 kredi). `ai_processing` 2.0 şart.
- Packshot ile orijinal yan yana gösterilir, kullanıcı seçer. Orijinal kalıcı saklanmaz.
- `image_source`: `'packshot' | 'bg_removed' | 'device_cutout' | 'original'`. b.1'deki `'fashn_bg' | 'device'` adlarının yerine.
- Cihaz üstü kesim: iOS 17+ Vision, Android ML Kit Subject Segmentation. Desteklenmeyen cihazda parça olduğu gibi kaydedilir ve çekim ipucu gösterilir.
- Packshot kotası dolunca parça cihaz üstü kesimle kaydedilir.
  - Ücretsiz plan: ilk 3 parça. Premium: aylık kota, değeri 15. adımda belirlenecek.
  - Kota yenilenince "stüdyo kalitesine yükselt" ile elle yükseltilir; otomatik yükseltme yok.
- Packshot başarısız olursa ya da içerik denetimine takılırsa: iade mevcut kurala göre, parça cihaz üstü kesimle kaydedilir.

### 8-10.0 Engelleyici açık nokta: FASHN packshot API'de belgelenmemiş

- **Packshot:** `https://docs.fashn.ai/api-reference/packshot` ve `.../product-to-packshot` → **404**.
  - Doküman dizininde ([llms.txt](https://docs.fashn.ai/llms.txt)) ve [model listesinde](https://docs.fashn.ai/api-overview/model-lifecycle) packshot / ghost mannequin / flat lay yok.
  - Mevcut API modelleri: Agent Images, Background Remove, Edit, Face to Model, Image to Video, Model Create, Model Swap, Product to Model, Reframe, Try-On Max, Try-On v1.6.
  - `model_name`, parametreler, kredi, süre, çıktı biçimi ve moderasyon davranışı **[doğrulanamadı]**.
- **Gereken:** FASHN'dan (support@fashn.ai) yazılı teyit:
  - (a) packshot API'de var mı, `model_name` ne
  - (b) girdiler ve maliyeti etkileyen alanlar
  - (c) kredi
  - (d) `return_base64` desteği
  - (e) moderasyon ve hata adları
  - (f) yanıt süresi
- **Teyit gelene kadar:**
  - Packshot dalı dışındaki her şey (native modül, background-remove dalı, kota altyapısı, akış) yapılabilir. Packshot dalı istemcide bir bayrakla kapalı kalır.
  - "Edit" ya da "Agent Images" ile prompt üzerinden packshot denemek bir seçenek ama **önerilmez**: maliyeti ve sonuç tutarlılığı bilinmiyor.
- **Background Remove belgelenmiş** ([kaynak](https://docs.fashn.ai/api-reference/background-remove)):
  - `model_name: "background-remove"`, girdi `image` (URL ya da data URI), `return_base64` (çıktı `data:image/png;base64,…`).
  - **1 kredi**. Tipik süre **1–3 sn**. Çıktı **şeffaf PNG**. En küçük girdi 128×128 px; en büyük boyut belirtilmemiş.
- **Ortak kurallar** ([hata yönetimi](https://docs.fashn.ai/api-overview/error-handling), [temeller](https://docs.fashn.ai/api-overview/api-fundamentals)):
  - *"Failed predictions do not consume credits."*
  - Çalışma hataları: `ImageLoadError`, `ContentModerationError`, `InputValidationError`, `ThirdPartyError`, `UnavailableError`, `PipelineError`.
  - Sınırlar: `/run` 100 istek / 60 sn, `/status` 50 istek / 10 sn, eşzamanlı 6 istek.

### 8-10.1 Native modül

**Platform API'leri:**

| Platform | API | Kaynak |
|---|---|---|
| iOS | `VNGenerateForegroundInstanceMaskRequest`, **iOS 17.0+**. Sonuç `VNInstanceMaskObservation`; `generateMaskedImage(ofInstances:from:croppedToInstancesExtent:)` arka planı saydam yüksek çözünürlüklü görüntü verir. Uygulama içinde (in-process) çalışır. Donanım kısıtı ve simülatör desteği belgede yok **[doğrulanmadı]**; bir kütüphane README'sine göre simülatörde çalışmıyor | [Apple doc (JSON)](https://developer.apple.com/tutorials/data/documentation/vision/vngenerateforegroundinstancemaskrequest.json), [WWDC23 10176](https://developer.apple.com/videos/play/wwdc2023/10176/) |
| Android | ML Kit Subject Segmentation, **beta** (SLA yok). API **24+**. Bağımlılık `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1`. Model **Play services üzerinden indirilir** ("unbundled", ~200 KB APK artışı); kurulumda indirme için manifest `com.google.mlkit.vision.DEPENDENCIES = subject_segment`. İndirme bitmeden yapılan istek **sonuç vermez**. Pixel 7 Pro'da ~200 ms. Play services olmayan cihazda davranış belgede yok **[doğrulanmadı]** | [Genel bakış](https://developers.google.com/ml-kit/vision/subject-segmentation), [Android](https://developers.google.com/ml-kit/vision/subject-segmentation/android) |
| Expo SDK 56 | iOS **16.4+**, Android **7+** (= API 24, çıkarım) | [SDK 56](https://docs.expo.dev/versions/v56.0.0/) |

Sonuç: iOS 16.4–16.x cihazlarda kesim yok, `@available(iOS 17, *)` ile korunur. Android minSdk zaten uyumlu.

**Hazır kütüphaneler** (npm kaydı, 07.11.2026):

| Paket | Son sürüm (tarih) | iOS / Android | Expo modülü / config plugin | Not |
|---|---|---|---|---|
| `@rbayuokt/expo-background-removal` | 0.1.0 (2026-09-11) | iOS 17 Vision / API 24 ML Kit (beta) | Expo modülü, autolink; plugin yok | En iyi belgelenmiş Expo adayı. Örnek SDK 55. README: SDK 56/57 için Swift 6.3.1 gerekiyor. ML Kit tüm-kare çıktısında SIGSEGV'ye karşı geçici çözüm var. Haftalık ~100 indirme, 9 yıldız |
| `@westwood-dev/expo-segmentation` | 0.1.0 (2026-06-07) | iOS 17 Vision / API 24 ML Kit | Expo modülü; plugin belirtilmemiş | SDK 56 devDeps. 6 commit, haftalık ~2 indirme |
| `@six33/react-native-bg-removal` | 1.3.4 (2026-01-09) | iOS 17 Vision (15.1–16 için `REQUIRES_API_FALLBACK`) / API 24 ML Kit | Expo'ya özel değil, RN kütüphanesi; codegen var | En çok kullanılan (haftalık ~1900). Expo ve yeni mimari uyumu **[belirtilmemiş]**. atlj fork'u |
| `react-native-nitro-vision-kit` | 0.4.1 (2026-10-25) | iOS 17 / API 24 ML Kit (beta) | Nitro modülü, Expo belirtilmemiş | Yeni mimari şart; OCR vb. fazladan |
| `expo-segmentation` | yayından kaldırılmış (2026-06-07) | — | — | **Kullanılamaz** (b.2'deki öneri geçersiz) |

Kaynak: npm registry JSON ve GitHub sayfaları (kütüphane taraması, 07.11.2026). Son commit tarihleri **[doğrulanmadı]**.

**Önerim: yerel Expo modülü** (`modules/garment-cutout`, `npx create-expo-module@latest --local`; [Expo](https://docs.expo.dev/modules/get-started/)). Gerekçeler:
- Adayların hepsi çok yeni ya da Expo SDK 56 ile çalıştığı belgelenmemiş.
- İhtiyacımız küçük: tek kesim fonksiyonu ve **beyaz zemine birleştirme**. FASHN background-remove da şeffaf PNG verdiği için birleştirmeye ayrıca ihtiyaç var; dolap JPEG kullanıyor ve JPEG'de saydamlık yok.
- Gizlilik açısından hassas yolda üçüncü taraf bağımlılık olmaz.
- MIT lisanslı `@rbayuokt` ve `@six33` kodu referans alınabilir (SIGSEGV notu dahil).
- Alternatif: önce bir günlük deneme olarak `@rbayuokt` ile dev build. SDK 56'da derlenirse onu kullanmak, `flattenOnWhite` için yine küçük bir yerel fonksiyon gerektirir.

**Modül arayüzü (öneri):**
```ts
isSupported(): Promise<{ supported: boolean; reason?: 'os' | 'no-play-services' | 'model-downloading' }>
cutout(uri: string): Promise<{ uri: string; width: number; height: number } | null>  // beyaz zemin JPEG; özne yoksa null
flattenOnWhite(pngUri: string): Promise<{ uri: string }>                             // FASHN bg-remove PNG → JPEG
```
- **iOS:** Vision isteği → `generateMaskedImage(allInstances, croppedToInstancesExtent: true)` → beyaz zemine birleştir → JPEG. Ana iş parçacığında çalışmaz.
- **Android:** `SubjectSegmentation.getClient(enableForegroundBitmap)` → beyaz zemin → JPEG.
  - Model indirilmemişse `model-downloading` döner, akış "olduğu gibi"ye düşer.
  - Config plugin (`withAndroidManifest`) kurulumda indirmeyi açar.
- **JS koruması:** `requireOptionalNativeModule('GarmentCutout')` modül yoksa `null` döner. Expo Go, web ve eski binary'de "desteklenmiyor" sayılır ([Expo](https://docs.expo.dev/versions/latest/sdk/expo.md)).
- **Kaç özne:** `allInstances` (askı ve aksesuar da kesilebilir). Tek özne seçimi lansman sonrası.

### 8-10.2 Build ve yayın

- **Neden yeni build:** native modül JS'ten çağrıldığı için yeni EAS build şart.
  - `runtimeVersion.policy = appVersion` (`app.json:98-100`).
  - `version` **1.0.1 → 1.1.0**. Böylece runtime 1.1.0 olur.
  - *"Only binaries with a matching runtime version can load the remote update"* ([Expo](https://docs.expo.dev/versions/latest/sdk/updates.md)).
- **1.0.1 kullanıcıları:**
  - 1.1.0 build'ini kurana kadar runtime 1.0.1 için yayınlanmış son OTA'yı kullanır: Poof akışı, adım 7'ye kadarki değişiklikler.
  - 1.1.0 için yayınlanan OTA'lar onlara **gitmez**. 1.0.1'e düzeltme gerekirse `version: 1.0.1` olan bir daldan ayrıca `eas update` yapılır.
  - Eski OTA'lar da yeni build'e gitmez; 1.1.0 kendi bundle'ıyla çıkar.
- **Sunucunun eski istemcilere desteği:**
  - `bg-removal-proxy` (Poof) ve mevcut `anthropic-proxy` girdisi, son 1.0.1 cihazı kalkana kadar durmalı. Bu yüzden **13. adım (Poof kaldırma), test hesaplarının ve demo hesabının 1.1.0'a geçmesinden sonra**.
  - Mağazada 1.0.1 incelemede ya da yayındaysa 1.1.0 incelemeden geçene kadar Poof kalır.
- `ios.deploymentTarget` yükseltilmez (16.4). iOS 17 API'si çalışma zamanında korunur.

| Değişiklik | Nereye |
|---|---|
| Migration 021: `image_source`, `garment_jobs`, `limit_for` yeni anahtarları | **sunucu** |
| `garment-image` edge function | **sunucu** |
| `modules/garment-cutout` (Swift/Kotlin + config plugin), `version` 1.1.0 | **build** (EAS + mağaza) |
| Yeni yükleme akışı, karşılaştırma ekranı, "stüdyo kalitesine yükselt", çekim ipucu | **1.1.0 bundle'ı** (build ile çıkar; sonraki düzeltmeler runtime 1.1.0 OTA'sı) |
| 1.0.1'e giden her şey | yalnızca `version: 1.0.1` dalından OTA (gerekmedikçe yok) |

### 8-10.3 Akış

Girdi: picker → `toUploadJpeg` (≤1400 px, ≤2 MB base64; mevcut). `uploadId = uuid` (parça id'si).

```
ensureAiDecision ─ izin yok ──────────────────────────────► [D] cihaz kesimi* / olduğu gibi
      │ izin var
      ├─ paralel: Claude analizi (orijinal base64)            kredi 0 · anthropic sayacı
      ├─ paralel: cihaz kesimi (destekleniyorsa, cache'te)    kredi 0 · kota yok
      └─ packshot hakkı var mı? (garment-image start, sunucu karar verir)
            ├─ hayır (kota dolu) ───────────────────────────► [C] cihaz kesimi / olduğu gibi + ipucu
            └─ evet → FASHN packshot (data URI girdi)         1 kredi · kota: rezerve
                  ├─ başarısız / moderasyon / OutOfCredits / zaman aşımı
                  │     → iş failed (kota iadesi) ──────────► [C]
                  └─ tamamlandı → [Yan yana: packshot | orijinal]
                        ├─ "Bu benim kıyafetim" → [A] kaydet: image_source='packshot'
                        └─ "Orijinali kullan" → FASHN background-remove (orijinal data URI)
                              1 kredi · packshot kotası DÜŞMEZ (8-10.4)
                              ├─ tamamlandı → flattenOnWhite → [B] 'bg_removed'
                              └─ başarısız → [C]
[C] cihaz kesimi varsa 'device_cutout', yoksa 'original' + "düz zemine ser, iyi ışıkta çek"
```
\* **İzin yokken cihaz kesimi:** veri cihazdan çıkmaz, bu yüzden teknik olarak mümkün. Ancak izin metninin "İzin vermezsen … arka planı kaldırılmadan kaydedilir" cümlesini değiştirir. Senin kararın: (a) izin yokken de cihaz kesimi + metin alt sürümü 2.1 (önerim), (b) izin yokken olduğu gibi.

**Dosyalar:**

| Ne | Nerede | Ne zaman silinir |
|---|---|---|
| Orijinal | **Yalnızca cihaz belleği / cache.** Sunucuya data URI olarak gider (`garment-image` gövdesi; `anthropic-proxy` zaten ≤2 MB base64 kabul ediyor). Storage'a geçici dosya **yazılmaz** | Kayıt ya da vazgeçme sonrası cache dosyası silinir. FASHN: base64 girdinin geçici kopyası iş bitince, en geç bir günde silinir [beyan] |
| Cihaz kesimi | Cihaz cache'i (`garment-cutout/…jpg`) | Kayıt ya da vazgeçme sonrası |
| Packshot / bg-remove çıktısı | Yanıtta base64, yalnızca bellek. Proxy storage'a **yazmaz** | Kayıt sonrası bellekten |
| Kalıcı | Mevcut yollar: `wardrobe-items/<uid>/<uuid>.jpg` (1000 px) + `<uuid>_thumb.jpg` (400 px); `image_url = processed_image_url = <uuid>.jpg` | Parça silinince (mevcut `deleteWardrobeItemFiles`) |

b.1'deki `_orig.jpg` geçici dosyası ve yetim temizliği **gerekmez**: orijinal storage'a hiç yazılmıyor.

- **Kredi özeti (yükleme başına):**
  - packshot onay: 1
  - "Orijinali kullan": 2 (packshot + bg-remove)
  - kota dolu ya da başarısız: 0
  - iade: FASHN başarısız işi ücretlendirmiyor
- **Açık soru:** "Orijinali kullan"da cihaz kesimi varsa bg-remove yerine o önerilebilir; kredi 1 → 0 olur. Kararlar bg-remove dediği için tasarım öyle; istersen değiştiririz.
- **Zaman aşımı (istemci):** packshot 90 sn (değer önerisi; süre belgede yok), bg-remove 30 sn. Geç gelen sonuç yok sayılır. İş sunucuda `failed` sayılmaz; FASHN tamamlarsa kredi harcanmış olur.

**"Stüdyo kalitesine yükselt"** (Dolap; `image_source in ('device_cutout','original')`):
- Kullanıcı parçaları seçer. Her biri için `garment-image start packshot { item_id }` çağrılır. Sunucu parçanın `processed_image_url`'ini sahiplik kontrolüyle 10 dk imzalar. Orijinal saklanmadığı için girdi mevcut temiz görsel ya da orijinal fotoğraftır.
- Sonuç yine yan yana gösterilir (eski | yeni):
  - **Onay:** yeni `<uuid>_s.jpg` + `_s_thumb.jpg` yazılır, satır güncellenir, eski dosyalar silinir.
  - **Ret:** hiçbir şey değişmez; kredi harcanmıştır, kota düşer.
- Try-on cache anahtarı yalnızca parça id'lerinden oluşuyor (`virtualModel.ts` `tryOnCacheSignature`). Yükseltilen parçanın eski try-on'ları **eski görselle** kalır. Onayda, adında o parça id'si geçen `mannequin-cache` dosyaları silinmeli (`deleteWardrobeItemFiles`'ın try-on kısmıyla aynı mantık).
- Otomatik yükseltme yok. Kota yenilenince Dolap'ta yalnızca bir öneri kartı gösterilir.

### 8-10.4 Kota sayımı (try-on koduna dokunmadan)

**Yeni tablo `garment_jobs`** (migration 021; `tryon_renders` deseni, ama ayrı):
```
id uuid pk · user_id → auth.users on delete cascade · kind text ('packshot'|'bg_remove')
item_id uuid null (yükseltmede) · parent_job uuid null (bg_remove → hangi packshot işinin "Orijinali kullan"ı)
prediction_id text null · created_at · succeeded_at null · failed_at null
```
- RLS açık, policy yok; yalnızca service_role.
- Sahiplik: `status` çağrısı yalnızca kullanıcının kendi işinin prediction id'siyle yapılabilir (b.1'deki öneri).

**Fonksiyonlar (yeni, security definer, yalnızca service_role):**
- `start_garment_job(p_user, p_kind, p_item, p_parent)`:
  - **packshot:** kullanılan = `kind='packshot' and failed_at is null and (succeeded_at is not null or created_at > now() - 10 min)`. Pencere ücretsizde ömür boyu, premium'da İstanbul ayı (`istanbul_month_start()` 013 ile aynı).
  - Limit: `limit_for('free.packshot_lifetime')` = 3 / `limit_for('premium.packshot_monthly')`. Değer 15. adımda belirlenecek; şimdilik `limit_for`'a bir varsayılan eklenir (örn. 20 **[değer kararı]**). Doluysa `{allowed:false, used, limit, reset_at}`.
  - **bg_remove:** packshot kotasından düşmez. `p_parent` zorunlu: aynı kullanıcının, **başarılı** ve henüz bg_remove çocuğu olmayan packshot işi olmalı. Packshot başına en çok 1 bg-remove.
  - **İkisi için de:** kötüye kullanım tavanı `bump_usage(p_user, 'garment', 60)` günlük. `bg` sayacının deseni; değer önerisi.
- `complete_garment_job` → `succeeded_at`. `fail_garment_job` → `failed_at`; kota kendiliğinden iade olur (`tryon_used` mantığı).
- **İade kuralı** (try-on ile aynı ilke):
  - İade **yalnızca üst servis hatasında**: `/run` OutOfCredits ya da 5xx, `/status` failed (moderasyon dahil). FASHN başarısız işi ücretlendirmediği için kredi kaybı yok.
  - Bizim 400/403 doğrulamalarımız rezervasyondan **önce** yapılır, böylece iade gerekmez.
  - Kullanıcı packshot'ı reddederse iade **yok** (kredi harcandı).
- `limit_for`: yeni anahtarlar `free.packshot_lifetime`, `premium.packshot_monthly` CASE'e ve `app_limits`'e eklenir. `limit_for_unknown` korunur.
- `get_usage`: `packshot { used, limit, reset_at }` alanı eklenir (15a göstergesi için).
- **Neden `api_usage` değil:** `api_usage` 13 ay sonra `purge_retention` ile siliniyor (`saklama-imha-politikasi.md`). Ömür boyu "ilk 3 parça" sayımı bu yüzden zamanla sıfırlanırdı. Ayrıca sahiplik için prediction id saklamak gerekiyor.

**Dokunulmayanlar:** `start_tryon`, `tryon_used`, `register_run`, `fail_render`, `tryon_renders`.

**`garment-image` (edge function):**
- `start {kind, image_b64? | item_id?, parent_job?}`:
  1. `aiConsentGate` (2.0).
  2. Girdi doğrulama: base64 ≤ 2 MB jpeg; `item_id` sahipliği.
  3. `start_garment_job`.
  4. FASHN `/run` (`return_base64: true`; packshot parametreleri teyitten sonra sabitlenir).
  5. OutOfCredits / 5xx → `fail_garment_job` + 503 (`reportOpsEvent`).
- `status {job_id}`:
  - Sahiplik kontrolü, FASHN `/status`.
  - Tamamlandıysa `complete_garment_job` ve yanıtta `image_b64`. Packshot çıktısı birkaç MB olabilir; edge yanıt sınırı belgede yok, ölçülmeli.
  - `failed` → `fail_garment_job` ve `error.name`'i istemciye geçirir (`ContentModerationError` → istemcide "bu parça için stüdyo görseli oluşturulamadı").
- Ortak katman `_shared/fashn.ts` (mevcut).

### 8-10.5 Gizlilik ve silme

- **Storage'a yeni geçici dosya yok.** `privacyActions` ve `delete-account` değişmeden kapsıyor:
  - Kalıcı dosyalar mevcut yollar.
  - Yükseltmenin yeni adı `<uuid>_s.jpg`. `deleteWardrobeItemFiles` `image_url` / `processed_image_url` / `thumb_url`'i yoldan siliyor, yani yeni ad satırda olduğu için kapsanır.
  - `delete-account` `<uid>/` kökünü siliyor.
- **`garment_jobs` satırları:** kota kaydı (prediction id dahil), hesap silinince cascade. Parça silinince **silinmez**; aksi halde hak geri gelirdi. Envanter #15'e benzer yeni bir satır ve saklama politikasına giriş gerekir (7. adımın benzeri, metin listesi aşağıda).
- **Cihaz cache'i:** kesim ve orijinal dosyaları kayıt ya da vazgeçme sonrası `FileSystem.deleteAsync`. Uygulama çökerse işletim sisteminin cache temizliğine kalır; cihazdan çıkmadığı için kabul edilebilir.
- **FASHN:**
  - Girdi data URI → geçici kopya iş bitince silinir [beyan]. İstek kaydında URL yok.
  - Yükseltmede 10 dk imzalı URL → kayıtta süresi dolmuş URL kalır.
  - Çıktı base64, 60 dk.
- **Uyum metinleri (yalnızca liste; ayrı adımda yazılır):**
  - Gizlilik amaç tablosu: cihaz üstü kesim (veri cihazdan çıkmaz), FASHN background-remove satırı.
  - `image_source` / `garment_jobs` için envanter satırları.
  - Saklama politikasında `garment_jobs`.
  - İzin yokken cihaz kesimi kararı (8-10.3, a) alınırsa `aiConsent.declineBody` 2.1.
  - App Store gizlilik beyanında değişiklik yok (veri türü aynı).

### 8-10.6 Uygulama sırası (commit grupları) ve test

Krediyle ilgili testler en sonda.

| # | Grup | Katman | Test |
|---|---|---|---|
| G1 | Migration 021: `image_source` (CHECK, null = eski), `garment_jobs`, `start/complete/fail_garment_job`, `limit_for` anahtarları, `get_usage.packshot`. Geri alma SQL'i dahil | sunucu | Kredi yok. SQL ile test kullanıcısında 3 packshot rezervasyonu → 4.'sü `allowed:false`. `fail` → hak geri gelir. bg_remove `parent` olmadan reddedilir; aynı parent'a ikinci bg_remove reddedilir. Premium'da `reset_at` dolu. try-on `get_usage` çıktısı değişmemeli |
| G2 | `modules/garment-cutout` (Swift + Kotlin + config plugin), `version` 1.1.0, dev build | build | Kredi yok. Gerçek cihazlar: iOS 17+ (kesim), iOS 16.x (`supported:false`, reason `os`), Android (Play services, model indirme anı), ilk açılışta model yokken `model-downloading`. Askılı, yatakta, mankende ve beyaz zeminde 10 fotoğraf; çıktı beyaz zemin JPEG |
| G3 | `garment-image` yalnızca **bg-remove** dalı + `status` | sunucu | Önce kredisiz testler: 1.1 izinle 403 `consent-version-outdated`, izinsiz 403, başkasının `job_id`'si 403, parent'sız bg_remove 400, sahte FASHN anahtarıyla OutOfCredits ya da 401 → `failed_at` dolu. Sonra **1 kredi**: gerçek bg-remove → şeffaf PNG `image_b64` |
| G4 | Yeni yükleme akışı, packshot dalı **bayrakla kapalı**: cihaz kesimi, olduğu gibi + ipucu, Claude orijinal üzerinde, `image_source` yazımı, cache temizliği | 1.1.0 dev build (JS) | Kredi yok. iOS 17 cihazda `device_cutout`, iOS 16 cihazda `original` + ipucu, izin yokken (karara göre) davranış. Kayıttan sonra cache'te dosya kalmamalı, storage'da yalnızca `<uuid>.jpg` + `_thumb` olmalı |
| G5 | FASHN teyidinden sonra: packshot dalı (`garment-image` packshot, yan yana ekran, "Orijinali kullan" → bg-remove → `flattenOnWhite`) | sunucu + JS | Kredili. Ücretsiz: 3 parça packshot, 4.'sü cihaz kesimi. Mayo ya da iç giyim → moderasyon → cihaz kesimi ve hak geri gelir. "Orijinali kullan" → 2 kredi, packshot kotası 1 düşer. Zaman aşımı → kesim |
| G6 | "Stüdyo kalitesine yükselt" | JS (+ G1/G5) | Kredili. Kota yenilenince öneri kartı, seçilen parçalar, onay → yeni dosya ve eski dosyalar silinir, ilgili try-on cache dosyaları silinir. Ret → değişiklik yok, kota düşmüş |
| G7 | Production build 1.1.0 + mağaza; ardından 12. adım (tarama Poof'suz) ve 13. adım (Poof kaldırma, test ve demo hesapları 1.1.0'dayken) | build + sunucu | 1.0.1 cihazında Poof akışı sürmeli; 1.1.0'da `bg` sayacı artmamalı |
| — | Uyum metinleri (8-10.5 listesi) | web + docs | G5 yayınından önce |

**Senin kararın gereken konular:**
1. **FASHN packshot teyidi** (8-10.0). Gelmezse alternatif: stüdyo görseli yerine yalnızca FASHN background-remove (1 kredi) ya da yalnızca cihaz kesimi.
2. **Native modül yöntemi:** yerel modül (önerim) ya da `@rbayuokt` ile bir günlük deneme.
3. **İzin yokken cihaz kesimi:** (a) evet + metin 2.1 (önerim), (b) hayır.
4. **"Orijinali kullan" kaynağı:** bg-remove (kararlar) ya da cihaz kesimi varsa o (0 kredi).
5. **Değerler:** premium aylık packshot varsayılanı (15. adıma kadar) ve günlük `garment` tavanı.

### 8-10.7 Uygulama durumu (07.11.2026)

**Onay ve sonrasında gelen kararlar:**
1. Packshot API'de var: `/run {"model_name":"packshot"}` → 400 `product_image is required`. Bayrak yok, dal açık.
2. Yerel Expo modülü.
3. İzin yokken de cihaz kesimi. Metin 13. adımdaki 2.1'de değişecek; **şu an `aiConsent.declineBody` "arka planı kaldırılmadan kaydedilir" diyor ve bu artık doğru değil**.
4. "Orijinali kullan" = cihaz kesimi; FASHN background-remove hiçbir dalda yok.
5. Premium 40/ay. Yıllık abonenin **ilk 30 günü 150** (sonra 40). Günlük tavan 60.

**Commit'ler:**

| Grup | Commit | Ne |
|---|---|---|
| G1 | `897d6c1` | `021_garment_jobs.sql`: `image_source`, `garment_jobs`, kota fonksiyonları, yıllık kurulum ayı, `limit_for` anahtarları, `get_usage.packshot` |
| G2 | `757b8af` (+ G4'te ek) | `modules/garment-cutout`: Swift (Vision), Kotlin (ML Kit), `flattenOnWhite`, `clearCache` |
| G3 | `9dffca3` | `garment-image` edge function (packshot) |
| G4 | `8ce15ff` | Yeni yükleme akışı (Poof çağrısı kalktı) |
| G6 | `2d06f2e` | "Stüdyo kalitesine yükselt" |
| G5 | — | Ayrı grup gerekmedi: packshot dalı G3 + G4'e girdi, background-remove dalı yok |
| G7 | — | Yayın: production build, sonra 12. ve 13. adım |

**Tasarımdan sapmalar:**
- **Yıllık plan tanıma:** `annual_products(product_id)` tablosu elle doldurulur. Kurulum ayı başlangıcı (`packshot_setup.started_at`), `entitlements`'a yıllık ve geçerli bir ürün ilk kez yazıldığında tetikleyiciyle bir kez kaydedilir.
  - RevenueCat'in `subscriptions[].original_purchase_date` alanı yalnızca örnek JSON'da geçiyor, anlamı tanımlanmamış ([kaynak](https://www.revenuecat.com/docs/api-v1/customer-info-model)). Bu yüzden kullanılmadı.
- **`app.json` `version` yükseltilmedi** (tasarımda G2'deydi). G7'de, production build'den hemen önce **1.1.0** yapılmalı. Gerekçe:
  - Yükseltilseydi `main`'den yapılan her `eas update` yalnızca 1.1.0'a gider. Henüz yayınlanmamış OTA'lar (izin 2.0 dahil) 1.0.1 cihazlarına ulaşmazdı.
  - JS native modülü `requireOptionalNativeModule` ile çağırıyor. Modülsüz 1.0.1 binary'sinde kesim "desteklenmiyor" sayılır, akış packshot ya da "olduğu gibi"ye düşer. Çökme olmaz.
  - Dev build'ler `development` kanalında; production OTA'ları onlara gitmez.
- **Orijinal hiçbir yolda storage'a yazılmıyor.** Packshot girdisi data URI; yükseltmede kayıtlı görselin 10 dk imzalı URL'i.
- **Claude analizi** orijinal üzerinde ve packshot ile paralel başlıyor (`src/lib/pendingAnalysis.ts`).
- **Yükseltmede "Vazgeç"** (üretim sürerken): iş sunucuda tamamlanabilir ve kredi harcanır. İstemci yoklamayı bıraktığı için iş `succeeded_at` almaz, 10 dk sonra kotadan düşer.
- **Try-on'da `garment_photo_type`** packshot parçalar için değiştirilmedi (`'auto'`). Packshot çıktısının biçimi (flat lay mi, ghost mannequin mi) ölçülmeden `'flat-lay'` riskli.

**Yayın sırası:**
1. Migration 021 (SQL Editor).
2. `npx supabase functions deploy garment-image --project-ref bdvrgbylirftuxmrpbea`. Ortak katman değiştiği için `fashn-proxy` da yeniden deploy edilmeli; davranışı değişmedi.
3. Packshot ölçümü (aşağıda).
4. Dev build (native modül).
5. OTA.
- **Uyarı:** 021 uygulanmadan OTA giderse kıyafet kaydı `image_source` kolonu yüzünden hata verir.

**Packshot ölçümü (tek kredili istek):**
- Dev build ya da OTA'lı bir test hesabıyla izin açıkken bir kıyafet ekle. fashn-proxy logunda iki satır olmalı:
  - `[garment-image] packshot run … credits_used=<x-fashn-credits-used>`
  - `[garment-image] packshot completed {shape, output_kind, mime, bytes, response_keys, credits_used}`
- FASHN panelinde kredi satırı kontrol edilir.
- `output_kind = "url"` çıkarsa `return_base64` yok sayılmış demektir. Bu durumda çıktı FASHN CDN'inde 3 gün kalır ve gizlilik metnindeki "en geç 60 dakika" packshot için geçersizleşir. Metin ya da tasarım güncellenmeli.
- **İsteğe bağlı parametreler:** FASHN 400 doğrulama yanıtı kredi harcamıyor (*"Failed predictions do not consume credits"*; 400 zaten iş başlatmıyor). Bilinmeyen bir anahtarla yapılan `/run` isteğinin 400 mesajı izinli alanları listeleyebilir **[doğrulanmadı]**. Kesin liste için FASHN'a sorulmalı. Şu an yalnızca `product_image` ve `return_base64` gönderiliyor.

**Test (kredisiz olanlar önce):**
1. **SQL:** `021` sonundaki kota testi (3 rezervasyon, 4.'sü red, iade, başarılı iş iade edilmez). Yıllık için `annual_products`'a test ürünü ekle, test hesabının `entitlements` satırını güncelle → `packshot_quota` `window = setup`, limit 150.
2. **Dev build (kredisiz):**
   - İzni kapalı hesapla kıyafet ekle. iOS 17+ ve Android'de kesim, iOS 16'da "olduğu gibi" + ipucu. Hiç FASHN isteği olmamalı.
   - Kotası dolu hesapla (SQL ile 3 başarılı iş) → "Stüdyo görseli hakkın doldu" + kesim.
3. **Kredili:**
   - Packshot ile yan yana ekran. "Bu benim kıyafetim" → `image_source = 'packshot'`. "Orijinali kullan" → `device_cutout`.
   - Mayo ya da iç giyim → moderasyon → kesim, `garment_jobs.failed_at` dolu.
   - Yükseltme: menü → onay → yeni `_s.jpg`, eski dosyalar ve o parçanın try-on cache dosyaları silinmiş olmalı.
4. **Storage:** hiçbir akışta `wardrobe-items`'a `<uuid>.jpg` / `_thumb.jpg` (yükseltmede `_s.jpg` / `_s_thumb.jpg`) dışında dosya oluşmamalı.

## Adım 12 + 13 (07.11.2026): "Uyar mı?" Poof'suz, Poof kaldırma, izin metni 2.1

**Commit'ler:**

| Commit | Ne |
|---|---|
| `f990376` | Tarama orijinali Claude'a gönderir; sonuç ekranında "Dolaba ekle" |
| `891e7ba` | `bg-removal-proxy` silindi, izin metni 2.1, yorum temizliği |
| `d482708` | `isUpgradeEligible`: `image_source` null (021 öncesi) parçalar da yükseltilebilir |
| web `draft` `226a6ab` | Poof tüm sayfalardan çıktı, izin 2.1, yürürlük 7 Kasım 2026 |

**Kararlar:**
- **"Dolaba ekle"** (sonuç ekranı, analiz başarılıysa). `guardWardrobeAdd` → Dolap sekmesinde `Upload { preset }`. Seçim adımı atlanır, akışın geri kalanı aynıdır: cihaz kesimi, packshot (kota sunucuda), yan yana onay. Girdi taramada normalize edilmiş JPEG'dir (`toUploadJpeg` çıktısı). Taramanın analizi `pendingAnalysis` ile devredilir, ikinci Claude çağrısı yapılmaz.
- **İzin 2.1 (alt sürüm):** yeniden onay istenmez. Sunucuda `MIN_CONSENT_MAJOR.ai_processing` 2 olarak kaldı.
- **`notice_shown` 2.1:** sanal deneme bilgilendirmesindeki "Anthropic'e ya da Poof'a gönderilmez" cümlesinden Poof çıkarıldı. Alt sürüm, "Okudum" yeniden istenmez. Rapor dışı küçük ek; `grep -i poof` temiz kalsın diye yapıldı.
- **Bilerek bırakılanlar:**
  - Uygulanmış migration yorumları (`014_privacy_consent.sql:7`, `021_garment_jobs.sql:7`).
  - Tarihsel kayıtlar: `guvenlik-tedbirleri.md` git geçmişi taraması ve remove.bg satırı, `data-inventory.md` "Geçmiş sağlayıcılar".
  - Sürüm notları (`acik-riza` / `consent`).
  - `kosullar` / `terms`: Poof adı geçmiyor. "Yapay zekâ izni verirsen arka planın kaldırılması" ifadesi artık eksik (izinsiz de cihazda kaldırılıyor) ama yanlış değil. Koşul değişikliği gerektirdiği için dokunulmadı.
- **Açık:** `garment_jobs` için envanter satırı ve saklama politikası girişi (8-10.5) hâlâ yazılmadı. Envanter #6 bu nota bağlantı veriyor.

**Yayın sırası** (sunucu değişikliği yalnızca silme):
1. **OTA:** `main`’de sürüm artık 1.1.0 (`1514327`), yani `eas update` yalnızca 1.1.0 build’ine gider. 1.0.1 cihazları Poof’lu son bundle’da kalır. Yeni bundle tarama için Poof’u çağırmaz; metin 2.1.
2. **Web:** `sestina-web` `draft` → `main` (OTA ile aynı gün).
3. **Poof'u kapatma:** test hesapları ve demo hesabı yeni bundle'dayken, mağazadaki sürüm Poof'lu değilken (8-10.2):
   - `npx supabase functions delete bg-removal-proxy --project-ref bdvrgbylirftuxmrpbea`
   - `npx supabase secrets unset POOF_API_KEY --project-ref bdvrgbylirftuxmrpbea`
   - Poof panelinde anahtarı iptal et, hesabı kapat. Tarihi `guvenlik-tedbirleri.md` bölüm 6'daki `POOF_API_KEY` satırına yaz.
   - `_shared/consent.ts` yalnızca yorumda değişti; başka fonksiyonun yeniden deploy'u gerekmez.

**Test:**
1. **Tarama:** kamera ve galeriyle bir ürün tara.
   - Sonuç ekranında arka planlı orijinal görünmeli.
   - `api_usage`'da `bg` artmamalı, `anthropic` 1 artmalı. Storage'a dosya yazılmamalı.
   - Function loglarında `bg-removal-proxy` çağrısı olmamalı.
2. **Dolaba ekle:** sonuç ekranından ekle.
   - Seçim ekranı atlanmalı, packshot hakkı varsa yan yana ekran çıkmalı. Kotası dolu hesapta "hak doldu" notu ve kesim görünmeli.
   - UploadDetail'de alanlar taramanın analiziyle dolu gelmeli; ikinci `anthropic` sayacı artmamalı.
   - Dolap 50/50 hesapta paywall açılmalı.
3. **İzin 2.1:** 2.0 onaylı hesapta izin ekranı yeniden açılmamalı. Yeni karar verilirse `consent_events`'e `2.1` yazılmalı.
   - İzin ekranında Poof satırı olmamalı. "İzin vermezsen" bölümü cihaz üstü kesimi anlatmalı.
4. **Yükseltme:** `image_source` null olan bir parçanın menüsünde "Stüdyo kalitesine yükselt" görünmeli; öneri kartı bu parçayı saymalı.
5. **grep:** `grep -rni "poof\|bg-removal" ne-giysem/src ne-giysem/supabase/functions` yalnızca sürüm geçmişi yorumlarını (`constants/consent.ts:15`, `:18`, `_shared/consent.ts:18`) vermeli; çağrı, URL, secret ya da çeviri kalmamalı. Repoda geri kalan sonuçlar tarihsel kayıt ve migration yorumudur.

## Adım 15 tasarım (07.11.2026) — onay bekliyor

Bu bölüm yalnızca tasarım; kod yazılmadı. 15 ve 15a'nın d tablosundaki eski tanımının (ücretsiz plan: packshot 3, deneme 1 ayakkabısız, tarama 3/ay) **yerine geçer**. Ayakkabı zorlaması (`start_tryon` → plan, `fashn-proxy` tryon-max 403) artık gerekmiyor: deneme ve premium'da try-on ayakkabılı.

**Kararlar (07.11.2026, kullanıcı):**
- **Hard paywall, ücretsiz plan yok.** Onboarding (stil testi) bitince paywall açılır. Abonelik ya da deneme olmadan ana ekranlara girilmez. Paywall'da "Satın alımları geri yükle", Kullanım Koşulları ve Gizlilik bağlantıları bulunur.
- **Ürünler:**
  - Yıllık plan 7 gün ücretsiz denemeli; deneme mağazada tanımlanır (kullanıcı yapar). Aylık plan denemesiz.
  - Yıllık plan varsayılan seçili ve üstte; "%X tasarruf" rozeti ve aylık karşılığıyla gösterilir.
  - Fiyatlar ve oran RevenueCat'in mağaza fiyatlarından hesaplanır; kodda fiyat yok.
- **Limitler** (`app_limits`, sunucuda zorunlu):

| | Deneme (7 gün, toplam) | Premium |
|---|---|---|
| Packshot | 15 | Ayda 40; yıllık planda ilk 30 gün 150; günde en fazla 60 |
| Try-on (ayakkabılı) | 2 | Ayda 5 |
| "Uyar mı?" | 5 | Ayda 40 |
| Dolap | Sınırsız | Sınırsız |

- "Uyar mı?" hakkı sunucuda düşer (bugün istemci `start_scan` çağırıyor).
- 15a: kalan hak göstergesi, deneme ve premium için.

### 15.1 Deneme durumunun tespiti

**Bugün:**
- Webhook olay içeriğine güvenmez: her olayda REST v1 `GET /subscribers/{id}` çağrılır (`_shared/revenuecat.ts:62`).
- `entitlements.period_type` zaten yazılıyor (`:109`, `:137`). Değer, abonelik kaydının `period_type` alanıdır.
- REST v1'de değerler küçük harf: `normal` / `trial` / `intro`. Webhook olayındaki `TRIAL` büyük harf, ama okunmuyor. **[doğrulanmadı: sandbox'ta görülmeli]**
- Deneme süresince entitlement aktiftir; `expires_at` = deneme bitişi. Yani `is_premium_user` deneme kullanıcısı için de bugün `true` döner.

**Eksik:** deneme penceresinin başlangıcı ve deneme → ücretli geçişin zamanı.
- `entitlements` satırı entitlement kaybolunca silinir (`:125-128`).
- Yenilemelerde başlangıç tarihi değişir.
- Bu yüzden ayrı ve kalıcı bir kayıt gerekiyor.

**Öneri (migration 022):**
- `entitlements.period_started_at timestamptz`: abonelik kaydının `purchase_date` alanı ("son satın alma ya da yenileme"). Denemede bu, deneme başlangıcıdır. **[doğrulanmadı: sandbox'ta `purchase_date` = deneme başlangıcı mı]**
  - `RcSubscription`'a `purchase_date` eklenir, `syncEntitlement` yazar.
- Yeni tablo **`trials`**:
  - Kolonlar: `user_id` → auth.users cascade, `started_at`, `ends_at`, `product_id`, `store`, `converted_at null`. PK `(user_id, started_at)`.
  - Yalnızca service_role erişir.
- Tetikleyici `entitlements` AFTER INSERT/UPDATE:
  - `new.period_type = 'trial'` → `trials` upsert (`started_at = new.period_started_at`, `ends_at = new.expires_at`).
  - `old.period_type = 'trial'` ve `new.period_type = 'normal'` → son denemede `converted_at = new.period_started_at` (ilk ücretli dönemin başı).
  - Entitlement silinir ya da süre dolarsa ayrı bir yazma olmaz. "Bitti" bilgisi `ends_at < now()` ve `converted_at is null` ile okunur.
- **`packshot_setup_on_entitlement` değişir:** `coalesce(new.period_type, '') <> 'trial'` şartı eklenir.
  - Yoksa yıllık deneme kullanıcısının 30 günlük "kurulum ayı" deneme başında başlar ve deneme bitince 23 günü kalır.
  - Böylece kurulum ayı ilk ücretli günde başlar.
- **Yardımcılar:**
  - `has_access(p_user)` = bugünkü `is_premium_user` (deneme dahil). Ad netleşsin diye yeni ad; eskisi uyumluluk için kalır.
  - `trial_window(p_user)`: aktif denemede `(started_at, ends_at)`, değilse null. Koşul: `period_type = 'trial' and expires_at > now()`.

**Senaryolar:**

| Olay | entitlements | trials | Kullanıcı |
|---|---|---|---|
| Deneme başlar | `period_type = trial`, `expires_at` = +7 gün | yeni satır | Deneme limitleri |
| Deneme içinde iptal | `will_renew = false`, `expires_at` aynı | değişmez | Deneme sonuna kadar deneme limitleri; sonra paywall |
| Deneme → ücretli | `period_type = normal`, yeni `expires_at` | `converted_at` dolar | Premium limitleri; sayaçlar 15.5'e göre |
| Ödeme sorunu (grace) | `effectiveExpiry` grace bitişini alır (`:81`) | — | Grace boyunca erişim |
| İade / iptal (revoke) | entitlement yok → satır silinir | kalır | Paywall |
| Ücretli dönem biter | `expires_at < now()` | — | Paywall |

### 15.2 Mevcut ücretsiz plan kodu: ne kapanır, ne kalır

**Sunucu:**

| Parça | Karar |
|---|---|
| `limit_for` anahtarları `free.wardrobe_max`, `free.tryon_lifetime`, `free.scan_monthly`, `free.packshot_lifetime` | **Kalkar**: CASE'ten ve `app_limits`'ten silinir. Kalırsa yanlışlıkla kullanılabilir; `limit_for_unknown` hatası korur |
| Yeni anahtarlar | `trial.packshot_total` 15, `trial.tryon_total` 2, `trial.scan_total` 5, `premium.tryon_monthly` 5 (8'den), `premium.scan_monthly` 40 (yeni; bugün sınırsız) |
| Kalan anahtarlar | `premium.packshot_monthly` 40, `premium.packshot_annual_setup` 150, `premium.packshot_setup_days` 30, `abuse.garment_daily` 60. Hepsi `app_limits`'e satır olarak girer (bugün yalnızca CASE varsayılanı) |
| `enforce_wardrobe_limit` | Erişim yoksa `raise 'subscription-required'`. Erişim varsa sınır yok. 50 sınırı kalkar |
| `enforce_planning_premium` | `has_access` (deneme dahil planlama açık). Mesaj aynı: `planning-premium` |
| `tryon_used(p_user, null)` (ömür boyu) | Fonksiyon kalır; `p_since` hep dolu çağrılır. Ömür boyu dal kullanılmaz |
| `start_tryon` | Erişim yok → `{allowed:false, error:'subscription-required'}`. Deneme → `trial.tryon_total`, `since = trial.started_at`, `reset_at = null`, `window:'trial'`. Premium → 15.5 |
| `packshot_quota` | `'free'` penceresi kalkar → `'trial'` (15, `since = started_at`) ve `'none'` (limit 0). `'setup'` / `'monthly'` aynı, `since` 15.5'e göre |
| `start_scan` (istemci RPC) | **Kalkar**; yerine sunucuda `scan_jobs` (15.2a). `authenticated` yetkisi OTA'dan sonra geri alınır. Eski bundle hata alırsa `spendScan` engellemiyor (`premiumGate.ts:44-47`) |
| `get_usage` | Yeni biçim, bkz. 15.5 |
| Edge function'lar | `anthropic-proxy`, `garment-image`, `fashn-proxy` (start), `fetch-product`: `has_access` yoksa **403 `subscription-required`**. Kontrol rezervasyondan önce yapılır; kredi ya da iade gerekmez. Onboarding'deki Stil DNA adı çağrısı zaten izin yokluğundan 403 alıp yerel ada düşüyor (`StyleResultScreen.tsx:103`), değişiklik yok |

**15.2a "Uyar mı?" sunucuda:**
- Yeni tablo `scan_jobs`: `id`, `user_id` cascade, `created_at`, `succeeded_at`, `failed_at`. `garment_jobs` deseni, service_role.
  - `api_usage` kullanılmaz: iade için iş satırı gerekiyor.
- `anthropic-proxy`'ye `purpose: 'scan'`:
  1. `start_scan_job(p_user)` kota kontrolü yapar ve iş açar. Dolu → **402 `scan-limit`** + `{used, limit, reset_at, window}`.
  2. Claude çağrısı.
  3. Yanıtta geçerli JSON ve `category` alanı varsa `complete_scan_job`; yoksa ya da üst servis hatasında `fail_scan_job` (iade).
  - Böylece "tanıyamadık → hak düşmez" kuralı (`StoreResultScreen.tsx:178`) sunucuda uygulanır.
  - Açık iş 10 dk kotadan düşer (garment deseni).
- İstemci: `StoreResult` analizi `purpose:'scan'` ile ister; `spendScan` kalkar.
- **Kabul edilen risk:** değiştirilmiş istemci taramayı `purpose` olmadan, kıyafet analizi olarak isteyebilir. Kıyafet analizinin kendi kotası yok.
  - Sınırlar: abonelik şartı + `anthropic` günlük 150 tavanı.
  - Kapatmak için kıyafet analizini packshot işine bağlamak gerekir. İzinsiz ya da kotası dolu kullanıcıda packshot işi olmadığından bu önerilmez.

**İstemci (kalkar / değişir):**

| Yer | Ne olur |
|---|---|
| `RootNavigator.tsx:39` | `isOnboarded` sonrası yeni dal: erişim yoksa yalnızca **hard paywall** (kapatılamaz) |
| `premiumGate.ts:14` `guardWardrobeAdd`, `:60` `wardrobeCountLabel`, `:69` `wardrobeLimitMessage`; `WardrobeScreen.tsx:124-130, 476`; `HomeScreen.tsx:285`; `StoreResultScreen.tsx:229`; `UploadDetailScreen.tsx:319` (`wardrobe-limit`) | Kalkar. `subscription-required` gelirse gate'e düşülür |
| `premiumGate.ts:25` `guardScan`, `:41` `spendScan`; `ScanScreen.tsx:58, 127, 182`; `StoreResultScreen.tsx:182` | Ön kontrol `get_usage.scan`'den gösterge + "hak bitti" mesajı olur (paywall değil); harcama sunucuda |
| `PaywallScreen.tsx` | Ücretsiz/Premium tablosu (`:180-193`, `COMPARE_ROWS`) → özellik listesi. `reason` metinleri (`:105-118`) → yalnızca gate. Kapat (`:158`) gate'te gizli. Deneme satırı ve CTA (15.6). Fiyat matematiği aynen (`annualMath` `:48`) |
| `CombosScreen.tsx:518, 916, 938, 1219` | Planlama kilidi `plan !== 'premium'` → erişim yoksa zaten gate. Try-on hak bitince paywall değil, mesaj (deneme / yenilenme tarihi) |
| `ProfileScreen.tsx:115-353` | "Ücretsiz" rozeti kalkar; "Deneme · {tarih} bitiyor" ya da "Premium · {tarih} yenilenir" |
| `usePlanStore.ts:10` | `Plan = 'trial' \| 'premium' \| 'none'`; `premiumExpired` → `accessExpired` |
| `virtualModel.ts:86-97` | `plan: 'free'` dalı → `'trial'` |
| `navigation/types.ts` `PaywallReason` | `'wardrobe' \| 'scan' \| 'planning' \| 'tryon'` kalkar; `'gate' \| 'generic'` kalır |
| i18n `premium.*` | `compareFree`, `row*Free`, `badgeFree`, `planFree`, `wardrobeCount`, `wardrobeLimitBody`, `reasonScan*`, `reasonTryon`, `scanRemaining` → yeni anahtarlar (15.6) |

**Gate ayrıntıları:**
- **Erişim kararı:** `get_usage.plan in ('trial','premium')`. Sunucu senkronu gecikirse RevenueCat SDK'nın `customerInfo.entitlements.active` değeri de kabul edilir (satın alma sonrası saniyeler). Asıl sınırı sunucu uygular.
- **Çevrimdışı:**
  - Son bilinen erişim ve `expires_at` AsyncStorage'da tutulur. `expires_at` gelecekteyse ana ekranlar açılır.
  - Hiç okunamadıysa gate "Tekrar dene" ile açılır.
  - Ödeme yapmış kullanıcı ağ hatası yüzünden kilitlenmemeli.
- **Gate'te hesap işlemleri — öneri, karar gerekiyor:**
  - Apple 5.1.1(v): hesap silme uygulama içinde bulunabilir olmalı. Hard paywall Profil'i kapatıyor.
  - Gate'e "Hesap" bağlantısı: Çıkış yap · Verilerimi indir · Hesabımı sil (mevcut `privacyActions` / `delete-account`). Abone olmayan kullanıcı verisine ulaşamazsa KVKK m. 11 erişim hakkı da sorun olur.

### 15.3 Aboneliği biten ya da denemeyi iptal eden kullanıcı

- **Uygulamayı açınca:** gate (paywall).
  - Metin: "Aboneliğin sona erdi. Dolabın ve kombinlerin duruyor; devam etmek için abone ol."
  - Deneme bitmişse: "Deneme süren bitti."
  - Ayrım: `access_expires_at` geçmişte ve `trials`'ta `converted_at is null`.
- **Veri:**
  - Silinmez: dolap, fotoğraflar, kombinler, takvim, rızalar.
  - Sunucu yeni ekleme / AI çağrısı kabul etmez. Var olanı silme ve düzenleme serbest (trigger'lar yalnızca INSERT'te; mevcut kural `013:18-19`).
  - Yeniden abone olunca her şey kaldığı yerden sürer.
- **Saklama politikasında hareketsiz hesap süresi YOK.** `saklama-imha-politikasi.md` bölüm 2: "Hesap, stil, dolap … Hesap süresince". Silme yalnızca kullanıcı isteğiyle.
  - Hard paywall'la birlikte hiç abone olmamış ya da aboneliği bitmiş hesapların fotoğrafları süresiz kalır. KVKK m. 4/2-ç ("amaç için gerekli süre") açısından zayıf.
  - **Öneri — karar ve hukuki görüş gerekiyor:**
    - (a) Erişimi olmayan ve 24 ay giriş yapmayan hesap: 30 gün önce e-posta, sonra `delete-account` ile aynı silme. Hiç abone olmamış hesap için 12 ay.
    - `purge_retention` ya da ayrı bir cron işi; `deletion_log` kanalı `inactive`.
    - Saklama politikası, gizlilik (bölüm 9) ve koşullar buna göre yazılır.
    - (b) Süresiz tutmak ve bunu politikaya açıkça yazmak.

### 15.4 Mevcut hesaplar

Gerçek kullanıcı yok (Karar 3); etkilenen yalnızca test hesapları. Uygulamadan önce SQL Editor'de:

```sql
-- Özet: kaç hesap paywall'a takılır
select count(*)                                                        as toplam,
       count(*) filter (where e.expires_at > now())                    as erisimi_var,
       count(*) filter (where e.user_id is null or e.expires_at <= now()) as paywall
  from auth.users u
  left join public.entitlements e on e.user_id = u.id;

-- Liste: paywall'a takılacaklar
select u.email, u.created_at, e.store, e.product_id, e.period_type, e.expires_at,
       (select count(*) from public.wardrobe_items w where w.user_id = u.id) as parca
  from auth.users u
  left join public.entitlements e on e.user_id = u.id
 where e.user_id is null or e.expires_at <= now()
 order by u.created_at;

-- Demo hesabı: ömür boyu promosyonel → expires_at = 'infinity', store = 'promotional'
select e.* from public.entitlements e
  join auth.users u on u.id = e.user_id
 where u.email = 'demo@sestinaapp.com';
```

- **Demo hesabı:**
  - `expires_at = 'infinity'` olduğu için `has_access` true döner.
  - Promosyonel kayıtta `subscriptions` girdisi yok, dolayısıyla `period_type` null: deneme sayılmaz, premium limitleri uygulanır. `packshot_setup`'a girmez (ürün `annual_products`'ta değil).
  - Etkilenmez. Yalnızca try-on 8 → 5/ay ve tarama sınırsız → 40/ay değişir.
- **App Review notu:** inceleme ekibi demo hesabıyla girerse paywall'u görmez.
  - İnceleme notuna "Yeni hesap açarak onboarding → paywall → sandbox satın alma akışı görülebilir; demo hesabı premium" yazılmalı.
- **Test hesapları:** sandbox'ta deneme ya da RevenueCat panelinden promosyonel entitlement.

### 15.5 Limitler ve sayım pencereleri

| Hak | Deneme penceresi | Premium penceresi | Kaynak tablo |
|---|---|---|---|
| Packshot | `trials.started_at` → deneme sonu, toplam 15 | Yıllık: kurulum ayı (`packshot_setup.started_at` + 30 gün, ilk ücretli günden) 150; sonra İstanbul ayı 40. Aylık: İstanbul ayı 40. Günlük 60 (`abuse.garment_daily`) | `garment_jobs` |
| Try-on | aynı pencere, 2 | İstanbul ayı 5 | `tryon_renders` |
| "Uyar mı?" | aynı pencere, 5 | İstanbul ayı 40 | `scan_jobs` |

- **Denemeden premium'a geçiş:** deneme sayaçları sıfırlanır. Ücretli dönemde deneme harcamaları sayılmaz.
  - Kural: premium `since = greatest(istanbul_month_start(), coalesce(son_deneme.converted_at, son_deneme.ends_at, '-infinity'))`.
  - Örnek: 3 Kasım'da başlayan deneme 10 Kasım'da ücretliye döner. Kasım'ın try-on sayımı 10 Kasım'dan başlar: 5 hak; denemedeki 2 sayılmaz. Aralık 1'de normal ay.
  - Packshot yıllık: kurulum ayı zaten dönüşümde başlıyor (15.1 tetikleyici değişikliği), deneme işleri sayılmaz.
- **Deneme iptal edilip sonra aylık alınırsa:** `converted_at` dolmaz; aynı ifadedeki `ends_at` devreye girer, deneme harcamaları ilk ayda sayılmaz.
- **Açık rezervasyonlar** kullanılmış sayılır: try-on 30 dk, packshot 10 dk, tarama 10 dk. `get_usage` aynı `*_used` fonksiyonlarını çağırdığı için gösterge ile red tutarlı.

**`get_usage` yeni biçimi:**
```
{
  plan: 'trial' | 'premium' | 'none',
  access_expires_at, will_renew,
  trial: { started_at, ends_at } | null,     -- aktif deneme
  trial_used: boolean,                        -- daha önce deneme var mı (metin seçimi)
  wardrobe: { used, limit: null },
  tryon:    { used, limit, reset_at, window: 'trial' | 'monthly' | 'none' },
  scan:     { used, limit, reset_at, window: 'trial' | 'monthly' | 'none' },
  packshot: { used, limit, reset_at, window: 'trial' | 'setup' | 'monthly' | 'none' }
}
```
- `reset_at`: deneme → null (deneme bitince ücretli pencere başlar, gösterge `trial.ends_at`'i kullanır). Premium → sonraki ay başı ya da kurulum bitişi.
- `premium_expires_at` → `access_expires_at` olarak yeniden adlandırılır. Eski bundle geçiş günü hata vermesin diye bir sürüm boyunca ikisi birden döner.

### 15.6 Metinler

**Paywall (gate)**

| Anahtar | TR | EN |
|---|---|---|
| `paywall.eyebrow` | Sestina Premium | Sestina Premium |
| `paywall.title` | Dolabın hazır. Şimdi kombinlere geçelim. | Your wardrobe is ready. Let's get to the outfits. |
| `paywall.titleExpired` | Aboneliğin sona erdi | Your subscription has ended |
| `paywall.titleTrialEnded` | Ücretsiz deneme süren bitti | Your free trial has ended |
| `paywall.bodyExpired` | Dolabın ve kombinlerin duruyor. Devam etmek için abone ol. | Your wardrobe and outfits are still here. Subscribe to continue. |
| `paywall.feature1` | Sınırsız dijital dolap | Unlimited digital wardrobe |
| `paywall.feature2` | Her parça için stüdyo görseli | A studio image for every piece |
| `paywall.feature3` | Tarzına göre kombin önerileri ve planlama | Outfit ideas for your style, plus planning |
| `paywall.feature4` | Sanal deneme | Virtual try-on |
| `paywall.feature5` | "Uyar mı?" ile alışverişte dolap uyumu | "Will it work?" checks your wardrobe while you shop |
| `paywall.annual` | Yıllık | Yearly |
| `paywall.monthly` | Aylık | Monthly |
| `paywall.saveBadge` | %{percent} tasarruf | Save {percent}% |
| `paywall.perMonth` | aylık {price} | {price}/month |
| `paywall.trialBadge` | {days} gün ücretsiz | {days}-day free trial |
| `paywall.ctaTrial` | {days} gün ücretsiz dene | Start {days}-day free trial |
| `paywall.cta` | Abone ol | Subscribe |
| `paywall.restore` | Satın alımları geri yükle | Restore purchases |
| `paywall.account` | Hesap | Account |
| `paywall.terms` / `paywall.privacy` | Kullanım Koşulları / Gizlilik Politikası | Terms of Use / Privacy Policy |

- Gate'te limit sayısı gösterilmez (öneri; karar 3). Sayılar koşullarda ve 15a göstergesinde var. Gösterilecekse değerler yeni bir `get_limits()` RPC'sinden (`authenticated`, yalnızca okuma) gelir; kodda sayı yazılmaz.
- **Deneme koşulları (CTA altı; yıllık + deneme uygunsa):**
  - **TR iOS:** "{days} gün ücretsiz, ardından {price}/yıl. Deneme bitmeden en az 24 saat önce iptal etmezsen abonelik otomatik başlar ve her yıl yenilenir. App Store hesap ayarlarından istediğin zaman iptal edebilirsin; deneme içinde iptal edersen ücret alınmaz."
  - **TR Android:** "{days} gün ücretsiz, ardından {price}/yıl. Deneme bitmeden iptal etmezsen abonelik otomatik başlar ve her yıl yenilenir. Google Play → Abonelikler'den istediğin zaman iptal edebilirsin; deneme içinde iptal edersen ücret alınmaz."
  - **EN iOS:** "{days} days free, then {price}/year. Unless you cancel at least 24 hours before the trial ends, your subscription starts automatically and renews every year. You can cancel anytime in your App Store account settings; you won't be charged if you cancel during the trial."
  - **EN Android:** "{days} days free, then {price}/year. Unless you cancel before the trial ends, your subscription starts automatically and renews every year. You can cancel anytime in Google Play → Subscriptions; you won't be charged if you cancel during the trial."
  - Deneme yoksa (aylık ya da uygun değil): mevcut `premium.autoRenewIos` / `premium.autoRenewAndroid`.
- **Deneme bilgisi kaynağı:** `{days}` ve `{price}` mağazadan gelir:
  - `product.introPrice` (fiyat 0, `periodNumberOfUnits` + `periodUnit`) ve `product.priceString`.
  - Uygunluk iOS'ta `checkTrialOrIntroductoryPriceEligibility`. Android'de teklif uygunsa `defaultOption`'da ücretsiz faz görünür. **[doğrulanmadı: react-native-purchases'ın Android'de `introPrice`'ı doldurup doldurmadığı]**
  - Deneme bilgisi okunamazsa deneme metni hiç gösterilmez; yanlış vaat yerine yalnızca fiyat.

**15a göstergeleri**

| Durum | TR | EN |
|---|---|---|
| Try-on, deneme | Ücretsiz deneme süresince {left} / {limit} sanal deneme hakkın var | {left} of {limit} virtual try-ons left in your trial |
| Try-on, premium | Bu ay {left} / {limit} sanal deneme hakkın kaldı | {left} of {limit} virtual try-ons left this month |
| Tarama, deneme | Ücretsiz deneme süresince {left} / {limit} tarama hakkın var | {left} of {limit} checks left in your trial |
| Tarama, premium | Bu ay {left} / {limit} tarama hakkın kaldı | {left} of {limit} checks left this month |
| Packshot, deneme / ay | {left} / {limit} stüdyo görseli hakkın var | {left} of {limit} studio images left |
| Packshot, kurulum ayı | İlk 30 gün: {left} / {limit} stüdyo görseli | First 30 days: {left} of {limit} studio images |
| Hak bitti, premium | Hakların {date} tarihinde yenilenir | Renews on {date} |
| Hak bitti, deneme | Deneme hakların bitti. Aboneliğin {date} tarihinde başlayınca her ay yeni hakların olacak. | You've used your trial allowance. New allowances arrive every month once your subscription starts on {date}. |
| Hak bitti, deneme iptal edilmiş (`will_renew = false`) | Deneme hakların bitti. Ücretsiz deneme süren {date} tarihinde sona eriyor. | You've used your trial allowance. Your trial ends on {date}. |

- **Yerler:** try-on butonu yanı (`CombosScreen`), Tara başlığı (`ScanScreen.tsx:180` yerine), Ekle ekranı ipucu (packshot), Profil kartı (hepsi).
- **Sayı kaynağı:** `get_usage`. Deneme başlayınca ya da iade sonrası `refresh()` (mevcut).
- "Sanal deneme" (try-on) ile "ücretsiz deneme" (trial) Türkçede karışıyor. Metinlerde trial için hep "ücretsiz deneme (süresi)", try-on için "sanal deneme" kullanıldı.

**store-listing.md "ÜCRETSİZ VE PREMİUM" paragrafının yerine**
- **TR:**
  > SESTINA PREMIUM
  > Yıllık planla 7 gün ücretsiz dene. Premium'da dolabın sınırsız; her ay stüdyo görselleri, sanal denemeler ve "Uyar mı?" hakların yenilenir, kombinlerini önceden planlarsın. Ücretsiz deneme süresince de tüm özellikleri kullanabilirsin.
  >
  > Sestina Premium aylık ve yıllık otomatik yenilenen abonelik olarak sunulur. Yıllık planın 7 günlük ücretsiz denemesi bitmeden iptal etmezsen abonelik otomatik başlar. Ödeme, satın alma onaylandığında (ücretsiz denemede deneme bitince) hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse otomatik olarak yenilenir. Aboneliğini mağaza hesap ayarlarından yönetebilir ve iptal edebilirsin.
- **EN:**
  > SESTINA PREMIUM
  > Try it free for 7 days with the yearly plan. Premium gives you an unlimited wardrobe, monthly studio images, virtual try-ons and "Will it work?" checks, plus outfit planning. You can use every feature during the free trial too.
  >
  > Sestina Premium is offered as monthly and yearly auto-renewing subscriptions. The yearly plan includes a 7-day free trial; unless you cancel before it ends, your subscription starts automatically. Payment is charged to your account when you confirm the purchase (for the free trial, when the trial ends). Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your store account settings.
- Sayılar mağaza metnine yazılmadı (limit değişince mağaza güncellemesi gerekmesin). İstenirse eklenir.

**Web'de ücretsiz plandan bahseden yerler (değiştirilmedi, liste):**
- `kosullar.html:25` (içindekiler "Ücretsiz plan ve Premium"), `:62` (bölüm 4 başlığı), `:66-72` (Ücretsiz / Premium tablosu: dolap 50, sanal deneme 3 / ay 8, "Uyar mı?" ay 3 / sınırsız, takvim), `:76` (aylık haklar takvim ayı), `:79` (premium bitince limit üstü parçalar; "ücretsiz plan sınırları")
- `kosullar.html:82-92` (bölüm 5 abonelik): ücretsiz plan geçmiyor ama **ücretsiz deneme maddesi eksik**; eklenmeli
- `terms.html` aynı satırlar (`:25`, `:62`, `:66-72`, `:76`, `:79`, `:82-92`)
- `gizlilik.html:109-111` / `privacy.html` aynı satır: "Abonelik … Premium alırsan" → herkes için (dönem türü, deneme başlangıcı dahil)
- `gizlilik.html:115` (operasyonel kayıtlar): `trials`, `scan_jobs`, `garment_jobs` eklenecek
- `gizlilik.html:294-295` (bölüm 8 abonelik): deneme kaydı (`trials`) eklenecek
- 15.3 kararına göre `gizlilik.html` bölüm 9 (saklama) ve koşullar
- "Free plan" geçen diğer yerler (`gizlilik:322`, `aydinlatma:215`) Supabase'in planı, ilgisiz
- Ayrıca `CLAUDE.md` "Monetizasyon" tablosu (ücretsiz sütunu) ve `013_premium_entitlements.sql:11-16` başlık yorumu

### 15.7 `garment_jobs` (ve yeni tablolar) için envanter ve saklama taslağı

**data-inventory.md — yeni satırlar (#31–#33):**

| # | Faaliyet | Veri | Amaç | Hukuki sebep | Toplama | Alıcı / konum | Saklama | Silme | İzin | Kod |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | Stüdyo görseli kota kaydı | Kullanıcı kimliği, iş zamanı, FASHN işlem kimliği, ilgili parça kimliği (yükseltmede), başarı / hata zamanı. Görsel yok | Packshot kotası, sahiplik kontrolü, kötüye kullanımın önlenmesi | m. 5/2-c (plan hakkı), m. 5/2-f | Otomatik, packshot isteğinde | Supabase · veri işleyen | Karar 4'e göre: 13 ay ya da hesap süresince. Parça silinince satır kalır (`item_id` null), hak geri gelmez. Hesap silinince cascade | Otomatik / hesap silme | — | `garment_jobs` (021), `functions/garment-image` |
| 32 | "Uyar mı?" kota kaydı | Kullanıcı kimliği, tarama zamanı, başarı / hata zamanı. Fotoğraf yok | Tarama hakkı, iade | m. 5/2-c, m. 5/2-f | Otomatik | Supabase · veri işleyen | 13 ay (aylık / deneme penceresi için yeterli) | Otomatik (`purge_retention`) / hesap silme | — | `scan_jobs` (022), `functions/anthropic-proxy` |
| 33 | Ücretsiz deneme kaydı | Deneme başlangıç / bitiş, ürün, mağaza, ücretliye geçiş zamanı | Deneme haklarının penceresi; ücretli dönem sayımının başlangıcı | m. 5/2-c | RevenueCat senkronu | Supabase · veri işleyen | Hesap süresince (deneme bitse de: ilk ücretli ayın sayımını etkiliyor). Hesap silinince cascade | Hesap silme | — | `trials` (022), `_shared/revenuecat.ts` |

- Bugün `garment_jobs` "hesap süresince" duruyor; gerekçesi ücretsiz plandaki ömür boyu "ilk 3" sayımıydı (021 başlığı). Ücretsiz plan kalkınca bu gerekçe kalmıyor, en uzun pencere 30 günlük kurulum ayı. Öneri: 13 ay (`api_usage` ile aynı); aynı karar `tryon_renders` (#15) için de verilebilir.
- #18 (abonelik) satırına `period_started_at` eklenir.

**saklama-imha-politikasi.md bölüm 2 — taslak:**

| Veri (envanter #) | Süre | İmha yöntemi | Nasıl tetiklenir |
|---|---|---|---|
| Stüdyo görseli kota kaydı (#31) | 13 ay (karar 4) | Silme | Otomatik, günlük (`purge_retention`) + hesap silme (cascade) |
| "Uyar mı?" kota kaydı (#32) | 13 ay | Silme | Otomatik, günlük (`purge_retention`) + hesap silme |
| Ücretsiz deneme kaydı (#33) | Hesap süresince | Silme | Hesap silme (cascade) |

Ayrıca 15.3 kararına göre "Hareketsiz hesap" satırı.

### 15.8 Uygulama sırası

Gerçek kullanıcı yok (Karar 3). Sunucu ve OTA aynı gün yayınlanır; test hesapları yeni OTA'yı almadan H3 yapılmaz. Kredili testler en sonda.

| # | Grup | Katman | Test (kredisiz önce) |
|---|---|---|---|
| H1 | Migration 022: `entitlements.period_started_at`, `trials` + tetikleyici, `packshot_setup` deneme şartı, `has_access` / `trial_window`, `app_limits` (yeni anahtarlar, `free.*` silinir), `start_tryon` / `packshot_quota` / `get_usage` yeni pencereler, `scan_jobs` + `start/complete/fail_scan_job`, `enforce_wardrobe_limit` → `subscription-required`, `purge_retention`'a yeni tablolar (karar 4). Geri alma SQL'i dosyada | sunucu | **Kredisiz, SQL:** test kullanıcısına elle `entitlements` satırı (deneme: `period_type='trial'`, `period_started_at = now()-1 day`, `expires_at = now()+6 days`) → `get_usage` deneme pencereleri; 15 `garment_jobs` / 2 `tryon_renders` / 5 `scan_jobs` ekle → 16./3./6. red; `period_type='normal'` yap → `converted_at` dolu, sayaçlar sıfır, yıllıkta `packshot_setup` şimdi; süresi geçmiş → `plan:'none'`, `wardrobe_items` INSERT `subscription-required`; demo hesabı premium kalmalı |
| H2 | `_shared/revenuecat.ts`: `purchase_date` → `period_started_at`. Deploy `revenuecat-webhook --no-verify-jwt`, `sync-entitlement` | sunucu | **Kredisiz, sandbox:** yıllık deneme satın al → `entitlements.period_type = 'trial'`, `trials` satırı. Sandbox'ta yenileme süreleri kısaltılmış **[doğrulanmadı: deneme süresi]**; dönüşümde `converted_at`. İptal → `will_renew = false`. Bu ölçümle 15.1'deki iki [doğrulanmadı] kapanır |
| H3 | Edge: `has_access` kontrolü (`anthropic-proxy`, `garment-image`, `fashn-proxy` start, `fetch-product`) → 403 `subscription-required`; `anthropic-proxy` `purpose:'scan'` + `scan_jobs` | sunucu | **Kredisiz:** erişimsiz hesapla curl → 403, FASHN'a istek gitmemeli. Tarama: SQL ile 40 `scan_jobs` → 41. istek 402, Claude çağrısı yok. **Az maliyetli (Anthropic):** gerçek tarama → iş `succeeded_at`; bulanık fotoğraf → "tanıyamadık", iş `failed_at` (iade) |
| H4 | OTA: gate (`RootNavigator`), yeni Paywall (deneme satırı, CTA, koşullar, Hesap menüsü), ücretsiz plan UI'ının kaldırılması, `purpose:'scan'`, 15a göstergeleri, TR + EN metinler | OTA (runtime 1.1.0) | **Kredisiz:** yeni hesap → onboarding → gate (kapatılamaz); geri yükle (sandbox); Koşullar / Gizlilik bağlantıları; Hesap → silme çalışmalı; çevrimdışı açılış (son bilinen erişim); gösterge `get_usage` ile aynı; TR ve EN; iOS ve Android deneme metni. **Kredili, en son:** deneme hesabında 2 try-on ve 3.'nün reddi; packshot için SQL ile 14 iş ekleyip 1 gerçek packshot, 16. red |
| H5 | Mağaza: yıllık üründe 7 günlük deneme (kullanıcı), `annual_products`'a ürün kimlikleri (SQL), `start_scan` yetkisinin geri alınması (`revoke execute … from authenticated`) | mağaza + sunucu | Paywall'da deneme rozeti yalnızca uygun hesapta; daha önce deneme kullanmış sandbox hesabında görünmemeli |
| H6 | Web + docs: koşullar / terms (bölüm 4 ve 5: deneme maddesi), gizlilik / privacy (15.6 listesi), `store-listing.md`, `CLAUDE.md` tablosu, envanter #31–#33, saklama, 15.3 kararı | web + docs | OTA ile aynı gün yayın; mağaza metni, uygulama ve koşullar aynı şeyi söylemeli |

**Senin kararın gereken konular:**
1. **Gate'te "Hesap" menüsü** (çıkış, verilerimi indir, hesabı sil). Önerim: evet (Apple 5.1.1(v), KVKK m. 11).
2. **Hareketsiz hesap süresi** (15.3): (a) 24 ay / hiç abone olmamışsa 12 ay + 30 gün önceden e-posta, ya da (b) süresiz ve politikada açıkça yazılı. Hukuki görüş önerilir.
3. **Paywall'da limit sayıları:** göstermemek (önerim) ya da `get_limits()` RPC'siyle göstermek.
4. **Kota kayıtlarının saklama süresi:** `garment_jobs` / `tryon_renders` / `scan_jobs` için 13 ay (önerim) ya da hesap süresince.
5. **Deneme → ücretli geçişte sayaç sıfırlama** (15.5): önerim sıfırlamak (deneme harcamaları ilk ücretli ayda sayılmaz).

### 15.9 Uygulama durumu (07.11.2026)

**Kararlar (onay, 07.11.2026):**
1. Paywall'da Hesap: verilerimi indir, çıkış yap, hesabı sil.
2. Hareketsiz hesap (a): hiç abone olmamış hesap 12 ay, erişimi bitmiş hesap 24 ay girişsiz kalırsa silinir; 30 gün önce e-posta. Bu adımda yalnızca metin (saklama politikası, gizlilik, envanter); otomatik iş açık iş olarak aşağıda.
3. Paywall'da limitler gösterilir: tek satır, `get_limits()` (app_limits).
4. Kota kayıtları (`garment_jobs`, `scan_jobs`, `tryon_renders`) 13 ay.
5. Denemeden ücretliye geçişte sayaçlar sıfırlanır; yıllık planın 150'lik kurulum ayı ilk ücretli günde başlar.

**Commit'ler:**

| Grup | Commit | Ne |
|---|---|---|
| H1 | `432ad63` | `022_hard_paywall_trial.sql` |
| H2 | `bc60b9a` | `_shared/revenuecat.ts` (`period_started_at`), `export-my-data` (deneme kaydı) |
| H3 | `124d3a4` | `_shared/access.ts`, dört fonksiyonda erişim kapısı, `anthropic-proxy` purpose `scan` |
| H4 | `0a50bf7` | İstemci: gate, paywall, ücretsiz plan UI'ının kaldırılması, 15a, TR + EN metinler |
| H5 | `cd976f5` | `023_drop_start_scan.sql` (OTA sonrası) + `annual_products` şablonu |
| H6 | web `draft` `e4ab5e6` + bu docs commit'i | Koşullar / terms bölüm 4–5, gizlilik / privacy, envanter #31–#33, saklama 1.4, `store-listing.md`, `CLAUDE.md` |

**Tasarımdan sapmalar:**
- **15a try-on göstergesi** kart üzerindeki butonun yanında değil, her denemede açılan kaynak penceresinde (`TryOnSourceModal`) ve Profil kartında. Kart `React.memo` comparator'ıyla çiziliyor; butonun yanına sayı koymak her kartı kota değişiminde yeniden çizdirirdi.
- **Paywall modalı yok:** tek paywall gate'tir (`RootNavigator`). `openPaywall` ve `PaywallReason` kaldırıldı. Hak bitince paywall değil, neden + tarih mesajı (`quota.*`). Uygulama açıkken erişim biterse sunucunun `subscription-required` yanıtı planı tazeler, gate kendiliğinden açılır.
- **`start_scan`** 022'de saymayan uyumluluk fonksiyonu olarak kaldı; 023 ile silinir (OTA'dan sonra).
- **`garment-image`** erişim kapısı tüm eylemlerde (start + status). Erişim deneme / üretim sırasında biterse iş 10 dk sonra kotadan kendiliğinden düşer.
- **`get_usage`**: `ended` (`'trial' | 'subscription' | null`, paywall başlığı) eklendi; `premium_expires_at` eski ad olarak `access_expires_at` ile birlikte dönüyor.
- **`trials`** satırı yalnızca `period_started_at` doluyken açılır (H2 deploy'undan sonra). Önceki senkronda deneme penceresi `-infinity` sayılır (sıkı taraf; test hesaplarını etkiler, gerçek kullanıcı yok).
- **Deneme süresi** mağazadan; yalnızca gün / hafta birimi okunur. Başka birimde ya da okunamazsa paywall deneme vaat etmez.
- **Doğrulanmadı:** bu makinede Node yok. `npx tsc --noEmit` ve uygulama çalıştırılmadı; OTA'dan önce şart. i18n anahtarları iki dilde betikle kontrol edildi (eksik yok). SQL bir veritabanında çalıştırılmadı.

**Yayın sırası:**
1. **SQL:** `022_hard_paywall_trial.sql` (SQL Editor). Önce dosya sonundaki "Mevcut hesaplar" sorgusu.
   - 022 olmadan yeni bundle'da `get_usage` eski biçimi döner (`plan: 'free'`) ve herkes gate'e düşer. Bu yüzden 022 OTA'dan önce gelir.
2. **Deploy:** `npx supabase functions deploy anthropic-proxy garment-image fashn-proxy fetch-product sync-entitlement export-my-data --project-ref bdvrgbylirftuxmrpbea` + `npx supabase functions deploy revenuecat-webhook --no-verify-jwt --project-ref bdvrgbylirftuxmrpbea`.
3. **Mağaza:** yıllık üründe 7 günlük deneme (kullanıcı); ardından `annual_products`'a ürün kimlikleri (023 dosyasındaki şablon).
4. **OTA** (runtime 1.1.0): önce `npx tsc --noEmit`.
5. **Web:** `sestina-web` `draft` → `main`, OTA ile aynı gün.
6. **023** (`start_scan` silinir): test ve demo hesapları yeni bundle'dayken.
7. **Mağaza metinleri** (`docs/store-listing.md`) ve App Review notu (aşağıda).

**Test (kredisiz önce):**
1. **SQL** (022 sonundaki bloklar): deneme penceresi (2 / 5 / 15), 3./6./16. red, iade; ücretliye geçişte `converted_at`, sayaçlar sıfır, yıllıkta `packshot_setup` dönüşüm anında; süresi geçmiş → `subscription-required` (try-on, packshot, parça ekleme). Demo hesabı `plan: 'premium'`.
2. **Edge (curl, kredisiz):** erişimsiz hesap → dört fonksiyonda 403 `subscription-required`, FASHN'a istek yok. SQL ile 40 `scan_jobs` → tarama 402 `scan-limit`, Claude çağrısı yok.
3. **Uygulama (kredisiz):**
   - Yeni hesap → onboarding → gate (kapatılamaz, Android geri tuşu çıkarmaz).
   - Yıllık seçili ve üstte; tasarruf rozeti ve aylık karşılık mağaza fiyatından. Deneme uygunsa "7 gün ücretsiz dene" ve deneme koşulları; aylıkta otomatik yenileme metni.
   - Limit satırı `get_limits` ile aynı sayılar; `app_limits`'te bir değeri değiştirince paywall yeni sayıyı göstermeli.
   - Geri yükle, Koşullar, Gizlilik; Hesap → verilerimi indir, çıkış, hesabı sil.
   - Sandbox deneme satın al → ana ekranlar; Profil "Ücretsiz deneme · … biter", göstergeler `get_usage` ile aynı.
   - Uçak modu açıkken yeniden açılış → son bilinen erişimle ana ekranlar.
   - TR ve EN.
4. **Az maliyetli / kredili (en son):**
   - Tarama: tanınan ürün → `scan_jobs.succeeded_at`; bulanık fotoğraf → "tanıyamadık", `failed_at` (hak geri). 5. taramadan sonra deneme hesabında "Tarama hakkın bitti" + deneme sonu tarihi.
   - Try-on: 2 deneme, 3.'sünde "Sanal deneme hakkın bitti".
   - Packshot: SQL ile 14 iş + 1 gerçek packshot; sonraki parça cihaz kesimi + "hak doldu".

**App Review notu (App Store Connect → App Review Information → Notes):**

```
Sestina uses a hard paywall: after onboarding (a short style quiz) a subscription or the 7-day free trial of the yearly plan is required to use the app.

The demo account (demo@sestinaapp.com) has a lifetime promotional Premium entitlement, so it goes straight to the app and does not show the paywall.

To see the paywall, the free trial and the purchase flow, create a new account (Sign up with email) and complete the style quiz; the paywall appears after it. The trial can be started with a sandbox Apple ID. The paywall also shows Restore Purchases, links to the Terms of Use and Privacy Policy, and Account options (download my data, sign out, delete account).
```

TR (iç kayıt): Sestina hard paywall kullanır; stil testinden sonra abonelik ya da yıllık planın 7 günlük ücretsiz denemesi gerekir. Demo hesabı ömür boyu promosyonel Premium olduğu için paywall'u göstermez. Paywall, deneme ve satın alma akışı yeni bir hesap açılıp stil testi tamamlanarak görülebilir.

### Açık iş: hareketsiz hesap silme (ilk silme tarihinden önce yapılacak)

**Karar (07.11.2026):** hiç erişimi (abonelik / deneme) olmamış hesap **12 ay**, erişimi bitmiş hesap erişim bitiminden sonra **24 ay** girişsiz kalırsa silinir; silmeden **30 gün önce** e-posta. Metinler yazıldı (saklama 1.4, gizlilik bölüm 9, envanter); **otomatik iş yok**.

**Son tarih:** ilk bildirim, lansmandan itibaren en erken **11. ayda** gider (12 ay − 30 gün). İş en geç lansman + 10 ayda canlıda olmalı.

**Yapılacaklar:**
- **Seçim (SQL fonksiyonu, service_role):**
  - `auth.users.last_sign_in_at` + `entitlements` + `trials`.
  - Hiç erişim yok (`entitlements` satırı ve `trials` yok) ve giriş > 12 ay; ya da erişim bitmiş (`expires_at < now()` veya satır silinmiş ama `trials` var) ve `greatest(last_sign_in_at, expires_at)` > 24 ay.
  - `last_sign_in_at` oturum yenilemede güncellenmiyor olabilir **[doğrulanmadı]**. Gerekirse uygulama açılışında `profiles.last_seen_at` yazılır.
- **Bildirim:** yeni tablo `inactive_notices(user_id, notified_at, delete_after)`. E-posta gönderimi (Supabase Auth e-postası değil; Gmail SMTP / transactional sağlayıcı; yeni alıcıysa envanter ve gizlilik güncellenir). Girişte satır silinir.
- **Silme:** `delete-account` mantığı (depo kökü, RevenueCat abone kaydı, Apple token iptali mümkünse, `auth.admin.deleteUser`) ortak modüle alınır. `deletion_log.source` CHECK'ine `'inactive'` eklenir (014: `'app' | 'email' | 'under18'`).
- **Zamanlama:** günlük pg_cron + edge function (cron → `net.http_post` ya da Supabase scheduled function).
- **Test:** test hesabında `last_sign_in_at`'i geriye alıp bildirim ve silme; girişte bildirim satırının silinmesi; `deletion_log` kaydı.

## e. Riskler ve açık sorular

**Açık sorular:**

> 1–5 numaralı sorular "Kararlar (05.11.2026)" ile kapandı (1 → Karar 1, 2 → Karar 2, 3 → Karar 3, 4 → Karar 4, 5 → Karar 5: izin metni FASHN'ı da sayar, sürüm 2.0, yeniden izin istenir). Hukuki dayanak görüşü ve 6. soru açık kalıyor. Aşağıdaki metin tarihsel kayıt olarak bırakıldı.

1. **"Uyar mı?" taraması** da Poof kullanıyor (`ScanScreen.tsx:35-48`). Seçenekler:
   - (a) Arka plan kaldırmadan Claude'a orijinal gönder: ücretsiz, tarama fotoğrafı zaten saklanmıyor
   - (b) Packshot: tarama başına 1 kredi
   - (c) Cihaz üstü kaldırma

   Öneri: (a), çünkü sonuç ekranında görsel sadece önizleme.
2. **Orijinali kalıcı saklamak** yeni bir saklama. Gerekli mi (yeniden işleme, "orijinali kullan" sonradan), yoksa karar sonrası silinsin mi? Saklama politikası ve gizlilik metni buna göre yazılır.
3. **Ücretsiz try-on 3 → 1 geçişi:** mevcut ücretsiz kullanıcılara kalan hak tanınacak mı? Premium 8 → 5 ay ortasında mı, ay başında mı?
4. **Ücretsiz plan, 4. parça ve sonrası, desteklenmeyen cihaz:** "olduğu gibi" mi (0 maliyet), FASHN background-remove mi (1 kredi)?
5. **Yapay zekâ izni 2.0 dayanağı:** FASHN'a kıyafet fotoğrafı gönderimi `ai_processing` tercihi altında mı kalacak (m. 5/2-c), yoksa ayrı bir onay mı gerekir? Hukuki görüş **[doğrulanmadı]**.
6. FASHN ile DPA ve "return_base64'te saklanmıyor" beyanının yazılı teyidi (`data-inventory.md:112` açık noktası). Güncelleme (06.11.2026): DPA yayımlanmış ([fashn.ai/legal/dpa](https://fashn.ai/legal/dpa)) ama gün sayısı içermiyor. Base64'te CDN kopyası olup olmadığı dokümanda yok (b.3b).

**Riskler:**

- **Maliyet:** her eklemede packshot (1 kredi), "orijinali kullan" seçilirse +1 kredi. Premium kullanıcı 200 parça eklerse 200–400 kredi. Günlük tavan (mevcut 150) yeni fonksiyonda da olmalı; global harcama alarmı yok (a.4).
- **Edge function limitleri** (`return_base64` + sunucuda storage yazma; packshot süresi) ölçülmedi. Adım 5'ten sonra `[fashn-proxy] output saved` logu boyut, decode/upload süresi ve CPU'yu yazıyor; ilk denemelerden okunmalı.
- **OTA'yı almamış eski binary'ler** `bg-removal-proxy`'yi çağırmaya devam eder. Kapatma zamanlaması benimseme oranına bağlı.
- **Sunucuda rıza sürümü kontrol edilmiyor** (c.2). Karar 5 ile çözülüyor (d, adım 6). Adım 6 ile 7 aynı gün yayınlanmazsa, test hesapları yeni metni görmeden 403 alır.
- **Ücretsiz plan 4.+ parçalar arka planlı kaydediliyor** (Karar 4). Kombin kartı ve try-on kalitesi bu parçalarda düşük olabilir. `garment_photo_type: 'auto'` kalmalı.
- **Claude girdisinin orijinale dönmesi** kategori doğruluğunu değiştirebilir (arka plan gürültüsü). Adım 14'teki test packshot'lı ve packshot'sız varyantı da ölçmeli.
- **`category:'auto'` ve `'flat-lay'`** packshot'larda daha iyi sonuç verecek mi, ölçülmedi.
- **`expo-segmentation` olgun değil.** Kendi Expo modülümüzü yazma maliyeti var. iOS 16.x kullanıcıları cihaz üstü yoldan yararlanamaz.
- **Cache imzası değişimi** (dış giyim eleme) kullanıcıların daha önce cache'ten aldığı kombinleri yeniden kotaya sokar.
- **Yarım kalan yüklemeler:** `_orig.jpg` yetim dosyaları için temizlik işi gerekir.
- **thumb_url sütunu:** onu ekleyen migration repoda yok (şema anlık görüntüsünde var). Yeni migration'lar için şema kaynağı netleştirilmeli.

**Dış kaynaklar** (kod dışı; teyit için):

- [Expo SDK 56 sürüm tablosu](https://docs.expo.dev/versions/v56.0.0.md): iOS 16.4+
- [expo-segmentation](https://www.pkgstats.com/pkg:@westwood-dev/expo-segmentation)
- [ML Kit Subject Segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation)
- [FASHN tryon-v1.6](https://docs.fashn.ai/api-reference/tryon-v1-6), [parametre rehberi](https://docs.fashn.ai/guides/tryon-parameters-guide): `moderation_level`, `return_base64`, `segmentation_free`

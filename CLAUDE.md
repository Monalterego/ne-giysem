# Ne Giysem? (What Should I Wear?)

AI destekli kişisel stil danışmanı mobil uygulaması.

Kullanıcıların gardrobunu dijitalleştiren, yapay zeka ile kombin önerileri sunan ve mağazada çekilen fotoğraflarla dolap uyum analizi yapan bir mobil uygulama.

## Teknik Stack

- **Mobil:** React Native / Expo (TypeScript)
- **Backend:** FastAPI (Python) veya Node.js
- **Görsel İşleme:** rembg / Segment Anything (SAM) — background removal
- **AI / Vision:** Claude API (Vision) — kategori, renk, desen, mevsim tespiti
- **Öneri Motoru:** Rule engine + embedding similarity (pgvector)
- **Veritabanı:** PostgreSQL + Redis (cache/session)
- **Auth:** Supabase Auth
- **Storage:** Cloudflare R2 veya AWS S3 + CDN
- **Hosting:** Hetzner VPS + Coolify
- **Push Notification:** Expo Notifications / OneSignal
- **Hava Durumu:** OpenWeatherMap API

## Geliştirme Kuralları

- TypeScript kullan (strict mode)
- Kod yorumları Türkçe
- Commit mesajları İngilizce (conventional commits: feat:, fix:, chore:, docs:)
- Mobile-first tasarım
- Elegant moda estetiği: siyah-beyaz baskın, soft rose/champagne accent (#E94560), bol whitespace
- Font: DM Sans (body) + Playfair Display (başlıklar)
- Renk paleti: primary #1A1A2E, accent #E94560, secondary #0F3460
- Component-based mimari, her ekran kendi klasöründe
- Expo Router kullan (file-based routing)

## Temel Özellikler

### 1. Dijital Gardrob
- Fotoğraf yükleme (kamera + galeri)
- Background removal → sticker formatında beyaz zemin üzerinde ürün
- AI ile otomatik kategori tespiti: üst/alt/dış/ayakkabı/aksesuar
- Otomatik renk çıkarımı (dominant + palet)
- Otomatik desen tespiti (düz/çizgili/ekose/çiçekli)
- Opsiyonel kumaş bilgisi girişi: Pamuk, Keten, Denim, İpek, Yün, Polyester, Viskon, Saten, Kadife, Karışım, Bilmiyorum
- Opsiyonel mevsim etiketi
- Opsiyonel marka/fiyat bilgisi
- İlk yüklemede fotoğraf çekme rehberi (düz zemin, doğal ışık, üstten çekim)
- Grid ve liste görünümü, kategori/renk/mevsim filtresi

### 2. Üç Katmanlı Stil Profili (Onboarding)

**Yol A — "Tarzımı Biliyorum":**
- Stil kategorilerinden direkt seçim: Minimalist, Streetwear, Old Money, Smart Casual, Bohemian, Athleisure, Avant-garde
- Birden fazla seçilebilir, ağırlık ayarlanabilir (%60 Minimalist, %40 Old Money gibi)

**Yol B — "Keşfetmek İstiyorum" (Stil Quiz):**
- 8-12 soru, görsel ağırlıklı
- Her soru iki görsel arası seçim veya sliding scale
- Soru örnekleri: brunch outfit seçimi, renk paleti tercihi, alışveriş önceliği, ayakkabı dolabı, ortam seçimi

**Yol C — "İlham Ver" (Keşif Modu):**
- Pinterest tarzı ilham akışı
- Swipe (beğen/geç) mekanizması
- 15-20 swipe sonrası stil profili önerisi

**Sonuç:** Her üç yol da aynı çıktıyı üretir → Stil DNA Kartı (ana stil + yan stil + renk paleti + önerilen temel parçalar). Paylaşılabilir (Instagram Story formatı).

### 3. Kombin Öneri Motoru

**Hibrit sistem:**
1. Kural Tabanlı: renk uyumu, mevsim, occasion kuralları
2. Stil Grafları: her stil kategorisi için kombin şablonları
3. AI Embedding: parçaların stil vektörleri üzerinden benzerlik (pgvector)
4. Kullanıcı Feedback: beğen/beğenme ile öğrenme

**Kombin Kartı (Pinterest flat lay stili):**
- Beyaz arka plan üzerinde sticker formatında ürün görselleri
- Doğal flat lay layout
- Uyum skoru (% gösterimi)
- Her parçanın ismi ve kategorisi etiketli
- "Bu Kombini Giy" butonu → günlük seçim olarak işaretler
- Paylaşım butonu (Instagram Story, WhatsApp)

**Tetikleyiciler:**
- Günlük öneri (push notification)
- Hava durumuna göre
- Etkinlik bazlı (iş, date, düğün vb.)
- Seyahat/bavul planlama modu

### 4. Mağaza Uyum Analizi (Killer Feature)
- Kullanıcı mağazada ürün fotoğraflar
- Uygulama ürünü tanır, arka planı siler
- Dolaptaki parçalarla otomatik kombin önerileri oluşturur
- Uyum skoru gösterir
- Bilgi sunar: "7 parçayla uyumlu", "bu renk paletine ters", "aynı işlevde 4 parçan var", "şu ayakkabılarınla iyi gider"
- Potansiyel kombinlerin görsel kartları

### 5. Monetizasyon (Freemium)

**Ücretsiz:**
- 30 parçaya kadar gardrob
- 3 kombin önerisi / gün
- 5 mağaza analizi / ay
- Temel stil profili

**Premium (₺99.99/ay veya ₺799.99/yıl):**
- Limitsiz gardrob
- Limitsiz kombin önerisi
- Limitsiz mağaza analizi
- Detaylı Stil DNA + evrim takibi
- AI Stil Danışmanı (sohbet tabanlı)
- Etkinlik bazlı kombin
- Hava durumu entegrasyonu
- Seyahat/bavul planlama
- Capsule wardrobe planner
- Trend analizi

## Görsel İşleme Pipeline

```
Fotoğraf → Boyutlandırma/Optimize → Background Removal (rembg/SAM)
→ Kategori Tespiti (Vision AI) → Renk/Desen/Mevsim Çıkarımı
→ Embedding Generation → Storage (orijinal + işlenmiş → CDN, metadata → DB)
```

## MVP Fazlaması

### V1 — "Dijital Dolap + İlk Kombinler" (3-4 ay)
- Kıyafet fotoğraf yükleme + background removal
- Otomatik kategorilendirme
- Renk ve temel özellik çıkarımı
- Opsiyonel kumaş bilgisi girişi
- Temel stil profili (Yol A: direkt seçim)
- Kural tabanlı basit kombin önerileri
- Kombin kartı görseli (Pinterest flat lay stili)
- Basit mağaza uyum kontrolü (renk uyumu seviyesinde)
- Fotoğraf çekme rehberi

### V2 — "Akıllı Stil" (2-3 ay)
- Stil Quiz (Yol B) ve Keşif Modu (Yol C)
- Gelişmiş kombin motoru (stil grafları + embedding)
- Hava durumu entegrasyonu
- Etkinlik bazlı kombin önerileri
- "Bu kombini giydim" takibi ve stil günlüğü
- Push notification ile günlük öneri
- Sosyal paylaşım (kombin kartı export)

### V3 — "Alışveriş Asistanı + Premium" (2-3 ay)
- Tam kapsamlı mağaza uyum analizi
- "Dolabında eksik" parça önerileri
- AI Stil Danışmanı (sohbet tabanlı)
- Capsule wardrobe planner
- Seyahat/bavul planlama
- Trend raporu
- Premium subscription lansmanı
- Affiliate/marka entegrasyonları

## UX Kuralları

- **"3 parça kuralı":** 3 parça yüklenince ilk kombin gösterilir — instant gratification
- **"60 saniye kuralı":** Kayıttan ilk değere 60 saniyede ulaşılmalı
- **"Sıfır boşluk":** Hiçbir ekran boş hissi vermemeli, her zaman bir aksiyon önerilmeli
- **"Progressive disclosure":** Karmaşıklık kademeli açılmalı, ilk deneyim sade olmalı

## Ekranlar (Wireframe Referansı)

1. Splash Screen
2. Onboarding Welcome (3 sayfalık carousel)
3. Kayıt (Apple/Google/E-posta)
4. Stil Yolu Seçimi (3 kart)
5. Stil Direkt Seçim (tag'ler + ağırlık slider)
6. Stil Quiz (görsel sorular)
7. Stil Keşif (swipe mekanizması)
8. Stil DNA Kartı Sonucu
9. Ana Sayfa (günün kombini, hava durumu, hızlı aksiyonlar, dolap önizleme)
10. Dijital Dolap (grid, kategori filtreleri)
11. Ürün Yükle (kamera/galeri + ipuçları)
12. Ürün Detayları (AI tespiti + kumaş/mevsim girişi)
13. Kombin Feed (occasion filtreleriyle)
14. Kombin Kartı Detay (flat lay + skor + giy butonu)
15. Mağaza Tarama (kamera viewfinder)
16. Uyum Analizi Sonucu (skor + kombinler + uyarılar)
17. Profil (istatistikler, stil DNA, ayarlar)
18. Premium (özellikler + fiyatlandırma)

## Bottom Navigation

🏠 Ana Sayfa | 👗 Dolap | ✨ Kombin | 📸 Tara | 👤 Profil

## Rakip Farklılaşma

- Mağaza uyum analizi: hiçbir rakipte yok
- Üç katmanlı stil profili: farklı farkındalık seviyelerine hitap
- Türk pazarına özel: Türkçe, yerel trendler, Türk moda terminolojisi
- Kumaş bilgisi sistemi: mevsimsel öneri kalitesini yükselten farklılaştırıcı

## GitHub

- Repo: Monalterego/ne-giysem (oluşturulacak)
- Branch stratejisi: main + dev + feature branches
- PR açıklamaları İngilizce

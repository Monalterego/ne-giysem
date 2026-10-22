# Başvuru Kayıt Defteri — Şablon

**Kullanım:** Bu dosya yalnızca şablondur. Doldurulmuş defter kişisel veri içerir; **repoya konmaz** — veri sorumlusunun Drive'ında ya da yerelinde (ör. tablo dosyası) tutulur. Prosedür: `basvuru-proseduru.md`.
**Saklama:** satır, başvurunun kapanışından itibaren 2 yıl (`saklama-imha-politikasi.md`).

## Alanlar

| # | Alan | Açıklama / değerler |
|---|---|---|
| 1 | Başvuru no | `B-YYYY-NNN` |
| 2 | Alış tarihi / saati | E-postanın Gmail'e ulaştığı an |
| 3 | Gelen adres | Başvurunun geldiği e-posta adresi |
| 4 | Kayıtlı adresten mi? | Evet / Hayır |
| 5 | Hesap | Kayıtlı e-posta (bulunamadıysa "bulunamadı") — kullanıcı kimliği (uid) yazılmaz |
| 6 | Doğrulama kodu | Gönderim tarihi, son geçerlilik (gönderim + 7 gün), deneme sayısı. **Kodun kendisi doğrulanınca silinir** |
| 7 | Doğrulama sonucu | Gerekmedi / Doğrulandı (tarih) / Süresi doldu / Başarısız |
| 8 | Tebliğ m. 5 bilgileri tam mı? | Evet / Eksik (eksik olan alan) — **TCKN / pasaport no buraya yazılmaz** |
| 9 | Eksik bilgi istendi | Tarih; tamamlandı tarihi |
| 10 | Talep türü | m. 11/a–ğ (birden fazla seçilebilir); GDPR / UK GDPR talebi ise belirt |
| 11 | Talep özeti | Kısa, kişisel veri içermeden |
| 12 | Süre başlangıcı | Tam ve doğrulanmış başvurunun tarihi |
| 13 | Son yanıt tarihi | Süre başlangıcı + 30 gün |
| 14 | Yapılan işlem | Ör. veri kopyası gönderildi / hesap silindi (`deletion_log` source = email) / düzeltildi |
| 15 | Sonuç | Kabul / Kısmi kabul / Ret |
| 16 | Ret gerekçesi | Varsa |
| 17 | Yanıt tarihi | |
| 18 | Kurul şikâyet bilgisi verildi mi? | Ret / kısmi kabulde Evet |
| 19 | Gmail etiketi | `KVKK / B-YYYY-NNN` |
| 20 | Kapanış tarihi | |
| 21 | İmha tarihi | Kapanış + 2 yıl; silindiğinde doldurulur |

## Örnek satır

| No | Alış | Gelen adres | Kayıtlı mı | Hesap | Kod | Doğrulama | m.5 tam | Talep | Süre başl. | Son tarih | İşlem | Sonuç | Yanıt | Kapanış |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B-2026-001 | 2026-11-02 10:14 | a@örnek.com | Hayır | k***@privaterelay.appleid.com | 2026-11-02 → 2026-11-09, 1 deneme | Doğrulandı 2026-11-03 | Evet | m. 11/e (silme) | 2026-11-03 | 2026-12-03 | Hesap silindi; deletion_log (email) | Kabul | 2026-11-04 | 2026-11-04 |

import React, { useState } from "react";

const screens = {
  splash: {
    title: "Splash",
    label: "Karşılama",
  },
  onboarding_welcome: {
    title: "Hoş Geldin",
    label: "Onboarding",
  },
  signup: {
    title: "Kayıt",
    label: "Kayıt",
  },
  style_choice: {
    title: "Stil Yolu Seçimi",
    label: "Stil Yolu",
  },
  style_direct: {
    title: "Tarzımı Biliyorum",
    label: "Direkt Seçim",
  },
  style_quiz: {
    title: "Stil Quiz",
    label: "Quiz",
  },
  style_explore: {
    title: "İlham Ver",
    label: "Keşfet",
  },
  style_result: {
    title: "Stil DNA Kartın",
    label: "Stil Sonuç",
  },
  home: {
    title: "Ana Sayfa",
    label: "Ana Sayfa",
  },
  wardrobe: {
    title: "Dijital Dolap",
    label: "Dolap",
  },
  upload: {
    title: "Ürün Yükle",
    label: "Yükle",
  },
  upload_detail: {
    title: "Ürün Detayları",
    label: "Detay Gir",
  },
  combo_feed: {
    title: "Kombin Önerileri",
    label: "Kombinler",
  },
  combo_card: {
    title: "Kombin Kartı",
    label: "Kombin Detay",
  },
  store_scan: {
    title: "Mağaza Tarama",
    label: "Mağaza",
  },
  store_result: {
    title: "Uyum Analizi",
    label: "Uyum Sonuç",
  },
  profile: {
    title: "Profil",
    label: "Profil",
  },
  premium: {
    title: "Premium",
    label: "Premium",
  },
};

const flows = [
  { id: "onboarding", name: "Onboarding Akışı", screens: ["splash", "onboarding_welcome", "signup", "style_choice", "style_direct", "style_quiz", "style_explore", "style_result"], color: "#E94560" },
  { id: "wardrobe", name: "Gardrob Akışı", screens: ["home", "wardrobe", "upload", "upload_detail"], color: "#0F3460" },
  { id: "combo", name: "Kombin Akışı", screens: ["home", "combo_feed", "combo_card"], color: "#6C5CE7" },
  { id: "store", name: "Mağaza Akışı", screens: ["home", "store_scan", "store_result"], color: "#00B894" },
  { id: "profile", name: "Profil & Premium", screens: ["home", "profile", "premium"], color: "#FDCB6E" },
];

function PhoneFrame({ children, title }) {
  return (
    <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 260, height: 520, borderRadius: 32, border: "3px solid #1A1A2E",
        background: "#FAFAFA", position: "relative", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(26,26,46,0.15), 0 4px 12px rgba(26,26,46,0.08)",
      }}>
        {/* Status bar */}
        <div style={{
          height: 36, background: "#1A1A2E", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 20px",
        }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>9:41</span>
          <div style={{ width: 60, height: 18, borderRadius: 12, background: "#2D2D4E" }} />
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 14, height: 10, borderRadius: 2, border: "1px solid #fff", position: "relative" }}>
              <div style={{ position: "absolute", right: 2, top: 2, bottom: 2, left: 4, background: "#fff", borderRadius: 1 }} />
            </div>
          </div>
        </div>
        {/* Content */}
        <div style={{ height: 484, overflow: "hidden" }}>
          {children}
        </div>
      </div>
      <div style={{
        marginTop: 12, fontSize: 12, fontWeight: 700, color: "#1A1A2E",
        fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em", textTransform: "uppercase",
      }}>{title}</div>
    </div>
  );
}

function SplashScreen() {
  return (
    <div style={{ height: "100%", background: "linear-gradient(160deg, #1A1A2E 0%, #0F3460 50%, #E94560 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 36 }}>👗</span>
      </div>
      <div style={{ color: "#fff", fontSize: 28, fontWeight: 800, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>Ne Giysem?</div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Kişisel Stil Danışmanın</div>
    </div>
  );
}

function OnboardingWelcome() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", height: 180, borderRadius: 16, background: "linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e8eaf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {["👕", "👖", "👟", "🧥"].map((e, i) => (
            <div key={i} style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, transform: `rotate(${(i - 1.5) * 6}deg)` }}>{e}</div>
          ))}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", textAlign: "center", marginBottom: 8 }}>Dolabını Dijitalleştir</div>
        <div style={{ fontSize: 12, color: "#888", fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.5, padding: "0 10px" }}>Fotoğrafla, keşfet, her gün mükemmel görün. AI destekli kişisel stil danışmanın.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: i === 0 ? 20 : 6, height: 6, borderRadius: 3, background: i === 0 ? "#E94560" : "#ddd" }} />)}
      </div>
      <div style={{ height: 44, borderRadius: 22, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Başlayalım →</div>
    </div>
  );
}

function SignupScreen() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginTop: 16, marginBottom: 4 }}>Hesap Oluştur</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>60 saniyede kişisel stiline kavuş</div>
      {["Apple ile devam et", "Google ile devam et"].map((t, i) => (
        <div key={i} style={{ height: 44, borderRadius: 12, border: "1.5px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, fontSize: 13, fontWeight: 600, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{i === 0 ? "🍎" : "🔵"}</span> {t}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#eee" }} />
        <span style={{ fontSize: 11, color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>veya</span>
        <div style={{ flex: 1, height: 1, background: "#eee" }} />
      </div>
      {["E-posta", "Şifre"].map((p, i) => (
        <div key={i} style={{ height: 44, borderRadius: 12, border: "1.5px solid #eee", padding: "0 14px", display: "flex", alignItems: "center", marginBottom: 10, fontSize: 12, color: "#bbb", fontFamily: "'DM Sans', sans-serif" }}>{p}</div>
      ))}
      <div style={{ marginTop: "auto" }}>
        <div style={{ height: 44, borderRadius: 22, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Kayıt Ol</div>
      </div>
    </div>
  );
}

function StyleChoice() {
  const paths = [
    { icon: "🎯", title: "Tarzımı Biliyorum", desc: "Stilimi direkt seçmek istiyorum", color: "#E94560" },
    { icon: "🧩", title: "Keşfetmek İstiyorum", desc: "Quiz ile tarzımı bul", color: "#0F3460" },
    { icon: "✨", title: "İlham Ver", desc: "Görseller ile keşfet", color: "#6C5CE7" },
  ];
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginTop: 12, marginBottom: 4 }}>Stilini Tanıyalım</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>Sana en uygun yolu seç</div>
      {paths.map((p, i) => (
        <div key={i} style={{ borderRadius: 16, border: "1.5px solid #f0f0f0", padding: 16, marginBottom: 12, display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${p.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{p.icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>{p.title}</div>
            <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{p.desc}</div>
          </div>
          <div style={{ marginLeft: "auto", color: "#ccc", fontSize: 16 }}>›</div>
        </div>
      ))}
    </div>
  );
}

function StyleDirect() {
  const styles = [
    { name: "Minimalist", sel: true }, { name: "Streetwear", sel: false },
    { name: "Old Money", sel: true }, { name: "Smart Casual", sel: false },
    { name: "Bohemian", sel: false }, { name: "Athleisure", sel: false },
  ];
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 11, color: "#E94560", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 4 }}>YOL A</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Tarzını Seç</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>Birden fazla seçebilirsin</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {styles.map((s, i) => (
          <div key={i} style={{
            padding: "10px 16px", borderRadius: 20,
            background: s.sel ? "#1A1A2E" : "#fff",
            color: s.sel ? "#fff" : "#1A1A2E",
            border: `1.5px solid ${s.sel ? "#1A1A2E" : "#eee"}`,
            fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}>{s.sel ? "✓ " : ""}{s.name}</div>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "#fafafa" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Ağırlık Ayarla</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Sans', sans-serif", width: 70 }}>Minimalist</span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#eee", position: "relative" }}>
            <div style={{ width: "60%", height: "100%", borderRadius: 2, background: "#E94560" }} />
          </div>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Sans', sans-serif" }}>60%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Sans', sans-serif", width: 70 }}>Old Money</span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#eee", position: "relative" }}>
            <div style={{ width: "40%", height: "100%", borderRadius: 2, background: "#0F3460" }} />
          </div>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Sans', sans-serif" }}>40%</span>
        </div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <div style={{ height: 44, borderRadius: 22, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Devam →</div>
      </div>
    </div>
  );
}

function StyleQuiz() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#E94560", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>SORU 3/8</div>
        <div style={{ width: 80, height: 4, borderRadius: 2, background: "#eee" }}><div style={{ width: "37.5%", height: "100%", borderRadius: 2, background: "#E94560" }} /></div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginBottom: 20, lineHeight: 1.4 }}>Hafta sonu brunch'ına hangisini giyersin?</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
        {[
          { bg: "linear-gradient(135deg, #f5ebe0 0%, #edede9 100%)", label: "Minimal & Şık", items: "🤍 Krem kazak + düz pantolon" },
          { bg: "linear-gradient(135deg, #d5f5e3 0%, #e8f8f5 100%)", label: "Rahat & Cool", items: "💚 Oversize tişört + jogger" },
          { bg: "linear-gradient(135deg, #fce4ec 0%, #faf0e6 100%)", label: "Feminen & Zarif", items: "🌸 Midi etek + bluz" },
          { bg: "linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)", label: "Cesur & Farklı", items: "💜 Statement parça + aksesuar" },
        ].map((o, i) => (
          <div key={i} style={{
            borderRadius: 14, background: o.bg, padding: 14,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            border: i === 0 ? "2px solid #E94560" : "2px solid transparent",
            position: "relative",
          }}>
            {i === 0 && <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, background: "#E94560", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{o.label}</div>
            <div style={{ fontSize: 9, color: "#666", fontFamily: "'DM Sans', sans-serif" }}>{o.items}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 44, borderRadius: 22, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginTop: 16 }}>Sonraki →</div>
    </div>
  );
}

function StyleExplore() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 11, color: "#6C5CE7", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 4 }}>KEŞİF MODU</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Beğen veya Geç</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>Sağa beğen, sola geç — tarzını keşfedelim</div>
      <div style={{ flex: 1, borderRadius: 20, background: "linear-gradient(160deg, #f8f4f0 0%, #fce4ec 50%, #e8eaf6 100%)", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 12, left: 14, background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}>7/20</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", padding: 20 }}>
          {["🧥", "👖", "👞", "🧣"].map((e, i) => (
            <div key={i} style={{ width: 64, height: 64, borderRadius: 16, background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, transform: `rotate(${(i-1.5) * 4}deg)` }}>{e}</div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>Classic Elegance</div>
        <div style={{ fontSize: 10, color: "#666", fontFamily: "'DM Sans', sans-serif" }}>#oldmoney #timeless</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, border: "2px solid #ff6b6b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✕</div>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", boxShadow: "0 4px 16px rgba(233,69,96,0.3)" }}>♥</div>
      </div>
    </div>
  );
}

function StyleResult() {
  return (
    <div style={{ height: "100%", background: "linear-gradient(180deg, #1A1A2E 0%, #0F3460 100%)", display: "flex", flexDirection: "column", padding: 20, alignItems: "center" }}>
      <div style={{ fontSize: 11, color: "#E94560", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginTop: 12, letterSpacing: "0.1em" }}>STİL DNA KARTIN</div>
      <div style={{ width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, marginTop: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'Playfair Display', serif" }}>Minimal Elegance</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>%60 Minimalist · %40 Old Money</div>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {["#2C3E50", "#ECF0F1", "#BDC3C7", "#8E6F47", "#1A1A2E"].map((c, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: 16, background: c, border: "2px solid rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", marginBottom: 8 }}>RENK PALETİN</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {["Sade hatlar", "Kaliteli kumaş", "Nötr tonlar", "Zamansız"].map((t, i) => (
            <div key={i} style={{ padding: "5px 12px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 44, borderRadius: 22, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Dolabımı Oluştur →</div>
        <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>📤 Paylaş</div>
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div style={{ height: "100%", background: "#FAFAFA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>Günaydın, Hasan 👋</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif" }}>Ne Giysem?</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>H</div>
      </div>
      {/* Daily combo */}
      <div style={{ margin: "4px 18px 10px", padding: 14, borderRadius: 16, background: "linear-gradient(135deg, #1A1A2E, #0F3460)", color: "#fff" }}>
        <div style={{ fontSize: 10, color: "#E94560", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em" }}>GÜNÜN KOMBİNİ</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {["👕", "👖", "👟", "⌚"].map((e, i) => (
            <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{e}</div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>92%</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>uyum skoru</div>
          </div>
        </div>
      </div>
      {/* Weather */}
      <div style={{ margin: "0 18px 10px", padding: "10px 14px", borderRadius: 12, background: "#fff", border: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>☀️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>24°C, Güneşli</div>
          <div style={{ fontSize: 9, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>Hafif kıyafetler ideal</div>
        </div>
      </div>
      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, padding: "0 18px", marginBottom: 10 }}>
        {[
          { icon: "📸", label: "Yükle" },
          { icon: "🛍️", label: "Mağaza" },
          { icon: "👔", label: "Kombin" },
        ].map((a, i) => (
          <div key={i} style={{ flex: 1, padding: "12px 0", borderRadius: 14, background: "#fff", border: "1px solid #f0f0f0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>{a.label}</span>
          </div>
        ))}
      </div>
      {/* Wardrobe preview */}
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>Dolabım</div>
          <div style={{ fontSize: 10, color: "#E94560", fontFamily: "'DM Sans', sans-serif" }}>Tümünü gör →</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 48, height: 48, borderRadius: 12, background: `hsl(${i * 40 + 200}, 15%, ${88 + i * 2}%)`, border: "1px solid #eee" }} />
          ))}
          <div style={{ width: 48, height: 48, borderRadius: 12, border: "1.5px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 18 }}>+</div>
        </div>
      </div>
      {/* Bottom nav */}
      <div style={{ marginTop: "auto", height: 56, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 10px" }}>
        {[
          { icon: "🏠", label: "Ana Sayfa", active: true },
          { icon: "👗", label: "Dolap", active: false },
          { icon: "✨", label: "Kombin", active: false },
          { icon: "📸", label: "Tara", active: false },
          { icon: "👤", label: "Profil", active: false },
        ].map((n, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            <span style={{ fontSize: 8, fontWeight: n.active ? 700 : 500, color: n.active ? "#E94560" : "#aaa", fontFamily: "'DM Sans', sans-serif" }}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WardrobeScreen() {
  const cats = ["Tümü", "Üst", "Alt", "Dış", "Ayakkabı", "Aksesuar"];
  return (
    <div style={{ height: "100%", background: "#FAFAFA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginBottom: 12 }}>Dijital Dolabım</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
          {cats.map((c, i) => (
            <div key={i} style={{
              padding: "6px 14px", borderRadius: 16, whiteSpace: "nowrap",
              background: i === 0 ? "#1A1A2E" : "#fff",
              color: i === 0 ? "#fff" : "#666",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              border: i === 0 ? "none" : "1px solid #eee",
            }}>{c}</div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignContent: "start", overflowY: "auto" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            aspectRatio: "1", borderRadius: 12, background: "#fff", border: "1px solid #f0f0f0",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: "#ddd",
          }}>
            {["👕", "👖", "🧥", "👟", "👜", "🧣", "👔", "🩳", "⌚"][i]}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 18px 6px" }}>
        <div style={{ height: 44, borderRadius: 22, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", gap: 6 }}>📸 Yeni Parça Ekle</div>
      </div>
      {/* Bottom nav */}
      <div style={{ height: 56, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {["🏠", "👗", "✨", "📸", "👤"].map((n, i) => (
          <span key={i} style={{ fontSize: 16, opacity: i === 1 ? 1 : 0.4 }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

function UploadScreen() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginTop: 8, marginBottom: 16 }}>Ürün Ekle</div>
      <div style={{
        flex: 0.6, borderRadius: 20, border: "2px dashed #ddd", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 16,
        background: "#fafafa",
      }}>
        <span style={{ fontSize: 40, marginBottom: 8 }}>📸</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>Fotoğraf Çek veya Seç</div>
        <div style={{ fontSize: 10, color: "#888", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>Düz zemine ser, üstten çek</div>
      </div>
      {/* Tips */}
      <div style={{ padding: 12, borderRadius: 12, background: "#FFF9E6", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4A017", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>💡 İpuçları</div>
        <div style={{ fontSize: 10, color: "#8B7000", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
          • Doğal ışık kullan<br />
          • Düz, açık renk zemin<br />
          • Ürünü düzgün ser<br />
          • Tam üstten çek
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, height: 44, borderRadius: 22, border: "1.5px solid #1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>Galeri</div>
        <div style={{ flex: 1, height: 44, borderRadius: 22, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Kamera</div>
      </div>
    </div>
  );
}

function UploadDetail() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginTop: 8, marginBottom: 16 }}>Ürün Detayları</div>
      {/* Preview */}
      <div style={{ height: 120, borderRadius: 16, background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative" }}>
        <span style={{ fontSize: 48 }}>👕</span>
        <div style={{ position: "absolute", top: 8, right: 8, padding: "3px 10px", borderRadius: 8, background: "#00B894", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>✓ BG Temizlendi</div>
      </div>
      {/* Auto detected */}
      <div style={{ padding: 10, borderRadius: 10, background: "#f0f4ff", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#0F3460", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>🤖 AI Tespiti</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Üst Giyim", "Tişört", "Beyaz", "Düz Desen"].map((t, i) => (
            <div key={i} style={{ padding: "4px 10px", borderRadius: 8, background: "#fff", fontSize: 10, color: "#0F3460", fontFamily: "'DM Sans', sans-serif", border: "1px solid #d0d8f0" }}>{t}</div>
          ))}
        </div>
      </div>
      {/* Fabric */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>Kumaş (opsiyonel)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Pamuk", "Keten", "Polyester", "Bilmiyorum"].map((t, i) => (
            <div key={i} style={{
              padding: "6px 12px", borderRadius: 14, fontSize: 10, fontFamily: "'DM Sans', sans-serif",
              background: i === 0 ? "#1A1A2E" : "#fff", color: i === 0 ? "#fff" : "#666",
              border: i === 0 ? "none" : "1px solid #eee",
            }}>{i === 0 ? "✓ " : ""}{t}</div>
          ))}
        </div>
      </div>
      {/* Season */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>Mevsim</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["🌸 İlkbahar", "☀️ Yaz", "🍂 Sonbahar", "❄️ Kış"].map((t, i) => (
            <div key={i} style={{
              padding: "6px 10px", borderRadius: 14, fontSize: 9, fontFamily: "'DM Sans', sans-serif",
              background: i === 1 ? "#E94560" : "#fff", color: i === 1 ? "#fff" : "#666",
              border: i === 1 ? "none" : "1px solid #eee",
            }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <div style={{ height: 44, borderRadius: 22, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Dolaba Ekle ✓</div>
      </div>
    </div>
  );
}

function ComboFeed() {
  return (
    <div style={{ height: "100%", background: "#FAFAFA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Kombin Önerileri</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["Günlük", "İş", "Date", "Spor"].map((c, i) => (
            <div key={i} style={{
              padding: "6px 12px", borderRadius: 14,
              background: i === 0 ? "#E94560" : "#fff",
              color: i === 0 ? "#fff" : "#666",
              fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              border: i === 0 ? "none" : "1px solid #eee",
            }}>{c}</div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 18px", overflowY: "auto" }}>
        {[
          { score: 94, items: ["👕", "👖", "👟", "⌚"], label: "Casual Minimal" },
          { score: 87, items: ["👔", "👖", "👞", "🧥"], label: "Smart Friday" },
        ].map((combo, ci) => (
          <div key={ci} style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, border: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>{combo.label}</div>
              <div style={{ padding: "3px 10px", borderRadius: 10, background: combo.score > 90 ? "#E8FAF0" : "#FFF5E6", fontSize: 11, fontWeight: 700, color: combo.score > 90 ? "#00B894" : "#F0932B", fontFamily: "'DM Sans', sans-serif" }}>{combo.score}%</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {combo.items.map((e, i) => (
                <div key={i} style={{ width: 48, height: 48, borderRadius: 12, background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{e}</div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, height: 32, borderRadius: 16, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Bu Kombini Giy</div>
              <div style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📤</div>
            </div>
          </div>
        ))}
      </div>
      {/* Bottom nav */}
      <div style={{ height: 56, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {["🏠", "👗", "✨", "📸", "👤"].map((n, i) => (
          <span key={i} style={{ fontSize: 16, opacity: i === 2 ? 1 : 0.4 }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

function ComboCard() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif" }}>Casual Minimal</div>
        <div style={{ padding: "4px 12px", borderRadius: 10, background: "#E8FAF0", fontSize: 13, fontWeight: 700, color: "#00B894", fontFamily: "'DM Sans', sans-serif" }}>94%</div>
      </div>
      {/* Flat lay style */}
      <div style={{ flex: 1, borderRadius: 20, background: "#fafafa", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, transform: "rotate(-3deg)" }}>👕</div>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, transform: "rotate(2deg)" }}>👖</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, transform: "rotate(1deg)" }}>👟</div>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, transform: "rotate(-2deg)" }}>⌚</div>
        </div>
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", gap: 4 }}>
          {["Beyaz Tişört", "Slim Jean", "Beyaz Sneaker", "Saat"].map((t, i) => (
            <div key={i} style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.05)", fontSize: 8, color: "#555", fontFamily: "'DM Sans', sans-serif" }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 44, borderRadius: 22, background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Bu Kombini Giy ✓</div>
        <div style={{ width: 44, height: 44, borderRadius: 22, border: "1.5px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📤</div>
      </div>
    </div>
  );
}

function StoreScan() {
  return (
    <div style={{ height: "100%", background: "#000", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Camera viewfinder */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 180, height: 220, border: "2px solid rgba(233,69,96,0.6)", borderRadius: 16, position: "relative" }}>
          <div style={{ position: "absolute", top: -1, left: -1, width: 20, height: 20, borderTop: "3px solid #E94560", borderLeft: "3px solid #E94560", borderRadius: "4px 0 0 0" }} />
          <div style={{ position: "absolute", top: -1, right: -1, width: 20, height: 20, borderTop: "3px solid #E94560", borderRight: "3px solid #E94560", borderRadius: "0 4px 0 0" }} />
          <div style={{ position: "absolute", bottom: -1, left: -1, width: 20, height: 20, borderBottom: "3px solid #E94560", borderLeft: "3px solid #E94560", borderRadius: "0 0 0 4px" }} />
          <div style={{ position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderBottom: "3px solid #E94560", borderRight: "3px solid #E94560", borderRadius: "0 0 4px 0" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 48, opacity: 0.3 }}>🧥</span>
          </div>
        </div>
        <div style={{ position: "absolute", top: 16, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Mağaza Taraması</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>Ürünü çerçevenin içine al</div>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ height: 52, borderRadius: 26, background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(233,69,96,0.4)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, border: "3px solid #fff" }} />
        </div>
      </div>
    </div>
  );
}

function StoreResult() {
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", fontFamily: "'Playfair Display', serif", marginTop: 8, marginBottom: 12 }}>Uyum Analizi</div>
      {/* Product */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🧥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>Kahverengi Ceket</div>
          <div style={{ fontSize: 10, color: "#888", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Dış Giyim · Sonbahar/Kış</div>
          <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
            <div style={{ padding: "3px 10px", borderRadius: 8, background: "#E8FAF0", fontSize: 10, fontWeight: 700, color: "#00B894", fontFamily: "'DM Sans', sans-serif" }}>7 parçayla uyumlu</div>
          </div>
        </div>
      </div>
      {/* Verdict */}
      <div style={{ padding: 12, borderRadius: 14, background: "linear-gradient(135deg, #E8FAF0, #F0FFF4)", marginBottom: 12, border: "1px solid #C8F7DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#00B894", fontFamily: "'DM Sans', sans-serif" }}>Dolabına Çok Uygun!</div>
        </div>
        <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>Bu ceket, mevcut stilinle %89 uyumlu. Minimalist gardrobunun sonbahar eksiklerini tamamlıyor.</div>
      </div>
      {/* Combos */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Potansiyel Kombinler</div>
      {[
        { items: ["🧥", "👕", "👖", "👞"], score: 92 },
        { items: ["🧥", "👔", "🩳", "👟"], score: 78 },
      ].map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 12, background: "#fafafa", marginBottom: 6 }}>
          {c.items.map((e, j) => (
            <div key={j} style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "1px solid #eee" }}>{e}</div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: c.score > 85 ? "#00B894" : "#F0932B", fontFamily: "'DM Sans', sans-serif" }}>{c.score}%</div>
        </div>
      ))}
      {/* Warning */}
      <div style={{ padding: 10, borderRadius: 10, background: "#FFF5E6", marginTop: 8 }}>
        <div style={{ fontSize: 10, color: "#8B6914", fontFamily: "'DM Sans', sans-serif" }}>⚠️ Benzer fonksiyonda 1 dış giyimin var (siyah mont). Bu ceket farklı bir stili tamamlıyor.</div>
      </div>
    </div>
  );
}

function ProfileScreen() {
  return (
    <div style={{ height: "100%", background: "#FAFAFA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", background: "linear-gradient(180deg, #1A1A2E, #0F3460)", color: "#fff", borderRadius: "0 0 24px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>H</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Hasan</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>Minimal Elegance</div>
          </div>
          <div style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 10, background: "rgba(233,69,96,0.2)", color: "#E94560", fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Ücretsiz</div>
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {[{ n: "23", l: "Parça" }, { n: "12", l: "Kombin" }, { n: "89%", l: "Uyum" }].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>{s.n}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "14px 18px", flex: 1 }}>
        {[
          { icon: "🎨", label: "Stil DNA Kartım" },
          { icon: "📊", label: "Dolap İstatistikleri" },
          { icon: "📅", label: "Stil Günlüğüm" },
          { icon: "⭐", label: "Premium'a Geç", accent: true },
          { icon: "⚙️", label: "Ayarlar" },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 0",
            borderBottom: i < 4 ? "1px solid #f0f0f0" : "none",
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 13, fontWeight: item.accent ? 700 : 500, color: item.accent ? "#E94560" : "#1A1A2E", fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
            <span style={{ marginLeft: "auto", color: "#ccc", fontSize: 14 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumScreen() {
  return (
    <div style={{ height: "100%", background: "linear-gradient(180deg, #1A1A2E 0%, #0F3460 40%, #E94560 100%)", display: "flex", flexDirection: "column", padding: 20, color: "#fff" }}>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", marginBottom: 4 }}>PREMIUM</div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>Stilini Sınırsız Yaşa</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
        {[
          "♾️ Limitsiz gardrob",
          "🤖 AI Stil Danışmanı",
          "🛍️ Sınırsız mağaza analizi",
          "🌤️ Hava durumu önerileri",
          "✈️ Seyahat & bavul planlama",
          "📈 Trend raporları",
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            <span style={{ fontSize: 14 }}>{f.split(" ")[0]}</span>
            <span style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{f.split(" ").slice(1).join(" ")}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>₺99.99<span style={{ fontSize: 12, fontWeight: 400 }}>/ay</span></div>
        </div>
        <div style={{ padding: 14, borderRadius: 16, background: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#E94560", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>EN POPÜLER</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Sans', sans-serif", color: "#1A1A2E" }}>₺799.99<span style={{ fontSize: 12, fontWeight: 400, color: "#888" }}>/yıl</span></div>
          <div style={{ fontSize: 10, color: "#00B894", fontFamily: "'DM Sans', sans-serif" }}>%33 tasarruf</div>
        </div>
      </div>
    </div>
  );
}

const screenComponents = {
  splash: SplashScreen,
  onboarding_welcome: OnboardingWelcome,
  signup: SignupScreen,
  style_choice: StyleChoice,
  style_direct: StyleDirect,
  style_quiz: StyleQuiz,
  style_explore: StyleExplore,
  style_result: StyleResult,
  home: HomeScreen,
  wardrobe: WardrobeScreen,
  upload: UploadScreen,
  upload_detail: UploadDetail,
  combo_feed: ComboFeed,
  combo_card: ComboCard,
  store_scan: StoreScan,
  store_result: StoreResult,
  profile: ProfileScreen,
  premium: PremiumScreen,
};

export default function App() {
  const [activeFlow, setActiveFlow] = useState("onboarding");
  const [activeScreen, setActiveScreen] = useState(null);

  const currentFlow = flows.find(f => f.id === activeFlow);
  const displayScreens = activeScreen ? [activeScreen] : currentFlow.screens;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F3F0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "32px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#1A1A2E" }}>Ne Giysem?</span>
          <span style={{ fontSize: 14, color: "#E94560", fontStyle: "italic", fontFamily: "'Playfair Display', serif" }}>UI / UX Wireframes</span>
        </div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Akış seç, ekranları keşfet. Tek ekrana tıkla detaylı görüntüle.</div>

        {/* Flow tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {flows.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFlow(f.id); setActiveScreen(null); }}
              style={{
                padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                background: activeFlow === f.id ? f.color : "#fff",
                color: activeFlow === f.id ? "#fff" : "#555",
                fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                boxShadow: activeFlow === f.id ? `0 4px 16px ${f.color}33` : "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.2s ease",
              }}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Flow connector */}
        {!activeScreen && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {currentFlow.screens.map((s, i) => (
              <React.Fragment key={s}>
                <button
                  onClick={() => setActiveScreen(s)}
                  style={{
                    padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${currentFlow.color}40`,
                    background: `${currentFlow.color}08`, color: currentFlow.color,
                    fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  }}
                >
                  {screens[s].label}
                </button>
                {i < currentFlow.screens.length - 1 && (
                  <span style={{ color: currentFlow.color, fontSize: 10, opacity: 0.5 }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {activeScreen && (
          <button
            onClick={() => setActiveScreen(null)}
            style={{
              padding: "6px 14px", borderRadius: 10, border: "1.5px solid #ddd", background: "#fff",
              fontSize: 11, fontWeight: 600, color: "#555", fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", marginBottom: 8,
            }}
          >
            ← Tüm akışa dön
          </button>
        )}
      </div>

      {/* Screens */}
      <div style={{
        padding: "20px 32px 40px", maxWidth: 1200, margin: "0 auto",
        display: "flex", gap: 24, overflowX: "auto", paddingBottom: 40,
      }}>
        {displayScreens.map((screenId, idx) => {
          const Comp = screenComponents[screenId];
          return (
            <div key={screenId} style={{ cursor: activeScreen ? "default" : "pointer" }} onClick={() => !activeScreen && setActiveScreen(screenId)}>
              <PhoneFrame title={screens[screenId].title}>
                <Comp />
              </PhoneFrame>
              {!activeScreen && idx < displayScreens.length - 1 && (
                <div style={{ display: "none" }} /> // spacing handled by gap
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

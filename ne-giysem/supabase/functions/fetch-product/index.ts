// supabase/functions/fetch-product/index.ts
//
// Ürün linkinden og:image görselini SUNUCUDA bulup indirir, base64 döner.
// Cihaz IP'si ürün sitesine gitmez; üçüncü taraf açık proxy'ler (codetabs,
// thingproxy) kaldırıldı.
//
// SSRF koruması: yalnızca http/https + 80/443; host DNS ile çözülür ve
// private/loopback/link-local/metadata/CGNAT/multicast adresleri reddedilir;
// yönlendirmeler elle izlenir (en fazla 3) ve HER adımda aynı kontrol yapılır.
// Kalan risk: DNS rebinding — kontrol ile fetch'in kendi çözümlemesi arasında
// adres değişebilir (fetch'e IP veremeyiz; TLS SNI bozulur).

import { adminClient, requireUser, bumpUsage, json, CORS } from "../_shared/auth.ts";

// ─── Sınırlar (tek yer) ──────────────────────────────────────────────────────
const DAILY_CAP     = 60;
const TIMEOUT_MS    = 10_000;            // tüm istek (sayfa + görsel) için
const MAX_BYTES     = 5 * 1024 * 1024;   // sayfa ve görsel ayrı ayrı
const MAX_REDIRECTS = 3;
const MAX_URL_LEN   = 2048;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

class FetchFail extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

// ─── IP sınıflandırma ────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((n) => n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

// [ağ, önek uzunluğu] — genel internete ait OLMAYAN IPv4 blokları
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16],               // link-local + bulut metadata (169.254.169.254)
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],  // multicast + ayrılmış (255.255.255.255 dahil)
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return V4_BLOCKED.some(([net, bits]) => {
    const base = ipv4ToInt(net)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((base & mask) >>> 0);
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  // Sonu gömülü IPv4 ise (::ffff:1.2.3.4) iki 16-bit gruba çevir
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    if (n === null) return null;
    s = s.slice(0, -v4[1].length) + ((n >>> 16).toString(16)) + ":" + ((n & 0xffff).toString(16));
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function isBlockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const allZeroUntil = (k: number) => g.slice(0, k).every((x) => x === 0);
  if (allZeroUntil(8)) return true;                                   // ::
  if (allZeroUntil(7) && g[7] === 1) return true;                     // ::1
  // IPv4-mapped (::ffff:a.b.c.d) / NAT64 (64:ff9b::a.b.c.d) → gömülü IPv4'e göre
  const embedded = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (allZeroUntil(5) && g[5] === 0xffff) return isBlockedV4(embedded());
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedV4(embedded());
  if ((g[0] & 0xfe00) === 0xfc00) return true;                        // fc00::/7 ULA (AWS fd00:ec2::254)
  if ((g[0] & 0xffc0) === 0xfe80) return true;                        // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                        // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                // 2001:db8::/32 dokümantasyon
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 discard
  return false;
}

const isIPv4 = (h: string) => ipv4ToInt(h) !== null;
const isIPv6 = (h: string) => h.includes(":");

// ─── DNS ─────────────────────────────────────────────────────────────────────

async function resolveHost(host: string): Promise<string[]> {
  const out: string[] = [];
  // deno-lint-ignore no-explicit-any
  const resolveDns = (Deno as any).resolveDns as undefined | ((h: string, t: string) => Promise<string[]>);
  if (typeof resolveDns === "function") {
    for (const type of ["A", "AAAA"]) {
      try { out.push(...await resolveDns(host, type)); } catch { /* kayıt yok */ }
    }
  }
  // Çalışma ortamında resolveDns yoksa / boş döndüyse: DNS-over-HTTPS
  if (!out.length) {
    for (const type of ["A", "AAAA"]) {
      try {
        const r = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
          { headers: { accept: "application/dns-json" } },
        );
        const j = await r.json();
        for (const a of j?.Answer ?? []) {
          if ((a.type === 1 || a.type === 28) && typeof a.data === "string") out.push(a.data);
        }
      } catch { /* yok */ }
    }
  }
  return out;
}

/** URL'yi doğrula: şema, port, kimlik bilgisi, ve hostun TÜM adresleri genel internette mi */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FetchFail(400, "invalid-url"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchFail(400, "invalid-url");
  if (url.username || url.password) throw new FetchFail(400, "invalid-url");
  if (!ALLOWED_PORTS.has(url.port)) throw new FetchFail(400, "blocked-host");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchFail(400, "blocked-host");
  }

  const addrs = isIPv4(host) || isIPv6(host) ? [host] : await resolveHost(host);
  if (!addrs.length) throw new FetchFail(400, "blocked-host");
  for (const a of addrs) {
    if (isIPv4(a) ? isBlockedV4(a) : isBlockedV6(a)) {
      console.error(`[fetch-product] engellendi host=${host} addr=${a}`);
      throw new FetchFail(400, "blocked-host");
    }
  }
  return url;
}

/** Yönlendirmeleri elle izle — her adımda assertSafeUrl */
async function safeFetch(raw: string, accept: string, signal: AbortSignal): Promise<{ res: Response; url: URL }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        accept,
        // Bazı mağazalar bot UA'larını reddediyor; sıradan tarayıcı başlığı
        "user-agent": "Mozilla/5.0 (compatible; SestinaBot/1.0; +https://sestinaapp.com)",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new FetchFail(502, "upstream-error");
      current = new URL(loc, url).toString();
      continue;
    }
    return { res, url };
  }
  throw new FetchFail(400, "too-many-redirects");
}

/** Gövdeyi MAX_BYTES'a kadar oku (Content-Length yalan söyleyebilir → akışta say) */
async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) { await res.body?.cancel(); throw new FetchFail(413, "too-large"); }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await reader.cancel(); throw new FetchFail(413, "too-large"); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ─── og:image ────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method-not-allowed" }, 405);

  try {
    const admin = adminClient();
    const user  = await requireUser(req, admin);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const raw  = body?.url;
    if (typeof raw !== "string" || !raw.trim() || raw.length > MAX_URL_LEN) {
      return json({ error: "invalid-url" }, 400);
    }

    if (!(await bumpUsage(admin, user.id, "fetch_product", DAILY_CAP))) {
      return json({ error: "daily-limit" }, 429);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // 1) Sayfa
      const page = await safeFetch(raw.trim(), "text/html,application/xhtml+xml", controller.signal);
      if (!page.res.ok) { await page.res.body?.cancel(); throw new FetchFail(502, "upstream-error"); }
      const html = new TextDecoder().decode(await readCapped(page.res));

      const meta = extractMetaImage(html);
      if (!meta) throw new FetchFail(404, "og-image-not-found");
      // Göreli og:image → son (yönlendirme sonrası) sayfa adresine göre çöz
      const imageUrl = new URL(meta, page.url).toString();

      // 2) Görsel — aynı SSRF kontrolleriyle
      const img = await safeFetch(imageUrl, "image/*", controller.signal);
      if (!img.res.ok) { await img.res.body?.cancel(); throw new FetchFail(502, "upstream-error"); }
      const type = (img.res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!type.startsWith("image/")) { await img.res.body?.cancel(); throw new FetchFail(415, "not-an-image"); }
      const bytes = await readCapped(img.res);

      return json({ image_b64: toBase64(bytes), content_type: type });
    } catch (e) {
      if (e instanceof FetchFail) return json({ error: e.code }, e.status);
      if (e instanceof DOMException && e.name === "AbortError") return json({ error: "timeout" }, 504);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error("[fetch-product]", e);
    return json({ error: "upstream-error" }, 502);
  }
});

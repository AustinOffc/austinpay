// Vercel Edge Middleware — pengganti peran Express untuk sisi halaman.
//
// Backend lama (src/server.js) melakukan beberapa hal saat menyajikan HTML. Sekarang HTML
// disajikan statis oleh Vercel, jadi file ini mereplikasinya di edge:
//   1. Menyisipkan nonce ke setiap <script> inline + header Content-Security-Policy
//      (termasuk hash untuk atribut event-handler inline seperti onclick="...").
//   2. Menolak akses langsung ke *.html mentah (hanya clean URL: /dashboard, bukan /dashboard.html).
//   3. redirectIfAuth: user yang sudah login membuka /login, /register, /verify-email,
//      /forgot-password diarahkan ke /dashboard (admin ke /austinganteng).
//   4. Mode maintenance: halaman "Maintenance" untuk non-admin saat maintenance_mode aktif.
//   5. Status 404 untuk path yang tidak dikenal (isi halaman tetap 404.html).
//   6. (Opsional) Meneruskan /api/* ke backend sambil menyertakan IP asli user, untuk klien yang
//      masih memanggil https://austinstore.id/api/... (aplikasi Flutter, integrator API key,
//      webhook provider). Tanpa ini backend hanya melihat IP Vercel.
//
// ENV di project Vercel:
//   JWT_SECRET    -> HARUS SAMA PERSIS dengan JWT_SECRET backend (config/settings.js).
//   API_BASE_URL  -> domain backend, mis. https://api.austinstore.id (untuk CSP & proxy).
//   PROXY_SECRET  -> HARUS SAMA dengan VERCEL_PROXY_SECRET di backend (opsional, lihat poin 6).
//
// Ini HANYA gerbang tampilan (UX). Proteksi data sesungguhnya tetap 100% di tiap endpoint
// /api/* backend (requireAuth/requireAdmin dengan cek DB penuh) yang tidak berubah.

import { next } from '@vercel/edge';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';
const API_BASE_URL = (process.env.API_BASE_URL || 'https://austinstore.id').replace(/\/+$/, '');
const PROXY_SECRET = process.env.PROXY_SECRET || '';
const encodedSecret = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

// Peta halaman sama dengan vercel.json (dan dengan `pages` di server.js lama).
const PAGE_ROUTES = new Set([
  '/', '/login', '/register', '/verify-email', '/forgot-password', '/verify-pin', '/set-pin',
  '/dashboard', '/saweria', '/cekmutasi', '/riwayat-mutasi', '/deposit', '/withdraw', '/history',
  '/overview', '/leaderboard', '/profile', '/webhook', '/api-settings', '/notification',
  '/download-apk', '/feedback', '/penghargaan', '/api-docs',
  '/austinganteng', '/austinganteng/users', '/austinganteng/deposits', '/austinganteng/withdraws',
  '/austinganteng/transactions', '/austinganteng/settings', '/austinganteng/logs',
  '/austinganteng/api-keys', '/austinganteng/ip-whitelist', '/austinganteng/notifications',
  '/austinganteng/feedback', '/austinganteng/saweria', '/austinganteng/tickets',
]);

// Halaman yang dialihkan kalau user sudah login (redirectIfAuth di backend lama).
const REDIRECT_IF_AUTH = new Set(['/login', '/register', '/verify-email', '/forgot-password']);

// Halaman yang tetap bisa dibuka saat maintenance (sama dengan checkMaintenance di backend).
const MAINTENANCE_ALLOWED_PREFIXES = ['/login', '/verify-email', '/forgot-password', '/austinganteng'];

const MAX_PROXY_BODY_BYTES = 4 * 1024 * 1024;

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

async function getRole(req) {
  if (!encodedSecret) return null;
  const token = getCookie(req, 'auth_token');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload.role || 'user';
  } catch {
    return null;
  }
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Hash SHA-256 (base64) untuk setiap atribut event-handler inline di HTML yang AKAN disajikan.
// Dihitung langsung dari body response (file statis kita sendiri), jadi tidak ada daftar hash
// yang bisa basi dan tiap halaman hanya membawa hash miliknya.
const HANDLER_ATTR_RE = /\son[a-z]+="([^"]*)"/gi;
const hashMemo = new Map();

function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function sha256Base64(text) {
  if (hashMemo.has(text)) return hashMemo.get(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let bin = '';
  for (const b of digest) bin += String.fromCharCode(b);
  const out = btoa(bin);
  if (hashMemo.size < 2000) hashMemo.set(text, out);
  return out;
}

async function inlineHandlerHashes(html) {
  const bodies = new Set();
  HANDLER_ATTR_RE.lastIndex = 0;
  let m;
  while ((m = HANDLER_ATTR_RE.exec(html)) !== null) {
    if (!m[1]) continue;
    bodies.add(m[1]);
    bodies.add(decodeEntities(m[1]));
  }
  const hashes = [];
  for (const body of bodies) hashes.push(`'sha256-${await sha256Base64(body)}'`);
  return hashes;
}

function cspHeader(nonce, handlerHashes) {
  const scriptSrcAttr = handlerHashes.length
    ? `script-src-attr 'unsafe-hashes' ${handlerHashes.join(' ')}`
    : "script-src-attr 'none'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' cdn.jsdelivr.net cdnjs.cloudflare.com static.cloudflareinsights.com challenges.cloudflare.com`,
    scriptSrcAttr,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net",
    "font-src 'self' fonts.gstatic.com cdn.jsdelivr.net data:",
    "img-src 'self' data: https:",
    `connect-src 'self' ${API_BASE_URL} https://austinstore.id ws: wss: challenges.cloudflare.com`,
    "frame-src 'self' challenges.cloudflare.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

// ── Maintenance ──
// Backend memblokir /api/public/branding dengan 503 saat maintenance_mode aktif, jadi
// endpoint itu dipakai sebagai probe (di-cache singkat supaya tidak menambah latensi tiap halaman).
let maintenanceCache = { at: 0, value: false };
async function isMaintenance() {
  const now = Date.now();
  if (now - maintenanceCache.at < 10000) return maintenanceCache.value;
  let value = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/api/public/branding`, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    value = res.status === 503;
  } catch {
    value = false; // backend tidak terjangkau: jangan menampilkan "maintenance" palsu
  }
  maintenanceCache = { at: now, value };
  return value;
}

const MAINTENANCE_HTML = `
      <!DOCTYPE html><html><head><title>Maintenance</title>
      <style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column}
      h1{font-size:3rem;margin-bottom:1rem}p{color:#94a3b8;font-size:1.1rem}</style></head>
      <body><h1>🔧</h1><h1>Maintenance</h1><p>Sistem sedang dalam pemeliharaan. Silakan kembali nanti.</p></body></html>
    `;

// ── Proxy /api/* ke backend dengan IP asli user (lihat poin 6 di atas) ──
function clientIpOf(req) {
  // Vercel menimpa header ini dengan IP klien sebenarnya (tidak bisa dipalsukan dari luar).
  return (
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    ''
  );
}

async function proxyToBackend(req, url) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const declaredLen = Number(req.headers.get('content-length') || 0);
  // Body besar (mis. unggah file dari aplikasi): serahkan ke rewrite biasa di vercel.json.
  if (hasBody && declaredLen > MAX_PROXY_BODY_BYTES) return next();

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('x-austin-proxy-secret');
  headers.delete('x-austin-client-ip');
  headers.set('x-austin-proxy-secret', PROXY_SECRET);
  headers.set('x-austin-client-ip', clientIpOf(req));

  const upstream = await fetch(`${API_BASE_URL}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  // fetch() sudah men-decompress body -> buang header yang tidak lagi cocok.
  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  out.delete('connection');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    if (PROXY_SECRET) {
      try {
        return await proxyToBackend(req, url);
      } catch {
        return new Response(JSON.stringify({ success: false, message: 'Server tidak dapat dihubungi.' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return next(); // tanpa PROXY_SECRET: rewrite biasa di vercel.json
  }

  // Sama seperti backend lama: tolak akses langsung ke *.html mentah.
  if (pathname.toLowerCase().endsWith('.html')) {
    return new Response('Not Found', { status: 404 });
  }

  const isKnownPage = PAGE_ROUTES.has(pathname);

  if (isKnownPage) {
    const role = await getRole(req);

    // redirectIfAuth. Dilewati kalau ada ?err= (mis. akun disuspend) atau datang dari halaman
    // lain situs ini (mis. dashboard melempar balik ke /login karena sesi ditolak backend),
    // supaya tidak terjadi loop redirect pada token yang masih valid tanda tangannya tapi
    // sudah dicabut di database.
    if (REDIRECT_IF_AUTH.has(pathname) && role && !url.searchParams.has('err')) {
      let sameSiteReferer = false;
      const ref = req.headers.get('referer');
      if (ref) {
        try { sameSiteReferer = new URL(ref).origin === url.origin; } catch { /* abaikan */ }
      }
      if (!sameSiteReferer) {
        return Response.redirect(new URL(role === 'admin' ? '/austinganteng' : '/dashboard', req.url), 302);
      }
    }

    // Mode maintenance (non-admin).
    if (!MAINTENANCE_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p)) && role !== 'admin') {
      if (await isMaintenance()) {
        return new Response(MAINTENANCE_HTML, {
          status: 503,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
    }
  }

  const res = await next();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  const nonce = randomNonce();
  const html = await res.text();
  const withNonce = html.split('<script>').join(`<script nonce="${nonce}">`);
  const handlerHashes = await inlineHandlerHashes(withNonce);

  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.set('Content-Security-Policy', cspHeader(nonce, handlerHashes));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Path yang tidak dikenal dilayani 404.html lewat rewrite catch-all; beri status 404 yang benar.
  const status = !isKnownPage && !pathname.includes('.') ? 404 : res.status;
  return new Response(withNonce, { status, headers });
}

export const config = {
  // Jalan di semua path KECUALI aset statis dan path yang diproxy langsung oleh vercel.json
  // (CDN font-awesome, uploads, socket.io, unduh APK, halaman "Bukan saya").
  matcher: ['/((?!css/|js/|img/|uploads/|fa/|socket\\.io|download/|not-me/|favicon|sw\\.js|manifest\\.json).*)'],
};

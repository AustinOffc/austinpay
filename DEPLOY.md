# Frontend AustinPay di Vercel

Folder ini hanya berisi frontend statis (`public/`), `vercel.json`, dan `middleware.js`.
Backend ada di folder `backend/` (Pterodactyl). Tampilan dan cara kerja halaman tidak diubah.

## Yang diubah dari versi lama
- `public/js/app.js` baris paling atas: `window.API_BASE_URL` = domain backend. Semua `fetch('/api/...')`,
  `API.get/post/put/delete`, dan koneksi Socket.IO (`io(window.API_BASE_URL, ...)`) otomatis memakai domain ini.
- `vercel.json` menggantikan peta halaman `server.js` lama (clean URL `/dashboard`, `/austinganteng/users`, dst).
  Juga meneruskan `/uploads`, `/download/apk`, `/not-me/:token`, `/api`, `/socket.io` ke backend,
  dan `/fa/*` (Font Awesome) ke CDN supaya URL di semua halaman tetap sama.
- `middleware.js` (Edge) menggantikan peran Express untuk: nonce + CSP (hash handler inline dihitung otomatis dari HTML),
  tolak `*.html` mentah, `redirectIfAuth`, halaman Maintenance, status 404, dan (opsional) meneruskan `/api/*`
  dengan IP asli user.

## Langkah deploy
1. Buat project Vercel baru, **Root Directory = folder `frontend/` ini**. Framework preset: Other. Tanpa build command.
2. Environment Variables di Vercel:
   | Nama | Isi |
   |---|---|
   | `JWT_SECRET` | **Sama persis** dengan `JWT_SECRET` di `backend/config/settings.js` |
   | `API_BASE_URL` | `https://api.austinstore.id` (domain backend) |
   | `PROXY_SECRET` | String acak, **sama persis** dengan `VERCEL_PROXY_SECRET` di backend (sangat disarankan, lihat di bawah) |
3. Ganti domain backend kalau bukan `api.austinstore.id`. Ada 3 tempat:
   - `public/js/app.js` → `window.API_BASE_URL`
   - `vercel.json` → semua `destination` yang berawalan `https://api.austinstore.id`
   - env `API_BASE_URL` di Vercel
4. Deploy dulu ke `namaproyek.vercel.app`, uji login dan dashboard. Origin `*.vercel.app` sudah diizinkan backend.
   Catatan: cookie sesi memakai `Domain=.austinstore.id`, jadi login dari `*.vercel.app` baru berfungsi
   penuh setelah domain custom terpasang. Untuk uji awal bisa isi `COOKIE_DOMAIN=` (kosong) di backend sementara.
5. Pasang domain `austinstore.id` (dan `www`) di Project Settings → Domains, lalu ubah DNS sesuai record
   yang ditampilkan Vercel. Kalau DNS tetap di Cloudflare, record ke Vercel harus **DNS only (awan abu-abu)**,
   sedangkan `api.austinstore.id` dibuat otomatis oleh Cloudflare Tunnel (proxied).

## Kenapa `PROXY_SECRET` penting
Aplikasi Flutter, integrator API key, dan webhook provider masih memanggil `https://austinstore.id/api/...`.
Request itu lewat Vercel, sehingga tanpa `PROXY_SECRET` backend hanya melihat IP Vercel. Akibatnya IP whitelist API key,
rate limit per-IP, dan catatan IP login jadi salah. Dengan `PROXY_SECRET` (di Vercel) + `VERCEL_PROXY_SECRET` (di backend)
yang sama, middleware meneruskan IP asli dan backend mempercayainya. Browser web tidak terpengaruh karena memanggil
domain backend langsung.
Request dengan body lebih dari 4 MB (mis. unggah foto besar dari aplikasi) otomatis memakai rewrite biasa tanpa IP asli.

## Setelah menambah halaman baru
Tambahkan di tiga tempat: file `public/<nama>.html`, rewrite di `vercel.json`, dan `PAGE_ROUTES` di `middleware.js`.

## Hal yang perlu dicek sendiri
- API Edge Middleware Vercel berubah cukup sering. Cocokkan import `@vercel/edge` dengan dokumentasi resmi (pola ini sama dengan frontend Marketplace).
- Buka DevTools Console setelah deploy dan pastikan tidak ada error CSP ("Refused to execute inline ...").

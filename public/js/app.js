// ==== Konfigurasi backend (frontend Vercel <-> backend Pterodactyl + tunnel) ====
// Frontend & backend sekarang dua origin berbeda, jadi setiap panggilan
// '/api/...' dibuat absolut ke domain backend (lewat Cloudflare Tunnel, HTTPS).
// Ini SATU-SATUNYA tempat yang perlu diubah kalau domain backend berganti
// (selain rewrite di vercel.json dan env API_BASE_URL di Vercel).
//   - Diisi domain backend (mis. https://austinstore.id)  -> mode langsung (disarankan)
//   - Dikosongkan ''                                          -> semua /api lewat rewrite Vercel
window.API_BASE_URL = 'https://austinstore.id'; // GANTI sesuai domain tunnel backend Anda
function apiUrl(path) {
  if (!path) return window.API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path; // sudah URL absolut, biarkan
  return window.API_BASE_URL.replace(/\/$/, '') + path;
}
window.apiUrl = apiUrl;


// Server menahan sesi dengan HTTP 423 + code:
//  - PIN_REQUIRED       : idle > 24 jam, cukup masukkan PIN (bukan logout)
//  - PIN_SETUP_REQUIRED : user belum punya PIN, wajib buat PIN
const PIN_GATE_PAGES = { PIN_REQUIRED: '/verify-pin', PIN_SETUP_REQUIRED: '/set-pin' };

function handlePinGate(data) {
  if (!data || data.success !== false || !PIN_GATE_PAGES[data.code]) return false;
  const target = PIN_GATE_PAGES[data.code];
  if (window.location.pathname !== target) window.location.href = target;
  return true;
}

const API = {
  async request(method, url, data = null) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };
      if (data) opts.body = JSON.stringify(data);
      const res = await fetch(apiUrl(url), opts);
      const json = await res.json();
      if (handlePinGate(json)) json.pin_gate = true;
      return json;
    } catch (err) {
      return { success: false, message: 'Koneksi gagal. Periksa jaringan.' };
    }
  },
  get: (url) => API.request('GET', url),
  post: (url, data) => API.request('POST', url, data),
  put: (url, data) => API.request('PUT', url, data),
  delete: (url) => API.request('DELETE', url),
};

const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      danger:  '<i class="fas fa-times-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info:    '<i class="fas fa-info-circle"></i>',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '<i class="fa-solid fa-bell"></i>'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all .3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'danger'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info'),
};

function formatRupiah(amount, withPrefix = true) {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('id-ID');
  return withPrefix ? `Rp ${formatted}` : formatted;
}

function formatDate(iso, withTime = true) {
  if (!iso) return '-';
  const d = new Date(iso);
  const opts = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleString('id-ID', opts);
}

function statusBadge(status) {
  const map = {
    pending:   ['badge-warning',   'Pending'],
    paid:      ['badge-success',   'Berhasil'],
    success:   ['badge-success',   'Berhasil'],
    failed:    ['badge-danger',    'Gagal'],
    rejected:  ['badge-danger',    'Ditolak'],
    expired:   ['badge-secondary', 'Expired'],
    cancel:    ['badge-secondary', 'Dibatalkan'],
    diproses:  ['badge-info',      'Diproses'],
    processing:['badge-info',      'Diproses'],
    active:    ['badge-success',   'Aktif'],
    suspended: ['badge-danger',    'Suspend'],
  };
  const [cls, label] = map[status] || ['badge-secondary', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

const Theme = {
  // Warna bar status & address bar browser ikut warna latar halaman (tidak putih/terpotong)
  _updateMeta(theme) {
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = theme === 'dark' ? '#0b1612' : '#c9f3e4';
  },
  init() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this._updateIcon(saved);
    this._updateMeta(saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this._updateIcon(next);
    this._updateMeta(next);
  },
  _updateIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  },
};

const Sidebar = {
  init() {
    const toggle  = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    // Menu Cek Mutasi & Riwayat Mutasi disisipkan otomatis ke semua halaman user
    const nav = document.querySelector('.sidebar-nav');
    if (nav && !nav.querySelector('.nav-item[data-href="/cekmutasi"]') && !document.getElementById('admin-nav')) {
      let last = nav.querySelector('.nav-item[data-href="/history"]');
      [['/cekmutasi', 'fa-magnifying-glass-dollar', 'Cek Mutasi'], ['/riwayat-mutasi', 'fa-list-check', 'Riwayat Mutasi']].forEach(([href, icon, label]) => {
        const el = document.createElement('div');
        el.className = 'nav-item';
        el.setAttribute('data-href', href);
        el.innerHTML = `<span class="nav-icon"><i class="fas ${icon}"></i></span> ${label}`;
        if (last && last.parentNode) last.parentNode.insertBefore(el, last.nextSibling);
        else nav.appendChild(el);
        last = el;
      });
    }

    const path = window.location.pathname;
    document.querySelectorAll('.nav-item[data-href]').forEach(item => {
      const href = item.getAttribute('data-href');
      if (path === href || (href !== '/' && path.startsWith(href))) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => { window.location.href = href; });
    });
  },
};

const Auth = {
  currentUser: null,
  async check(role = null) {
    const res = await API.get('/api/auth/me');
    if (!res.success) {
      // Sesi terkunci PIN: API sudah mengarahkan ke /verify-pin atau /set-pin, jangan ke /login.
      if (res.pin_gate) return false;
      window.location.href = '/login';
      return false;
    }
    this.currentUser = res.user;
    if (role && res.user.role !== role) {
      window.location.href = role === 'admin' ? '/dashboard' : '/login';
      return false;
    }
    return res;
  },
  async logout() {
    await API.post('/api/auth/logout');
    window.location.href = '/login';
  },
  renderUserInfo(user, wallet) {
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.full_name || user.username);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role === 'admin' ? 'Administrator' : 'Member');
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="">`;
      } else {
        el.textContent = (user.full_name || user.username)[0].toUpperCase();
      }
    });
    if (wallet) {
      document.querySelectorAll('[data-balance]').forEach(el => el.textContent = formatRupiah(wallet.balance));
    }
  },
};

const Heartbeat = {
  KEY: 'apg_last_active_at',
  _started: false,

  checkOffline(thresholdMs = 10 * 60 * 1000) {
    let last = null;
    try { last = parseInt(localStorage.getItem(this.KEY), 10); } catch (e) {}
    const now = Date.now();
    const wasOffline = !last || isNaN(last) || (now - last) > thresholdMs;
    this.touch();
    return wasOffline;
  },

  touch() {
    try { localStorage.setItem(this.KEY, String(Date.now())); } catch (e) {}
  },

  start() {
    if (this._started) return;
    this._started = true;
    setInterval(() => this.touch(), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.touch(); });
  },
};

// [BARU] Penanda "baru saja login/daftar". Diset di halaman login/register
// sebelum redirect, lalu dikonsumsi (sekali pakai) di dashboard untuk
// menentukan apakah alur banner + notif install APK perlu ditampilkan.
// Pakai sessionStorage + timestamp supaya tidak "nyangkut" kalau tidak
// sempat dikonsumsi (mis. akun admin yang di-redirect ke halaman lain).
const FreshLogin = {
  KEY: 'apg_fresh_login',
  mark() {
    try { sessionStorage.setItem(this.KEY, String(Date.now())); } catch (e) {}
  },
  consume(maxAgeMs = 2 * 60 * 1000) {
    try {
      const v = parseInt(sessionStorage.getItem(this.KEY), 10);
      sessionStorage.removeItem(this.KEY);
      return !isNaN(v) && (Date.now() - v) <= maxAgeMs;
    } catch (e) { return false; }
  },
};

// [BARU] Helper untuk fitur unduh aplikasi Android (APK).
const ApkPromo = {
  DOWNLOAD_URL: '/download/apk',
  // { ok, apk } — ok=false artinya request gagal (jaringan/maintenance),
  // bukan berarti APK tidak ada. apk=null + ok=true berarti belum diupload.
  async getInfo() {
    try {
      const res = await fetch(apiUrl('/api/apk'), { credentials: 'include' });
      const data = await res.json();
      if (data && data.success) return { ok: true, apk: data.apk || null };
    } catch (e) {}
    return { ok: false, apk: null };
  },
  // Tombol "Unduh Aplikasi Android" di halaman login/daftar: tampil default,
  // disembunyikan hanya kalau server memastikan APK memang belum tersedia.
  async initAuthButton(wrapSelector = '[data-apk-wrap]') {
    const wrap = document.querySelector(wrapSelector);
    if (!wrap) return;
    const info = await this.getInfo();
    if (info.ok && !info.apk) wrap.style.display = 'none';
  },
};

function renderPagination(containerId, current, total, onPage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (total <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
      if (i === current - 3 || i === current + 3) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = html;

  container._onPage = onPage;
  if (!container._paginationBound) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute('data-page'));
      if (!Number.isNaN(page) && page >= 1 && typeof container._onPage === 'function') {
        container._onPage(page);
      }
    });
    container._paginationBound = true;
  }
}

const Modal = {
  open(id) { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
};
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

function btnLoading(btn, loading) {
  if (loading) { btn.classList.add('btn-loading'); btn.disabled = true; }
  else         { btn.classList.remove('btn-loading'); btn.disabled = false; }
}

const AppLogo = {
  async init() {
    try {
      const res = await fetch(apiUrl('/api/public/branding'), { credentials: 'include' });
      const data = await res.json();
      if (!data.success) return;
      if (data.app_logo) {
        document.querySelectorAll('.logo-icon, .brand-icon').forEach(el => {
          el.innerHTML = `<img src="${data.app_logo}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
        });
      }
      if (data.app_name) {
        document.title = document.title.replace(/AustinPay|Austin Pay/i, data.app_name);
        document.querySelectorAll('.sidebar-logo span').forEach(el => { el.textContent = data.app_name; });
      }
    } catch {}
  },
};

const Notifications = {
  panelEl: null,
  async init() {
    const bell = document.getElementById('notif-bell');
    if (!bell) return;
    this._buildPanel();
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.addEventListener('click', (e) => {
      if (this.panelEl && !this.panelEl.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
        this.panelEl.classList.remove('open');
      }
    });
    await this.refresh();
    setInterval(() => this.refresh(), 30000);
  },
  _buildPanel() {
    const wrap = document.createElement('div');
    wrap.id = 'notif-panel';
    wrap.className = 'notif-panel';
    wrap.innerHTML = `
      <div class="notif-panel-header">
        <span>Notifikasi</span>
        <button type="button" class="notif-mark-all">Tandai semua dibaca</button>
      </div>
      <div class="notif-panel-list" id="notif-panel-list"><div class="notif-empty">Memuat...</div></div>
    `;
    document.body.appendChild(wrap);
    this.panelEl = wrap;
    wrap.querySelector('.notif-mark-all').addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.post('/api/user/notifications/read-all');
      this.refresh();
    });
  },
  toggle() {
    if (!this.panelEl) return;
    const bell = document.getElementById('notif-bell');
    const rect = bell.getBoundingClientRect();

    const panelWidth = Math.min(340, window.innerWidth - 16);

    const maxRight = window.innerWidth - panelWidth - 8;
    const desiredRight = window.innerWidth - rect.right;
    const right = Math.min(Math.max(desiredRight, 8), Math.max(maxRight, 8));
    this.panelEl.style.top = `${rect.bottom + 8}px`;
    this.panelEl.style.right = `${right}px`;
    this.panelEl.classList.toggle('open');
  },
  async refresh() {
    const res = await API.get('/api/user/notifications');
    if (!res.success) return;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (res.unread_count > 0) { badge.textContent = res.unread_count > 9 ? '9+' : res.unread_count; badge.style.display = 'flex'; }
      else badge.style.display = 'none';
    }
    const list = document.getElementById('notif-panel-list');
    if (!list) return;
    if (!res.data.length) {
      list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Belum ada notifikasi</p></div>`;
      return;
    }
    const typeIcon = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', danger: 'fa-circle-exclamation' };
    list.innerHTML = res.data.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon ${n.type}"><i class="fas ${typeIcon[n.type] || 'fa-bell'}"></i></div>
        <div class="notif-item-body">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-msg">${n.message}</div>
          <div class="notif-item-time">${formatDate(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        if (item.classList.contains('unread')) {
          await API.post(`/api/user/notifications/${id}/read`);
          item.classList.remove('unread');
          this.refresh();
        }
      });
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Sidebar.init();
  AppLogo.init();
  Notifications.init();
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => Theme.toggle());
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', () => Auth.logout());
  });
});

// [BARU] Salin teks ke clipboard (fallback untuk konteks non-HTTPS / browser lama).
async function copyToClipboard(text, successMsg = 'ID transaksi disalin') {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) throw new Error('copy failed');
    }
    if (typeof Toast !== 'undefined') Toast.success(successMsg);
    return true;
  } catch (err) {
    if (typeof Toast !== 'undefined') Toast.error('Gagal menyalin');
    return false;
  }
}


/* ================================================================
   AustinDialog — pengganti confirm() / prompt() bawaan browser.
   Tampilannya mengikuti gaya AustinPay (kartu bulat, border tebal,
   tombol pill) dan ikut tema terang/gelap.

   Pakai (WAJIB await, karena dialog ini asinkron):
     if (!(await austinConfirm('Hapus IP ini? Request dari IP ini akan ditolak.'))) return;
     const v = await austinPrompt('Batas request?', '100');   // string | null

   Teks pesan otomatis dipecah: kalimat sampai tanda "?" jadi judul,
   sisanya jadi isi. Ikon & warna ditebak dari kata pertama, atau
   atur sendiri lewat opsi:
     austinConfirm(msg, { title, icon:'fa-trash-can', tone:'danger|warning|success|info',
                          okText:'Hapus', cancelText:'Batal' })
================================================================ */
const AustinDialog = (() => {
  const queue = [];
  let busy = false;

  const TONES = [
    { re: /^(hapus|cabut|keluar|nonaktifkan|matikan|reset|tutup)/i, tone: 'danger',  ok: null },
    { re: /^(ganti|ubah)/i,                                         tone: 'warning', ok: 'Ganti' },
    { re: /^(setujui|tandai|aktifkan|ajukan|tambah|simpan|kirim)/i, tone: 'success', ok: null },
  ];
  const ICONS = [
    [/poin|saldo|withdraw|deposit/i, 'fa-coins'],
    [/hapus|cabut/i,                 'fa-trash-can'],
    [/keluar/i,                      'fa-right-from-bracket'],
    [/api key|api secret|secret|key/i, 'fa-key'],
    [/whitelist|ip/i,                'fa-shield-halved'],
    [/tutup/i,                       'fa-circle-xmark'],
    [/nonaktifkan|matikan/i,         'fa-power-off'],
    [/setujui|tandai|aktifkan|ajukan/i, 'fa-circle-check'],
  ];

  function infer(message, opts) {
    const text = String(message == null ? '' : message).trim();
    const first = text.split(/\s+/)[0] || '';
    const hit = TONES.find(t => t.re.test(first));
    const tone = opts.tone || (hit ? hit.tone : 'info');
    let icon = opts.icon;
    if (!icon) {
      const ic = ICONS.find(([re]) => re.test(text.slice(0, 80)));
      icon = ic ? ic[1] : (tone === 'danger' || tone === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-question');
    }
    let title = opts.title, body = opts.body;
    if (title == null) {
      const q = text.indexOf('?');
      if (q > -1 && q < text.length - 1) { title = text.slice(0, q + 1); body = text.slice(q + 1).trim(); }
      else { title = text; body = ''; }
    }
    if (title.length > 90 && !body) { body = title; title = 'Konfirmasi'; }
    const okText = opts.okText || (hit && hit.ok) ||
      (/^hapus/i.test(first) ? 'Hapus' : /^cabut/i.test(first) ? 'Cabut' : /^keluar/i.test(first) ? 'Keluar' :
       /^tutup/i.test(first) ? 'Tutup' : /^(nonaktifkan|matikan)/i.test(first) ? 'Nonaktifkan' :
       /^reset/i.test(first) ? 'Reset' : /^setujui/i.test(first) ? 'Setujui' : 'Oke');
    return { tone, icon, title, body, okText, cancelText: opts.cancelText || 'Batal' };
  }

  function build(cfg, prompt) {
    const overlay = document.createElement('div');
    overlay.className = 'ad-overlay';
    overlay.innerHTML = `
      <div class="ad-card ad-${cfg.tone}" role="alertdialog" aria-modal="true" aria-labelledby="ad-title">
        <div class="ad-icon"><i class="fas ${cfg.icon}"></i></div>
        <div class="ad-title" id="ad-title"></div>
        <div class="ad-body"></div>
        ${prompt ? '<input class="form-control ad-input" type="text" autocomplete="off">' : ''}
        <div class="ad-actions">
          <button type="button" class="btn btn-outline ad-cancel"></button>
          <button type="button" class="btn ad-ok"></button>
        </div>
      </div>`;
    overlay.querySelector('.ad-title').textContent = cfg.title;
    const bodyEl = overlay.querySelector('.ad-body');
    if (cfg.body) bodyEl.textContent = cfg.body; else bodyEl.remove();
    overlay.querySelector('.ad-cancel').textContent = cfg.cancelText;
    const ok = overlay.querySelector('.ad-ok');
    ok.textContent = cfg.okText;
    ok.classList.add(cfg.tone === 'danger' ? 'btn-danger' : 'btn-primary');
    return overlay;
  }

  function show(item) {
    busy = true;
    const { cfg, prompt, defVal, resolve } = item;
    const overlay = build(cfg, prompt);
    const input = overlay.querySelector('.ad-input');
    if (input) input.value = defVal == null ? '' : String(defVal);
    const lastFocus = document.activeElement;
    document.body.appendChild(overlay);
    document.body.classList.add('ad-lock');
    requestAnimationFrame(() => overlay.classList.add('open'));

    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        if (!document.querySelector('.ad-overlay')) document.body.classList.remove('ad-lock');
        try { lastFocus && lastFocus.focus && lastFocus.focus(); } catch {}
      }, 160);
      busy = false;
      resolve(val);
      if (queue.length) show(queue.shift());
    };
    const accept = () => done(prompt ? input.value : true);
    const reject = () => done(prompt ? null : false);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); reject(); }
      else if (e.key === 'Enter' && (prompt || document.activeElement !== overlay.querySelector('.ad-cancel'))) {
        e.preventDefault(); e.stopPropagation(); accept();
      } else if (e.key === 'Tab') {
        const f = overlay.querySelectorAll('input,button');
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) reject(); });
    overlay.querySelector('.ad-cancel').addEventListener('click', reject);
    overlay.querySelector('.ad-ok').addEventListener('click', accept);
    setTimeout(() => {
      if (input) { input.focus(); input.select(); }
      else overlay.querySelector(cfg.tone === 'danger' ? '.ad-cancel' : '.ad-ok').focus();
    }, 30);
  }

  function enqueue(message, opts, prompt, defVal) {
    return new Promise((resolve) => {
      const item = { cfg: infer(message, opts || {}), prompt, defVal, resolve };
      if (busy) queue.push(item); else show(item);
    });
  }

  return {
    confirm: (message, opts) => enqueue(message, opts, false),
    prompt: (message, defVal, opts) => enqueue(message, Object.assign({ tone: 'info', icon: 'fa-pen' }, opts || {}), true, defVal),
  };
})();
window.austinConfirm = AustinDialog.confirm;
window.austinPrompt = AustinDialog.prompt;

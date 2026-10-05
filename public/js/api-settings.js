// Halaman "API Docs" (pengaturan API): API key, API secret (HMAC), whitelist IP.
// Logikanya sama dengan bagian API di halaman Profil; tanpa inline handler
// (CSP hanya mengizinkan handler ber-hash), semua event dipasang lewat addEventListener.

let myApiKeyValue = '';
let apiKeyVisible = false;

const $ = (id) => document.getElementById(id);

async function init() {
  const res = await Auth.check();
  if (!res) return;
  Auth.renderUserInfo(res.user, res.wallet);
  bindActions();
  loadMyApiKey();
  loadIpWhitelist();
}

function bindActions() {
  $('apikey-eye-btn').addEventListener('click', toggleApiKeyVisibility);
  $('apikey-copy-btn').addEventListener('click', copyMyApiKey);
  $('regenerate-key-btn').addEventListener('click', confirmRegenerateKey);
  $('apisecret-copy-btn').addEventListener('click', copyMyApiSecret);
  $('regenerate-secret-btn').addEventListener('click', confirmRegenerateSecret);
  $('delete-secret-btn').addEventListener('click', confirmDeleteSecret);
  $('ip-whitelist-toggle').addEventListener('change', (e) => handleToggleIpWhitelist(e.target));
  $('add-ip-btn').addEventListener('click', addIp);
  $('apikey-meta').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-retry="apikey"]');
    if (!link) return;
    e.preventDefault();
    loadMyApiKey();
  });
  $('ip-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-ip]');
    if (btn) removeIp(btn.getAttribute('data-remove-ip'));
  });
}

/* ------------------------------ API key ------------------------------ */

async function loadMyApiKey() {
  const meta = $('apikey-meta');
  meta.textContent = 'Memuat...';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let res;
  try {
    const r = await fetch(apiUrl('/api/user/api-key'), { credentials: 'include', signal: controller.signal });
    res = await r.json();
  } catch (err) {
    res = { success: false, message: err.name === 'AbortError' ? 'Koneksi lambat — gagal memuat API key' : 'Koneksi gagal. Periksa jaringan.' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.success) {
    meta.innerHTML = `${res.message} — <a href="#" data-retry="apikey">coba lagi</a>`;
    return;
  }

  myApiKeyValue = res.data.key || '';
  apiKeyVisible = false;
  renderApiKeyField();

  if (!myApiKeyValue) {
    meta.textContent = 'Key dibuat sebelum update sistem ini — klik "Ganti API Key" sekali untuk mengaktifkan tampilan key.';
  } else if (res.data.last_used_at) {
    meta.textContent = `Terakhir dipakai: ${formatDate(res.data.last_used_at)}${res.data.last_used_ip ? ' dari ' + res.data.last_used_ip : ''}`;
  } else {
    meta.textContent = 'Belum pernah dipakai';
  }

  renderApiSecretStatus(res.data);

  // Secret yang baru dibuat otomatis hanya tampil sekali.
  if (res.data.secret) showFreshApiSecret(res.data.secret);
}

function renderApiKeyField() {
  const input = $('my_apikey');
  const icon = $('apikey-eye-icon');
  if (!myApiKeyValue) {
    input.type = 'text';
    input.value = '— belum tersedia —';
    icon.className = 'fas fa-eye';
    return;
  }
  input.type = apiKeyVisible ? 'text' : 'password';
  input.value = myApiKeyValue;
  icon.className = apiKeyVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function toggleApiKeyVisibility() {
  if (!myApiKeyValue) return;
  apiKeyVisible = !apiKeyVisible;
  renderApiKeyField();
}

function copyMyApiKey() {
  if (!myApiKeyValue) { Toast.error('Belum ada API key untuk disalin'); return; }
  copyToClipboard(myApiKeyValue, 'Key disalin ke clipboard');
}

async function confirmRegenerateKey() {
  if (!await austinConfirm('Ganti API key sekarang? Key lama langsung tidak berlaku — semua integrasi yang masih pakai key lama akan berhenti bekerja sampai kamu update ke key baru.')) return;
  const btn = $('regenerate-key-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/regenerate', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  myApiKeyValue = res.data.key;
  apiKeyVisible = true;
  renderApiKeyField();
  $('apikey-meta').textContent = 'Belum pernah dipakai';
  Toast.success(res.message);
}

/* ----------------------------- API secret ---------------------------- */

function renderApiSecretStatus(data) {
  const meta = $('apisecret-meta');
  const deleteBtn = $('delete-secret-btn');
  const wlGroup = $('ip-whitelist-toggle-group');
  const wlToggle = $('ip-whitelist-toggle');

  if (data.has_secret) {
    meta.textContent = `Aktif — berakhiran ****${data.secret_last4 || '????'}. HMAC signature wajib untuk key ini.`;
    deleteBtn.style.display = '';
    wlGroup.style.display = '';
  } else {
    meta.textContent = 'Belum ada API secret. HMAC signature belum wajib — request cukup pakai API key seperti biasa.';
    deleteBtn.style.display = 'none';
    wlGroup.style.display = 'none';
  }

  if (typeof data.require_ip_whitelist === 'boolean') {
    wlToggle.checked = data.require_ip_whitelist;
  }
}

function showFreshApiSecret(rawSecret) {
  $('my_apisecret').value = rawSecret;
  $('apisecret-reveal-group').style.display = '';
}

function copyMyApiSecret() {
  const value = $('my_apisecret').value;
  if (!value) { Toast.error('Belum ada API secret untuk disalin'); return; }
  copyToClipboard(value, 'API secret disalin ke clipboard');
}

async function confirmRegenerateSecret() {
  if (!await austinConfirm('Ganti API secret sekarang? Secret lama langsung tidak berlaku — semua server yang masih menandatangani request pakai secret lama akan gagal (401) sampai kamu update ke secret baru.')) return;
  const btn = $('regenerate-secret-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/regenerate-secret', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  showFreshApiSecret(res.data.secret);
  renderApiSecretStatus({ has_secret: true, secret_last4: res.data.secret_last4 });
  Toast.success(res.message);
}

async function confirmDeleteSecret() {
  if (!await austinConfirm('Hapus API secret? HMAC signature tidak lagi wajib untuk key ini — request kembali cukup pakai API key + IP whitelist seperti biasa (IP whitelist otomatis diwajibkan lagi).')) return;

  const btn = $('delete-secret-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/delete-secret', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  $('apisecret-reveal-group').style.display = 'none';
  $('my_apisecret').value = '';
  renderApiSecretStatus({ has_secret: false, require_ip_whitelist: true });
  Toast.success(res.message);
}

async function handleToggleIpWhitelist(checkboxEl) {
  const desired = checkboxEl.checked;

  if (!desired) {
    const ok = await austinConfirm('Matikan kewajiban IP whitelist untuk key ini? HMAC signature (API secret) jadi satu-satunya pembuktian kepemilikan request — pastikan API secret-nya sudah kamu simpan dengan aman.');
    if (!ok) { checkboxEl.checked = true; return; }
  }

  checkboxEl.disabled = true;
  const res = await API.post('/api/user/api-key/toggle-ip-whitelist', { require_ip_whitelist: desired });
  checkboxEl.disabled = false;

  if (!res.success) {
    Toast.error(res.message);
    checkboxEl.checked = !desired;
    return;
  }
  Toast.success(res.message);
}

/* ---------------------------- Whitelist IP --------------------------- */

function escHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadIpWhitelist() {
  const res = await API.get('/api/user/ip-whitelist');
  const tbody = $('ip-list');
  if (!res.success || !res.data || !res.data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Belum ada IP yang di-whitelist. Semua request API akan ditolak.</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map((r) => `<tr>
    <td><code style="font-size:12px">${escHtml(r.ip)}</code></td>
    <td class="text-xs">${escHtml(r.label) || '-'}</td>
    <td class="text-xs">${formatDate(r.createdAt, false)}</td>
    <td><button class="btn btn-danger btn-sm" type="button" data-remove-ip="${escHtml(r.id)}"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('');
}

async function addIp() {
  const btn = $('add-ip-btn');
  const alertBox = $('ip-alert');
  const ip = $('ip_address').value.trim();
  const label = $('ip_label').value.trim();
  alertBox.innerHTML = '';

  btnLoading(btn, true);
  const res = await API.post('/api/user/ip-whitelist', { ip, label });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${escHtml(res.message)}</div>`;
    $('ip_address').value = '';
    $('ip_label').value = '';
    Toast.success(res.message);
    loadIpWhitelist();
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${escHtml(res.message)}</div>`;
  }
}

async function removeIp(id) {
  if (!await austinConfirm('Hapus IP ini dari whitelist? Request API dari IP ini akan ditolak setelahnya.')) return;
  const res = await API.request('DELETE', `/api/user/ip-whitelist/${id}`);
  if (res.success) { Toast.success(res.message); loadIpWhitelist(); }
  else Toast.error(res.message);
}

init();

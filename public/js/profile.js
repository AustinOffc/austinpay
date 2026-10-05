let userData = null;

async function init() {
  const res = await Auth.check();
  if (!res) return;
  userData = res.user;
  Auth.renderUserInfo(res.user, res.wallet);
  populateForm(res.user, res.wallet);
  loadLoginHistory();
  loadMyApiKey();
  loadIpWhitelist();
  loadPinStatus();
  loadDevices();
  bindDevicesActions();

  document.getElementById('apikey-meta').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-retry="apikey"]');
    if (!link) return;
    e.preventDefault();
    loadMyApiKey();
  });
}

function populateForm(user, wallet) {
  document.getElementById('full_name').value = user.full_name || '';
  document.getElementById('username').value = user.username || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('phone').value = user.phone || '';
  document.getElementById('profile-name').textContent = user.full_name || user.username;
  document.getElementById('profile-username').textContent = `@${user.username}`;
  document.getElementById('profile-joined').textContent = formatDate(user.createdAt, false);
  document.getElementById('profile-role').innerHTML = `<span class="badge ${user.role==='admin'?'badge-primary':'badge-success'}">${user.role==='admin'?'Administrator':'Member'}</span>`;

  const avatarEl = document.getElementById('profile-avatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="">`;
  } else {
    avatarEl.textContent = (user.full_name || user.username)[0].toUpperCase();
  }

  if (wallet) {
    document.querySelectorAll('[data-balance]').forEach(el => el.textContent = formatRupiah(wallet.balance));
  }
}

async function saveProfile() {
  const btn = document.getElementById('save-profile-btn');
  const alertBox = document.getElementById('profile-alert');
  btnLoading(btn, true);
  alertBox.innerHTML = '';

  const res = await API.post('/api/user/profile', {
    full_name: document.getElementById('full_name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
  });

  btnLoading(btn, false);
  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    Toast.success(res.message);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function changePassword() {
  const old_password = document.getElementById('old_password').value;
  const new_password = document.getElementById('new_password').value;
  const confirm = document.getElementById('confirm_password').value;
  const alertBox = document.getElementById('pass-alert');
  const btn = document.getElementById('change-pass-btn');
  alertBox.innerHTML = '';

  if (new_password !== confirm) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Konfirmasi password tidak cocok</div>`;
    return;
  }

  btnLoading(btn, true);
  const res = await API.post('/api/user/change-password', { old_password, new_password });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    document.getElementById('old_password').value = '';
    document.getElementById('new_password').value = '';
    document.getElementById('confirm_password').value = '';
    Toast.success(res.message);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

function _onlyDigits(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 6);
}
['set_pin', 'set_pin_confirm', 'old_pin', 'new_pin', 'confirm_pin'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => _onlyDigits(el));
});

async function loadPinStatus() {
  const res = await API.get('/api/user/pin/status');
  if (!res.success) return;

  const setSection = document.getElementById('pin-set-section');
  const changeSection = document.getElementById('pin-change-section');

  if (res.has_pin) {
    setSection.style.display = 'none';
    changeSection.style.display = '';
    document.getElementById('pin-set-meta').textContent = res.pin_set_at
      ? `PIN aktif — terakhir diatur ${formatDate(res.pin_set_at, false)}`
      : 'PIN aktif';
  } else {
    setSection.style.display = '';
    changeSection.style.display = 'none';
  }
}

async function setPinSubmit() {
  const pin = document.getElementById('set_pin').value;
  const confirm_pin = document.getElementById('set_pin_confirm').value;
  const alertBox = document.getElementById('pin-alert');
  const btn = document.getElementById('set-pin-btn');
  alertBox.innerHTML = '';

  if (!/^\d{6}$/.test(pin)) {
    alertBox.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> PIN harus 6 digit angka</div>';
    return;
  }
  if (pin !== confirm_pin) {
    alertBox.innerHTML = '<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Konfirmasi PIN tidak cocok</div>';
    return;
  }

  btnLoading(btn, true);
  const res = await API.post('/api/user/pin/set', { pin, confirm_pin });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    document.getElementById('set_pin').value = '';
    document.getElementById('set_pin_confirm').value = '';
    Toast.success(res.message);
    loadPinStatus();
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function changePinSubmit() {
  const old_pin = document.getElementById('old_pin').value;
  const new_pin = document.getElementById('new_pin').value;
  const confirm_pin = document.getElementById('confirm_pin').value;
  const alertBox = document.getElementById('pin-alert');
  const btn = document.getElementById('change-pin-btn');
  alertBox.innerHTML = '';

  if (!/^\d{6}$/.test(old_pin)) {
    alertBox.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> Masukkan PIN lama (6 digit)</div>';
    return;
  }
  if (!/^\d{6}$/.test(new_pin)) {
    alertBox.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> PIN baru harus 6 digit angka</div>';
    return;
  }
  if (new_pin !== confirm_pin) {
    alertBox.innerHTML = '<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Konfirmasi PIN baru tidak cocok</div>';
    return;
  }

  btnLoading(btn, true);
  const res = await API.post('/api/user/pin/change', { old_pin, new_pin, confirm_pin });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    document.getElementById('old_pin').value = '';
    document.getElementById('new_pin').value = '';
    document.getElementById('confirm_pin').value = '';
    Toast.success(res.message);
    loadPinStatus();
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function uploadAvatar(input) {
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append('avatar', input.files[0]);

  const res = await fetch(apiUrl('/api/user/avatar'), {
    method: 'POST', credentials: 'include', body: formData,
  }).then(r => r.json());

  if (res.success) {
    const avatarEl = document.getElementById('profile-avatar');
    avatarEl.innerHTML = `<img src="${res.avatar}" alt="">`;
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      el.innerHTML = `<img src="${res.avatar}" alt="">`;
    });
    Toast.success('Foto profil diperbarui!');
  } else {
    Toast.error(res.message);
  }
}

async function loadLoginHistory() {
  const res = await API.get('/api/user/login-history');
  const tbody = document.getElementById('login-history');
  if (!res.success || !res.data || !res.data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Tidak ada riwayat</td></tr>`;
    return;
  }
  tbody.innerHTML = res.data.map(l => {
    const statusMap = {
      success: '<span class="badge badge-success">Berhasil</span>',
      failed_password: '<span class="badge badge-danger">Password Salah</span>',
      failed_notfound: '<span class="badge badge-danger">Tidak Ditemukan</span>',
      failed_suspended: '<span class="badge badge-danger">Disuspend</span>',
      register: '<span class="badge badge-info">Registrasi</span>',
    };
    const ua = l.user_agent || '';
    const device = ua.includes('Mobile')
      ? '<i class="fas fa-mobile-alt"></i> Mobile'
      : '<i class="fas fa-desktop"></i> Desktop';
    return `<tr>
      <td class="text-xs">${formatDate(l.createdAt)}</td>
      <td><code style="font-size:11px">${l.ip || '-'}</code></td>
      <td>${statusMap[l.status] || statusBadge(l.status)}</td>
      <td class="text-xs text-muted">${device}</td>
    </tr>`;
  }).join('');
}

let myApiKeyValue = '';
let apiKeyVisible = false;

async function loadMyApiKey() {
  const meta = document.getElementById('apikey-meta');
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

  if (res.data.secret) {
    showFreshApiSecret(res.data.secret);
  }
}

function renderApiSecretStatus(data) {
  const meta = document.getElementById('apisecret-meta');
  const deleteBtn = document.getElementById('delete-secret-btn');
  const wlGroup = document.getElementById('ip-whitelist-toggle-group');
  const wlToggle = document.getElementById('ip-whitelist-toggle');
  if (!meta) return;

  if (data.has_secret) {
    meta.textContent = `Aktif — berakhiran ****${data.secret_last4 || '????'}. HMAC signature wajib untuk key ini.`;
    if (deleteBtn) deleteBtn.style.display = '';
    if (wlGroup) wlGroup.style.display = '';
  } else {
    meta.textContent = 'Belum ada API secret. HMAC signature belum wajib — request cukup pakai API key seperti biasa.';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (wlGroup) wlGroup.style.display = 'none';
  }

  if (wlToggle && typeof data.require_ip_whitelist === 'boolean') {
    wlToggle.checked = data.require_ip_whitelist;
  }
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

async function confirmDeleteSecret() {
  if (!await austinConfirm('Hapus API secret? HMAC signature tidak lagi wajib untuk key ini — request kembali cukup pakai API key + IP whitelist seperti biasa (IP whitelist otomatis diwajibkan lagi).')) return;

  const btn = document.getElementById('delete-secret-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/delete-secret', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  const revealGroup = document.getElementById('apisecret-reveal-group');
  if (revealGroup) revealGroup.style.display = 'none';
  const input = document.getElementById('my_apisecret');
  if (input) input.value = '';

  renderApiSecretStatus({ has_secret: false, require_ip_whitelist: true });
  Toast.success(res.message);
}

function showFreshApiSecret(rawSecret) {
  const group = document.getElementById('apisecret-reveal-group');
  const input = document.getElementById('my_apisecret');
  if (!group || !input) return;
  input.value = rawSecret;
  group.style.display = '';
}

function copyMyApiSecret() {
  const input = document.getElementById('my_apisecret');
  if (!input || !input.value) { Toast.error('Belum ada API secret untuk disalin'); return; }
  navigator.clipboard.writeText(input.value).then(() => Toast.success('API secret disalin ke clipboard'));
}

async function confirmRegenerateSecret() {
  if (!await austinConfirm('Ganti API secret sekarang? Secret lama langsung tidak berlaku — semua server yang masih menandatangani request pakai secret lama akan gagal (401) sampai kamu update ke secret baru.')) return;
  const btn = document.getElementById('regenerate-secret-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/regenerate-secret', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  showFreshApiSecret(res.data.secret);

  renderApiSecretStatus({ has_secret: true, secret_last4: res.data.secret_last4 });
  Toast.success(res.message);
}

function renderApiKeyField() {
  const input = document.getElementById('my_apikey');
  const eyeOpen = document.getElementById('apikey-eye-open');
  const eyeClosed = document.getElementById('apikey-eye-closed');
  if (!myApiKeyValue) {
    input.type = 'text';
    input.value = '— belum tersedia —';
    eyeOpen.style.display = '';
    eyeClosed.style.display = 'none';
    return;
  }
  input.type = apiKeyVisible ? 'text' : 'password';
  input.value = myApiKeyValue;
  eyeOpen.style.display = apiKeyVisible ? 'none' : '';
  eyeClosed.style.display = apiKeyVisible ? '' : 'none';
}

function toggleApiKeyVisibility() {
  if (!myApiKeyValue) return;
  apiKeyVisible = !apiKeyVisible;
  renderApiKeyField();
}

function copyMyApiKey() {
  if (!myApiKeyValue) { Toast.error('Belum ada API key untuk disalin'); return; }
  navigator.clipboard.writeText(myApiKeyValue).then(() => Toast.success('Key disalin ke clipboard'));
}

async function confirmRegenerateKey() {
  if (!await austinConfirm('Ganti API key sekarang? Key lama langsung tidak berlaku — semua integrasi yang masih pakai key lama akan berhenti bekerja sampai kamu update ke key baru.')) return;
  const btn = document.getElementById('regenerate-key-btn');
  btnLoading(btn, true);
  const res = await API.post('/api/user/api-key/regenerate', {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  myApiKeyValue = res.data.key;
  apiKeyVisible = true;
  renderApiKeyField();
  const meta = document.getElementById('apikey-meta');
  meta.textContent = 'Belum pernah dipakai';
  Toast.success(res.message);
}

async function loadIpWhitelist() {
  const res = await API.get('/api/user/ip-whitelist');
  const tbody = document.getElementById('ip-list');
  if (!res.success || !res.data || !res.data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Belum ada IP yang di-whitelist. Semua request API akan ditolak.</td></tr>`;
    return;
  }
  tbody.innerHTML = res.data.map(r => `<tr>
    <td><code style="font-size:12px">${r.ip}</code></td>
    <td class="text-xs">${r.label || '-'}</td>
    <td class="text-xs">${formatDate(r.createdAt, false)}</td>
    <td><button class="btn btn-danger btn-sm" type="button" data-remove-ip="${r.id}"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('');
  _bindIpListActions(tbody);
}

function _bindIpListActions(tbody) {
  if (tbody._ipActionsBound) return;
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-ip]');
    if (!btn) return;
    removeIp(btn.getAttribute('data-remove-ip'));
  });
  tbody._ipActionsBound = true;
}

async function addIp() {
  const btn = document.getElementById('add-ip-btn');
  const alertBox = document.getElementById('ip-alert');
  const ip = document.getElementById('ip_address').value.trim();
  const label = document.getElementById('ip_label').value.trim();
  alertBox.innerHTML = '';

  btnLoading(btn, true);
  const res = await API.post('/api/user/ip-whitelist', { ip, label });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    document.getElementById('ip_address').value = '';
    document.getElementById('ip_label').value = '';
    Toast.success(res.message);
    loadIpWhitelist();
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function removeIp(id) {
  if (!await austinConfirm('Hapus IP ini dari whitelist? Request API dari IP ini akan ditolak setelahnya.')) return;
  const res = await API.request('DELETE', `/api/user/ip-whitelist/${id}`);
  if (res.success) { Toast.success(res.message); loadIpWhitelist(); }
  else Toast.error(res.message);
}

init();


// ===== Perangkat & Sesi =====
// Tidak memakai inline onclick (CSP hanya mengizinkan handler inline yang di-hash), jadi
// semua aksi lewat event delegation.

function _devEsc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _deviceRow(d, kind) {
  const icon = d.platform === 'app' ? 'mobile-screen-button' : 'globe';
  const when = kind === 'session' ? d.last_active_at : d.last_used_at;
  const whenLabel = kind === 'session' ? 'Aktif terakhir' : 'Terakhir dipakai';
  const badge = d.current ? ' <span class="badge badge-success">Perangkat ini</span>' : '';
  const btnLabel = kind === 'session' ? 'Keluarkan' : 'Cabut';
  return `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
    <div style="width:32px;text-align:center;color:var(--primary);padding-top:2px"><i class="fas fa-${icon}"></i></div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px;word-break:break-word">${_devEsc(d.label)}${badge}</div>
      <div class="text-xs text-muted">IP ${_devEsc(d.ip || '-')} · ${whenLabel} ${_devEsc(formatDate(when))}</div>
    </div>
    <button class="btn btn-outline btn-sm" type="button" data-device-action="${kind}" data-id="${_devEsc(d.id)}" data-current="${d.current ? '1' : '0'}">${btnLabel}</button>
  </div>`;
}

async function loadDevices() {
  const sBox = document.getElementById('devices-sessions');
  const tBox = document.getElementById('devices-trusted');
  if (!sBox || !tBox) return;
  const res = await API.get('/api/user/devices');
  if (!res.success) {
    sBox.textContent = res.message || 'Gagal memuat sesi.';
    tBox.textContent = '';
    return;
  }
  sBox.innerHTML = res.sessions.length
    ? res.sessions.map((d) => _deviceRow(d, 'session')).join('')
    : 'Tidak ada sesi aktif.';
  tBox.innerHTML = res.trusted_devices.length
    ? res.trusted_devices.map((d) => _deviceRow(d, 'trusted')).join('')
    : 'Belum ada perangkat tepercaya. Centang "Percaya perangkat ini" saat login untuk menambahkan.';
}

function bindDevicesActions() {
  const card = document.getElementById('devices-card');
  if (!card) return;

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-device-action]');
    if (!btn) return;
    const { deviceAction, id, current } = btn.dataset;

    if (deviceAction === 'session') {
      const msg = current === '1'
        ? 'Keluar dari perangkat ini? Kamu akan diarahkan ke halaman login.'
        : 'Keluarkan sesi di perangkat ini?';
      if (!await austinConfirm(msg)) return;
      btnLoading(btn, true);
      const res = await API.delete(`/api/user/devices/sessions/${encodeURIComponent(id)}`);
      btnLoading(btn, false);
      if (!res.success) return Toast.error(res.message);
      Toast.success(res.message);
      if (res.logged_out) { location.href = res.redirect || '/login'; return; }
      loadDevices();
    } else if (deviceAction === 'trusted') {
      if (!await austinConfirm('Cabut kepercayaan perangkat ini? Login berikutnya dari sana akan memicu notifikasi login baru.')) return;
      btnLoading(btn, true);
      const res = await API.delete(`/api/user/devices/trusted/${encodeURIComponent(id)}`);
      btnLoading(btn, false);
      if (!res.success) return Toast.error(res.message);
      Toast.success(res.message);
      loadDevices();
    }
  });

  document.getElementById('logout-all-btn')?.addEventListener('click', async (e) => {
    if (!await austinConfirm('Keluar dari SEMUA perangkat (termasuk ini) dan cabut semua perangkat tepercaya? Kamu harus login ulang.')) return;
    const btn = e.currentTarget;
    btnLoading(btn, true);
    const res = await API.post('/api/user/devices/logout-all', {});
    btnLoading(btn, false);
    if (!res.success) return Toast.error(res.message);
    Toast.success(res.message);
    setTimeout(() => { location.href = res.redirect || '/login'; }, 800);
  });
}

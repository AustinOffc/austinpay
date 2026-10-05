

let ntHasPin = true;
let ntCurrentChatId = null;

async function init() {
  const res = await Auth.check();
  if (!res) return;
  Auth.renderUserInfo(res.user, res.wallet);

  bindActions();
  await loadPinStatus();
  await loadNotificationSettings();
}

function bindActions() {
  document.getElementById('nt-save-btn').addEventListener('click', saveNotificationSettings);
  document.getElementById('nt-reset-btn').addEventListener('click', resetNotificationSettings);
}

async function loadPinStatus() {
  const res = await API.get('/api/user/pin/status');
  ntHasPin = res.success ? !!res.has_pin : true;
  document.getElementById('nt-pin-missing-hint').style.display = ntHasPin ? 'none' : '';
  if (!ntHasPin) {
    document.getElementById('nt-pin').disabled = true;
    document.getElementById('nt-chat-id').disabled = true;
    document.getElementById('nt-save-btn').disabled = true;
    document.getElementById('nt-reset-btn').disabled = true;
  }
}

async function loadNotificationSettings() {
  const res = await API.get('/api/user/notification-settings');
  if (!res.success) {
    Toast.error(res.message || 'Gagal memuat pengaturan notifikasi');
    return;
  }
  const d = res.data;
  ntCurrentChatId = d.telegram_chat_id;
  document.getElementById('nt-chat-id').value = d.telegram_chat_id || '';

  const botLabel = document.getElementById('nt-bot-username');
  botLabel.textContent = d.bot_username ? `@${d.bot_username}` : 'belum tersedia';
  document.getElementById('nt-bot-unconfigured').style.display = d.bot_configured ? 'none' : '';

  const openBotBtn = document.getElementById('nt-bot-open-btn');
  if (d.bot_username) {
    openBotBtn.href = `https://t.me/${d.bot_username}?start=1`;
    openBotBtn.style.display = '';
  } else {
    openBotBtn.style.display = 'none';
  }

  updateStatusPill(!!d.telegram_chat_id);
}

function updateStatusPill(active) {
  const pill = document.getElementById('nt-status-pill');
  if (active) {
    pill.className = 'nt-status-pill on';
    pill.innerHTML = '<span class="nt-status-dot"></span> Notifikasi Telegram Aktif';
  } else {
    pill.className = 'nt-status-pill off';
    pill.innerHTML = '<span class="nt-status-dot"></span> Belum Terhubung';
  }
}

async function saveNotificationSettings() {
  const btn = document.getElementById('nt-save-btn');
  const alertBox = document.getElementById('nt-config-alert');
  alertBox.innerHTML = '';

  const chatId = document.getElementById('nt-chat-id').value.trim();
  const pin = document.getElementById('nt-pin').value.trim();

  if (!chatId) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Chat ID Telegram wajib diisi</div>`;
    return;
  }
  if (!/^-?\d{5,15}$/.test(chatId)) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Chat ID Telegram tidak valid — harus berupa angka</div>`;
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> PIN harus 6 digit angka</div>`;
    return;
  }

  btnLoading(btn, true);
  const res = await API.post('/api/user/notification-settings', { telegram_chat_id: chatId, pin });
  btnLoading(btn, false);
  document.getElementById('nt-pin').value = '';

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    Toast.success(res.message);
    ntCurrentChatId = chatId;
    updateStatusPill(true);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function resetNotificationSettings() {
  if (!ntCurrentChatId) {
    Toast.error('Belum ada notifikasi Telegram yang aktif');
    return;
  }
  if (!await austinConfirm('Nonaktifkan notifikasi Telegram sekarang? Kamu tidak akan lagi menerima notifikasi real-time ke Telegram sampai menghubungkannya kembali.')) return;

  const pin = document.getElementById('nt-pin').value.trim();
  if (!/^\d{6}$/.test(pin)) {
    Toast.error('Masukkan PIN 6 digit dulu untuk konfirmasi reset');
    return;
  }

  const btn = document.getElementById('nt-reset-btn');
  const alertBox = document.getElementById('nt-config-alert');
  alertBox.innerHTML = '';

  btnLoading(btn, true);
  const res = await API.post('/api/user/notification-settings/reset', { pin });
  btnLoading(btn, false);
  document.getElementById('nt-pin').value = '';

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    Toast.success(res.message);
    ntCurrentChatId = null;
    document.getElementById('nt-chat-id').value = '';
    updateStatusPill(false);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

init();

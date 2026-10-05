

let whList = [];
let whMaxWebhooks = 5;
let whLogPage = 1;
let whEditingId = null;
let whFormSecretValue = '';
let whFormSecretVisible = false;

const WH_SAMPLE_PAYLOADS = {
  'deposit.paid': {
    event: 'deposit.paid',
    data: {
      transactionId: 'APG-1751000000',
      amount: 55000,
      status: 'paid',
      paidAt: '2026-07-08T03:38:35.000Z',
    },
    sentAt: '2026-07-08T03:38:35.512Z',
  },
  'withdraw.approved': {
    event: 'withdraw.approved',
    data: {
      transactionId: 'a1b2c3d4-uuid',
      amount: 100000,
      method: 'Dana',
      status: 'success',
      processedAt: '2026-07-08T03:40:00.000Z',
    },
    sentAt: '2026-07-08T03:40:00.512Z',
  },
  'withdraw.rejected': {
    event: 'withdraw.rejected',
    data: {
      transactionId: 'a1b2c3d4-uuid',
      amount: 100000,
      method: 'Dana',
      status: 'rejected',
      reason: 'Data rekening tidak valid',
      processedAt: '2026-07-08T03:41:00.000Z',
    },
    sentAt: '2026-07-08T03:41:00.512Z',
  },
  'mutasi.shopee': {
    event: 'mutasi.shopee',
    data: {
      mutationId: 'f3b1c2d4-uuid',
      shopeeAccountId: 'a9e8d7c6-uuid',
      merchantId: '123456',
      accountName: 'Toko Saya',
      type: 'CREDIT',
      amount: 25000,
      description: 'Pembayaran QR',
      balance: null,
      fee: 125,
      mutationAt: '2026-07-08T03:42:00.000Z',
    },
    sentAt: '2026-07-08T03:42:00.512Z',
  },
};

async function init() {
  const res = await Auth.check();
  if (!res) return;
  Auth.renderUserInfo(res.user, res.wallet);

  renderDocJson('deposit.paid');
  bindDocTabs();
  bindActions();

  await loadWebhooks();
  await loadWebhookLogs(1);
}

function bindDocTabs() {
  document.getElementById('wh-doc-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.wh-doc-tab');
    if (!btn) return;
    document.querySelectorAll('.wh-doc-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDocJson(btn.getAttribute('data-event'));
  });
}

function renderDocJson(event) {
  document.getElementById('wh-doc-json').textContent = JSON.stringify(WH_SAMPLE_PAYLOADS[event], null, 2);
}

function bindActions() {
  document.getElementById('wh-add-btn').addEventListener('click', openAddModal);
  document.getElementById('wh-form-save-btn').addEventListener('click', saveWebhookForm);
  document.getElementById('wh-form-delete-btn').addEventListener('click', deleteWebhookFromForm);
  document.getElementById('wh-form-regen-btn').addEventListener('click', confirmRegenerateSecret);
  document.getElementById('wh-form-test-btn').addEventListener('click', testWebhookForm);
  document.getElementById('wh-log-filter').addEventListener('change', () => loadWebhookLogs(1));
}

async function loadWebhooks() {
  const res = await API.get('/api/user/webhook');
  if (!res.success) {
    Toast.error(res.message || 'Gagal memuat daftar webhook');
    return;
  }
  whList = res.data || [];
  whMaxWebhooks = res.max_webhooks || 5;

  renderStats(res.stats || {});
  renderWebhookList();
  renderLogFilterOptions();
}

function renderStats(stats) {
  document.getElementById('wh-stat-delivery').textContent = stats.delivered_24h ?? 0;
  document.getElementById('wh-stat-success').textContent = stats.success ?? 0;
  document.getElementById('wh-stat-failed').textContent = stats.failed ?? 0;
  document.getElementById('wh-stat-avg').textContent = (stats.avg_response_ms ?? 0) + 'ms';
}

function renderWebhookList() {
  document.getElementById('wh-count-label').textContent = `${whList.length} webhook`;
  document.getElementById('wh-add-btn').disabled = whList.length >= whMaxWebhooks;

  const container = document.getElementById('wh-item-list');
  if (!whList.length) {
    container.innerHTML = `
      <div class="wh-empty">
        <i class="fas fa-satellite-dish"></i>
        <div class="wh-empty-title">Belum ada webhook</div>
        <div class="wh-empty-sub">Webhook memungkinkan Anda menerima notifikasi otomatis ke server Anda</div>
        <button class="btn btn-primary" type="button" data-wh-add-empty><i class="fas fa-plus"></i> Tambah Webhook Pertama</button>
      </div>`;
    _bindWebhookListActions(container);
    return;
  }

  container.innerHTML = whList.map(w => {
    const isOn = w.enabled && w.url;
    const lastDelivery = w.last_delivery_at
      ? `Pengiriman terakhir: ${formatDate(w.last_delivery_at)} — ${w.last_delivery_status === 'success' ? '<span style="color:var(--success);font-weight:600">berhasil</span>' : '<span style="color:var(--danger);font-weight:600">gagal</span>'}`
      : 'Belum pernah mengirim';
    const events = (w.events || []).map(e => `<span class="badge badge-info">${e}</span>`).join('');
    return `
      <div class="wh-item">
        <span class="wh-item-dot ${isOn ? 'on' : 'off'}"></span>
        <div class="wh-item-info">
          <div class="wh-item-name">${escapeHtml(w.name || 'Webhook tanpa nama')}</div>
          <div class="wh-item-url">${escapeHtml(w.url || '— URL belum diisi —')}</div>
          <div class="wh-item-events">${events}</div>
          <div class="wh-item-meta">${lastDelivery}</div>
        </div>
        <div class="wh-item-actions">
          <label class="wh-switch" title="Aktifkan/nonaktifkan">
            <input type="checkbox" ${w.enabled ? 'checked' : ''} data-toggle-webhook="${w.id}">
            <span class="wh-switch-track"></span>
          </label>
          <span class="wh-icon-btn" title="Edit" data-edit-webhook="${w.id}"><i class="fas fa-pen"></i></span>
          <span class="wh-icon-btn danger" title="Hapus" data-delete-webhook="${w.id}"><i class="fas fa-trash"></i></span>
        </div>
      </div>`;
  }).join('');
  _bindWebhookListActions(container);
}

function _bindWebhookListActions(container) {
  if (container._whActionsBound) return;
  container.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-wh-add-empty]');
    if (addBtn) return openAddModal();

    const editBtn = e.target.closest('[data-edit-webhook]');
    if (editBtn) return openEditModal(editBtn.getAttribute('data-edit-webhook'));

    const delBtn = e.target.closest('[data-delete-webhook]');
    if (delBtn) return confirmDeleteWebhook(delBtn.getAttribute('data-delete-webhook'));
  });
  container.addEventListener('change', (e) => {
    const toggle = e.target.closest('[data-toggle-webhook]');
    if (!toggle) return;
    quickToggleWebhook(toggle.getAttribute('data-toggle-webhook'), toggle.checked);
  });
  container._whActionsBound = true;
}

function renderLogFilterOptions() {
  const sel = document.getElementById('wh-log-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">Semua webhook</option>' +
    whList.map(w => `<option value="${w.id}">${escapeHtml(w.name || w.url || w.id)}</option>`).join('');
  sel.value = whList.some(w => w.id === current) ? current : '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function quickToggleWebhook(id, enabled) {
  const w = whList.find(x => x.id === id);
  if (!w) return;
  const res = await API.put(`/api/user/webhook/${id}`, {
    name: w.name, url: w.url, enabled, events: w.events,
  });
  if (!res.success) {
    Toast.error(res.message);
    await loadWebhooks();
    return;
  }
  w.enabled = enabled;
  Toast.success(enabled ? 'Webhook diaktifkan' : 'Webhook dinonaktifkan');
  renderWebhookList();
}

async function confirmDeleteWebhook(id) {
  if (!await austinConfirm('Hapus webhook ini? Riwayat pengirimannya tetap tersimpan, tapi webhook tidak akan menerima notifikasi lagi.')) return;
  const res = await API.delete(`/api/user/webhook/${id}`);
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success(res.message);
  await loadWebhooks();
  loadWebhookLogs(1);
}

function openAddModal() {
  if (whList.length >= whMaxWebhooks) {
    Toast.error(`Maksimal ${whMaxWebhooks} webhook per akun`);
    return;
  }
  whEditingId = null;
  document.getElementById('wh-modal-title').textContent = 'Tambah Webhook';
  document.getElementById('wh-modal-alert').innerHTML = '';
  document.getElementById('wh-form-name').value = '';
  document.getElementById('wh-form-url').value = '';
  document.getElementById('wh-form-enabled').checked = false;
  document.querySelectorAll('.wh-form-event-cb').forEach(cb => { cb.checked = true; });
  document.getElementById('wh-form-secret-group').style.display = 'none';
  document.getElementById('wh-form-delete-btn').style.display = 'none';
  document.getElementById('wh-form-test-result').style.display = 'none';
  document.getElementById('wh-form-test-hint').style.display = 'block';
  Modal.open('wh-modal');
}

function openEditModal(id) {
  const w = whList.find(x => x.id === id);
  if (!w) return;
  whEditingId = id;
  document.getElementById('wh-modal-title').textContent = 'Edit Webhook';
  document.getElementById('wh-modal-alert').innerHTML = '';
  document.getElementById('wh-form-name').value = w.name || '';
  document.getElementById('wh-form-url').value = w.url || '';
  document.getElementById('wh-form-enabled').checked = !!w.enabled;
  const events = w.events && w.events.length ? w.events : ['deposit.paid', 'withdraw.approved', 'withdraw.rejected', 'mutasi.shopee'];
  document.querySelectorAll('.wh-form-event-cb').forEach(cb => { cb.checked = events.includes(cb.value); });

  whFormSecretValue = w.secret || '';
  whFormSecretVisible = false;
  renderFormSecretField();
  document.getElementById('wh-form-secret-group').style.display = 'block';
  document.getElementById('wh-form-delete-btn').style.display = 'inline-flex';
  document.getElementById('wh-form-test-result').style.display = 'none';
  document.getElementById('wh-form-test-hint').style.display = 'none';
  Modal.open('wh-modal');
}

function renderFormSecretField() {
  const el = document.getElementById('wh-form-secret-value');
  const eye = document.getElementById('wh-form-secret-eye');
  if (!whFormSecretValue) { el.textContent = '— belum tersedia —'; return; }
  el.textContent = whFormSecretVisible ? whFormSecretValue : '•'.repeat(Math.min(whFormSecretValue.length, 44));
  eye.innerHTML = whFormSecretVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function toggleFormSecretVisibility() {
  if (!whFormSecretValue) return;
  whFormSecretVisible = !whFormSecretVisible;
  renderFormSecretField();
}

function copyFormSecret() {
  if (!whFormSecretValue) { Toast.error('Belum ada secret untuk disalin'); return; }
  navigator.clipboard.writeText(whFormSecretValue).then(() => Toast.success('Secret disalin ke clipboard'));
}

async function saveWebhookForm() {
  const btn = document.getElementById('wh-form-save-btn');
  const alertBox = document.getElementById('wh-modal-alert');
  alertBox.innerHTML = '';

  const name = document.getElementById('wh-form-name').value.trim();
  const url = document.getElementById('wh-form-url').value.trim();
  const enabled = document.getElementById('wh-form-enabled').checked;
  const events = Array.from(document.querySelectorAll('.wh-form-event-cb:checked')).map(cb => cb.value);

  if (!url) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> URL webhook wajib diisi</div>`;
    return;
  }

  const isCreate = !whEditingId;
  btnLoading(btn, true);
  const res = whEditingId
    ? await API.put(`/api/user/webhook/${whEditingId}`, { name, url, enabled, events })
    : await API.post('/api/user/webhook', { name, url, enabled, events });
  btnLoading(btn, false);

  if (!res.success) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
    return;
  }

  Toast.success(res.message);
  await loadWebhooks();
  loadWebhookLogs(1);

  if (isCreate && res.data) {
    whEditingId = res.data.id;
    document.getElementById('wh-modal-title').textContent = 'Webhook Dibuat — Salin Secret Ini';
    whFormSecretValue = res.data.secret || '';
    whFormSecretVisible = true;
    renderFormSecretField();
    document.getElementById('wh-form-secret-group').style.display = 'block';
    document.getElementById('wh-form-delete-btn').style.display = 'inline-flex';
    document.getElementById('wh-form-test-hint').style.display = 'none';
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> Webhook berhasil dibuat. Salin <b>Signing Secret</b> di bawah dan pasang di server tujuan kamu — secret ini tidak akan ditampilkan lengkap lagi kecuali kamu klik "Ganti Secret".</div>`;
    return;
  }

  Modal.close('wh-modal');
}

async function deleteWebhookFromForm() {
  if (!whEditingId) return;
  if (!await austinConfirm('Hapus webhook ini?')) return;
  const res = await API.delete(`/api/user/webhook/${whEditingId}`);
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success(res.message);
  Modal.close('wh-modal');
  await loadWebhooks();
  loadWebhookLogs(1);
}

async function confirmRegenerateSecret() {
  if (!whEditingId) return;
  if (!await austinConfirm('Ganti webhook secret sekarang? Signature yang dihitung server kamu dengan secret lama tidak akan cocok lagi sampai kamu update ke secret baru.')) return;
  const btn = document.getElementById('wh-form-regen-btn');
  btnLoading(btn, true);
  const res = await API.post(`/api/user/webhook/${whEditingId}/regenerate-secret`, {});
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }
  whFormSecretValue = res.data.secret;
  whFormSecretVisible = true;
  renderFormSecretField();
  Toast.success(res.message);
}

async function testWebhookForm() {
  const btn = document.getElementById('wh-form-test-btn');
  const url = document.getElementById('wh-form-url').value.trim();
  const resultBox = document.getElementById('wh-form-test-result');
  const head = document.getElementById('wh-form-test-result-head');
  const body = document.getElementById('wh-form-test-result-body');

  btnLoading(btn, true);
  const res = whEditingId
    ? await API.post(`/api/user/webhook/${whEditingId}/test`, { url })
    : await API.post('/api/user/webhook/test', { url });
  btnLoading(btn, false);

  if (!res.success) { Toast.error(res.message); return; }

  const r = res.result;
  resultBox.style.display = 'block';
  resultBox.className = 'wh-test-result ' + (r.delivered ? 'ok' : 'fail');
  head.innerHTML = r.delivered
    ? `<i class="fas fa-check-circle"></i> Terkirim — HTTP ${r.status_code} (${r.attempts} percobaan)`
    : `<i class="fas fa-times-circle"></i> Gagal terkirim (${r.attempts} percobaan)`;
  body.textContent = r.response_body || '(tidak ada response body)';

  if (r.delivered) Toast.success('Test webhook berhasil dikirim');
  else Toast.error('Test webhook gagal — cek response di bawah');
}

async function loadWebhookLogs(page) {
  whLogPage = page;
  const webhookId = document.getElementById('wh-log-filter').value;
  const qs = new URLSearchParams({ page, limit: 10 });
  if (webhookId) qs.set('webhook_id', webhookId);

  const res = await API.get(`/api/user/webhook/logs?${qs.toString()}`);
  const tbody = document.getElementById('wh-log-list');

  if (!res.success || !res.data || !res.data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada riwayat pengiriman webhook</td></tr>`;
    document.getElementById('wh-log-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = res.data.map(l => `<tr>
    <td class="text-xs">${formatDate(l.createdAt)}</td>
    <td><code style="font-size:11px">${l.event}</code></td>
    <td class="text-xs">#${l.attempt}</td>
    <td class="text-xs">${l.status_code || '-'}</td>
    <td>${l.success ? '<span class="badge badge-success">Berhasil</span>' : '<span class="badge badge-danger">Gagal</span>'}</td>
    <td class="text-xs">${l.duration_ms != null ? l.duration_ms + ' ms' : '-'}</td>
  </tr>`).join('');

  renderPagination('wh-log-pagination', res.page, res.pages, (p) => loadWebhookLogs(p));
}

init();

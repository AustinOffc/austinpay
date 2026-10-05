// Halaman profil: verifikasi email, ganti email, dan lupa/reset PIN via OTP email.
// Tanpa inline handler (patuh CSP); semua teks dari server dipasang lewat textContent.

(function () {
  const $ = (id) => document.getElementById(id);
  const COOLDOWN = 60;

  function flash(boxId, type, msg) {
    const box = $(boxId);
    if (!box) return;
    const icon = type === 'success' ? 'check-circle' : (type === 'warning' ? 'exclamation-triangle' : 'times-circle');
    box.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'alert alert-' + type;
    const i = document.createElement('i');
    i.className = 'fas fa-' + icon;
    div.appendChild(i);
    div.appendChild(document.createTextNode(' ' + msg));
    box.appendChild(div);
  }

  function digitsOnly(el) {
    el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, 6); });
  }

  // Tombol kirim kode dengan hitung mundur supaya tidak spam.
  function cooldown(btn, label, seconds) {
    let left = seconds;
    btn.disabled = true;
    btn.textContent = label + ' (' + left + 's)';
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = label;
      } else {
        btn.textContent = label + ' (' + left + 's)';
      }
    }, 1000);
  }

  let me = null;

  function renderEmailStatus() {
    if (!me) return;
    $('email-current').textContent = me.email || '-';
    const badge = $('email-badge');
    const verified = me.email_verified === true;
    badge.className = 'badge ' + (verified ? 'badge-success' : 'badge-warning');
    badge.textContent = verified ? 'Terverifikasi' : 'Belum terverifikasi';
    $('email-verify-box').style.display = verified ? 'none' : '';
    $('email').value = me.email || '';
  }

  async function loadMe() {
    const res = await API.get('/api/auth/me');
    if (res.success) {
      me = res.user;
      renderEmailStatus();
    }
  }

  // ── Verifikasi email ────────────────────────────────────────────────────
  function initVerify() {
    const sendBtn = $('email-verify-send-btn');
    const confirmBtn = $('email-verify-confirm-btn');
    digitsOnly($('email-verify-code'));

    sendBtn.addEventListener('click', async () => {
      btnLoading(sendBtn, true);
      const res = await API.post('/api/user/email/verify/send', {});
      btnLoading(sendBtn, false);
      if (res.success) {
        flash('email-alert', 'success', res.message);
        $('email-verify-confirm').style.display = '';
        $('email-verify-code').focus();
        cooldown(sendBtn, 'Kirim Ulang Kode', COOLDOWN);
      } else {
        flash('email-alert', 'danger', res.message || 'Gagal mengirim kode');
        if (res.retry_after) cooldown(sendBtn, 'Kirim Ulang Kode', res.retry_after);
      }
    });

    confirmBtn.addEventListener('click', async () => {
      const code = $('email-verify-code').value;
      if (!/^\d{6}$/.test(code)) return flash('email-alert', 'warning', 'Kode harus 6 digit angka');
      btnLoading(confirmBtn, true);
      const res = await API.post('/api/user/email/verify/confirm', { code });
      btnLoading(confirmBtn, false);
      if (res.success) {
        flash('email-alert', 'success', res.message);
        Toast.success(res.message);
        if (me) me.email_verified = true;
        $('email-verify-code').value = '';
        $('email-verify-confirm').style.display = 'none';
        renderEmailStatus();
      } else {
        flash('email-alert', 'danger', res.message || 'Verifikasi gagal');
      }
    });
  }

  // ── Ganti email ─────────────────────────────────────────────────────────
  function initChangeEmail() {
    const toggle = $('email-change-toggle-btn');
    const sendBtn = $('email-change-send-btn');
    const confirmBtn = $('email-change-confirm-btn');
    digitsOnly($('email-change-code'));

    toggle.addEventListener('click', () => {
      const box = $('email-change-box');
      box.style.display = box.style.display === 'none' ? '' : 'none';
    });

    sendBtn.addEventListener('click', async () => {
      const new_email = $('email-change-new').value.trim().toLowerCase();
      const password = $('email-change-password').value;
      if (!new_email || !password) return flash('email-alert', 'warning', 'Isi email baru dan password akun');
      btnLoading(sendBtn, true);
      const res = await API.post('/api/user/email/change/send', { new_email, password });
      btnLoading(sendBtn, false);
      if (res.success) {
        flash('email-alert', 'success', res.message);
        $('email-change-confirm').style.display = '';
        $('email-change-code').focus();
        cooldown(sendBtn, 'Kirim Ulang Kode', COOLDOWN);
      } else {
        flash('email-alert', 'danger', res.message || 'Gagal mengirim kode');
        if (res.retry_after) cooldown(sendBtn, 'Kirim Ulang Kode', res.retry_after);
      }
    });

    confirmBtn.addEventListener('click', async () => {
      const new_email = $('email-change-new').value.trim().toLowerCase();
      const code = $('email-change-code').value;
      if (!/^\d{6}$/.test(code)) return flash('email-alert', 'warning', 'Kode harus 6 digit angka');
      btnLoading(confirmBtn, true);
      const res = await API.post('/api/user/email/change/confirm', { new_email, code });
      btnLoading(confirmBtn, false);
      if (res.success) {
        flash('email-alert', 'success', res.message);
        Toast.success(res.message);
        if (me) { me.email = res.email; me.email_verified = true; }
        ['email-change-new', 'email-change-password', 'email-change-code'].forEach((id) => { $(id).value = ''; });
        $('email-change-confirm').style.display = 'none';
        $('email-change-box').style.display = 'none';
        renderEmailStatus();
      } else {
        flash('email-alert', 'danger', res.message || 'Konfirmasi gagal');
      }
    });
  }

  // ── Lupa PIN ────────────────────────────────────────────────────────────
  function initForgotPin() {
    const link = $('pin-forgot-link');
    const sendBtn = $('pin-forgot-send-btn');
    const resetBtn = $('pin-forgot-reset-btn');
    ['pin-forgot-code', 'pin-forgot-new', 'pin-forgot-confirm-pin'].forEach((id) => digitsOnly($(id)));

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = $('pin-forgot-section');
      sec.style.display = sec.style.display === 'none' ? '' : 'none';
    });

    sendBtn.addEventListener('click', async () => {
      btnLoading(sendBtn, true);
      const res = await API.post('/api/user/pin/forgot/send', {});
      btnLoading(sendBtn, false);
      if (res.success) {
        flash('pin-alert', 'success', res.message);
        $('pin-forgot-confirm').style.display = '';
        $('pin-forgot-code').focus();
        cooldown(sendBtn, 'Kirim Ulang Kode', COOLDOWN);
      } else {
        flash('pin-alert', res.code === 'EMAIL_NOT_VERIFIED' ? 'warning' : 'danger', res.message || 'Gagal mengirim kode');
        if (res.retry_after) cooldown(sendBtn, 'Kirim Ulang Kode', res.retry_after);
        if (res.code === 'EMAIL_NOT_VERIFIED') {
          const card = $('email-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    resetBtn.addEventListener('click', async () => {
      const code = $('pin-forgot-code').value;
      const new_pin = $('pin-forgot-new').value;
      const confirm_pin = $('pin-forgot-confirm-pin').value;
      if (!/^\d{6}$/.test(code)) return flash('pin-alert', 'warning', 'Kode email harus 6 digit angka');
      if (!/^\d{6}$/.test(new_pin)) return flash('pin-alert', 'warning', 'PIN baru harus 6 digit angka');
      if (new_pin !== confirm_pin) return flash('pin-alert', 'danger', 'Konfirmasi PIN baru tidak cocok');

      btnLoading(resetBtn, true);
      const res = await API.post('/api/user/pin/forgot/reset', { code, new_pin, confirm_pin });
      btnLoading(resetBtn, false);
      if (res.success) {
        flash('pin-alert', 'success', res.message);
        Toast.success(res.message);
        ['pin-forgot-code', 'pin-forgot-new', 'pin-forgot-confirm-pin'].forEach((id) => { $(id).value = ''; });
        $('pin-forgot-confirm').style.display = 'none';
        $('pin-forgot-section').style.display = 'none';
      } else {
        flash('pin-alert', 'danger', res.message || 'Reset PIN gagal');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('email-card')) return;
    initVerify();
    initChangeEmail();
    initForgotPin();
    loadMe();
  });
})();

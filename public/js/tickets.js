

window.Tickets = {
  socket: null,
  winEl: null,
  currentUser: null,
  isOpen: false,
  view: 'list',
  activeTicketId: null,
  pendingFile: null,

  init(currentUser, socket) {
    this.currentUser = currentUser;
    this.socket = socket;
    this._buildWindow();
    this._bindSocket();
  },

  _buildWindow() {
    const win = document.createElement('div');
    win.className = 'chat-window';
    win.id = 'ticket-window';
    document.body.appendChild(win);
    this.winEl = win;
    this._renderList();
  },

  _bindSocket() {
    if (!this.socket) return;
    this.socket.on('ticket:new_message', (msg) => {
      if (this.view === 'thread' && this.activeTicketId === msg.ticket_id) {
        this._appendMessage(msg, true);
      } else if (this.view === 'list' && this.isOpen) {
        this._renderList();
      } else if (!this.isOpen) {
        Toast.info('Ada balasan baru di Tiket Admin');
      }
    });
    this.socket.on('ticket:new_ticket', (ticket) => {
      if (ticket.user_id === (this.currentUser && this.currentUser.id) && this.view === 'list') this._renderList();
      if (!this.isOpen) Toast.info('Admin membuka tiket baru untukmu');
    });
    this.socket.on('ticket:closed', (ticket) => {
      if (this.view === 'thread' && this.activeTicketId === ticket.id) this._openThread(ticket.id);
      else if (this.view === 'list' && this.isOpen) this._renderList();
    });
    this.socket.on('ticket:updated', (ticket) => {
      if (this.view === 'thread' && this.activeTicketId === ticket.id) this._openThread(ticket.id);
    });
  },

  open() {
    this.winEl?.classList.add('open');
    this.isOpen = true;
    if (this.view === 'list') this._renderList();
  },

  close() {
    this.winEl?.classList.remove('open');
    this.isOpen = false;
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  async _renderList() {
    this.view = 'list';
    this.activeTicketId = null;
    this.winEl.innerHTML = `
      <div class="chat-window-header">
        <div>
          <div class="chat-window-header-title"><i class="fas fa-ticket"></i> Tiket Admin</div>
          <div class="chat-window-header-sub">Riwayat tiket dukunganmu</div>
        </div>
        <button class="chat-window-close" id="ticket-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <button class="ticket-new-btn" id="ticket-new-btn"><i class="fas fa-plus"></i> Buat Tiket Baru</button>
      <div class="ticket-list" id="ticket-list"><div class="chat-empty">Memuat...</div></div>
    `;
    this.winEl.querySelector('#ticket-close-btn').addEventListener('click', () => this.close());
    this.winEl.querySelector('#ticket-new-btn').addEventListener('click', () => this._renderNew());

    const res = await API.get('/api/tickets');
    const listEl = this.winEl.querySelector('#ticket-list');
    if (!listEl) return;
    if (!res.success || !res.data.length) {
      listEl.innerHTML = `<div class="chat-empty"><i class="fas fa-ticket" style="font-size:26px;display:block;margin-bottom:8px;opacity:.5"></i>Belum ada tiket. Buat tiket kalau butuh bantuan admin!</div>`;
      return;
    }
    listEl.innerHTML = res.data.map((t) => `
      <div class="ticket-list-item" data-id="${t.id}">
        <div class="ticket-list-item-icon" style="${t.status === 'closed' ? 'background:#94a3b8' : ''}"><i class="fas fa-ticket"></i></div>
        <div class="ticket-list-item-body">
          <div class="ticket-list-item-title">${escapeHtml(t.subject || 'Tanpa subjek')}</div>
          <div class="ticket-list-item-sub">${escapeHtml((t.last_message || '').slice(0, 40))}</div>
        </div>
        <span class="ticket-status-badge ${t.status}">${t.status === 'open' ? 'Terbuka' : 'Ditutup'}</span>
      </div>
    `).join('');
    listEl.querySelectorAll('.ticket-list-item').forEach((el) => {
      el.addEventListener('click', () => this._openThread(el.getAttribute('data-id')));
    });
  },

  _renderNew() {
    this.view = 'new';
    this.pendingFile = null;
    this.winEl.innerHTML = `
      <div class="chat-window-header">
        <div style="display:flex;align-items:center">
          <button class="ticket-back-btn" id="ticket-back-btn"><i class="fas fa-arrow-left"></i></button>
          <div>
            <div class="chat-window-header-title"><i class="fas fa-ticket"></i> Tiket Baru</div>
          </div>
        </div>
      </div>
      <input type="text" class="ticket-subject-input" id="ticket-subject" placeholder="Subjek (opsional)" maxlength="150">
      <div class="chat-messages" id="ticket-new-hint">
        <div class="chat-empty">Ceritakan kendala kamu di bawah, sertakan foto kalau perlu, admin akan membalas secepatnya 🎫</div>
      </div>
      <div id="ticket-attach-preview"></div>
      <div class="chat-input-row">
        <input type="file" id="ticket-file-input" accept="image/png,image/jpeg,image/webp" style="display:none">
        <button class="ticket-attach-btn" id="ticket-attach-btn" type="button"><i class="fas fa-paperclip"></i></button>
        <textarea id="ticket-new-input" placeholder="Tulis pesan..." rows="1" maxlength="1000"></textarea>
        <button class="chat-send-btn" id="ticket-new-send-btn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    this.winEl.querySelector('#ticket-back-btn').addEventListener('click', () => this._renderList());
    this._bindAttach('ticket-file-input', 'ticket-attach-btn', 'ticket-attach-preview');
    this.winEl.querySelector('#ticket-new-send-btn').addEventListener('click', () => this._submitNewTicket());
    const input = this.winEl.querySelector('#ticket-new-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submitNewTicket(); }
    });
  },

  async _submitNewTicket() {
    const subject = this.winEl.querySelector('#ticket-subject').value.trim();
    const message = this.winEl.querySelector('#ticket-new-input').value.trim();
    if (!message && !this.pendingFile) { Toast.warning('Tulis pesan atau lampirkan foto dulu'); return; }

    const btn = this.winEl.querySelector('#ticket-new-send-btn');
    btn.disabled = true;

    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('message', message);
    if (this.pendingFile) fd.append('image', this.pendingFile);

    const res = await fetch(apiUrl('/api/tickets'), { method: 'POST', credentials: 'include', body: fd }).then((r) => r.json()).catch(() => ({ success: false, message: 'Gagal terhubung ke server' }));
    btn.disabled = false;

    if (!res.success) { Toast.error(res.message || 'Gagal membuka tiket'); return; }
    Toast.success('Tiket berhasil dibuka!');
    this._openThread(res.ticket.id);
  },

  async _openThread(ticketId) {
    this.view = 'thread';
    this.activeTicketId = ticketId;
    this.pendingFile = null;
    this.winEl.innerHTML = `
      <div class="chat-window-header">
        <div style="display:flex;align-items:center">
          <button class="ticket-back-btn" id="ticket-back-btn"><i class="fas fa-arrow-left"></i></button>
          <div>
            <div class="chat-window-header-title" id="ticket-thread-title"><i class="fas fa-ticket"></i> Tiket</div>
          </div>
        </div>
        <button class="chat-window-close" id="ticket-close-window-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="chat-messages" id="ticket-messages"><div class="chat-empty">Memuat percakapan...</div></div>
      <div id="ticket-thread-footer"></div>
    `;
    this.winEl.querySelector('#ticket-back-btn').addEventListener('click', () => this._renderList());
    this.winEl.querySelector('#ticket-close-window-btn').addEventListener('click', () => this.close());

    const res = await API.get(`/api/tickets/${ticketId}/messages`);
    if (this.view !== 'thread' || this.activeTicketId !== ticketId) return;
    if (!res.success) { Toast.error(res.message || 'Gagal memuat tiket'); this._renderList(); return; }

    const titleEl = this.winEl.querySelector('#ticket-thread-title');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-ticket"></i> ${escapeHtml(res.ticket.subject || 'Tiket')}`;

    const container = this.winEl.querySelector('#ticket-messages');
    container.innerHTML = '';
    res.messages.forEach((m) => this._appendMessage(m, false));
    this._scrollToBottom();

    const footer = this.winEl.querySelector('#ticket-thread-footer');
    if (res.ticket.status === 'closed') {
      footer.innerHTML = `<div class="ticket-closed-banner"><i class="fas fa-lock"></i> Tiket ini sudah ditutup. Buat tiket baru kalau masih butuh bantuan.</div>`;
    } else {
      footer.innerHTML = `
        <div id="ticket-thread-attach-preview"></div>
        <div class="chat-input-row">
          <input type="file" id="ticket-thread-file-input" accept="image/png,image/jpeg,image/webp" style="display:none">
          <button class="ticket-attach-btn" id="ticket-thread-attach-btn" type="button"><i class="fas fa-paperclip"></i></button>
          <textarea id="ticket-thread-input" placeholder="Tulis balasan..." rows="1" maxlength="1000"></textarea>
          <button class="chat-send-btn" id="ticket-thread-send-btn"><i class="fas fa-paper-plane"></i></button>
        </div>
        <button class="ticket-new-btn" style="background:var(--danger);margin-top:0" id="ticket-close-btn"><i class="fas fa-lock"></i> Tutup Tiket</button>
      `;
      this._bindAttach('ticket-thread-file-input', 'ticket-thread-attach-btn', 'ticket-thread-attach-preview');
      this.winEl.querySelector('#ticket-thread-send-btn').addEventListener('click', () => this._sendThreadMessage(ticketId));
      const input = this.winEl.querySelector('#ticket-thread-input');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendThreadMessage(ticketId); }
      });
      this.winEl.querySelector('#ticket-close-btn').addEventListener('click', () => this._closeTicket(ticketId));
    }
  },

  async _sendThreadMessage(ticketId) {
    const input = this.winEl.querySelector('#ticket-thread-input');
    const message = input.value.trim();
    if (!message && !this.pendingFile) return;

    // [FIX] Cegah kirim ganda (tap 2x / Enter + klik) selama request masih jalan.
    if (this._sending) return;
    this._sending = true;

    const btn = this.winEl.querySelector('#ticket-thread-send-btn');
    btn.disabled = true;

    const fd = new FormData();
    fd.append('message', message);
    if (this.pendingFile) fd.append('image', this.pendingFile);

    let res;
    try {
      res = await fetch(apiUrl(`/api/tickets/${ticketId}/messages`), { method: 'POST', credentials: 'include', body: fd }).then((r) => r.json()).catch(() => ({ success: false, message: 'Gagal terhubung ke server' }));
    } finally {
      this._sending = false;
      btn.disabled = false;
    }

    if (!res.success) { Toast.error(res.message || 'Gagal mengirim pesan'); return; }
    input.value = '';
    this.pendingFile = null;
    const preview = this.winEl.querySelector('#ticket-thread-attach-preview');
    if (preview) preview.innerHTML = '';
    this._appendMessage(res.data, true);
  },

  async _closeTicket(ticketId) {
    if (!await austinConfirm('Tutup tiket ini? Kamu tetap bisa membuat tiket baru kalau masih butuh bantuan.')) return;
    const res = await API.post(`/api/tickets/${ticketId}/close`);
    if (!res.success) { Toast.error(res.message || 'Gagal menutup tiket'); return; }
    Toast.success('Tiket ditutup');
    this._openThread(ticketId);
  },

  _bindAttach(fileInputId, btnId, previewId) {
    const fileInput = this.winEl.querySelector(`#${fileInputId}`);
    const btn = this.winEl.querySelector(`#${btnId}`);
    const preview = this.winEl.querySelector(`#${previewId}`);
    if (!fileInput || !btn) return;
    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { Toast.warning('Ukuran foto maksimal 5MB'); fileInput.value = ''; return; }
      this.pendingFile = file;
      const url = URL.createObjectURL(file);
      if (preview) {
        preview.innerHTML = `
          <div class="ticket-image-preview">
            <img src="${url}" alt="">
            <span>${escapeHtml(file.name)}</span>
            <button type="button" id="ticket-remove-attach"><i class="fas fa-times"></i></button>
          </div>
        `;
        preview.querySelector('#ticket-remove-attach').addEventListener('click', () => {
          this.pendingFile = null;
          fileInput.value = '';
          preview.innerHTML = '';
        });
      }
    });
  },

  _appendMessage(msg, scroll) {
    const container = this.winEl.querySelector('#ticket-messages');
    if (!container) return;

    // [FIX] Pesan yang sama datang 2x: sekali dari respon HTTP kirim, sekali dari
    // event socket 'ticket:new_message' (server juga emit ke room pengirim).
    // Skip kalau id pesan sudah ada di layar.
    if (msg.id && container.querySelector(`[data-id="${String(msg.id).replace(/"/g, '')}"]`)) return;

    if (container.querySelector('.chat-empty')) container.innerHTML = '';

    if (msg.sender_type === 'system') {
      const el = document.createElement('div');
      el.className = 'chat-empty';
      el.style.padding = '4px 16px';
      if (msg.id) el.setAttribute('data-id', msg.id);
      el.textContent = msg.message;
      container.appendChild(el);
      if (scroll) this._scrollToBottom();
      return;
    }

    const isMine = msg.sender_type === 'user' && this.currentUser && this.currentUser.role !== 'admin';
    const isMineAdmin = msg.sender_type === 'admin' && this.currentUser && this.currentUser.role === 'admin';
    const mine = isMine || isMineAdmin;
    const initial = (msg.sender_name || '?')[0].toUpperCase();
    const time = new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const displayText = String(msg.message || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    const el = document.createElement('div');
    el.className = `chat-msg ${mine ? 'mine' : ''}`;
    el.setAttribute('data-id', msg.id);
    el.innerHTML = `
      <div class="chat-msg-avatar">${initial}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name">${escapeHtml(msg.sender_name || (msg.sender_type === 'admin' ? 'Admin' : 'User'))}${msg.sender_type === 'admin' ? '<span class="admin-tag">ADMIN</span>' : ''}</div>
        <div class="chat-bubble">${msg.image ? `<img src="${msg.image}" class="chat-msg-image" onclick="window.open('${msg.image}','_blank')">` : ''}${displayText ? escapeHtml(displayText) : ''}</div>
        <div class="chat-msg-time">${time}</div>
      </div>
    `;
    container.appendChild(el);
    if (scroll) this._scrollToBottom();
  },

  _scrollToBottom() {
    const container = this.winEl && this.winEl.querySelector('#ticket-messages');
    if (container) container.scrollTop = container.scrollHeight;
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}


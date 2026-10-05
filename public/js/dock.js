/* AustinPay UI v3 — navigasi bawah (dock).
   Disisipkan otomatis di halaman yang punya sidebar/menu.
   Item aktif melebar & menampilkan label; "Menu" membuka drawer lengkap. */
(function () {
  if (!document.querySelector('.sidebar')) return; // halaman auth / 404 tidak pakai dock
  if (document.querySelector('.dock')) return;

  // Halaman bisa menimpa isi dock lewat window.AUSTIN_DOCK (dipakai halaman admin:
  // item bertipe {section:'...'} memicu menu admin dengan data-section yang sama).
  var items = window.AUSTIN_DOCK || [
    { href: '/dashboard', label: 'Beranda', icon: 'fa-house',         tone: 'green'  },
    { href: '/deposit',   label: 'Deposit', icon: 'fa-arrow-down',    tone: 'indigo' },
    { href: '/withdraw',  label: 'Withdraw', icon: 'fa-arrow-up',     tone: 'orange' },
    { href: '/history',   label: 'Riwayat', icon: 'fa-clock-rotate-left', tone: 'purple' },
    { menu: true,         label: 'Menu',    icon: 'fa-grip',          tone: 'yellow' }
  ];

  var path = location.pathname.replace(/\/+$/, '') || '/';
  var dock = document.createElement('nav');
  dock.className = 'dock';
  dock.setAttribute('aria-label', 'Navigasi utama');

  var hasActive = false;
  items.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dock-item';
    b.setAttribute('data-tone', it.tone);
    b.setAttribute('aria-label', it.label);
    b.innerHTML = '<i class="fas ' + it.icon + '"></i><span>' + it.label + '</span>';

    if (it.section) b.setAttribute('data-dock-section', it.section);
    if (!it.menu && !it.section && (path === it.href || path.indexOf(it.href + '/') === 0)) {
      b.classList.add('active');
      b.setAttribute('aria-current', 'page');
      hasActive = true;
    }

    b.addEventListener('click', function () {
      if (it.menu) {
        var toggle = document.getElementById('sidebar-toggle');
        if (toggle) { toggle.click(); return; }
        var sb = document.querySelector('.sidebar');
        var ov = document.getElementById('sidebar-overlay');
        if (sb) sb.classList.toggle('open');
        if (ov) ov.classList.toggle('open');
        return;
      }
      if (it.section) {
        var nav = document.querySelector('#admin-nav .nav-item[data-section="' + it.section + '"]');
        if (nav) nav.click();
        window.scrollTo({ top: 0 });
        return;
      }
      if (path !== it.href) location.href = it.href;
    });
    dock.appendChild(b);
  });

  // Halaman admin: item aktif mengikuti menu admin yang sedang terbuka
  var adminNav = document.getElementById('admin-nav');
  if (adminNav && items.some(function (i) { return i.section; })) {
    var syncAdmin = function () {
      var cur = adminNav.querySelector('.nav-item.active[data-section]');
      var sec = cur && cur.getAttribute('data-section');
      var matched = false;
      dock.querySelectorAll('.dock-item').forEach(function (d) {
        var on = !!sec && d.getAttribute('data-dock-section') === sec;
        d.classList.toggle('active', on);
        if (on) matched = true;
      });
      if (!matched) dock.lastChild.classList.add('active');
    };
    new MutationObserver(syncAdmin).observe(adminNav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    document.body.appendChild(dock);
    syncAdmin();
    hasActive = true;
  }

  // Halaman di luar 4 tujuan utama (profil, webhook, dll): tandai "Menu" aktif
  if (!hasActive) dock.lastChild.classList.add('active');

  if (!dock.parentNode) document.body.appendChild(dock);

  // Tutup drawer dengan tombol Escape
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var sb = document.querySelector('.sidebar');
    var ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('open');
  });
})();

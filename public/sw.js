

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'AustinPay', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'AustinPay';
  const options = {
    body: data.body || '',
    icon: '/uploads/logo_1783120214476.jpg',
    badge: '/uploads/logo_1783120214476.jpg',
    tag: data.tag || undefined,
    data: { url: data.url || '/dashboard' },
    // Eksplisit: jangan silent, dan getar (dipakai browser mobile/Chrome
    // Android) supaya notifikasi terasa "berdering", bukan cuma muncul diam.
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })
  );
});



const Push = {
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  },

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {

      const me = await API.get('/api/auth/me');
      if (!me || !me.success) return;

      const reg = await navigator.serviceWorker.register('/sw.js');

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await API.post('/api/user/push/subscribe', existing.toJSON());
        return;
      }

      if (Notification.permission === 'denied') return;

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      const keyRes = await API.get('/api/push/vapid-public-key');
      if (!keyRes.success || !keyRes.publicKey) return;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Push.urlBase64ToUint8Array(keyRes.publicKey),
      });

      await API.post('/api/user/push/subscribe', subscription.toJSON());
    } catch (err) {
      console.warn('[Push] Setup notifikasi browser gagal:', err.message);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => Push.init());

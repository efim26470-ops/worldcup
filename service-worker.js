const CACHE = 'wc26-lean-shell-v61';
const SHELL = [
  './', './index.html', './styles.css', './config.js', './demo-data.js', './app.js',
  './manifest.webmanifest', './assets/icons/apple-touch-icon.png', './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('.workers.dev')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const network = fetch(request).then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => null);
      return cached || network || Response.error();
    })());
  }
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') return;
  const payload = event.data.payload || {};
  event.waitUntil(self.registration.showNotification(payload.title || 'World Cup 26', {
    body: payload.body || '',
    tag: payload.tag || 'wc26',
    renotify: true,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/favicon-32.png',
    data: { url: payload.url || './#today' }
  }));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'World Cup 26', {
    body: payload.body || 'Новое событие матча',
    tag: payload.tag || 'wc26-push',
    renotify: true,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/favicon-32.png',
    data: { url: payload.url || './#today' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#today', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});

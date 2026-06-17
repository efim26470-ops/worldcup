const CACHE = 'wc26-final-direct-v9';
const SHELL = [
  './', './index.html', './styles.css?v=20260618-direct9', './config.js?v=20260618-direct9',
  './demo-data.js?v=20260618-direct9', './direct-data.js?v=20260618-direct9', './app.js?v=20260618-direct9',
  './manifest.webmanifest', './assets/icons/apple-touch-icon.png', './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/trophies/world-cup.svg', './assets/trophies/copa-america.svg', './assets/trophies/euro.svg',
  './assets/trophies/nations-league.svg', './assets/trophies/olympic.svg', './assets/trophies/finalissima.svg',
  './assets/trophies/u20-world-cup.svg', './assets/trophies/golden-ball.svg', './assets/trophies/golden-boot.svg',
  './assets/trophies/golden-glove.svg', './assets/trophies/young-player.svg', './assets/trophies/international-award.svg',
  './assets/trophies/photos/world-cup.jpg', './assets/trophies/photos/copa-america.jpg',
  './assets/trophies/photos/euro.jpg', './assets/trophies/photos/nations-league.jpg'
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
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(async response => {
      const cache = await caches.open(CACHE); cache.put('./index.html', response.clone()); return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const isCode = /\.(?:js|css)$/.test(url.pathname);
  if (isCode) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(async response => {
      if (response.ok) { const cache = await caches.open(CACHE); cache.put(request, response.clone()); }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
    if (response.ok) { const cache = await caches.open(CACHE); cache.put(request, response.clone()); }
    return response;
  })));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') return;
  const payload = event.data.payload || {};
  event.waitUntil(self.registration.showNotification(payload.title || 'World Cup 26', {
    body: payload.body || '', tag: payload.tag || 'wc26', renotify: true,
    icon: './assets/icons/icon-192.png', badge: './assets/icons/favicon-32.png',
    data: { url: payload.url || './#today' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#today', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); if ('navigate' in existing) await existing.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});

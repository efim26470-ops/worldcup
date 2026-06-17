const CACHE = 'wc26-final-shell-v1';
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

  // API always stays network-only. The app itself stores the last good snapshot.
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

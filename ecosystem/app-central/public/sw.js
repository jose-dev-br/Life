const CACHE_NAME = 'jornada-v2';
const STATIC_ASSETS = [
  '/',
  '/hub.html',
  '/shared/api.js',
  '/shared/store.js',
  '/shared/security.js',
  '/shared/sync.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/')) {
    if (e.request.method === 'POST') {
      e.respondWith(
        fetch(e.request.clone()).catch(() => {
          return new Response(JSON.stringify({ ok: false, error: 'offline', queued: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        })
      );
      return;
    }
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ ok: false, error: 'Sem conexão' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('/hub.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'jornada-sync') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_TRIGGER' }));
      })
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

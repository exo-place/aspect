const CACHE_NAME = 'aspect-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  // Stale-while-revalidate for assets
  e.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(e.request);

      const fetchPromise = fetch(e.request).then(response => {
        if (response.ok) {
          cache.put(e.request, response.clone());
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

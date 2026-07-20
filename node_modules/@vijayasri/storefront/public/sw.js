const CACHE_NAME = 'vijayasri_cache_v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  (event as any).waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static storefront shells');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  (event as any).waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning historical cache keys:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch Interceptor (Network falling back to Cache)
self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache new responses dynamically
        if (response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Generic placeholder response if both fail
          return new Response('Offline Mode active. Live catalog connection required for this action.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

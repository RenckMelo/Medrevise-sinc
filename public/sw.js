const CACHE_NAME = 'medrevise-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Non-GET requests should always bypass cache
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip external APIs (MercadoPago, Firebase, Firestore, Google APIs, WebSockets)
  if (!url.origin.includes(self.location.origin) || url.pathname.includes('/api/')) {
    return;
  }
  
  // Cache-first for stable assets (icons, manifest, svgs, pngs)
  if (url.pathname.startsWith('/icons/') || 
      url.pathname.endsWith('.svg') || 
      url.pathname.endsWith('.png') || 
      url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  } else {
    // Network-first for HTML pages, CSS files and compiled JS bundles
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Client-side single page app routing fallback
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});

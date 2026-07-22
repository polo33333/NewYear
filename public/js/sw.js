const CACHE_NAME = 'kdstream-v5';
const ASSETS = [
  '/',
  '/css/control.css?v=15',
  '/css/sidebar.css?v=5',
  '/js/control.js?v=2',
  '/js/sidebar.js?v=2'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.log('PWA cache error:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept GET requests from HTTP/HTTPS protocols
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Bypass API requests, hot reloading, sockets, static images, and dynamic templates
  if (
    e.request.url.includes('/api/') || 
    e.request.url.includes('/templates/') ||
    e.request.url.includes('/socket') || 
    e.request.url.includes('socket.io') || 
    e.request.url.includes('browser-sync') ||
    e.request.url.includes('/live-reload') ||
    e.request.url.includes('/images/')
  ) {
    return;
  }

  // For HTML navigation requests (e.g. /settings, /history, /character-editor)
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return caches.match('/').then((response) => response || caches.match(e.request));
      })
    );
    return;
  }

  // For static assets, try network first, fallback to cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});


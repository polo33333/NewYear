const CACHE_NAME = 'kdstream-v4';
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
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Only intercept GET requests from HTTP/HTTPS protocols
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Bypass API requests, hot reloading, sockets, and static images
  if (
    e.request.url.includes('/api/') || 
    e.request.url.includes('/socket') || 
    e.request.url.includes('socket.io') || 
    e.request.url.includes('browser-sync') ||
    e.request.url.includes('/live-reload') ||
    e.request.url.includes('/images/')
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request).then((response) => {
        if (response) {
          return response;
        }
        // Return a basic offline fallback or let it fail gracefully without uncaught rejection
        return new Response('Network error occurred', {
          status: 488,
          statusText: 'Network Connection Failed'
        });
      });
    })
  );
});

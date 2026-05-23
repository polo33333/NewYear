const CACHE_NAME = 'kdstream-v2';
const ASSETS = [
  '/',
  '/css/control.css?v=6',
  '/css/sidebar.css',
  '/js/control.js',
  '/js/sidebar.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.log('PWA cache error:', err));
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept GET requests from HTTP/HTTPS protocols
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch((err) => {
      return caches.match(e.request).then((response) => {
        if (response) {
          return response;
        }
        throw err;
      });
    })
  );
});

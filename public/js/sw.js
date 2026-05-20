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
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});

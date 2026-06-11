const CACHE_NAME = 'emarket-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pages/login.html',
  '/pages/recovery.html',
  '/pages/catalog.html',
  '/pages/product.html',
  '/pages/cart.html',
  '/pages/checkout.html',
  '/pages/profile.html',
  '/pages/admin-dashboard.html',
  '/pages/admin-products.html',
  '/pages/admin-sales.html',
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/pages.css',
  '/js/utils.js',
  '/js/store.js',
  '/js/api.js',
  '/js/theme.js',
  '/js/auth.js',
  '/js/offline.js',
  '/js/cart.js',
  '/js/products.js',
  '/js/checkout.js',
  '/js/reviews.js',
  '/js/admin.js',
  '/manifest.json'
];

/* ── Install: pre-cache static assets ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/* ── Fetch: Cache First for static, Network First for API ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: Network First
  if (url.hostname === 'fakestoreapi.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
      )
      .catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

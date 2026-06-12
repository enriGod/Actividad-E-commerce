const CACHE_NAME = 'emarket-v10';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET
  if (event.request.method !== 'GET') return;

  // External API (FakeStore): Network First with cache fallback
  if (url.hostname === 'fakestoreapi.com') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // JS, CSS and HTML files: always Network First so code changes
  // are visible on the next normal reload (no hard reload needed).
  // Versioned requests (?v=...) are never cached.
  const isCode = /\.(js|css|html)$/.test(url.pathname) ||
                 event.request.mode === 'navigate';
  const hasVersionParam = url.search.includes('v=');

  if (isCode || hasVersionParam) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache clean (unversioned) responses for offline use
          if (res.status === 200 && !hasVersionParam) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Images, fonts, etc.: Cache First (rarely changes)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('/index.html');
    })
  );
});

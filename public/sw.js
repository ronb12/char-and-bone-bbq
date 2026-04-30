/* Char & Bone BBQ — service worker (PWA). Bump VERSION after changing precache or strategies. */
var VERSION = 'cbbq-pwa-v2';
var CACHE = 'cbbq-' + VERSION;

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/site.css',
  '/js/cart.js',
  '/js/nav.js',
  '/js/orders-sync.js',
  '/menu.json',
  '/site.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];

function isStaticFile(url) {
  var p = url.pathname;
  return (
    /\.(css|js|json|png|ico|svg|html|webmanifest)$/i.test(p) || p === '/site.webmanifest'
  );
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          PRECACHE_URLS.map(function (url) {
            return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (!sameOrigin(url)) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(function () {
        return new Response(JSON.stringify({ offline: true, error: 'You appear to be offline.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  var accept = req.headers.get('accept') || '';
  var wantsHtml =
    accept.indexOf('text/html') !== -1 || accept.indexOf('application/xhtml+xml') !== -1;
  var isNavigate = req.mode === 'navigate';
  var isPageRequest = isNavigate || (wantsHtml && !isStaticFile(url));

  if (isPageRequest) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            if (hit) return hit;
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  if (isStaticFile(url)) {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req).then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          });
          if (cached) {
            network.catch(function () {});
            return cached;
          }
          return network;
        });
      })
    );
  }
});

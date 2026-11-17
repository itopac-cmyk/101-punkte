var CACHE = '101-punkte-v2';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './numbers.js',
  './score.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/carlito-latin-400.woff2',
  './fonts/carlito-latin-700.woff2',
  './fonts/carlito-latin-ext-400.woff2',
  './fonts/carlito-latin-ext-700.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return fetch(req).then(function (fresh) {
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }).catch(function () {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') return cache.match('./index.html');
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      });
    })
  );
});

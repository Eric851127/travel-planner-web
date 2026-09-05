const CACHE_NAME = 'travel-planner-p16-2-20260905-1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './p4.js',
  './p7.js',
  './p7maps-shared.js',
  './p7map.js',
  './p7network.js',
  './p7today.js',
  './p8.js',
  './p14-place-memos-traveler.js',
  './p16-runtime-core.js',
  './admin.html',
  './admin-p11.html',
  './p14-place-memos-admin.js',
  './p16-admin-places-ux.js',
  './p9-auth-poc.html',
  './manifest.webmanifest',
  './app-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});

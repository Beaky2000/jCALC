// jCALC service worker: makes the app work offline.
//
// Strategy: stale-while-revalidate. Every request is answered from the cache
// immediately (so the app starts instantly, with or without network), and when
// online the file is re-fetched in the background to refresh the cache. A new
// index.html therefore shows up on the launch AFTER it was published, without
// having to edit this file.
//
// Bump VERSION only when the list of files in ASSETS changes (or to force all
// clients to drop their cache); old caches are deleted on activation.

const VERSION = 'v1';
const CACHE = 'jcalc-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses the browser HTTP cache so we store fresh copies.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('jcalc-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // All page navigations (e.g. "./", "./?source=pwa") are served the app page.
  const key = req.mode === 'navigate' ? './' : req;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });

    // 'no-cache' revalidates with the server instead of trusting GitHub Pages'
    // 10-minute HTTP cache, so updates are picked up promptly.
    const refresh = fetch(req.mode === 'navigate' ? './' : req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      })
      .catch(() => undefined);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    return (await refresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});

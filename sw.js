/* Fiduciary Quest service worker — cache-first shell, network-first data */
const CACHE = 'fq-v1';
const SHELL = [
  '.', 'index.html', 'css/style.css', 'js/app.js', 'manifest.json',
  'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // data files: network first (pick up new questions/cases), fall back to cache.
  // cache:'no-cache' forces revalidation with the server — the browser's heuristic
  // HTTP cache otherwise keeps serving a stale question bank after updates.
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // shell: network first so updates land immediately, cache fallback for offline
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

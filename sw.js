// Offline support: the app shell is cached on install; Google Fonts are cached as they load.
// build-app.py stamps VERSION from the app's contents, so phones pick up each rebuild.
const VERSION = 'dixon-closet-d7f8f91d0c';
const SHELL = [
  './', 'index.html', 'app-extras.js', 'app-sync.js', 'sync-config.js', 'manifest.webmanifest', 'vendor/anthropic.mjs', 'vendor/supabase.mjs',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Fetch past the browser's own cache, so a new version never installs yesterday's files.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache:'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname === 'api.anthropic.com') return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin === self.location.origin) {
    // Network first for the page itself so updates show up; cache first for everything else.
    if (e.request.mode === 'navigate') {
      e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return r; })
        .catch(() => caches.match('index.html')));
      return;
    }
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
});

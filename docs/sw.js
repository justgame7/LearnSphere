/* LearnSphere service worker. Bump VERSION on every release so installed apps update. */
const VERSION = 'v9';
const SHELL = `ls-shell-${VERSION}`;
const RUNTIME = `ls-runtime-${VERSION}`;
const ASSETS = [
  './', './index.html', './pg-lesson.js', './pg-quiz.js', './rs-common.js', './rs-s01.js', './rs-s02.js', './rs-s03.js', './rs-s04.js', './rs-s05.js', './rs-s06.js', './rs-s07.js', './rs-s08.js', './rs-s09.js', './rs-s10.js', './rs-s11.js', './rs-s12.js', './rs-s13.js', './rs-s14.js', './rs-q01.js', './rs-q02.js', './rs-q03.js', './rs-q04.js', './rs-q05.js', './rs-q06.js', './rs-q07.js', './rs-q08.js', './rs-q09.js', './rs-q10.js', './rs-q11.js', './rs-q12.js', './rs-q13.js', './rs-q14.js',
  './k8s-common.js', './k8s-s01.js', './k8s-s02.js', './k8s-s03.js', './k8s-s04.js', './k8s-s05.js', './k8s-s06.js', './k8s-s07.js', './k8s-s08.js', './k8s-s09.js', './k8s-s10.js', './k8s-s11.js', './k8s-q11.js', './k8s-s12.js', './k8s-q12.js', './k8s-q01.js', './k8s-q02.js', './k8s-q03.js', './k8s-q04.js', './k8s-q05.js', './k8s-q06.js', './k8s-q07.js', './k8s-q08.js', './k8s-q09.js', './k8s-q10.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page navigations: network first, fall back to cached app shell (offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(SHELL).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin files and Google Fonts: stale-while-revalidate.
  const ok = url.origin === location.origin ||
             url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) caches.open(RUNTIME).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

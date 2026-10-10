/* LearnSphere service worker. Bump VERSION on every release so installed apps update. */
const VERSION = 'v20';
const SHELL = `ls-shell-${VERSION}`;
const RUNTIME = `ls-runtime-${VERSION}`;
const ASSETS = [
  './', './index.html', './pg-lesson.js', './pg-quiz.js', './rs-common.js', './rs-s01.js', './rs-s02.js', './rs-s03.js', './rs-s04.js', './rs-s05.js', './rs-s06.js', './rs-s07.js', './rs-s08.js', './rs-s09.js', './rs-s10.js', './rs-s11.js', './rs-s12.js', './rs-s13.js', './rs-s14.js', './rs-q01.js', './rs-q02.js', './rs-q03.js', './rs-q04.js', './rs-q05.js', './rs-q06.js', './rs-q07.js', './rs-q08.js', './rs-q09.js', './rs-q10.js', './rs-q11.js', './rs-q12.js', './rs-q13.js', './rs-q14.js',
  './k8s-common.js', './k8s-s01.js', './k8s-s02.js', './k8s-s03.js', './k8s-s04.js', './k8s-s05.js', './k8s-s06.js', './k8s-s07.js', './k8s-s08.js', './k8s-s09.js', './k8s-s10.js', './k8s-s11.js', './k8s-q11.js', './k8s-s12.js', './k8s-q12.js', './k8s-s13.js', './k8s-q13.js', './k8s-s14.js', './k8s-q14.js', './k8s-q01.js', './k8s-q02.js', './k8s-q03.js', './k8s-q04.js', './k8s-q05.js', './k8s-q06.js', './k8s-q07.js', './k8s-q08.js', './k8s-q09.js', './k8s-q10.js',
  './docker-common.js', './docker-s01.js', './docker-q01.js', './docker-s02.js', './docker-q02.js', './docker-s03.js', './docker-q03.js', './docker-s04.js', './docker-q04.js', './docker-s05.js', './docker-q05.js', './docker-s06.js', './docker-q06.js', './docker-s07.js', './docker-q07.js', './docker-s08.js', './docker-q08.js', './docker-s09.js', './docker-q09.js', './docker-s10.js', './docker-q10.js', './docker-s11.js', './docker-q11.js', './docker-s12.js', './docker-q12.js',
  './tf-common.js', './tf-s01.js', './tf-q01.js', './tf-s02.js', './tf-q02.js', './tf-s03.js', './tf-q03.js', './tf-s04.js', './tf-q04.js', './tf-s05.js', './tf-q05.js', './tf-s06.js', './tf-q06.js', './tf-s07.js', './tf-q07.js', './tf-s08.js', './tf-q08.js', './tf-s09.js', './tf-q09.js', './tf-s10.js', './tf-q10.js', './tf-s11.js', './tf-q11.js', './tf-s12.js', './tf-q12.js', './tf-s13.js', './tf-q13.js', './tf-s14.js', './tf-q14.js', './tf-s15.js', './tf-q15.js',
  './ora-common.js', './ora-core-s01.js', './ora-core-q01.js', './ora-core-s02.js', './ora-core-q02.js', './ora-core-s03.js', './ora-core-q03.js', './ora-core-s04.js', './ora-core-q04.js', './ora-core-s05.js', './ora-core-q05.js', './ora-core-s06.js', './ora-core-q06.js', './ora-core-s07.js', './ora-core-q07.js', './ora-core-s08.js', './ora-core-q08.js', './ora-core-s09.js', './ora-core-q09.js', './ora-core-s10.js', './ora-core-q10.js', './ora-core-s11.js', './ora-core-q11.js', './ora-core-s12.js', './ora-core-q12.js', './ora-core-s13.js', './ora-core-q13.js', './ora-core-s14.js', './ora-core-q14.js', './ora-core-s15.js', './ora-core-q15.js',
  './ora-rac-s01.js', './ora-rac-q01.js', './ora-rac-s02.js', './ora-rac-q02.js', './ora-rac-s03.js', './ora-rac-q03.js', './ora-rac-s04.js', './ora-rac-q04.js', './ora-rac-s05.js', './ora-rac-q05.js', './ora-rac-s06.js', './ora-rac-q06.js', './ora-rac-s07.js', './ora-rac-q07.js', './ora-rac-s08.js', './ora-rac-q08.js', './ora-rac-s09.js', './ora-rac-q09.js', './ora-rac-s10.js', './ora-rac-q10.js',
  './ora-exa-s01.js', './ora-exa-q01.js', './ora-exa-s02.js', './ora-exa-q02.js', './ora-exa-s03.js', './ora-exa-q03.js', './ora-exa-s04.js', './ora-exa-q04.js', './ora-exa-s05.js', './ora-exa-q05.js', './ora-exa-s06.js', './ora-exa-q06.js', './ora-exa-s07.js', './ora-exa-q07.js', './ora-exa-s08.js', './ora-exa-q08.js', './ora-exa-s09.js', './ora-exa-q09.js', './ora-exa-s10.js', './ora-exa-q10.js',
  './ora-dg-s01.js', './ora-dg-q01.js', './ora-dg-s02.js', './ora-dg-q02.js', './ora-dg-s03.js', './ora-dg-q03.js', './ora-dg-s04.js', './ora-dg-q04.js', './ora-dg-s05.js', './ora-dg-q05.js', './ora-dg-s06.js', './ora-dg-q06.js', './ora-dg-s07.js', './ora-dg-q07.js', './ora-dg-s08.js', './ora-dg-q08.js', './ora-dg-s09.js', './ora-dg-q09.js', './ora-dg-s10.js', './ora-dg-q10.js', './ora-dg-s11.js', './ora-dg-q11.js', './ora-dg-s12.js', './ora-dg-q12.js',
  './ora-gg-s01.js', './ora-gg-q01.js', './ora-gg-s02.js', './ora-gg-q02.js', './ora-gg-s03.js', './ora-gg-q03.js', './ora-gg-s04.js', './ora-gg-q04.js', './ora-gg-s05.js', './ora-gg-q05.js', './ora-gg-s06.js', './ora-gg-q06.js', './ora-gg-s07.js', './ora-gg-q07.js', './ora-gg-s08.js', './ora-gg-q08.js', './ora-gg-s09.js', './ora-gg-q09.js', './ora-gg-s10.js', './ora-gg-q10.js', './ora-gg-s11.js', './ora-gg-q11.js', './ora-gg-s12.js', './ora-gg-q12.js', './ora-gg-s13.js', './ora-gg-q13.js',
  './ora-bkp-s01.js', './ora-bkp-q01.js', './ora-bkp-s02.js', './ora-bkp-q02.js', './ora-bkp-s03.js', './ora-bkp-q03.js', './ora-bkp-s04.js', './ora-bkp-q04.js', './ora-bkp-s05.js', './ora-bkp-q05.js', './ora-bkp-s06.js', './ora-bkp-q06.js', './ora-bkp-s07.js', './ora-bkp-q07.js', './ora-bkp-s08.js', './ora-bkp-q08.js', './ora-bkp-s09.js', './ora-bkp-q09.js', './ora-bkp-s10.js', './ora-bkp-q10.js', './ora-perf-s01.js', './ora-perf-q01.js', './ora-perf-s02.js', './ora-perf-q02.js', './ora-perf-s03.js', './ora-perf-q03.js', './ora-perf-s04.js', './ora-perf-q04.js', './ora-perf-s05.js', './ora-perf-q05.js', './ora-perf-s06.js', './ora-perf-q06.js', './ora-perf-s07.js', './ora-perf-q07.js', './ora-perf-s08.js', './ora-perf-q08.js', './ora-perf-s09.js', './ora-perf-q09.js', './ora-perf-s10.js', './ora-perf-q10.js', './ora-perf-s11.js', './ora-perf-q11.js', './ora-sec-s01.js', './ora-sec-q01.js', './ora-sec-s02.js', './ora-sec-q02.js', './ora-sec-s03.js', './ora-sec-q03.js', './ora-sec-s04.js', './ora-sec-q04.js', './ora-sec-s05.js', './ora-sec-q05.js', './ora-sec-s06.js', './ora-sec-q06.js', './ora-sec-s07.js', './ora-sec-q07.js', './ora-sec-s08.js', './ora-sec-q08.js', './ora-sec-s09.js', './ora-sec-q09.js', './ora-upg-s01.js', './ora-upg-q01.js', './ora-upg-s02.js', './ora-upg-q02.js', './ora-upg-s03.js', './ora-upg-q03.js', './ora-upg-s04.js', './ora-upg-q04.js', './ora-upg-s05.js', './ora-upg-q05.js', './ora-upg-s06.js', './ora-upg-q06.js', './ora-upg-s07.js', './ora-upg-q07.js',
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

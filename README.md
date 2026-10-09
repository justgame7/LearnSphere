# LearnSphere

Bite-sized, structured lessons (currently a PostgreSQL DBA course) with progress saved on-device.
Static site, installable as an Android app (PWA), works offline.

## Layout
```
docs/                    <- GitHub Pages root
  index.html             app
  pg-lesson.js           PostgreSQL lesson content (single file)
  rs-common.js           Redshift helpers (diagram builder, doc URLs), lazy-loaded
  rs-s01.js ... rs-s14.js  Redshift lessons, one file per section, lazy-loaded on first open
  rs-q01.js ... rs-q14.js  Redshift quizzes (window.QUIZZES['rs:<section>']), one file per section, lazy-loaded with the lessons
                         (key = rs:<section>:<lecture>; add new files to ASSETS in sw.js)
  docker-common.js, docker-s01.js ... docker-s12.js, docker-q01.js ... docker-q12.js  Docker lessons and quizzes (core lectures; additional topics later), lazy-loaded
                         (lesson key = docker:<section>:<lecture>, quiz key = docker:<section>)
  tf-common.js, tf-s01.js ... tf-s15.js, tf-q01.js ... tf-q15.js  Terraform lessons and quizzes (core lectures; additional topics later), lazy-loaded
                         (lesson key = tf:<section>:<lecture>, quiz key = tf:<section>)
  manifest.webmanifest   PWA manifest
  sw.js                  service worker (offline cache)
  icons/                 app icons (any + maskable)
  .nojekyll
```

## Run locally
```
cd docs && python3 -m http.server 8080
```
Open http://localhost:8080 (service workers work on localhost).

## Deploy (GitHub Pages)
1. Push to GitHub (`main`).
2. Settings > Pages > Source: **Deploy from a branch**, branch `main`, folder `/docs`.
3. Site is live at `https://<user>.github.io/<repo>/`.

## Install on Android
Open the Pages URL in **Chrome**, tap the in-app **Install** button (or menu > *Install app*).

## Releasing changes
Edit lesson files, then bump `VERSION` in `docs/sw.js` (`v1` to `v2`) so installed apps pick up new content.

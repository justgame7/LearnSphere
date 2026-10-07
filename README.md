# LearnSphere

Bite-sized, structured lessons (currently a PostgreSQL DBA course) with progress saved on-device.
Static site, installable as an Android app (PWA), works offline.

## Layout
```
docs/                    <- GitHub Pages root
  index.html             app
  lessons*.js            lesson content
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

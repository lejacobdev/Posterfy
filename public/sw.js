/**
 * Posterfy service worker.
 *
 * Strategy:
 *   - navigations: network first, cached shell only as an offline fallback
 *   - build assets (hashed): cache first, they never change under one URL
 *   - API + album images: network only, so search always reflects reality
 *
 * The VERSION below is stamped with the real build id at build time (see the
 * `serviceWorkerBuildId` plugin in vite.config.ts). That matters: the cache
 * name has to change every deploy, otherwise the activate handler below can
 * never purge the previous one and a stale index.html keeps being served
 * pointing at asset hashes that no longer exist — a blank page that persists.
 */

const VERSION = '__BUILD_ID__';
const SHELL_CACHE = `posterfy-shell-${VERSION}`;
const ASSET_CACHE = `posterfy-assets-${VERSION}`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A missing optional file must not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('posterfy-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAssetRequest(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(?:css|js|woff2?|svg|png|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API calls or remote artwork — both must stay live.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          // Offline: fall back to the last good shell rather than a dead tab.
          caches.match('/index.html').then((cached) => cached ?? Response.error()),
        ),
    );
    return;
  }

  if (isAssetRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

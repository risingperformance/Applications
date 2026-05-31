/*
 * MMGAG offline service worker
 * --------------------------------------------------------------------
 *  - Precaches the app shell (HTML pages, logo, icons, manifest) on
 *    install so Club Roulette and Reverse Twister keep working with
 *    no network.
 *  - Caches Google Fonts (CSS + woff2) on first use for offline reads.
 *  - Lets the podcast embed, YouTube card, RSS proxies, and outbound
 *    social links pass straight through to the network — those bits
 *    require connectivity by design.
 *  - Bump CACHE_VERSION any time the precache list or shell changes
 *    so old caches are evicted on the next visit.
 */

'use strict';

const CACHE_VERSION = 'mmgag-v1';
const SHELL_CACHE   = 'mmgag-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'mmgag-runtime-' + CACHE_VERSION;
const FONT_CACHE    = 'mmgag-fonts-'   + CACHE_VERSION;

// Resources required to render the app without network. Paths are
// relative so this SW works whether deployed at site root or a sub-path
// (e.g. GitHub Pages /repo/).
const APP_SHELL = [
  './',
  './index.html',
  './roulette.html',
  './twister.html',
  './MMGAGLogo.jpeg',
  './app-icon.png',
  './app-icon-maskable.png',
  './manifest.json'
];

// Hostnames whose responses should never be cached or short-circuited
// by the worker — they need a live connection every time.
const NETWORK_ONLY_HOSTS = [
  'open.spotify.com',
  'img.youtube.com',
  'i.ytimg.com',
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'api.allorigins.win',
  'corsproxy.io',
  'api.codetabs.com',
  'shorturl.at',
  'www.instagram.com',
  'instagram.com',
  'www.facebook.com',
  'facebook.com',
  'www.tiktok.com',
  'tiktok.com',
  'shows.acast.com',
  'feeds.acast.com'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ------------------------------ install ------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ------------------------------ activate -----------------------------
self.addEventListener('activate', (event) => {
  const allowList = new Set([SHELL_CACHE, RUNTIME_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((k) => allowList.has(k) ? null : caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Helper: is the URL's host in the network-only list?
function isNetworkOnly(url) {
  return NETWORK_ONLY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
}

function isFontRequest(url) {
  return FONT_HOSTS.includes(url.hostname);
}

// Stale-while-revalidate for Google Fonts so the CSS and woff2 stay
// available offline after the first load, but still refresh in the
// background.
function staleWhileRevalidate(event, cacheName) {
  event.respondWith(
    caches.open(cacheName).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
}

// Cache-first with network fallback for same-origin app shell.
function cacheFirst(event) {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful, basic (same-origin) responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      }).catch(() => {
        // Offline + nothing cached: if this is an HTML navigation, fall
        // back to the cached landing page so the user still sees the app.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
}

// ------------------------------ fetch --------------------------------
self.addEventListener('fetch', (event) => {
  // Only handle GETs. POST/PUT/etc. always go to the network.
  if (event.request.method !== 'GET') return;

  let url;
  try { url = new URL(event.request.url); }
  catch (e) { return; }

  // Don't touch chrome-extension://, data:, blob:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Spotify, YouTube, RSS proxies, social outlinks: pass through.
  if (isNetworkOnly(url)) return;

  // Google Fonts: stale-while-revalidate so they work offline after first load.
  if (isFontRequest(url)) {
    staleWhileRevalidate(event, FONT_CACHE);
    return;
  }

  // Same-origin assets: cache-first.
  if (url.origin === self.location.origin) {
    cacheFirst(event);
    return;
  }

  // Anything else cross-origin we don't recognise: pass through.
});

// Allow the page to trigger an immediate update if a new SW is waiting.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

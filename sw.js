// Lebith Finance — Service Worker v1.0.0
// Works on GitHub Pages, Netlify, Vercel, or any static host

const CACHE = 'lebith-v1.0.0';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap',
];

// Live APIs — never cache these
const LIVE_HOSTS = [
  'open.er-api.com', 'api.exchangerate.host', 'api.coingecko.com',
  'query1.finance.yahoo.com', 'api.allorigins.win', 'corsproxy.io',
  'api.codetabs.com', 'egcurrency.com', 'cedirates.com',
  'api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache app shell (critical — must succeed)
      await cache.addAll(SHELL).catch(() => {});
      // Cache CDN libs (best-effort)
      await Promise.allSettled(
        CDN.map(url => fetch(url, { mode: 'cors' })
          .then(r => r.ok ? cache.put(url, r) : null)
          .catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ───────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Live APIs → network only, never cache
  if (LIVE_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      fetch(request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // CDN & fonts → cache-first
  const isCDN = url.hostname.includes('cdnjs.cloudflare.com') ||
                url.hostname.includes('cdn.jsdelivr.net') ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com');
  if (isCDN) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(r => {
          if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()));
          return r;
        });
      })
    );
    return;
  }

  // App shell → cache-first, background refresh
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(r => {
          if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()));
          return r;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

// ── Messages from app ────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

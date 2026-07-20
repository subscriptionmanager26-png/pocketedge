/**
 * Emits a production service worker that precaches hashed build assets.
 * Network-first for navigations; cache-first for hashed /assets/*.
 */
export function socialServiceWorkerPlugin() {
  let buildOutDir = 'dist';

  return {
    name: 'social-service-worker',
    apply: 'build',
    configResolved(config) {
      buildOutDir = config.build.outDir;
    },
    async writeBundle(_options, bundle) {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const path = await import('node:path');

      const assets = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.map'))
        .filter((fileName) => !fileName.includes('ocr-') && !fileName.includes('spreadsheet-'))
        .map((fileName) => `/${fileName.replace(/^\/+/, '')}`);

      const marketPreviews = [
        '/data/markets/stocks-preview.json',
        '/data/markets/mutual-funds-preview.json',
        '/data/markets/etf-preview.json',
        '/data/markets/indices-preview.json',
        '/data/markets/commodities-preview.json',
      ];

      const precache = Array.from(
        new Set(['/', '/index.html', '/manifest.webmanifest', ...assets, ...marketPreviews])
      );

      const sw = `/* Generated — do not edit */
const CACHE = 'pe-social-v1';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth / supabase-bound dynamic calls from this origin.
  if (url.pathname.startsWith('/api/')) return;

  // Hashed assets: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Navigations / HTML: network-first, fall back to cached shell.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Other same-origin GETs (e.g. small preview JSON): stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
`;

      await mkdir(buildOutDir, { recursive: true });
      await writeFile(path.join(buildOutDir, 'sw.js'), sw, 'utf8');
    },
  };
}

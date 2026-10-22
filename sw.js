/* =================================================================
   Service Worker - Sahib
   Strategy:
     - Precache app shell on install
     - Cache-first for same-origin assets
     - Network-first for HTML navigation (so updates flow)
     - Stale-while-revalidate for fonts
   ================================================================= */

const VERSION = 'v2.13.8';
const CACHE = `sahib-${VERSION}`;
const APP_BASE = new URL(self.registration.scope);

const APP_SHELL = [
  './css/daily-rhythm.css?v=20261022-rhythm-5',
  './assets/home/rhythm-phases.webp',
  './',
  './index.html',
  './manifest.webmanifest',

  './css/base.css',
  './css/layout.css',
  './css/tokens.css',
  './css/views/home.css',
  './css/views/home-refresh.css?v=20261022-garden-app-4',
  './css/garden-tokens.css?v=20261022-garden-app-4',
  './css/garden-system.css?v=20261022-garden-app-4',
  './css/garden-refinements.css?v=20261022-refine-4',
  './css/app-language.css?v=20261022-language-5',
  './js/i18n-ar.js?v=20261022-release-2',
  './js/i18n.js?v=20261022-language-5',
  './js/app-search.js?v=20261022-language-5',
  './assets/fonts/Dm-sans-Variable.woff2',
  './assets/fonts/Manrope-Variable.woff2',
  './assets/home/courtyard.webp',
  './css/views/adkar.css',
  './css/views/prayer.css',
  './css/views/hijri.css',
  './css/views/asma.css',
  './css/views/flashcards.css',
  './css/views/books.css',
  './css/views/tasbih.css',
  './css/components.css',
  './css/design.css',
  './css/responsive.css',
  
  './assets/icons/sprite.svg',
  './assets/adhan/al-azhar-park.mp3',
  './assets/adhan/quseir-sea.mp3',
  './assets/adhan/fajr-balakong.mp3',
  './assets/adhan/LICENSES.md',
  './assets/adhan/nasser-al-qatami.mp3',
  './assets/adhan/nasser-al-qatami-fajr.mp3',
  './assets/adhan/AWQAT-SALAAT-LICENSE.txt',
  './assets/asma-audio/index.json',
  './assets/fonts/Amiri-Regular.woff2',
  './assets/fonts/Amiri-Bold.woff2',
  './assets/fonts/Tajawal-Regular.woff2',
  './assets/fonts/Tajawal-Medium.woff2',
  './assets/fonts/Tajawal-Bold.woff2',
  './assets/fonts/Cairo-Variable.woff2',
  './assets/fonts/Cairo-Latin.woff2',
  './assets/fonts/Cairo-LatinExt.woff2',
  './assets/fonts/Inter-Variable.woff2',

  './js/config.js',
  './js/utils.js',
  './js/icons.js',
  './js/scroll-preserve.js',
  './js/dict.js',
  './js/vendor/fuse.min.js',
  './js/db.js',
  './js/store.js',
  './js/theme.js?v=20261022-language-5',
  './js/data-defaults.js',
  './js/hisn-data.js',
  './js/adhkar-taxonomy.js',
  './js/state.js',
  './js/search.js',
  './js/vendor/adhan.js',
  './js/prayer.js?v=20261022-release-2',
  './js/prayer-widget.js?v=20261022-release-2',
  './js/qibla.js',
  './js/location.js',
  './js/quotes.js',
  './js/dates.js',
  './js/hijri-events.js',
  './js/hijri-calendar.js',
  './js/practices-data.js',
  './js/asma-data.js',
  './js/asma.js',
  './js/books-data.js',
  './js/books.js',
  './js/offline-books.js',
  './js/offline-ui.js',
  './js/reader.js?v=20261022-refine-4',
  './js/vendor/embedpdf/engines/dist/index.js',
  './js/vendor/embedpdf/engines/dist/lib/pdfium/index.js',
  './js/vendor/embedpdf/engines/dist/lib/converters/index.js',
  './js/vendor/embedpdf/engines/dist/direct-engine-C8xTbxym.js',
  './js/vendor/embedpdf/engines/dist/browser-BKLM0ThC.js',
  './js/vendor/embedpdf/engines/dist/pdf-engine-D9v0RfKe.js',
  './js/vendor/embedpdf/pdfium/dist/index.browser.js',
  './js/vendor/embedpdf/pdfium/dist/pdfium.wasm',
  './js/vendor/embedpdf/models/dist/index.js',
  './js/vendor/embedpdf/fonts-arabic/dist/index.js',
  './js/vendor/embedpdf/fonts-latin/dist/index.js',

  './js/views/cats.js',
  './js/views/home.js?v=20261022-language-5',
  './js/views/practice.js?v=20261022-language-5',
  './js/views/adkar.js',
  './js/views/search.js',
  './js/views/favs.js',
  './js/views/favs-menu.js',
  './js/views/detail.js',
  './js/views/session.js',
  './js/views/form.js',
  './js/views/catmgr.js',
  './js/views/confirm.js',
  './js/views/menu.js',
  './js/views/quote.js?v=20261022-garden-app-4',
  './js/views/prayer.js?v=20261022-rhythm-5',
  './js/views/hijri.js?v=20261022-garden-app-4',
  './js/views/asma.js?v=20261022-language-5',
  './js/views/books.js',
  './js/views/tasbih.js?v=20261022-refine-4',
  './js/views/reader.js',
  './js/io.js',
  './js/settings.js?v=20261022-pages-2',
  './js/app.js?v=20261022-pages-2',

  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
/* â”€â”€ Install: precache the shell â”€â”€ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try { await cache.addAll(APP_SHELL.map(path => new URL(path, APP_BASE).href)); } catch (err) { console.warn('[sw] app shell precache failed', err); }

      /* Small beginner-path PDFs, cached on install. ~14 MB. */
      const smallBooks = [
        'https://sahib-proxy.sahib-app.workers.dev/books/1.%20%D8%A7%D9%84%D9%82%D8%B1%D8%A2%D9%86%20%D9%88%D8%B9%D9%84%D9%88%D9%85%D9%87%20-%20Quran%20%26%20Its%20Sciences/Noor-Book.com%20%D8%A7%D9%84%D9%85%D9%82%D8%AF%D9%85%D8%A9%20%D8%A7%D9%84%D8%AC%D8%B2%D8%B1%D9%8A%D8%A9%203%20.pdf',
        'https://sahib-proxy.sahib-app.workers.dev/books/4.%20%D8%A7%D9%84%D8%B9%D9%82%D9%8A%D8%AF%D8%A9%20%D9%88%D8%A7%D9%84%D8%AA%D9%88%D8%AD%D9%8A%D8%AF%20-%20Islamic%20Creed%20%26%20Theology/%D9%84%D8%AA%D9%88%D8%AD%D9%8A%D8%AF%20%D8%A7%D9%84%D8%B0%D9%8A%20%D9%87%D9%88%20%D8%AD%D9%82%20%D8%A7%D9%84%D9%84%D9%87%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A8%D9%8A%D8%AF%20%D9%85%D8%A4%D9%84%D9%81%20%D8%A7%D9%84%D9%83%D8%AA%D8%A7%D8%A8%20%D9%85%D8%AD%D9%85%D8%AF%20%D8%A8%D9%86%20%D8%B9%D8%A8%D8%AF%20%D8%A7%D9%84%D9%88%D9%87%D8%A7%D8%A8.pdf',
        'https://sahib-proxy.sahib-app.workers.dev/books/4.%20%D8%A7%D9%84%D8%B9%D9%82%D9%8A%D8%AF%D8%A9%20%D9%88%D8%A7%D9%84%D8%AA%D9%88%D8%AD%D9%8A%D8%AF%20-%20Islamic%20Creed%20%26%20Theology/%D9%85%D8%A7%20%D9%84%D8%A7%20%D9%8A%D8%B3%D8%B9%20%D8%A7%D9%84%D9%85%D8%B3%D9%84%D9%85%20%D8%AC%D9%87%D9%84%D9%87.pdf',
        'https://sahib-proxy.sahib-app.workers.dev/books/5.%20%D8%A7%D9%84%D9%81%D9%82%D9%87%20%D9%88%D8%A3%D8%B5%D9%88%D9%84%D9%87%20-%20Islamic%20Jurisprudence%20(Fiqh)/%D9%85%D9%86%D9%87%D8%AC%20%D8%A7%D9%84%D8%B3%D8%A7%D9%84%D9%83%D9%8A%D9%86%20%D9%88%D8%AA%D9%88%D8%B6%D9%8A%D8%AD%20%D8%A7%D9%84%D9%81%D9%82%D9%87%20%D9%81%D9%8A%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86.pdf',
        'https://sahib-proxy.sahib-app.workers.dev/books/6.%20%D8%A7%D9%84%D8%B1%D9%82%D8%A7%D8%A6%D9%82%D8%8C%20%D8%A7%D9%84%D8%A3%D8%B0%D9%83%D8%A7%D8%B1%20%D9%88%D8%A7%D9%84%D8%AA%D8%B2%D9%83%D9%8A%D8%A9%20-%20Purification%20of%20the%20Soul%20%26%20Adhkar/%D8%AD%D8%B5%D9%86%20%D8%A7%D9%84%D9%85%D8%B3%D9%84%D9%85.pdf',
      ];
      const booksCache = await caches.open('sahib-books');
      for (const url of smallBooks) {
        try {
          const existing = await booksCache.match(url);
          if (existing) continue;
          const res = await fetch(url);
          if (res && res.ok) await booksCache.put(url, res.clone());
        } catch (err) {
          console.warn('[sw] book precache failed', url, err);
        }
      }

      await self.skipWaiting();
    })()
  );
});

/* â”€â”€ Activate: drop old caches â”€â”€ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => (k.startsWith('adkar-') || k.startsWith('sahib-')) && k !== CACHE && k !== 'sahib-books' && k !== 'sahib-asma-audio')
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* â”€â”€ Fetch handling â”€â”€ */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  const isSameOrigin = url.origin === self.location.origin;
  const isBookProxy = url.origin === 'https://sahib-proxy.sahib-app.workers.dev';

  /* Handle same-origin requests and book-proxy requests. */
  if (!isSameOrigin && !isBookProxy) return;

  /* Bundled adhan recordings: serve the full cached file before the Range
     short-circuit so offline reminders work when <audio> requests a byte
     range. Local user files never travel through the service worker. */
  if (url.pathname.includes('/assets/adhan/') && url.pathname.endsWith('.mp3')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const res = await fetch(cacheKey);
        if (res && res.status === 200) await cache.put(cacheKey, res.clone());
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  /* Asma audio mp3s: dedicated runtime cache, cache-first, exempt from version cleanup.
     Handled BEFORE the Range short-circuit because <audio> sends Range: bytes=0-
     on every load. We fetch without Range, cache the full file, and let the
     browser slice it from the cached response.
     Use includes(), not startsWith(). On GitHub Pages the site is served under
     a subpath like /sahib/, so pathname is /sahib/assets/asma-audio/x.mp3,
     not /assets/asma-audio/x.mp3. startsWith() failed silently on prod and
     let the browser HTTP cache serve the mp3s instead. */
  if (url.pathname.includes('/assets/asma-audio/') && url.pathname.endsWith('.mp3')) {
    event.respondWith((async () => {
      const cache = await caches.open('sahib-asma-audio');
      const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const res = await fetch(cacheKey);
        if (res && res.status === 200) {
          await cache.put(cacheKey, res.clone());
        }
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  /* Range requests: let the browser stream them directly. */
  if (req.headers.has('range')) return;

  /* Book PDFs: if the URL is already in the offline-books cache, serve it;
     otherwise pass through to the network. Lazy caching on first read is
     done by js/offline-books.js, not here. */
  if (url.pathname.includes('/books/') || url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.open('sahib-books').then((cache) =>
        cache.match(req).then((cachedResponse) => {
          // Return cached version immediately if found
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise, try the network
          return fetch(req).then((networkResponse) => {
            // If network succeeds, cache it for future offline use
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open('sahib-books').then((cache) => {
                cache.put(req, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => {
            // Fallback if both fail (e.g., offline and not in cache)
            return new Response(JSON.stringify({ error: "Offline and not cached" }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
      )
    );
    return;
  }

  /* HTML navigation â†’ network-first, fall back to cache when offline */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(new URL('index.html', APP_BASE).href))
    );
    return;
  }

  /* Same-origin static assets â†’ cache-first */
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
    )
  );
});

/* Allow the page to trigger skipWaiting */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* Open or focus Sahib when a prayer reminder is tapped. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requested = new URL((event.notification.data && event.notification.data.url) || './index.html', APP_BASE);
  const target = requested.origin === APP_BASE.origin && requested.pathname.startsWith(APP_BASE.pathname)
    ? requested.href : new URL('index.html', APP_BASE).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(APP_BASE.href) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch (err) { /* cross-origin or unavailable */ }
        }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
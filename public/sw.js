const CACHE_NAME = 'eco-client-pwa-v2';
const CACHE_PREFIX = 'eco-client-pwa-';
const LEGACY_CACHE_PREFIXES = ['eco-origin-shell-', 'noa-world-origin-shell-'];
const SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/timeline.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font']);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const staleCaches = cacheNames.filter((name) =>
      name !== CACHE_NAME
      && (name.startsWith(CACHE_PREFIX) || LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))),
    );
    await Promise.all(staleCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch (error) {
            console.warn('Could not cache this page for offline use.', error);
          }
        }
        return response;
      } catch (error) {
        console.warn('Network navigation failed; serving an offline page.', error);
        const cachedPage = await caches.match(request)
          || await caches.match('/index.html')
          || await caches.match('/offline.html');
        return cachedPage || new Response('This page is unavailable offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination) && url.pathname !== '/manifest.webmanifest') return;

  const networkResponse = (async () => {
    const response = await fetch(request);
    if (response.ok) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('Could not cache this asset for offline use.', error);
      }
    }
    return response;
  })();

  event.waitUntil(networkResponse.then(() => undefined).catch((error) => {
    console.warn('Could not refresh a cached asset.', error);
  }));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedAsset = await cache.match(request);
    if (cachedAsset) return cachedAsset;
    try {
      return await networkResponse;
    } catch (error) {
      console.warn('Requested asset is unavailable offline.', error);
      return new Response('This asset is unavailable offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

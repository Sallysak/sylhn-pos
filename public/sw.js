/**
 * SYLHN POS — Service Worker
 *
 * Caching strategy:
 *   - App shell (HTML/JS/CSS): stale-while-revalidate
 *   - Static assets (images, fonts): cache-first
 *   - API calls: network-first, fall back to cache
 *
 * Updates: new SW takes over on next navigation (skipWaiting).
 */

const CACHE_VERSION = "sylhn-pos-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

// ===== Install: pre-cache app shell =====
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => { /* ignore individual failures */ }))
      .then(() => self.skipWaiting())
  );
});

// ===== Activate: clean up old caches =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== Fetch: strategy based on request type =====
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // Skip Next.js HMR
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // API calls: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell (HTML/JS/CSS): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ===== Strategies =====
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request).then((res) => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return res;
  }).catch(() => cached || new Response("Offline", { status: 503 }));
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const clone = res.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const clone = res.clone();
        cache.put(request, clone).catch(() => {});
      }
      return res;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ===== Message: skip waiting =====
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

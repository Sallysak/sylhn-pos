/**
 * SYLHN POS — Service Worker
 *
 * Caching strategy:
 *   - App shell (HTML): stale-while-revalidate
 *   - Static assets (images, fonts): cache-first
 *   - API calls: network-first, fall back to cache
 *   - Next.js JS/CSS chunks: NEVER cache (they change on every deploy/HMR)
 *
 * Updates: new SW takes over immediately (skipWaiting + clients.claim).
 */

const CACHE_VERSION = "sylhn-pos-v3";
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
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ===== Activate: clean up ALL old caches + take control immediately =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all clients to refresh so they pick up the new SW + fresh chunks
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
      })
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

  // CRITICAL: Never cache Next.js JS/CSS chunks — they change on every deploy
  // and HMR update. Caching them causes "module factory not available" errors
  // when the app tries to load a chunk that references a deleted module.
  if (url.pathname.startsWith("/_next/static/chunks/") ||
      url.pathname.startsWith("/_next/static/compiled/") ||
      url.pathname.startsWith("/_next/static/development/") ||
      url.pathname.includes(".hot-update.")) {
    // Bypass cache entirely — always fetch from network
    event.respondWith(fetch(request));
    return;
  }

  // API calls: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (images, fonts, icons): cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages: network-first (so we always get the latest HTML with fresh chunk references)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else: try network, fall back to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || new Response("", { status: 503 })))
  );
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
    if (res.ok && res.type !== "opaque") {
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

// ===== Message: skip waiting =====
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

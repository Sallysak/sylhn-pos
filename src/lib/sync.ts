/**
 * SYLHN POS — Sync utilities (server-source-of-truth architecture)
 *
 * ARCHITECTURE
 * ============
 * The server is the SINGLE SOURCE OF TRUTH for product catalog, stock counts,
 * stock groups, and suppliers. Clients never push these to the server — they
 * only pull.
 *
 * What clients CAN write to the server:
 *   - Sales (POST /api/sales) — server transactionally decrements stock
 *   - Stock adjustments (POST /api/stock-adjustments) — with manager approval
 *   - Product CRUD (POST /api/products) — only via the Stock Management UI,
 *     which makes targeted single-record writes (not bulk upserts)
 *
 * What clients DO NOT push to the server:
 *   - The entire products array (was the source of the "lost update" bug)
 *   - The entire groups array
 *   - The entire suppliers array
 *
 * PULL STRATEGY
 * =============
 * - On app load: fetch products/groups/suppliers from server
 * - On a timer (default 15s): refresh products (for stock count changes
 *   made by other cashiers)
 * - After a sale completes: refresh products (so this cashier's screen shows
 *   the new stock count from the server's transactional update)
 * - On user demand (Sync Settings page): manual refresh button
 *
 * OFFLINE BEHAVIOR
 * ================
 * - Sales made offline are queued in IndexedDB (see offline-queue.ts)
 * - Product list is cached in localStorage ONLY for offline display
 *   (so the cashier can still see product names/prices when offline)
 * - When back online: queue flushes + product list refreshes from server
 */

const SYNC_STATE_KEY = "sylhn-sync-state";
const PRODUCT_CACHE_KEY = "sylhn-products-cache";  // offline display only
const GROUP_CACHE_KEY = "sylhn-groups-cache";
const SUPPLIER_CACHE_KEY = "sylhn-suppliers-cache";
const CURSOR_KEY = "sylhn-products-cursor";  // incremental sync cursor
const ETAG_KEY = "sylhn-products-etag";  // for non-incremental calls
const SYNC_INTERVAL_MS = 15 * 1000; // 15 seconds (was 5 min — too slow for multi-cashier)

export interface SyncState {
  lastPulledAt: string | null;
  lastError: string | null;
  online: boolean;
  productsCount: number;
}

const DEFAULT_STATE: SyncState = {
  lastPulledAt: null,
  lastError: null,
  online: true,
  productsCount: 0,
};

// ===== State persistence =====
export function getSyncState(): SyncState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}

function setSyncState(state: Partial<SyncState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSyncState();
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ ...current, ...state }));
  } catch { /* ignore */ }
}

// ===== Online detection =====
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ===== Cache helpers (offline display only) =====
// Returns `any[]` (not generic) to avoid TypeScript inference issues with
// JSON.parse. Callers should cast if they need a specific type.
export function getCachedProducts(): any[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getCachedGroups(): any[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GROUP_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getCachedSuppliers(): any[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SUPPLIER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheProducts(products: any[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(products)); } catch { /* quota */ }
}

function cacheGroups(groups: any[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(GROUP_CACHE_KEY, JSON.stringify(groups)); } catch { /* quota */ }
}

function cacheSuppliers(suppliers: any[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SUPPLIER_CACHE_KEY, JSON.stringify(suppliers)); } catch { /* quota */ }
}

// ===== Pull (server → client) =====
// This is the ONLY sync operation. Server is source of truth.
// Returns the fresh data so callers can update React state.
//
// INCREMENTAL SYNC
// ================
// On each pull, we send `?since=<cursor>` (the timestamp from the last
// successful pull). The server only returns products updated after that
// timestamp. We merge the deltas into the local cache:
//   - Updated products: replace in cache
//   - New products: add to cache
//   - Deleted products: filter out (active=false comes through as updated)
//
// On the FIRST pull (no cursor), we do a full fetch (no `?since`).
//
// ETAG
// ====
// As a secondary optimization, we send `If-None-Match: <etag>` from the last
// response. If the server's product list hasn't changed at all, it returns
// 304 Not Modified (empty body). This is mostly useful for the first pull
// (when we don't have a cursor yet) — incremental calls almost always return
// some deltas.

export interface PulledData {
  products: any[];        // FULL product list (after merge) — for callers that want the whole state
  productDeltas?: any[];  // Only the changed products (empty array if nothing changed or full refresh)
  groups?: any[];
  suppliers?: any[];
  fromCache?: boolean;    // true if we served from cache (304 or offline)
}

export async function pullChanges(options?: { includeGroups?: boolean; includeSuppliers?: boolean; forceFull?: boolean }): Promise<{ success: boolean; message: string; data?: PulledData }> {
  if (!isOnline()) {
    setSyncState({ online: false, lastError: "Offline" });
    // Return cached data so the UI can still render
    const cachedProducts = getCachedProducts() || [];
    return {
      success: false,
      message: "Offline",
      data: { products: cachedProducts, fromCache: true },
    };
  }

  try {
    // ===== Pull products (incremental if we have a cursor) =====
    const cursor = options?.forceFull ? null : (typeof window !== "undefined" ? localStorage.getItem(CURSOR_KEY) : null);
    const etag = typeof window !== "undefined" ? localStorage.getItem(ETAG_KEY) : null;

    const url = new URL("/api/products", typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (cursor) url.searchParams.set("since", cursor);

    const headers: Record<string, string> = {};
    // Only send ETag on non-incremental calls (no `since` param). The server
    // computes the ETag over the full list, so it's only meaningful when we
    // request the full list.
    if (!cursor && etag) headers["If-None-Match"] = etag;

    const productRes = await fetch(url.toString(), { headers });
    let products: any[] = [];
    let productDeltas: any[] = [];
    let fromCache = false;

    if (productRes.status === 304) {
      // 304 Not Modified — our cached list is still fresh
      products = getCachedProducts() || [];
      fromCache = true;
      productDeltas = [];
    } else if (productRes.ok) {
      const data = await productRes.json();
      const serverProducts = Array.isArray(data.products) ? data.products : [];
      const newCursor = data.cursor as string | undefined;
      const newEtag = productRes.headers.get("etag");

      if (cursor && data.incremental) {
        // ===== INCREMENTAL: merge deltas into cache =====
        const cached = getCachedProducts() || [];
        const cacheMap = new Map(cached.map(p => [p.id, p]));
        for (const sp of serverProducts) {
          cacheMap.set(sp.id, sp);  // add or replace
        }
        products = Array.from(cacheMap.values());
        productDeltas = serverProducts;
      } else {
        // ===== FULL: replace cache =====
        products = serverProducts;
        productDeltas = serverProducts;
      }
      cacheProducts(products);
      if (newCursor && typeof window !== "undefined") {
        try { localStorage.setItem(CURSOR_KEY, newCursor); } catch { /* quota */ }
      }
      if (newEtag && typeof window !== "undefined") {
        try { localStorage.setItem(ETAG_KEY, newEtag); } catch { /* quota */ }
      }
    } else {
      // Fetch failed — fall back to cache
      products = getCachedProducts() || [];
      fromCache = true;
    }

    let groups: any[] | undefined;
    let suppliers: any[] | undefined;

    if (options?.includeGroups) {
      const groupsRes = await fetch("/api/stock-groups").catch(() => null);
      if (groupsRes && groupsRes.ok) {
        const data = await groupsRes.json();
        groups = Array.isArray(data.groups) ? data.groups : [];
        if (groups) cacheGroups(groups);
      }
    }

    if (options?.includeSuppliers) {
      const supRes = await fetch("/api/suppliers").catch(() => null);
      if (supRes && supRes.ok) {
        const data = await supRes.json();
        suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
        if (suppliers) cacheSuppliers(suppliers);
      }
    }

    setSyncState({
      lastPulledAt: new Date().toISOString(),
      lastError: null,
      online: true,
      productsCount: products.length,
    });
    return {
      success: true,
      message: "Pulled",
      data: { products, productDeltas, groups, suppliers, fromCache },
    };
  } catch (e) {
    setSyncState({ lastError: (e as Error).message, online: true });
    return { success: false, message: (e as Error).message };
  }
}

/**
 * Reset the incremental sync cursor. The next pullChanges() call will do a
 * full fetch (no `?since` param). Use this if the local cache is corrupted
 * or after a server-side data migration.
 */
export function resetSyncCursor(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CURSOR_KEY);
    localStorage.removeItem(ETAG_KEY);
  } catch { /* ignore */ }
}

// ===== pushChanges() — DEPRECATED (no-op) =====
//
// Previously this function pushed the entire localStorage products/groups/
// suppliers arrays to the server, overwriting server state. This caused
// "lost update" bugs when multiple cashiers were online simultaneously.
//
// The server is now the single source of truth. Clients only push:
//   - Sales (POST /api/sales) — handled in page.tsx
//   - Targeted product CRUD (POST /api/products with single record) — handled in StockManagement
//
// This function is kept for backward compatibility (older code may still
// call it) but does nothing.
export async function pushChanges(): Promise<{ success: boolean; message: string }> {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[sync] pushChanges() is deprecated and does nothing. The server is the source of truth — use pullChanges() instead.");
  }
  return { success: true, message: "No-op (server is source of truth)" };
}

// ===== Auto-pull (debounced + interval) =====
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let autoPullInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Schedule a debounced pull (3s default). Use this after any local action
 * that might have changed server state (e.g. completing a sale) so the UI
 * refreshes with the authoritative server data.
 */
export function schedulePull(delay = 3000, onPull?: (data: PulledData) => void): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(async () => {
    const result = await pullChanges();
    if (result.success && result.data && onPull) onPull(result.data);
    pullTimer = null;
  }, delay);
}

/**
 * Start auto-pull on a 15-second interval. Use this once on app mount to keep
 * the product list fresh (other cashiers' sales will appear within 15s).
 */
export function startAutoPull(
  onPull?: (data: PulledData) => void,
  onStateChange?: (state: SyncState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  // Online/offline listeners
  const onOnline = () => {
    setSyncState({ online: true });
    // Pull immediately when back online
    pullChanges().then(r => {
      if (r.success && r.data && onPull) onPull(r.data);
      onStateChange?.(getSyncState());
    });
  };
  const onOffline = () => {
    setSyncState({ online: false });
    onStateChange?.(getSyncState());
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  // Initial pull (don't wait for the first interval)
  pullChanges().then(r => {
    if (r.success && r.data && onPull) onPull(r.data);
    onStateChange?.(getSyncState());
  });

  // Periodic pull
  autoPullInterval = setInterval(async () => {
    if (!isOnline()) return;
    const r = await pullChanges();
    if (r.success && r.data && onPull) onPull(r.data);
    onStateChange?.(getSyncState());
  }, SYNC_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (autoPullInterval) clearInterval(autoPullInterval);
    if (pullTimer) clearTimeout(pullTimer);
    autoPullInterval = null;
    pullTimer = null;
  };
}

// ===== Legacy aliases (for code that imports startAutoSync/scheduleSync) =====
// These map the old names to the new pull-only functions.
export const startAutoSync = startAutoPull;
export const scheduleSync = schedulePull;

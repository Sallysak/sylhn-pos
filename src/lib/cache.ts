/**
 * SYLHN POS — In-memory LRU cache for hot read paths.
 *
 * Use cases:
 *  - /api/auth/me: cache user permissions for 60s (invalidated on role change)
 *  - /api/dashboard: cache aggregation results for 30s
 *  - /lib/reports.ts: cache SalesSummary, InventorySnapshot for 30s
 *
 * Multi-instance note: this is per-instance only. On Railway with multiple
 * replicas, each replica has its own cache. For cross-replica consistency,
 * upgrade to Redis (@upstash/redis) — the API here is intentionally Redis-like
 * so the swap is a one-line change.
 *
 * Invalidation: callers should call `cache.delete(key)` after writes that
 * would change the cached value. For dashboard data, the 30s TTL is usually
 * acceptable — better to show 30s-old data than to crash Postgres.
 */

interface Entry<V> {
  value: V;
  expiresAt: number;  // epoch ms
}

const DEFAULT_TTL_MS = 30_000; // 30s
const DEFAULT_MAX = 200;       // max entries

const store = new Map<string, Entry<any>>();

export function cacheGet<V>(key: string): V | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // Move to end (LRU refresh — Map iterates in insertion order, oldest first)
  store.delete(key);
  store.set(key, hit);
  return hit.value as V;
}

export function cacheSet<V>(key: string, value: V, ttlMs: number = DEFAULT_TTL_MS): void {
  // Enforce max size — evict oldest entry
  if (store.size >= DEFAULT_MAX) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}

/**
 * Get-or-set helper. The loader is called only on cache miss.
 * Concurrent calls to the same key will each invoke the loader (no
 * single-flight) — acceptable for our use case where loaders are idempotent
 * reads. Add single-flight if a thundering-herd becomes a problem.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  cacheSet(key, value, ttlMs);
  return value;
}

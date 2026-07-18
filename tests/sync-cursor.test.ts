/**
 * SYLHN POS — Sync cursor logic tests
 *
 * Tests the incremental sync cursor handling in src/lib/sync.ts.
 * We mock the global `fetch` so we can control what the server returns
 * and verify that pullChanges() correctly:
 *   1. Sends ?since=<cursor> on subsequent calls
 *   2. Sends If-None-Match on non-incremental calls
 *   3. Merges incremental deltas into the cache
 *   4. Handles 304 Not Modified correctly
 *   5. Falls back to cache when offline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Mock navigator.onLine
let online = true;
Object.defineProperty(navigator, "onLine", {
  configurable: true,
  get: () => online,
});

// Mock fetch
let fetchMock: ReturnType<typeof vi.fn>;
const mockResponse = (body: any, init?: ResponseInit & { etag?: string }) => {
  const headers = new Headers(init?.headers);
  if (init?.etag) headers.set("etag", init.etag);
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
    status: init?.status ?? 200,
  });
};

describe("Sync incremental cursor logic", () => {
  beforeEach(() => {
    localStorageMock.clear();
    online = true;
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    global.localStorage = localStorageMock as any;
    global.window = { location: { origin: "http://localhost" } } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("first pull does a full fetch (no ?since= param)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        products: [{ id: "p1", name: "Apples", quantity: 10 }],
        count: 1,
        cursor: "2026-01-01T00:00:00.000Z",
        incremental: false,
      }, { etag: '"abc123"' })
    );

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges();

    expect(result.success).toBe(true);
    expect(result.data?.products).toHaveLength(1);
    expect(result.data?.products[0].name).toBe("Apples");
    expect(result.data?.fromCache).toBe(false);

    // Verify fetch was called WITHOUT ?since= (first pull has no cursor)
    const fetchUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(fetchUrl.searchParams.has("since")).toBe(false);

    // Cursor should be saved for the next call
    expect(localStorageMock.getItem("sylhn-products-cursor")).toBe("2026-01-01T00:00:00.000Z");
    expect(localStorageMock.getItem("sylhn-products-etag")).toBe('"abc123"');
  });

  it("second pull sends ?since=<cursor> from the first response", async () => {
    // Set up the cursor from a "previous" pull
    localStorageMock.setItem("sylhn-products-cursor", "2026-01-01T00:00:00.000Z");
    localStorageMock.setItem("sylhn-products-cache", JSON.stringify([
      { id: "p1", name: "Apples", quantity: 10 },
    ]));

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        products: [{ id: "p1", name: "Apples", quantity: 8 }],  // stock changed 10 → 8
        count: 1,
        cursor: "2026-01-01T00:00:05.000Z",
        incremental: true,
      })
    );

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges();

    expect(result.success).toBe(true);
    // Verify ?since= was sent with the cursor from localStorage
    const fetchUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(fetchUrl.searchParams.get("since")).toBe("2026-01-01T00:00:00.000Z");

    // The merged result should have the updated stock count
    expect(result.data?.products).toHaveLength(1);
    expect(result.data?.products[0].quantity).toBe(8);
    // productDeltas should contain only the changed product
    expect(result.data?.productDeltas).toHaveLength(1);
  });

  it("merges incremental deltas into cache (add new + update existing)", async () => {
    localStorageMock.setItem("sylhn-products-cursor", "2026-01-01T00:00:00.000Z");
    localStorageMock.setItem("sylhn-products-cache", JSON.stringify([
      { id: "p1", name: "Apples", quantity: 10 },
      { id: "p2", name: "Bananas", quantity: 20 },
    ]));

    // Server returns: p1 updated (stock 8), p3 is new
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        products: [
          { id: "p1", name: "Apples", quantity: 8 },
          { id: "p3", name: "Cherries", quantity: 5 },
        ],
        count: 2,
        cursor: "2026-01-01T00:00:05.000Z",
        incremental: true,
      })
    );

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges();

    expect(result.success).toBe(true);
    // Merged result should have p1 (updated), p2 (unchanged from cache), p3 (new)
    expect(result.data?.products).toHaveLength(3);
    const names = result.data?.products.map(p => p.name).sort();
    expect(names).toEqual(["Apples", "Bananas", "Cherries"]);
    // p1 should have updated stock
    const p1 = result.data?.products.find(p => p.id === "p1");
    expect(p1?.quantity).toBe(8);
  });

  it("handles 304 Not Modified by serving from cache", async () => {
    localStorageMock.setItem("sylhn-products-etag", '"abc123"');
    localStorageMock.setItem("sylhn-products-cache", JSON.stringify([
      { id: "p1", name: "Apples", quantity: 10 },
    ]));

    // Server returns 304 with no body
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges();

    expect(result.success).toBe(true);
    expect(result.data?.fromCache).toBe(true);
    expect(result.data?.products).toHaveLength(1);
    expect(result.data?.products[0].name).toBe("Apples");
    expect(result.data?.productDeltas).toHaveLength(0);
  });

  it("falls back to cache when offline", async () => {
    online = false;
    localStorageMock.setItem("sylhn-products-cache", JSON.stringify([
      { id: "p1", name: "Apples", quantity: 10 },
    ]));

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges();

    expect(result.success).toBe(false);
    expect(result.message).toBe("Offline");
    expect(result.data?.fromCache).toBe(true);
    expect(result.data?.products).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forceFull option skips the cursor and does a full fetch", async () => {
    localStorageMock.setItem("sylhn-products-cursor", "2026-01-01T00:00:00.000Z");
    localStorageMock.setItem("sylhn-products-etag", '"abc123"');

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        products: [{ id: "p1", name: "Apples", quantity: 10 }],
        count: 1,
        cursor: "2026-01-01T00:00:05.000Z",
        incremental: false,
      }, { etag: '"def456"' })
    );

    const { pullChanges } = await import("@/lib/sync");
    const result = await pullChanges({ forceFull: true });

    // Should NOT send ?since= because forceFull=true
    const fetchUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(fetchUrl.searchParams.has("since")).toBe(false);

    expect(result.success).toBe(true);
    expect(result.data?.products).toHaveLength(1);
  });

  it("resetSyncCursor clears the cursor and etag", async () => {
    localStorageMock.setItem("sylhn-products-cursor", "2026-01-01T00:00:00.000Z");
    localStorageMock.setItem("sylhn-products-etag", '"abc123"');

    const { resetSyncCursor } = await import("@/lib/sync");
    resetSyncCursor();

    expect(localStorageMock.getItem("sylhn-products-cursor")).toBeNull();
    expect(localStorageMock.getItem("sylhn-products-etag")).toBeNull();
  });
});

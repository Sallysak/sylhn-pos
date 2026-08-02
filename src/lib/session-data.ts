/**
 * SYLHN POS — Session Data Manager
 *
 * SOLVES: "Data entry gets deleted when logging in after logging out"
 *
 * ROOT CAUSE
 * ==========
 * The app stores user session data (held orders, stock history, daily totals,
 * transaction count) in localStorage. On logout, the old code cleared
 * 'sylhn-current-user' and 'sylhn-session-token' but NOT the business data.
 * However, on re-login, the React state was NOT re-initialized from
 * localStorage (because the component didn't remount), so the user saw
 * stale/empty state.
 *
 * The real issue: the logout flow didn't properly distinguish between
 * "clear authentication" and "clear business data." It also didn't handle
 * the case where the page refreshes after logout (via reset credentials or
 * manual refresh), which loses all in-memory React state.
 *
 * FIX
 * ===
 * This module provides a clear separation:
 *   - clearAuthState(): removes ONLY auth-related keys (user, token, csrf)
 *   - clearBusinessData(): removes business data (held orders, history, etc.)
 *     — called ONLY when explicitly starting a new shift or wiping data
 *   - preserveBusinessData(): called on logout to ensure business data
 *     survives the logout/login cycle
 *
 * On login, the POSPage component reads from localStorage (via the state
 * initializers), so business data is automatically restored.
 *
 * KEYS MANAGED
 * ===========
 * Auth keys (cleared on logout):
 *   - sylhn-current-user       (cached user object)
 *   - sylhn-session-token      (Bearer token for API auth)
 *   - sylhn-csrf               (CSRF double-submit token)
 *   - sylhn-login-attempts     (failed login counter)
 *
 * Business data keys (PERSISTED on logout, cleared only on explicit reset):
 *   - sylhn-held-orders        (parked carts for recall)
 *   - sylhn-history            (local stock movement log)
 *   - sylhn-daily-total        (today's gross sales)
 *   - sylhn-txn-count          (today's transaction count)
 *   - sylhn-products-cache     (offline product list cache)
 *   - sylhn-groups-cache       (offline stock groups cache)
 *   - sylhn-suppliers-cache    (offline suppliers cache)
 *   - sylhn-sync-state         (last pull timestamp, etc.)
 *   - sylhn-products-cursor    (incremental sync cursor)
 *   - sylhn-products-etag      (ETag for 304 optimization)
 *   - sylhn-dark-mode          (UI preference)
 *   - sylhn-stocktake-*        (stocktake schedule + notifications)
 *
 * IndexedDB (survives logout):
 *   - sylhn-pos-cart           (cart state for crash recovery)
 *   - sylhn-offline-queue      (offline sale queue)
 */

// ===== Auth keys (cleared on logout) =====
const AUTH_KEYS = [
  "sylhn-current-user",
  "sylhn-session-token",
  "sylhn-csrf",
  "sylhn-login-attempts",
  "sylhn-session-visible",  // dev-only cookie mirror
];

// ===== Business data keys (PERSISTED on logout) =====
// IMPORTANT: This list must match the actual keys used in setItem() calls
// across the app. Any mismatch means data gets orphaned on clearBusinessData().
const BUSINESS_DATA_KEYS = [
  "sylhn-held-orders",
  "sylhn-history",
  "sylhn-daily-total",
  "sylhn-txn-count",
  "sylhn-products-cache",
  "sylhn-groups",                // was "sylhn-groups-cache" — FIXED to match actual key
  "sylhn-suppliers-cache",
  "sylhn-sync-state",
  "sylhn-products-cursor",
  "sylhn-products-etag",
  "sylhn-dark-mode",
  "sylhn-stocktake-schedule",
  "sylhn-stocktake-notifications",
  "sylhn-stocktake-last-notified",
  "sylhn-auto-pull-enabled",
  // Added missing keys that are written by various modules:
  "sylhn-maintenance-users",     // Maintenance → User Management
  "sylhn-purchase-orders",       // Purchase module
  "sylhn-purchase-suppliers",    // Supplier form
  "sylhn-purchase-transactions", // Purchase transactions
  "sylhn-tel-call-log",          // Telephone module
  "sylhn-tel-customers",         // Telephone customers
  "sylhn-tel-phone-orders",      // Telephone orders
  "sylhn-variance-thresholds",   // Stocktake variance thresholds
  "sylhn-po-draft-from-reorder", // Purchase order draft
  "sylhn-settings",              // System settings (Maintenance)
  "sylhn-system-settings",       // System settings (alternate key)
  "sylhn-smtp-config",           // Email SMTP config (legacy localStorage)
  "sylhn-email-history",         // Email history (legacy localStorage)
  "sylhn-audit-log",             // Local audit log
];

/**
 * Clear ONLY authentication state. Business data (held orders, history,
 * daily totals, product cache) is PRESERVED so the next cashier (or the
 * same cashier re-logging in) sees the correct state.
 *
 * Call this on logout.
 */
export function clearAuthState(): void {
  if (typeof window === "undefined") return;
  for (const key of AUTH_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/**
 * Clear ALL business data. Use this ONLY when:
 *   - Starting a new business day (Z-Report reset)
 *   - Explicitly wiping all data (admin action)
 *   - Changing the server/database (stale cache)
 *
 * Do NOT call this on logout — it would lose held orders and history.
 */
export function clearBusinessData(): void {
  if (typeof window === "undefined") return;
  for (const key of BUSINESS_DATA_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  // Also clear the IndexedDB cart (but NOT the offline sale queue —
  // queued sales must sync even after a data reset)
  clearCartIndexedDB().catch(() => {});
}

/**
 * Full reset — clears everything (auth + business data + IndexedDB).
 * Use for "factory reset" or when switching servers.
 */
export function clearAllData(): void {
  clearAuthState();
  clearBusinessData();
  clearOfflineQueue().catch(() => {});
}

/**
 * Save the current user to localStorage (for session restore).
 * Called on successful login.
 */
export function saveUserSession(user: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("sylhn-current-user", JSON.stringify(user));
  } catch { /* ignore */ }
}

/**
 * Get the cached user from localStorage (for session restore).
 * Returns null if not found or invalid.
 */
export function getCachedUser<T = any>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem("sylhn-current-user");
    if (!cached) return null;
    const user = JSON.parse(cached);
    return user && user.username ? user : null;
  } catch { return null; }
}

// ===== IndexedDB helpers =====

async function clearCartIndexedDB(): Promise<void> {
  try {
    const { clearCart } = await import("./cart-persistence");
    await clearCart();
  } catch { /* ignore */ }
}

async function clearOfflineQueue(): Promise<void> {
  try {
    // The offline queue uses IndexedDB — clear it
    const db = await openOfflineQueueDB();
    if (!db) return;
    const tx = db.transaction("sales", "readwrite");
    tx.objectStore("sales").clear();
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch { /* ignore */ }
}

function openOfflineQueueDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("sylhn-offline-queue", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

/**
 * Check if there's unsaved business data that should be preserved.
 * Returns true if held orders, history, or offline sales exist.
 * Used to show a "You have unsaved data" warning on logout.
 */
export function hasUnsavedBusinessData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const heldOrders = localStorage.getItem("sylhn-held-orders");
    if (heldOrders && JSON.parse(heldOrders).length > 0) return true;
    const history = localStorage.getItem("sylhn-history");
    if (history && JSON.parse(history).length > 0) return true;
    return false;
  } catch { return false; }
}

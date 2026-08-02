/**
 * SYLHN POS — Cart Persistence (IndexedDB)
 * Saves/restores cart to survive page refresh, crash, or accidental close.
 */
const DB_NAME = "sylhn-pos-cart";
const STORE = "cart-state";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCart(cart: any[], customerName: string, invoiceNumber: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ cart, customerName, invoiceNumber, savedAt: Date.now() }, "current");
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch {}
}

export async function loadCart(): Promise<{ cart: any[]; customerName: string; invoiceNumber: string } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    return new Promise((resolve) => {
      const req = tx.objectStore(STORE).get("current");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function clearCart(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("current");
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
  } catch {}
}

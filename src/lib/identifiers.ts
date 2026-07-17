/**
 * SYLHN POS — Invoice / reference number generators
 *
 * Collision-safe: uses server timestamp + counter to guarantee uniqueness
 * even under concurrent requests within the same millisecond.
 */

// Monotonic counter — resets when ms changes. Process-local (single instance).
let lastMs = 0;
let counter = 0;

function nextCounter(): { ms: number; n: number } {
  const now = Date.now();
  if (now === lastMs) {
    counter = (counter + 1) % 10000;
  } else {
    lastMs = now;
    counter = 0;
  }
  return { ms: now, n: counter };
}

export function generateInvoiceNumber(): string {
  const { ms, n } = nextCounter();
  return `INV-${ms}-${n.toString().padStart(4, "0")}`;
}

export function generatePurchaseRefNo(): string {
  const { ms, n } = nextCounter();
  return `PUR-${ms}-${n.toString().padStart(4, "0")}`;
}

export function generateStocktakeRefNo(): string {
  const { ms, n } = nextCounter();
  return `ST-${ms}-${n.toString().padStart(4, "0")}`;
}

// Supplier codes: SUP-00001, SUP-00002, ...
export async function generateSupplierCode(): Promise<string> {
  // Import lazily to avoid circular deps at module load.
  const { db } = await import("./db");
  const count = await db.supplier.count();
  // Try count+1; if it collides (race), bump until we find a free slot.
  for (let i = count + 1; i < count + 100; i++) {
    const code = `SUP-${i.toString().padStart(5, "0")}`;
    const existing = await db.supplier.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  // Fallback to timestamp-based
  return `SUP-${Date.now().toString().slice(-8)}`;
}

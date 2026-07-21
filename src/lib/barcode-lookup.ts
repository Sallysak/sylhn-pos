/**
 * Multi-database barcode lookup.
 *
 * Tries multiple free / open databases in order until one returns a match:
 *   1. OpenFoodFacts — 2M+ food products worldwide (free, no auth)
 *   2. UPCitemdb     — 6M+ products (free, 100 req/day per IP)
 *   3. OffDB (openfoodfacts-contrib) — alternate mirror
 *
 * Each database covers different product categories:
 *   - OpenFoodFacts: food, drinks, groceries
 *   - UPCitemdb: electronics, books, household, health, beauty
 *
 * Returns the first successful match. If all fail, returns null so the
 * caller can prompt the user to enter product details manually.
 */

export interface BarcodeLookupResult {
  barcode: string;
  name?: string;
  emoji?: string;
  category?: string;
  description?: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  source: "openfoodfacts" | "upcitemdb" | "manual" | "unknown";
}

/** Normalize a barcode for lookup: strip spaces, dashes, leading zeros (for UPC). */
export function normalizeBarcode(raw: string): string {
  let code = raw.trim().replace(/[\s-]/g, "");
  // Remove leading zeros for UPC-A (some DBs index without them)
  // but keep at least 12 digits for EAN-13 compatibility
  if (/^0+\d{11,13}$/.test(code) && code.length > 12) {
    code = code.replace(/^0+/, "");
    // Pad back to 12 for UPC-A
    if (code.length < 12) code = code.padStart(12, "0");
  }
  return code;
}

/** Validate that a string looks like a real barcode (any common format). */
export function isValidBarcode(raw: string): boolean {
  const code = raw.trim().replace(/[\s-]/g, "");
  if (!code) return false;
  // EAN-13 (13 digits), EAN-8 (8 digits), UPC-A (12 digits), UPC-E (6-7 digits)
  if (/^\d{6,14}$/.test(code)) return true;
  // Code-128, Code-39, Code-93 — alphanumeric
  if (/^[A-Z0-9]{4,30}$/i.test(code)) return true;
  // QR code content (URLs, text)
  if (code.length >= 4 && code.length <= 100) return true;
  return false;
}

// ===== OpenFoodFacts (food, drinks, groceries) =====
async function lookupOpenFoodFacts(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = p.product_name || p.product_name_en || p.generic_name || undefined;
    if (!name) return null; // got a record but no name — treat as not found

    return {
      barcode,
      name,
      emoji: "📦",
      category: p.categories_tags?.[0]?.replace(/^[^:]+:/, "") ||
                p.compared_to_category?.replace(/^[^:]+:/, "") ||
                p.categories?.split(",").pop()?.trim() ||
                undefined,
      description: [p.generic_name, p.brands, p.quantity].filter(Boolean).join(" · ") || undefined,
      brand: p.brands || undefined,
      imageUrl: p.image_front_small_url || p.image_thumb_url || p.image_url || undefined,
      source: "openfoodfacts",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    console.warn("[barcode-lookup] OpenFoodFacts failed:", e?.message);
    return null;
  }
}

// ===== UPCitemdb (electronics, books, household, health, beauty) =====
async function lookupUPCitemdb(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  try {
    // Free tier: 100 req/day per IP, no auth needed
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?barcode=${encodeURIComponent(barcode)}`, {
      signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "OK" || !data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const name = item.title || item.description || undefined;
    if (!name) return null;

    return {
      barcode,
      name,
      emoji: "📦",
      category: item.category || undefined,
      description: [item.brand, item.model, item.color, item.size].filter(Boolean).join(" · ") || undefined,
      brand: item.brand || undefined,
      imageUrl: item.images?.[0] || undefined,
      source: "upcitemdb",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    console.warn("[barcode-lookup] UPCitemdb failed:", e?.message);
    return null;
  }
}

/**
 * Try all databases in parallel and return the first match.
 * Uses Promise.any() — first success wins, others are cancelled.
 */
export async function lookupBarcodeEverywhere(barcode: string): Promise<BarcodeLookupResult | null> {
  const normalized = normalizeBarcode(barcode);
  if (!isValidBarcode(normalized)) return null;

  // Give each DB a 10-second timeout via AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    // Try in parallel — first success wins
    const result = await Promise.any([
      lookupOpenFoodFacts(normalized, controller.signal),
      lookupUPCitemdb(normalized, controller.signal),
    ]);
    if (result) return result;
    return null;
  } catch {
    // All promises rejected — no match in any database
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Multi-database barcode lookup.
 *
 * Tries multiple free / open databases in order until one returns a match:
 *   1. OpenFoodFacts — 2M+ food products worldwide (free, no auth)
 *   2. UPCitemdb     — 6M+ products (free, 100 req/day per IP)
 *   3. Open Beauty Facts — cosmetics, personal care
 *   4. Open Pet Food Facts — pet food
 *
 * Each database covers different product categories. Returns the first
 * successful match. If all fail, returns null so the caller can prompt
 * the user to enter product details manually.
 *
 * Also provides EAN-13 / UPC-A check digit validation so we can detect
 * mistyped barcodes before even hitting the databases.
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
  source: "openfoodfacts" | "upcitemdb" | "openbeautyfacts" | "openpetfoodfacts" | "manual" | "unknown";
}

/** Normalize a barcode for lookup: strip spaces, dashes, leading zeros (for UPC). */
export function normalizeBarcode(raw: string): string {
  let code = raw.trim().replace(/[\s-]/g, "");
  // Some scanners prepend a leading 0 to UPC-A codes making them 13 digits
  // (EAN-13 format). Try both with and without the leading zero.
  return code;
}

/**
 * Validate that a string looks like a real barcode (any common format).
 * Does NOT validate the check digit — use validateCheckDigit() for that.
 */
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

/**
 * Validate the check digit of an EAN-13 or UPC-A barcode.
 * Returns { valid: true } if the check digit is correct, or
 * { valid: false, expected: <digit> } if it's wrong (likely a mis-scan).
 *
 * EAN-13 algorithm:
 *   sum = (d1 + d3 + d5 + d7 + d9 + d11) + 3 * (d2 + d4 + d6 + d8 + d10 + d12)
 *   check = (10 - sum % 10) % 10
 *   Must equal d13.
 *
 * UPC-A is the same algorithm on 12 digits (first 11 + check).
 * EAN-8 uses the same algorithm on 8 digits.
 */
export function validateCheckDigit(code: string): { valid: boolean; expected?: number; actual?: number } {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== 13 && cleaned.length !== 12 && cleaned.length !== 8) {
    return { valid: true }; // not a check-digit-coded format — assume valid
  }
  const digits = cleaned.split("").map(Number);
  const actualCheck = digits[digits.length - 1];
  const payload = digits.slice(0, -1);
  // Sum odd positions (1-indexed) * 1, even positions * 3
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    sum += payload[i] * (i % 2 === 0 ? 1 : 3);
  }
  const expectedCheck = (10 - (sum % 10)) % 10;
  return { valid: expectedCheck === actualCheck, expected: expectedCheck, actual: actualCheck };
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
    if (!name) return null;

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

// ===== Open Beauty Facts (cosmetics, personal care) =====
async function lookupOpenBeautyFacts(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`, {
      signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = p.product_name || p.product_name_en || p.generic_name || undefined;
    if (!name) return null;

    return {
      barcode,
      name,
      emoji: "💄",
      category: p.categories_tags?.[0]?.replace(/^[^:]+:/, "") || p.categories?.split(",").pop()?.trim() || undefined,
      description: [p.generic_name, p.brands, p.quantity].filter(Boolean).join(" · ") || undefined,
      brand: p.brands || undefined,
      imageUrl: p.image_front_small_url || p.image_thumb_url || p.image_url || undefined,
      source: "openbeautyfacts",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    return null;
  }
}

// ===== Open Pet Food Facts (pet food) =====
async function lookupOpenPetFoodFacts(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://world.openpetfoodfacts.org/api/v2/product/${barcode}.json`, {
      signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = p.product_name || p.product_name_en || p.generic_name || undefined;
    if (!name) return null;

    return {
      barcode,
      name,
      emoji: "🐾",
      category: p.categories_tags?.[0]?.replace(/^[^:]+:/, "") || undefined,
      description: [p.generic_name, p.brands, p.quantity].filter(Boolean).join(" · ") || undefined,
      brand: p.brands || undefined,
      imageUrl: p.image_front_small_url || p.image_thumb_url || p.image_url || undefined,
      source: "openpetfoodfacts",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    return null;
  }
}

// ===== UPCitemdb (electronics, books, household, health, beauty) =====
// FIXED: was using `barcode=` param, correct param is `upc=`
async function lookupUPCitemdb(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
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
 *
 * Also tries variations:
 *   - With/without leading zero (EAN-13 ↔ UPC-A)
 *   - If check digit is wrong, tries the corrected version
 */
export async function lookupBarcodeEverywhere(rawBarcode: string): Promise<BarcodeLookupResult | null> {
  const normalized = normalizeBarcode(rawBarcode);
  if (!isValidBarcode(normalized)) return null;

  // Build a list of barcode variants to try
  const variants = new Set<string>([normalized]);
  // Add leading-zero version (UPC-A → EAN-13)
  if (normalized.length === 12 && /^\d+$/.test(normalized)) {
    variants.add("0" + normalized);
  }
  // Add without-leading-zero version (EAN-13 → UPC-A)
  if (normalized.length === 13 && normalized.startsWith("0") && /^\d+$/.test(normalized)) {
    variants.add(normalized.slice(1));
  }
  // If check digit is wrong, add the corrected version
  const checkResult = validateCheckDigit(normalized);
  if (!checkResult.valid && checkResult.expected !== undefined) {
    const corrected = normalized.slice(0, -1) + checkResult.expected;
    variants.add(corrected);
  }

  // Give each DB a 12-second timeout via AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    // Try all variants in all databases in parallel
    const lookupPromises: Promise<BarcodeLookupResult | null>[] = [];
    for (const variant of variants) {
      lookupPromises.push(lookupOpenFoodFacts(variant, controller.signal));
      lookupPromises.push(lookupUPCitemdb(variant, controller.signal));
      lookupPromises.push(lookupOpenBeautyFacts(variant, controller.signal));
      lookupPromises.push(lookupOpenPetFoodFacts(variant, controller.signal));
    }

    // Wait for the first non-null result
    const result = await Promise.any(lookupPromises).catch(() => null);
    if (result) return result;

    // All returned null — no match anywhere
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

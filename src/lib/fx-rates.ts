/**
 * SYLHN POS — Auto Exchange Rate Fetcher
 *
 * Fetches daily exchange rates from the Bank of Ghana (BoG) or a free FX API.
 * Used to auto-fill exchange rates when creating purchase orders in foreign
 * currencies (USD, EUR, GBP, CNY).
 *
 * Free API: https://open.er-api.com/v6/latest/GHS (no auth required)
 * BoG rates: https://www.bog.gov.gh/treasury-and-the-markets/exchange-rates/
 *
 * Environment variables:
 *   FX_API_URL — optional, defaults to open.er-api.com
 *   FX_CACHE_HOURS — optional, defaults to 6 hours
 */

const DEFAULT_API = "https://open.er-api.com/v6/latest/GHS";
const CACHE_HOURS = 6;

interface FXRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

let cachedRates: FXRates | null = null;

/**
 * Fetch current exchange rates with GHS as the base currency.
 * Rates are cached for 6 hours to avoid hitting the API too often.
 */
export async function getExchangeRates(): Promise<FXRates | null> {
  // Return cached rates if still fresh
  if (cachedRates) {
    const age = Date.now() - new Date(cachedRates.fetchedAt).getTime();
    if (age < CACHE_HOURS * 60 * 60 * 1000) {
      return cachedRates;
    }
  }

  try {
    const apiUrl = process.env.FX_API_URL || DEFAULT_API;
    const res = await fetch(apiUrl, { next: { revalidate: CACHE_HOURS * 3600 } });
    if (!res.ok) throw new Error(`FX API returned ${res.status}`);
    const data = await res.json();
    if (!data.rates) throw new Error("No rates in response");

    cachedRates = {
      base: "GHS",
      rates: data.rates,
      fetchedAt: new Date().toISOString(),
    };
    return cachedRates;
  } catch (e: any) {
    // Fallback: return last known rates or null
    return cachedRates;
  }
}

/**
 * Get the exchange rate from GHS to a target currency.
 * Returns how many units of the target currency equal 1 GHS.
 * (For purchase orders, you need the inverse: how many GHS = 1 unit of foreign currency)
 */
export async function getGHSRate(currency: string): Promise<number | null> {
  const rates = await getExchangeRates();
  if (!rates?.rates) return null;
  const rate = rates.rates[currency];
  if (!rate || rate <= 0) return null;
  // API returns: 1 GHS = rate units of currency
  // For PO: 1 unit of currency = 1/rate GHS
  return 1 / rate;
}

/**
 * Get all supported currency rates as a formatted object.
 */
export async function getAllRates(): Promise<{ currency: string; rate: number; updated: string }[]> {
  const rates = await getExchangeRates();
  if (!rates) return [];
  const currencies = ["USD", "EUR", "GBP", "CNY", "NGN", "ZAR"];
  return currencies
    .filter(c => rates.rates[c])
    .map(c => ({ currency: c, rate: 1 / rates.rates[c], updated: rates.fetchedAt }));
}

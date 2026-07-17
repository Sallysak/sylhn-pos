/**
 * SYLHN POS — Multi-currency support
 *
 * Premium: allows customers to pay in USD, EUR, or GHS (local). The cashier
 * sees prices in GHS (the system currency) and the equivalent foreign amount
 * is computed using the configured exchange rate.
 *
 * Rates are stored in SystemSetting as JSON:
 *   { base: "GHS", rates: { "USD": 0.078, "EUR": 0.072, "GHS": 1 } }
 *
 * For production, integrate with a live FX API (e.g. exchangerate-api.com).
 * For now, admin can update rates via /api/system-settings.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "GHS", symbol: "₵", name: "Ghana Cedi", decimalPlaces: 2 },
  { code: "USD", symbol: "$", name: "US Dollar", decimalPlaces: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimalPlaces: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimalPlaces: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimalPlaces: 0 },
  { code: "CFA", symbol: "CFA", name: "West African CFA Franc", decimalPlaces: 0 },
];

export const DEFAULT_RATES = {
  base: "GHS",
  rates: {
    GHS: 1,
    USD: 0.078,   // 1 GHS ≈ $0.078 → 1 USD ≈ GHS 12.82
    EUR: 0.072,   // 1 GHS ≈ €0.072 → 1 EUR ≈ GHS 13.89
    GBP: 0.061,   // 1 GHS ≈ £0.061 → 1 GBP ≈ GHS 16.39
    NGN: 122.50,  // 1 GHS ≈ ₦122.50
    CFA: 47.85,   // 1 GHS ≈ CFA 47.85
  },
  updatedAt: new Date().toISOString(),
};

let cachedRates: typeof DEFAULT_RATES | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getExchangeRates(): Promise<typeof DEFAULT_RATES> {
  if (cachedRates && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }
  try {
    const { db } = await import("./db");
    const setting = await db.systemSetting.findUnique({ where: { key: "currency.rates" } });
    if (setting) {
      cachedRates = JSON.parse(setting.value);
      cachedAt = Date.now();
      return cachedRates!;
    }
  } catch (e) {
    console.warn("Failed to load exchange rates, using defaults:", e);
  }
  return DEFAULT_RATES;
}

export function clearRatesCache() {
  cachedRates = null;
  cachedAt = 0;
}

export function convert(amountGHS: number, toCurrency: string, rates: typeof DEFAULT_RATES): number {
  if (toCurrency === rates.base) return amountGHS;
  const rate = rates.rates[toCurrency as keyof typeof rates.rates];
  if (!rate) return amountGHS;
  return Math.round(amountGHS * rate * 100) / 100;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const info = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  if (!info) return `${amount.toFixed(2)} ${currencyCode}`;
  return `${info.symbol}${amount.toFixed(info.decimalPlaces)}`;
}

export function getCurrencyInfo(code: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
}

// ============================================================================
// Ghana tax helpers — VAT 15%, NHIL 2.5%, GETFL 2.5%
// ============================================================================
// Source: Ghana Revenue Authority (gra.gov.gh)
// These rates apply to most taxable supplies. Some items are zero-rated or
// exempt — see https://gra.gov.gh/resources/tax-rates/ for the full schedule.
// ============================================================================

export interface TaxComponent {
  name: string;
  rate: number;        // 0.15 = 15%
  amount: number;      // computed
}

export interface GhanaTaxBreakdown {
  components: TaxComponent[];
  totalTax: number;
  totalRate: number;
}

export const GHANA_TAX_RATES = {
  VAT: 0.15,
  NHIL: 0.025,
  GETFL: 0.025,
} as const;

/**
 * Compute Ghana tax breakdown for a taxable amount.
 * By default, applies VAT + NHIL + GETFL.
 */
export function computeGhanaTax(
  taxableAmount: number,
  options: { vat?: boolean; nhil?: boolean; getfl?: boolean } = {}
): GhanaTaxBreakdown {
  const { vat = true, nhil = true, getfl = true } = options;

  const components: TaxComponent[] = [];
  if (nhil) components.push({ name: "NHIL", rate: GHANA_TAX_RATES.NHIL, amount: taxableAmount * GHANA_TAX_RATES.NHIL });
  if (getfl) components.push({ name: "GETFL", rate: GHANA_TAX_RATES.GETFL, amount: taxableAmount * GHANA_TAX_RATES.GETFL });
  if (vat) components.push({ name: "VAT", rate: GHANA_TAX_RATES.VAT, amount: taxableAmount * GHANA_TAX_RATES.VAT });

  const totalTax = components.reduce((s, c) => s + c.amount, 0);
  const totalRate = components.reduce((s, c) => s + c.rate, 0);

  return { components, totalTax, totalRate };
}

/**
 * Format a Ghana Cedis amount with the ₵ symbol.
 */
export function formatCedis(amount: number): string {
  return `₵${Number(amount || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * SYLHN POS — Loyalty points & customer tier engine
 *
 * Premium feature: customers earn loyalty points on every purchase, can redeem
 * points for discounts, and auto-upgrade tiers (Bronze → Silver → Gold → Platinum)
 * based on lifetime spend.
 *
 * Configuration is stored in SystemSetting table so the admin can tune it
 * without redeploying. Defaults match a typical Ghana grocery loyalty program:
 *   - Earn 1 point per GHS 1 spent (excluding VAT)
 *   - Redeem: 100 points = GHS 5 discount
 *   - Tiers: Bronze (default), Silver (GHS 1k+), Gold (GHS 5k+), Platinum (GHS 10k+)
 *   - Tier perks: Silver 2% bonus points, Gold 5%, Platinum 10%
 */

import { db } from "./db";

// ===== Defaults (used if SystemSetting not yet populated) =====
export const DEFAULT_POINTS_PER_CEDI = 1;       // earn 1 pt per GHS 1 spent
export const DEFAULT_REDEEM_RATE = 0.05;        // 1 point = GHS 0.05 (100 pts = GHS 5)
export const DEFAULT_MIN_REDEEM = 100;          // min points balance to redeem

export const TIER_THRESHOLDS = [
  { tier: "platinum", minSpend: 10_000, bonusPct: 0.10 },
  { tier: "gold",     minSpend: 5_000,  bonusPct: 0.05 },
  { tier: "silver",   minSpend: 1_000,  bonusPct: 0.02 },
  { tier: "bronze",   minSpend: 0,      bonusPct: 0.00 },
] as const;

// Premium: human-readable tier perks for UI display
export const TIER_PERKS: Record<string, {
  label: string;
  color: string;
  gradient: string;
  icon: string;
  bonusPct: number;
  perks: string[];
  nextTier?: string;
  nextTierMinSpend?: number;
}> = {
  bronze: {
    label: "Bronze",
    color: "text-amber-700",
    gradient: "from-amber-600 to-orange-700",
    icon: "🥉",
    bonusPct: 0,
    perks: ["Earn 1 pt per GHS 1 spent", "Redeem 100 pts for GHS 5 discount", "Birthday surprise gift"],
    nextTier: "Silver",
    nextTierMinSpend: 1000,
  },
  silver: {
    label: "Silver",
    color: "text-slate-600",
    gradient: "from-slate-400 to-slate-600",
    icon: "🥈",
    bonusPct: 0.02,
    perks: ["Earn 1 pt per GHS 1 + 2% bonus", "Redeem points for discounts", "Priority WhatsApp receipts", "5% off fresh produce"],
    nextTier: "Gold",
    nextTierMinSpend: 5000,
  },
  gold: {
    label: "Gold",
    color: "text-yellow-600",
    gradient: "from-yellow-400 to-amber-600",
    icon: "🥇",
    bonusPct: 0.05,
    perks: ["Earn 1 pt per GHS 1 + 5% bonus", "Free delivery on orders > GHS 200", "Exclusive monthly deals", "10% off all household items"],
    nextTier: "Platinum",
    nextTierMinSpend: 10000,
  },
  platinum: {
    label: "Platinum",
    color: "text-violet-600",
    gradient: "from-violet-500 to-purple-700",
    icon: "💎",
    bonusPct: 0.10,
    perks: ["Earn 1 pt per GHS 1 + 10% bonus", "Free delivery (no minimum)", "Personal shopper via WhatsApp", "15% off entire purchase on birthday month", "Invitation to product launches"],
  },
};

export interface LoyaltyConfig {
  pointsPerCedi: number;
  redeemRate: number;     // GHS per point
  minRedeem: number;      // minimum points to redeem
}

// ===== Cache settings (60s TTL) =====
let cachedConfig: LoyaltyConfig | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }
  const settings = await db.systemSetting.findMany({
    where: {
      key: { in: ["loyalty.pointsPerCedi", "loyalty.redeemRate", "loyalty.minRedeem"] },
    },
  });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  cachedConfig = {
    pointsPerCedi: parseFloat(map["loyalty.pointsPerCedi"] || "") || DEFAULT_POINTS_PER_CEDI,
    redeemRate:    parseFloat(map["loyalty.redeemRate"] || "")    || DEFAULT_REDEEM_RATE,
    minRedeem:     parseInt(map["loyalty.minRedeem"] || "", 10)   || DEFAULT_MIN_REDEEM,
  };
  cachedAt = Date.now();
  return cachedConfig;
}

export function clearLoyaltyConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

// ===== Compute points earned for a sale =====
// Points are awarded on the post-discount, pre-tax subtotal.
export function computePointsEarned(subtotal: number, tier: string, config: LoyaltyConfig): number {
  const tierDef = TIER_THRESHOLDS.find(t => t.tier === tier) || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
  const bonusMultiplier = 1 + tierDef.bonusPct;
  return Math.floor(subtotal * config.pointsPerCedi * bonusMultiplier);
}

// ===== Compute cash value of redeemed points =====
export function pointsToCash(points: number, config: LoyaltyConfig): number {
  return Math.round(points * config.redeemRate * 100) / 100;
}

// ===== Determine tier from lifetime spend =====
export function tierFromSpend(totalSpent: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (totalSpent >= t.minSpend) return t.tier;
  }
  return "bronze";
}

// ===== Award points + update customer stats after a completed sale =====
// Called inside the sale-create transaction so everything is atomic.
export async function awardLoyaltyPoints(
  tx: any,
  customerId: string,
  saleId: string,
  subtotal: number,
  saleTotal: number,
): Promise<{ pointsEarned: number; newTier: string }> {
  const config = await getLoyaltyConfig();
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { pointsEarned: 0, newTier: "bronze" };

  const pointsEarned = computePointsEarned(subtotal, customer.tier, config);
  const newTotalSpent = customer.totalSpent + saleTotal;
  const newTier = tierFromSpend(newTotalSpent);
  const newPointsBalance = customer.pointsBalance + pointsEarned;
  const newPointsEarnedYTD = customer.pointsEarnedYTD + pointsEarned;
  const tierUpgraded = newTier !== customer.tier;

  await tx.customer.update({
    where: { id: customerId },
    data: {
      pointsBalance: newPointsBalance,
      pointsEarnedYTD: newPointsEarnedYTD,
      totalSpent: newTotalSpent,
      visits: { increment: 1 },
      lastVisitAt: new Date(),
      tier: newTier,
    },
  });

  await tx.loyaltyTransaction.create({
    data: {
      customerId,
      saleId,
      type: "earn",
      points: pointsEarned,
      balanceAfter: newPointsBalance,
      description: `Earned on sale (subtotal ${subtotal})${tierUpgraded ? ` — tier upgraded to ${newTier}` : ""}`,
    },
  });

  return { pointsEarned, newTier };
}

// ===== Redeem points for a sale (deduct balance, log transaction) =====
// Called inside the sale-create transaction. saleId may be null if the
// sale hasn't been created yet (the LoyaltyTransaction.saleId is nullable).
export async function redeemLoyaltyPoints(
  tx: any,
  customerId: string,
  saleId: string | null,
  pointsToRedeem: number,
): Promise<{ cashValue: number; ok: boolean; error?: string }> {
  if (pointsToRedeem <= 0) return { cashValue: 0, ok: true };

  const config = await getLoyaltyConfig();
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { cashValue: 0, ok: false, error: "Customer not found" };

  if (customer.pointsBalance < pointsToRedeem) {
    return { cashValue: 0, ok: false, error: `Insufficient points (have ${customer.pointsBalance}, need ${pointsToRedeem})` };
  }
  if (pointsToRedeem < config.minRedeem && customer.pointsBalance >= config.minRedeem) {
    return { cashValue: 0, ok: false, error: `Minimum redeem is ${config.minRedeem} points` };
  }

  const cashValue = pointsToCash(pointsToRedeem, config);
  const newBalance = customer.pointsBalance - pointsToRedeem;

  await tx.customer.update({
    where: { id: customerId },
    data: { pointsBalance: newBalance },
  });

  await tx.loyaltyTransaction.create({
    data: {
      customerId,
      saleId: saleId || null,  // nullable FK
      type: "redeem",
      points: -pointsToRedeem,
      balanceAfter: newBalance,
      description: `Redeemed ${pointsToRedeem} pts for GHS ${cashValue.toFixed(2)} discount`,
    },
  });

  return { cashValue, ok: true };
}

// ===== Link a loyalty transaction to a sale (after sale is created) =====
// Use this when redeemLoyaltyPoints was called with null saleId before the sale existed.
export async function linkLoyaltyToSale(
  tx: any,
  customerId: string,
  saleId: string,
): Promise<void> {
  await tx.loyaltyTransaction.updateMany({
    where: { customerId, saleId: null },
    data: { saleId },
  });
}

// ===== Reverse loyalty on void/refund (called in void/refund transaction) =====
export async function reverseLoyaltyForSale(
  tx: any,
  saleId: string,
  saleTotal: number,
  pointsEarned: number,
  pointsRedeemed: number,
  customerId: string | null,
): Promise<void> {
  if (!customerId) return;

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;

  // Reverse: subtract previously-awarded points, refund redeemed points,
  // decrement totalSpent (but never below 0), decrement visits (but never below 0).
  const newPointsBalance = Math.max(0, customer.pointsBalance - pointsEarned + pointsRedeemed);
  const newTotalSpent = Math.max(0, customer.totalSpent - saleTotal);
  const newVisits = Math.max(0, customer.visits - 1);

  await tx.customer.update({
    where: { id: customerId },
    data: {
      pointsBalance: newPointsBalance,
      totalSpent: newTotalSpent,
      visits: newVisits,
      // Re-evaluate tier — may downgrade after reversal
      tier: tierFromSpend(newTotalSpent),
    },
  });

  // Log the reversal
  await tx.loyaltyTransaction.create({
    data: {
      customerId,
      saleId,
      type: "adjust",
      points: -(pointsEarned - pointsRedeemed),
      balanceAfter: newPointsBalance,
      description: `Reversal of sale (earned ${pointsEarned} reversed, ${pointsRedeemed} redeemed returned)`,
    },
  });
}

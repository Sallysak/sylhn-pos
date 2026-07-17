"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Gift, Crown } from "lucide-react";
import { TIER_PERKS, tierFromSpend } from "@/lib/loyalty";

interface LoyaltyTierCardProps {
  tier: string;
  totalSpent: number;
  pointsBalance: number;
  pointsEarnedYTD: number;
  visits: number;
  customerName?: string;
  className?: string;
}

/**
 * Premium: Loyalty Tier Card — shows the customer's current tier, perks,
 * progress to the next tier, and lifetime stats.
 *
 * Used in the customer profile view and the POS checkout (when a loyalty
 * customer is attached to the sale).
 */
export function LoyaltyTierCard({
  tier, totalSpent, pointsBalance, pointsEarnedYTD, visits, customerName,
  className = "",
}: LoyaltyTierCardProps) {
  const perks = TIER_PERKS[tier] || TIER_PERKS.bronze;
  const nextTier = perks.nextTier;
  const nextTierMin = perks.nextTierMinSpend || 0;
  const progressToNext = nextTier
    ? Math.min(100, ((totalSpent - (perks.nextTierMinSpend! - (nextTierMin - totalSpent > 0 ? nextTierMin - totalSpent : 0))) / nextTierMin) * 100)
    : 100;
  const remainingToNext = nextTier ? Math.max(0, nextTierMin - totalSpent) : 0;

  return (
    <div className={`bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden ${className}`}>
      {/* Tier banner */}
      <div className={`bg-gradient-to-br ${perks.gradient} p-5 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 text-9xl opacity-20 -mr-4 -mt-4">
          {perks.icon}
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Loyalty Tier</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{perks.label}</span>
            <span className="text-2xl">{perks.icon}</span>
          </div>
          {customerName && (
            <div className="text-sm opacity-90 mt-1">{customerName}</div>
          )}
        </div>
      </div>

      {/* Points summary */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
        <div className="p-3 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Points Balance</div>
          <div className="text-xl font-bold text-emerald-600 font-mono">{pointsBalance}</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Earned YTD</div>
          <div className="text-xl font-bold text-blue-600 font-mono">{pointsEarnedYTD}</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Visits</div>
          <div className="text-xl font-bold text-purple-600 font-mono">{visits}</div>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              Progress to {nextTier}
            </div>
            <div className="text-xs font-bold text-slate-800">
              GHS {totalSpent.toFixed(0)} / {nextTierMin.toFixed(0)}
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full bg-gradient-to-r ${perks.gradient}`}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            Spend <strong className="text-slate-700">GHS {remainingToNext.toFixed(2)}</strong> more to reach {nextTier} {TIER_PERKS[nextTier]?.icon}
          </div>
        </div>
      )}

      {/* Perks list */}
      <div className="p-4">
        <div className="text-xs font-semibold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
          <Gift className="h-3 w-3" />
          {perks.label} Member Perks
        </div>
        <ul className="space-y-1.5">
          {perks.perks.map((perk, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Lifetime value */}
      <div className="px-4 pb-4">
        <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Lifetime Spend</div>
            <div className="text-lg font-bold text-slate-800 font-mono">GHS {totalSpent.toFixed(2)}</div>
          </div>
          <Crown className={`h-6 w-6 ${perks.color}`} />
        </div>
      </div>
    </div>
  );
}

// Compact version for the POS cart sidebar
export function LoyaltyTierBadge({ tier, pointsBalance }: { tier: string; pointsBalance: number }) {
  const perks = TIER_PERKS[tier] || TIER_PERKS.bronze;
  return (
    <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${perks.gradient} text-white text-[10px] font-bold px-2 py-1 rounded-full`}>
      <span>{perks.icon}</span>
      <span>{perks.label}</span>
      <span className="opacity-80">·</span>
      <span>{pointsBalance} pts</span>
    </div>
  );
}

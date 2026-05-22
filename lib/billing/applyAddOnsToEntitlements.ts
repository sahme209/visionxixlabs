/**
 * Pure add-on application — Phase 386.
 *
 * Given a plan's base entitlements + the list of active AddOnPurchase
 * rows for the current period, produce the *effective* entitlements:
 *
 *   - AI credit pool = base + sum(deliveredAICreditsCents) for "paid"
 *     ai_credits purchases in this period.
 *   - Seats         = base + sum(deliveredSeats) for "paid" purchases.
 *     Permanent skus carry forward; current_month skus would be a
 *     no-op here (no seat skus are current_month today).
 *   - Connectors    = base + sum(deliveredConnectors) for "paid"
 *     permanent purchases.
 *
 * Only purchases with status="paid" count. Pending purchases (Stripe
 * checkout opened but not yet completed) DO NOT apply — that's the
 * webhook's job to flip status and the producer's job to re-resolve.
 *
 * Pure — no Prisma. Live wrapper in lib/billing/effectiveEntitlements.ts
 * reads the rows from DB and calls this.
 */

import type { PricingPlan } from "./planRegistry";

export interface AddOnPurchaseRow {
  sku: string;
  status: string;
  deliveredAICreditsCents: number;
  deliveredSeats: number;
  deliveredConnectors: number;
  validFor: string;
}

export interface EffectiveEntitlements {
  /** Adjusted credit pool = base + applied add-on credits. */
  includedAICreditsCents: number;
  /** Adjusted seat cap. null when the base is null (Enterprise unlimited). */
  maxUsers: number | null;
  /** Adjusted connector cap. null when base is null. */
  maxConnectors: number | null;
  /** Totals applied this period (for the operator dashboard). */
  appliedAICreditsCents: number;
  appliedSeats: number;
  appliedConnectors: number;
}

export function applyAddOnsToEntitlements(
  plan: PricingPlan,
  purchases: ReadonlyArray<AddOnPurchaseRow>,
): EffectiveEntitlements {
  let appliedAICreditsCents = 0;
  let appliedSeats = 0;
  let appliedConnectors = 0;

  for (const p of purchases) {
    if (p.status !== "paid") continue;
    appliedAICreditsCents += Math.max(0, p.deliveredAICreditsCents);
    appliedSeats          += Math.max(0, p.deliveredSeats);
    appliedConnectors     += Math.max(0, p.deliveredConnectors);
  }

  const base = plan.entitlements;
  return {
    includedAICreditsCents: base.includedAICreditsCents + appliedAICreditsCents,
    maxUsers:      base.maxUsers === null      ? null : base.maxUsers + appliedSeats,
    maxConnectors: base.maxConnectors === null ? null : base.maxConnectors + appliedConnectors,
    appliedAICreditsCents,
    appliedSeats,
    appliedConnectors,
  };
}

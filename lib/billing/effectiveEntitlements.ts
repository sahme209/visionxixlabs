/**
 * Live effective-entitlements resolver — Phase 386.
 *
 * Pulls the workspace's paid AddOnPurchase rows for the current
 * period and the relevant permanent rows, then hands them to the
 * pure applyAddOnsToEntitlements() to derive the effective caps.
 *
 *   - ai_credits add-ons (validFor="current_month") only count when
 *     periodMonth matches.
 *   - seats + connectors (validFor="permanent") count regardless of
 *     period — once purchased, they apply forever (until refunded).
 *
 * Fails open on Prisma errors — returns the plan's base entitlements
 * with zero applied add-ons.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { applyAddOnsToEntitlements, type EffectiveEntitlements, type AddOnPurchaseRow } from "./applyAddOnsToEntitlements";
import type { PricingPlan } from "./planRegistry";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function effectiveEntitlements(
  organizationId: string,
  plan: PricingPlan,
  now: Date = new Date(),
): Promise<EffectiveEntitlements> {
  const period = periodKey(now);

  let purchases: AddOnPurchaseRow[];
  try {
    const rows = await prisma.addOnPurchase.findMany({
      where: {
        organizationId,
        status: "paid",
        OR: [
          // current_month add-ons only count when periodMonth matches.
          { validFor: "current_month", periodMonth: period },
          // permanent add-ons always count (one-time + recurring monthly billed elsewhere).
          { validFor: "permanent", refundedAt: null },
        ],
      },
      select: {
        sku: true,
        status: true,
        deliveredAICreditsCents: true,
        deliveredSeats: true,
        deliveredConnectors: true,
        validFor: true,
      },
    });
    purchases = rows;
  } catch {
    purchases = [];
  }

  return applyAddOnsToEntitlements(plan, purchases);
}

import { isolatedRuntimeRequested } from "./isolatedApplication/runtime";
import { resolveIsolatedApplicationPlan } from "./isolatedApplication/plan";
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { planForStripeTier } from "./planRegistry";
import { applyAddOnsToEntitlements } from "./applyAddOnsToEntitlements";

export type CurrentAIAllowance =
  | { available: false }
  | { available: true; baseCents: number; addOnCents: number; poolCents: number; usedCents: number; heldCents: number; includedRemainingCents: number; overagePolicy: string };

const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Read-only snapshot of reserveAICredits' current authority, not an admission
 * decision. Expired unlinked holds are excluded without modifying their rows.
 * Linked/pending holds remain included regardless of age or month. */
export async function readCurrentAIAllowance(repo: Pick<PrismaClient, "$transaction">, organizationId: string, now = new Date()): Promise<CurrentAIAllowance> {
  if (!organizationId || !Number.isFinite(now.getTime())) return { available: false };
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  try {
    return await repo.$transaction(async (tx) => {
      const [billing, purchases, usage, active] = await Promise.all([
        tx.tenantBillingPlan.findUnique({ where: { organizationId } }),
        tx.addOnPurchase.findMany({ where: { organizationId, status: { in: ["paid", "partially_refunded"] }, OR: [{ validFor: "current_month", periodMonth: month }, { validFor: "permanent", refundedAt: null }] } }),
        tx.usageEvent.aggregate({ where: { organizationId, eventKind: "ai_invocation", createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } }, _sum: { billedCents: true } }),
        tx.aIUsageReservation.aggregate({ where: { organizationId, OR: [
          { status: "reserved", usageEventId: null, expiresAt: { gt: now } },
          { status: "reserved", usageEventId: { not: null } },
          { status: "pending_settlement" },
        ] }, _sum: { reservedCents: true } }),
      ]);
      if (billing !== null && (!billing || typeof billing.tier !== "string" || !billing.tier.trim() || !["trialing", "active", "past_due", "canceled", "no_plan"].includes(billing.status))) return { available: false };
      if (!Array.isArray(purchases) || purchases.some(p => !p || !["paid", "partially_refunded"].includes(p.status)
        || !["current_month", "permanent"].includes(p.validFor) || !cents(p.deliveredAICreditsCents) || !cents(p.reversedAICreditsCents)
        || !cents(p.deliveredSeats) || !cents(p.deliveredConnectors))) return { available: false };
      const used = usage?._sum?.billedCents;
      const held = active?._sum?.reservedCents;
      if (!(used === null || cents(used)) || !(held === null || cents(held))) return { available: false };
      const plan = isolatedRuntimeRequested() ? await resolveIsolatedApplicationPlan(tx, organizationId, "read") : planForStripeTier(billing?.tier);
      const effective = applyAddOnsToEntitlements(plan, purchases);
      const usedCents = used ?? 0, heldCents = held ?? 0;
      if (!cents(effective.includedAICreditsCents) || !cents(effective.appliedAICreditsCents) || !cents(usedCents + heldCents)) return { available: false };
      return { available: true, baseCents: plan.entitlements.includedAICreditsCents, addOnCents: effective.appliedAICreditsCents,
        poolCents: effective.includedAICreditsCents, usedCents, heldCents,
        includedRemainingCents: Math.max(0, effective.includedAICreditsCents - usedCents - heldCents), overagePolicy: plan.entitlements.overagePolicy };
    }, { isolationLevel: "RepeatableRead" });
  } catch { return { available: false }; }
}

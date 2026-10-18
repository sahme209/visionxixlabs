import { newTestAllocationGuard, reserveAllocationV2 } from "./newTestSubscription/allocationPlan";
import { fenceNewTestAdmission, newTestPlanGuard } from "./newTestSubscription/paidPlan";
import { isolatedRuntimeRequested } from "./isolatedApplication/runtime";
import { resolveIsolatedApplicationPlan } from "./isolatedApplication/plan";
import "server-only";
import type { Prisma, TenantBillingPlan } from "@prisma/client";

import { applyAddOnsToEntitlements } from "./applyAddOnsToEntitlements";
import type { PricingPlan } from "./planRegistry";
import { planForStripeTier } from "./planRegistry";

const RESERVATION_TTL_MS = 5 * 60 * 1000;

type ReservationRow = {
  id: string; organizationId: string; idempotencyKey: string; reservedCents: number;
  status: string; expiresAt: Date;
};

export type AICreditReservationResult =
  | { ok: true; reservation: ReservationRow; reused: boolean; allocationPolicy?: "axiom_test_anniversary_v2" }
  | { ok: false; error: "ai_credit_pool_exhausted" | "ai_credit_reservation_unavailable" | "idempotency_key_conflict" };

/**
 * Transactional hold for a bounded AI request. The caller must settle or
 * release it. Unattached stale holds are expired before each new admission
 * decision; Gateway-backed holds move to pending_settlement once usage is
 * durably linked, so they remain reserved until reconciliation.
 */
export async function reserveAICredits(
  repo: any,
  input: { organizationId: string; idempotencyKey: string; reservedCents: number; correlationId?: string },
  now = new Date(),
  /** Internal isolated-test composition only; never supplied by a request body.
   * Resolver must verify durable provenance using this same transaction. Existing
   * production callers omit it and retain their exact legacy path. */
  isolatedVerifiedPlan?: (transaction: Prisma.TransactionClient, organizationId: string, billing: TenantBillingPlan | null) => Promise<PricingPlan>,
): Promise<AICreditReservationResult> {
  if (!input.organizationId || !/^[A-Za-z0-9_-]{16,200}$/.test(input.idempotencyKey) || !Number.isSafeInteger(input.reservedCents) || input.reservedCents < 1) {
    return { ok: false, error: "ai_credit_reservation_unavailable" };
  }
  try {
    return await repo.$transaction(async (tx: any) => {
      // A reused hold is not proof that an isolated contract remains valid.
      const isolatedPlan = isolatedRuntimeRequested() ? await resolveIsolatedApplicationPlan(tx, input.organizationId, "admission") : isolatedVerifiedPlan ? await isolatedVerifiedPlan(tx, input.organizationId, await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } })) : undefined;
      const guard = newTestPlanGuard(isolatedPlan);
      const allocationGuard = newTestAllocationGuard(isolatedPlan);
      const decisionNow = allocationGuard?.clock ?? guard?.clock ?? now;
      if ((isolatedRuntimeRequested() || isolatedVerifiedPlan) && !guard && !allocationGuard) throw new Error("isolated_plan_unavailable");
      if (isolatedRuntimeRequested() && !isolatedPlan) throw new Error("isolated_plan_unavailable");
      const existing = await tx.aIUsageReservation.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
      if (existing) {
        if (existing.reservedCents !== input.reservedCents) return { ok: false as const, error: "idempotency_key_conflict" as const };
        if (allocationGuard) await reserveAllocationV2(tx, isolatedPlan!, input, true);
        if (guard) await fenceNewTestAdmission(tx, isolatedPlan!, input, false);
        return { ok: true as const, reservation: existing, reused: true, ...(allocationGuard ? { allocationPolicy: "axiom_test_anniversary_v2" as const } : {}) };
      }
      if (allocationGuard) {
        const reservation = (await reserveAllocationV2(tx, isolatedPlan!, input, false))!;
        return { ok: true as const, reservation, reused: false, allocationPolicy: "axiom_test_anniversary_v2" as const };
      }
      await tx.aIUsageReservation.updateMany({
        where: { organizationId: input.organizationId, status: "reserved", usageEventId: null, expiresAt: { lte: decisionNow } },
        data: { status: "expired", releasedAt: decisionNow },
      });
      const [billing, purchases, usage, active] = await Promise.all([
        tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } }),
        tx.addOnPurchase.findMany({ where: { organizationId: input.organizationId, status: { in: ["paid", "partially_refunded"] }, OR: [{ validFor: "current_month", periodMonth: monthKey(decisionNow) }, { validFor: "permanent", refundedAt: null }] } }),
        tx.usageEvent.aggregate({ where: { organizationId: input.organizationId, eventKind: "ai_invocation", createdAt: { gte: monthStart(decisionNow) } }, _sum: { billedCents: true } }),
        tx.aIUsageReservation.aggregate({
          where: {
            organizationId: input.organizationId,
            OR: [
              { status: "reserved", usageEventId: null, expiresAt: { gt: decisionNow } },
              // Older linked Gateway holds predate pending_settlement and must
              // continue consuming capacity until their usage is reconciled.
              { status: "reserved", usageEventId: { not: null } },
              { status: "pending_settlement" },
            ],
          },
          _sum: { reservedCents: true },
        }),
      ]);
      const plan = isolatedPlan ?? planForStripeTier(billing?.tier);
      const pool = applyAddOnsToEntitlements(plan, purchases).includedAICreditsCents;
      const used = usage._sum.billedCents ?? 0;
      const held = active._sum.reservedCents ?? 0;
      if (plan.entitlements.overagePolicy === "hard_stop" && pool - used - held < input.reservedCents) {
        return { ok: false as const, error: "ai_credit_pool_exhausted" as const };
      }
      const reservation = guard ? (await fenceNewTestAdmission(tx, isolatedPlan!, input, true))! : await tx.aIUsageReservation.create({ data: { ...input, status: "reserved", expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) } });
      return { ok: true as const, reservation, reused: false };
    }, { isolationLevel: "Serializable" });
  } catch {
    return { ok: false, error: "ai_credit_reservation_unavailable" };
  }
}

export async function releaseAICreditReservation(repo: any, organizationId: string, reservationId: string, now = new Date()): Promise<boolean> {
  try {
    const result = await repo.aIUsageReservation.updateMany({ where: { id: reservationId, organizationId, status: "reserved" }, data: { status: "released", releasedAt: now } });
    return result.count === 1;
  } catch { return false; }
}

/** Settle a hold after authoritative usage is recorded.  The ledger never
 * debits more than the pre-authorized maximum; callers must surface a
 * settlement failure rather than silently overrun a customer's budget. */
export async function settleAICreditReservation(
  repo: any,
  organizationId: string,
  reservationId: string,
  actualCents: number,
  usageEventId?: string | null,
  now = new Date(),
): Promise<boolean> {
  if (!Number.isSafeInteger(actualCents) || actualCents < 0) return false;
  try {
    const result = await repo.aIUsageReservation.updateMany({
      where: { id: reservationId, organizationId, status: "reserved", reservedCents: { gte: actualCents } },
      data: { status: "settled", settledCents: actualCents, usageEventId: usageEventId ?? null, settledAt: now },
    });
    return result.count === 1;
  } catch { return false; }
}

export async function attachAICreditReservationUsage(repo: any, organizationId: string, reservationId: string, usageEventId: string): Promise<boolean> {
  try {
    const result = await repo.aIUsageReservation.updateMany({
      where: { id: reservationId, organizationId, status: "reserved", usageEventId: null },
      data: { status: "pending_settlement", usageEventId },
    });
    return result.count === 1;
  } catch { return false; }
}

function monthStart(now: Date) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }
function monthKey(now: Date) { return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; }

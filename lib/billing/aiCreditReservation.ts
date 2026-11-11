import { smallSonnet55Reservation, type SmallSonnet55Request } from "./smallSonnet55Request";
import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { publicBillingWindow, reservePublicCredits, claimPublicCreditDispatch, publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEnrollment } from "./publicBillingStore";
import { newTestAllocationGuard, reserveAllocationV2 } from "./newTestSubscription/allocationPlan";
import { fenceNewTestAdmission, newTestPlanGuard } from "./newTestSubscription/paidPlan";
import { isolatedRuntimeRequested } from "./isolatedApplication/runtime";
import { resolveIsolatedApplicationPlan } from "./isolatedApplication/plan";
import "server-only";
import { requestReservationCents } from "./requestReservationCents";
import { smallSonnetReservation, type SmallSonnetRequest } from "./smallSonnetRequest";
import type { Prisma, TenantBillingPlan } from "@/lib/prismaClient";

import { applyAddOnsToEntitlements } from "./applyAddOnsToEntitlements";
import type { PricingPlan } from "./planRegistry";
import { planForStripeTier } from "./planRegistry";

type ReservationRepository = {
  $transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T>;
};
type ReservationWriter = {
  aIUsageReservation: { updateMany(args: Prisma.AIUsageReservationUpdateManyArgs): Promise<{ count: number }> };
};

const RESERVATION_TTL_MS = 5 * 60 * 1000;

type ReservationRow = {
  id: string; organizationId: string; idempotencyKey: string; reservedCents: number;
  status: string; expiresAt: Date;
};

export type AICreditReservationResult =
  | { ok: true; reservation: ReservationRow; reused: boolean; smallRequestApplied?: true; small55RequestApplied?: true; allocationPolicy?: "axiom_test_anniversary_v2" | "axiom_public_anniversary_v1" }
  | { ok: false; error: "ai_credit_pool_exhausted" | "ai_credit_reservation_unavailable" | "idempotency_key_conflict" };

/**
 * Transactional hold for a bounded AI request. The caller must settle or
 * release it. Unattached stale holds are expired before each new admission
 * decision; Gateway-backed holds move to pending_settlement once usage is
 * durably linked, so they remain reserved until reconciliation.
 */
export async function reserveAICredits(
  repo: ReservationRepository,
  request: { organizationId: string; idempotencyKey: string; reservedCents: number; correlationId?: string; smallAgentRequest?: SmallSonnetRequest; smallAgent55Request?: SmallSonnet55Request },
  now = new Date(),
  /** Internal isolated-test composition only; never supplied by a request body.
   * Resolver must verify durable provenance using this same transaction. Existing
   * production callers omit it and retain their exact legacy path. */
  isolatedVerifiedPlan?: (transaction: Prisma.TransactionClient, organizationId: string, billing: TenantBillingPlan | null) => Promise<PricingPlan>,
): Promise<AICreditReservationResult> {
  if (!request.organizationId || !/^[A-Za-z0-9_-]{16,200}$/.test(request.idempotencyKey) || !Number.isSafeInteger(request.reservedCents) || request.reservedCents < 1) {
    return { ok: false, error: "ai_credit_reservation_unavailable" };
  }
  try {
    return await repo.$transaction(async (tx: Prisma.TransactionClient) => {
      return reserveAICreditsInTransaction(tx, request, now, isolatedVerifiedPlan);
    }, { isolationLevel: "Serializable" });
  } catch {
    return { ok: false, error: "ai_credit_reservation_unavailable" };
  }
}

/** Same transaction as its caller: no early policy branch can commit separately. */
export async function reserveAICreditsInTransaction(
 tx: Prisma.TransactionClient,
 request: Parameters<typeof reserveAICredits>[1],
 now = new Date(),
 isolatedVerifiedPlan?: Parameters<typeof reserveAICredits>[3],
): Promise<AICreditReservationResult> {
 if (!request.organizationId || !/^[A-Za-z0-9_-]{16,200}$/.test(request.idempotencyKey) || !Number.isSafeInteger(request.reservedCents) || request.reservedCents < 1) throw Error("ai_credit_reservation_unavailable");
      const { smallAgentRequest, smallAgent55Request, ...ordinaryInput } = request;
      if (smallAgentRequest && smallAgent55Request) throw Error("small_agent_protocol_conflict");
      let input = ordinaryInput;
      if (smallAgent55Request) {
        // A genuine exact55 quote is valid only in its reviewed public Free ledger.
        // Never clip its hold or fall back to ordinary/old5 provider behavior.
        if (isolatedRuntimeRequested() || isolatedVerifiedPlan || !publicBillingPolicyEnabled() || input.reservedCents > 100 || smallSonnet55Reservation(smallAgent55Request, input) !== input.reservedCents) throw Error("small_agent55_reservation_unavailable");
        const identity = configuredPublicBillingIdentity(), decisionNow = await publicDatabaseNow(tx);
        const state = await publicBillingWindow(tx, input.organizationId, identity, decisionNow);
        if (!state?.available || state.contract !== null) throw Error("small_agent55_public_free_required");
        const reserved = await reservePublicCredits(tx, input, identity, decisionNow);
        if (!reserved) throw Error("small_agent55_public_reservation_required");
        return reserved.ok ? { ...reserved, small55RequestApplied: true as const } : reserved;
      }
      if (smallAgentRequest) {
        if (isolatedRuntimeRequested() || isolatedVerifiedPlan || !publicBillingPolicyEnabled() || smallSonnetReservation(smallAgentRequest, input) !== input.reservedCents) throw Error("small_agent_reservation_unavailable");
        const identity = configuredPublicBillingIdentity(), decisionNow = await publicDatabaseNow(tx);
        const state = await publicBillingWindow(tx, input.organizationId, identity, decisionNow);
        // Only authoritative enrolled Free accounts use the smaller hold. A
        // paid/legacy account keeps its existing amount and provider behavior.
        if (state?.available && state.contract === null) {
          const reserved = await reservePublicCredits(tx, input, identity, decisionNow);
          if (!reserved) throw Error("small_agent_public_reservation_required");
          return reserved.ok ? { ...reserved, smallRequestApplied: true as const } : reserved;
        }
        input = { ...ordinaryInput, reservedCents: requestReservationCents() };
      }
      // A reused hold is not proof that an isolated contract remains valid.
      const isolatedPlan = isolatedRuntimeRequested() ? await resolveIsolatedApplicationPlan(tx, input.organizationId, "admission") : isolatedVerifiedPlan ? await isolatedVerifiedPlan(tx, input.organizationId, await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } })) : undefined;
      if (!isolatedPlan && publicBillingPolicyEnabled()) {
        const publicResult = await reservePublicCredits(tx, input, configuredPublicBillingIdentity(), await publicDatabaseNow(tx));
        if (publicResult !== undefined) return publicResult;
      }
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
        where: { organizationId: input.organizationId, status: "reserved", usageEventId: null, expiresAt: { lte: decisionNow }, pipelineCall: { is: null } },
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
              { status: "reserved", pipelineCall: { isNot: null } },
              // A dispatch can be billable even if no SDK response was received.
              // TTL only expires work that was never durably claimed.
              { status: "dispatch_unknown" },
            ],
          },
          _sum: { reservedCents: true },
        }),
      ]);
      const plan = isolatedPlan ?? planForStripeTier(billing?.tier);
      const pool = applyAddOnsToEntitlements(plan, purchases).includedAICreditsCents;
      const used = usage._sum.billedCents ?? 0;
      const held = active._sum.reservedCents ?? 0;
      // Never beyond prepaid (2026-11-08): every tier hard-stops. Legacy
      // metered_billing / soft_warn / custom_contract no longer admit usage
      // the balance cannot cover; post-use metered settlement is not a
      // substitute for prepaid balance.
      if (pool - used - held < input.reservedCents) {
        return { ok: false as const, error: "ai_credit_pool_exhausted" as const };
      }
      const reservation = guard ? (await fenceNewTestAdmission(tx, isolatedPlan!, input, true))! : await tx.aIUsageReservation.create({ data: { ...input, status: "reserved", expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) } });
      return { ok: true as const, reservation, reused: false };
}

/** Legacy dispatch admission. Retains the existing accepted-member policy (not
 * the isolated v2 owner/admin policy). Commit before handing control to an SDK.
 * A membership row lock and database-clock conditional transition close both
 * revocation and expiry races. A prior claim never grants retry authority. */
export async function claimLegacyAICreditDispatch(
  tx: Prisma.TransactionClient,
  scope: { organizationId: string; userId: string },
  reservationId: string,
): Promise<boolean> {
  if (!scope.organizationId || !scope.userId || !reservationId) return false;
  if (publicBillingPolicyEnabled() && await readPublicEnrollment(tx, scope.organizationId)) {
    return claimPublicCreditDispatch(tx, scope, reservationId, configuredPublicBillingIdentity(), await publicDatabaseNow(tx));
  }
  const members = await tx.$queryRawUnsafe<Array<{ userId: string; organizationId: string; acceptedAt: Date | null }>>(
    'SELECT "userId","organizationId","acceptedAt" FROM "OrgMembership" WHERE "userId"=$1 AND "organizationId"=$2 FOR SHARE', scope.userId, scope.organizationId,
  );
  const member = members[0];
  if (members.length !== 1 || !member || member.userId !== scope.userId || member.organizationId !== scope.organizationId || !(member.acceptedAt instanceof Date) || !Number.isFinite(member.acceptedAt.getTime())) return false;
  const changed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "AIUsageReservation" h SET status='dispatch_unknown',"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE h.id=$1 AND h."organizationId"=$2 AND h.status='reserved' AND h."usageEventId" IS NULL AND h."expiresAt" AT TIME ZONE 'UTC'>clock_timestamp() AND EXISTS(SELECT 1 FROM "OrgMembership" m WHERE m."userId"=$3 AND m."organizationId"=$2 AND m."acceptedAt" IS NOT NULL) RETURNING h.id`,
    reservationId, scope.organizationId, scope.userId,
  );
  return changed.length === 1 && changed[0]?.id === reservationId;
}

export async function releaseAICreditReservation(repo: ReservationWriter, organizationId: string, reservationId: string, now = new Date()): Promise<boolean> {
  try {
    const result = await repo.aIUsageReservation.updateMany({ where: { id: reservationId, organizationId, status: "reserved", pipelineCall: { is: null } }, data: { status: "released", releasedAt: now } });
    return result.count === 1;
  } catch { return false; }
}

/** Settle a hold after authoritative usage is recorded.  The ledger never
 * debits more than the pre-authorized maximum; callers must surface a
 * settlement failure rather than silently overrun a customer's budget. */
export async function settleAICreditReservation(
  repo: ReservationWriter,
  organizationId: string,
  reservationId: string,
  actualCents: number,
  usageEventId?: string | null,
  now = new Date(),
): Promise<boolean> {
  if (!Number.isSafeInteger(actualCents) || actualCents < 0) return false;
  try {
    const result = await repo.aIUsageReservation.updateMany({
      where: { id: reservationId, organizationId, status: "reserved", pipelineCall: { is: null }, reservedCents: { gte: actualCents } },
      data: { status: "settled", settledCents: actualCents, usageEventId: usageEventId ?? null, settledAt: now },
    });
    return result.count === 1;
  } catch { return false; }
}

export async function attachAICreditReservationUsage(repo: ReservationWriter, organizationId: string, reservationId: string, usageEventId: string): Promise<boolean> {
  try {
    const result = await repo.aIUsageReservation.updateMany({
      where: { id: reservationId, organizationId, status: "reserved", usageEventId: null, pipelineCall: { is: null } },
      data: { status: "pending_settlement", usageEventId },
    });
    return result.count === 1;
  } catch { return false; }
}

function monthStart(now: Date) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }
function monthKey(now: Date) { return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; }

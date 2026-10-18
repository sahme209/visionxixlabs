import { newTestAllocationPricingPlan } from "./allocationPlan";
import "server-only";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { planForStripeTier, type PricingPlan } from "../planRegistry";
import { paidAccess, paidIdentity } from "./paidCoverage";
import type { readVerifiedNewTestContract } from "./verifiedContract";

type Guard = { revision: number; org: string; runtimeId: string; accountId: string; eventToken: string; originalDigest: string; evidenceDigest: string | null; status: string; seats: number; month: string; clock: Date; start: string; end: string; collectedAt: string | null };
const guards = new WeakMap<PricingPlan, Guard>();
export const newTestPlanGuard = (plan: PricingPlan | undefined) => plan ? guards.get(plan) : undefined;
export async function newTestPricingPlan(tx: Prisma.TransactionClient, verified: NonNullable<Awaited<ReturnType<typeof readVerifiedNewTestContract>>>): Promise<PricingPlan> {
  if (verified.allowance) return newTestAllocationPricingPlan(tx, verified.contract, verified, verified.allowance);
  const clock = await tx.$queryRawUnsafe<Array<{ now: Date }>>('SELECT clock_timestamp() AS now');
  if (!(clock[0]?.now instanceof Date)) throw new Error("paid_coverage_unavailable");
  const { contract, intent, coverage } = verified;
  const access = paidAccess(paidIdentity(contract, intent), contract.status, contract.eventToken, coverage?.observation ?? null, !!coverage, clock[0].now);
  const legacy = planForStripeTier("starter");
  const plan: PricingPlan = { ...legacy, entitlements: { ...legacy.entitlements, includedAICreditsCents: access.monthlyAICreditsCents, overagePolicy: "hard_stop" } };
  const o = coverage!.observation; const e = o.collection.kind === "collected" ? o.collection.evidence : null;
  guards.set(plan, { revision: coverage!.revision, org: contract.organizationId, runtimeId: contract.runtimeId, accountId: contract.accountId, eventToken: contract.eventToken, originalDigest: coverage!.originalEvidence.digest, evidenceDigest: e?.digest ?? null, status: contract.status, seats: contract.seatQuantity, month: access.month, clock: clock[0].now, start: o.currentPeriodStart, end: o.currentPeriodEnd, collectedAt: e?.collectedAt ?? null });
  return plan;
}
/** Same Serializable transaction as pool arithmetic. Locking the current rows
 * rejects an updated snapshot; database clock is checked at the admission SQL,
 * including reused receipts. No existing hold is changed by a failed fence. */
export async function fenceNewTestAdmission(tx: Prisma.TransactionClient, plan: PricingPlan, input: { organizationId: string; idempotencyKey: string; reservedCents: number; correlationId?: string }, create: boolean) {
  const g = guards.get(plan); if (!g || g.org !== input.organizationId) throw new Error("paid_coverage_unavailable");
  const authority = `WITH authority AS MATERIALIZED (
    SELECT p."organizationId" FROM "TenantBillingPlan" p
    JOIN "OrganizationTestCoverageObservation" o ON o.org=p."organizationId"
    JOIN "IsolatedTestRuntime" r ON r.id=$2 AND r.account=$3
    WHERE p."organizationId"=$1 AND p."lastStripeEventId"=$4 AND p.status=$5 AND p."seatQuantity"=$6
      AND p."currentPeriodEndsAt" AT TIME ZONE 'UTC'=$11::timestamptz
      AND o.revision=$13 AND o.body->>'eventToken'=$4 AND o."originalDigest"=$7 AND o."evidenceDigest" IS NOT DISTINCT FROM $8::text
    FOR SHARE OF p,o)
  `;
  const clockFence = `to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM')=$9
    AND ($5<>'active' OR ($8::text IS NOT NULL AND clock_timestamp()>=$10::timestamptz AND clock_timestamp()<$11::timestamptz AND clock_timestamp()>=$12::timestamptz))`;
  const args = [g.org, g.runtimeId, g.accountId, g.eventToken, g.status, g.seats, g.originalDigest, g.evidenceDigest, g.month, g.start, g.end, g.collectedAt, g.revision];
  if (!create) {
    const rows = await tx.$queryRawUnsafe<Array<{ organizationId: string }>>(authority + `SELECT "organizationId" FROM authority WHERE ${clockFence}`, ...args);
    if (rows.length !== 1) throw new Error("paid_coverage_unavailable");
    return null;
  }
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; organizationId: string; idempotencyKey: string; reservedCents: number; status: string; expiresAt: Date }>>(authority + `INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents",status,"correlationId","expiresAt","createdAt","updatedAt") SELECT $14,$1,$15,$16,'reserved',$17,clock_timestamp()+interval '5 minutes',clock_timestamp(),clock_timestamp() FROM authority WHERE ${clockFence} RETURNING *`, ...args, randomUUID(), input.idempotencyKey, input.reservedCents, input.correlationId ?? null);
  if (rows.length !== 1) throw new Error("paid_coverage_unavailable");
  return rows[0];
}

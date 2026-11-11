import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/lib/prismaClient";
import { planForStripeTier, type PricingPlan } from "../planRegistry";
import { ANNIVERSARY_POLICY_V2, resolveAllowanceWindowV2, type AllowanceBasisV2, type AllowanceWindowV2 } from "./anniversaryWindow";
import { createEnrollmentV2, readAllocationFactsV2, readFixtureEnrollment, type AllocationScopeV2, type VerifiedEnrollmentV2 } from "./fixtureAllocation";
import { createReservationAttributionV2, resolveAllocationV2, sameAllocationJSON, type PurchaseV2 } from "./allocationV2";
import { paidIdentity, validateObservation } from "./paidCoverage";
import type { readVerifiedNewTestContract } from "./verifiedContract";
type Verified = NonNullable<Awaited<ReturnType<typeof readVerifiedNewTestContract>>>;
export type AllocationGuardV2 = { scope: AllocationScopeV2; state: VerifiedEnrollmentV2; verified: Verified | null; basis: AllowanceBasisV2; window: AllowanceWindowV2; clock: Date };
const guards = new WeakMap<PricingPlan, AllocationGuardV2>();
export const newTestAllocationGuard = (plan: PricingPlan | undefined) => plan ? guards.get(plan) : undefined;
function deny(): never { throw new Error("allowance_provenance_unavailable"); }
export async function allocationClock(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRawUnsafe<Array<{ now: Date }>>('SELECT clock_timestamp() AS now'); const now = rows[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) deny(); return now;
}
/** Requires independently verified original identity and enrollment. No public
 * request can select this policy and absent V1 evidence never becomes Free. */
export async function newTestAllocationPricingPlan(tx: Prisma.TransactionClient, scope: AllocationScopeV2, verified: Verified | null, suppliedState?: VerifiedEnrollmentV2): Promise<PricingPlan> {
  const state = suppliedState ?? await readFixtureEnrollment(tx, scope); if (!state || createEnrollmentV2(scope).digest !== state.enrollment.digest) deny();
  const clock = await allocationClock(tx);
  let basis: AllowanceBasisV2 = state.freeBasis, coverage: Parameters<typeof resolveAllowanceWindowV2>[1] = null;
  if (state.paidBasis) {
    if (!verified?.allowance || verified.allowance.enrollment.digest !== state.enrollment.digest || verified.allowance.revision !== state.revision || !verified.coverage) deny();
    const { contract: c, intent, coverage: stored } = verified;
    if (!intent.allowanceV2 || intent.allowanceV2.enrollmentDigest !== state.enrollment.digest || state.paidBasis.origin.firstCollectionDigest !== stored.originalEvidence.digest) deny();
    const o = stored.observation; validateObservation(paidIdentity(c, intent), c.eventToken, o);
    if (o.collection.kind === "unavailable" && ["unsupported_terms", "replay_unavailable"].includes(o.collection.reason)) deny();
    if (c.status === "active") {
      if (o.collection.kind !== "collected") deny();
      const e = o.collection.evidence;
      if (e.version !== 2 || e.enrollmentDigest !== state.enrollment.digest || e.originalAnchor !== state.paidBasis.anchor || e.originalCreateProofDigest !== state.paidBasis.origin.createProofDigest) deny();
      basis = state.paidBasis; coverage = { version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "collected", status: c.status, basisDigest: basis.digest, evidenceDigest: e.digest, serviceStart: e.serviceStart, serviceEnd: e.serviceEnd, collectedAt: e.collectedAt };
    } else if (!["past_due", "canceled", "trialing", "no_plan"].includes(c.status)) deny();
  } else {
    if (verified) deny();
    const billing = await tx.tenantBillingPlan.findUnique({ where: { organizationId: scope.organizationId } });
    if (billing && (billing.stripeCustomerId || billing.stripeSubscriptionId || billing.tier !== "starter" || !["trialing", "no_plan"].includes(billing.status))) deny();
  }
  if (basis.runtimeId !== scope.runtimeId || basis.accountId !== scope.accountId || basis.organizationId !== scope.organizationId || basis.enrollmentDigest !== state.enrollment.digest) deny();
  const result = resolveAllowanceWindowV2(basis, coverage, clock); if (result.kind !== "available") deny();
  const legacy = planForStripeTier("starter"), plan: PricingPlan = { ...legacy, entitlements: { ...legacy.entitlements, includedAICreditsCents: result.window.includedCents, overagePolicy: "hard_stop" } };
  guards.set(plan, { scope, state, verified, basis, window: result.window, clock }); return plan;
}
export async function readAllocationAllowanceV2(tx: Prisma.TransactionClient, plan: PricingPlan) {
  const g = guards.get(plan); if (!g) deny();
  const facts = await readAllocationFactsV2(tx, g.state);
  await lockAllocationAuthorityV2(tx, g);
  const now = await allocationClock(tx), result = resolveAllocationV2(g.basis, g.window, facts, now);
  const { sql, predicate, args } = allocationAuthoritySQLV2(g, []);
  const current = await tx.$queryRawUnsafe<Array<{ org: string }>>(sql + `SELECT org FROM authority WHERE ${predicate}`, ...args);
  if (current.length !== 1) deny();
  const poolCents = result.remainingCents + result.usedCents + result.heldCents;
  return { available: true as const, baseCents: result.baseCents, addOnCents: Math.max(0, poolCents - result.baseCents), poolCents, usedCents: result.usedCents, heldCents: result.heldCents, includedRemainingCents: result.remainingCents, overagePolicy: "hard_stop" };
}
export function purchaseFingerprintV2(p: PurchaseV2) { return { id: p.id, organizationId: p.organizationId, status: p.status, deliveredAICreditsCents: p.deliveredAICreditsCents, reversedAICreditsCents: p.reversedAICreditsCents, validFor: p.validFor, periodMonth: p.periodMonth, refundedAt: p.refundedAt?.toISOString() ?? null }; }
/** Real AddOnPurchase UPDATE (including the existing refund writer) conflicts
 * with these locks; no refund-side enrollment-lock assumption is required. */
export async function lockSelectedPurchasesV2(tx: Prisma.TransactionClient, selected: PurchaseV2[]): Promise<void> {
  if (!selected.length) return;
  const rows = await tx.$queryRawUnsafe<PurchaseV2[]>('SELECT * FROM "AddOnPurchase" WHERE id=ANY($1::text[]) AND "organizationId"=$2 ORDER BY id FOR UPDATE', selected.map(p => p.id).sort(), selected[0].organizationId);
  if (rows.length !== selected.length || selected.some(p => !rows.some(row => sameAllocationJSON(purchaseFingerprintV2(row), purchaseFingerprintV2(p))))) deny();
}
/** Final SQL runs AFTER locks. It rechecks current purchase fingerprints and
 * UTC validity at DB clock, even when the paid anniversary bucket is unchanged. */
export function allocationAuthoritySQLV2(g: AllocationGuardV2, selected: PurchaseV2[]) {
  const c = g.verified?.contract, o = g.verified?.coverage;
  const args: unknown[] = [g.scope.organizationId, g.scope.runtimeId, g.scope.accountId, g.state.enrollment.digest, g.state.revision, g.window.start, g.window.end, JSON.stringify(selected.map(purchaseFingerprintV2)), c?.eventToken ?? null, o?.revision ?? null, o?.originalEvidence.digest ?? null, o?.observation.collection.kind === "collected" ? o.observation.collection.evidence.digest : null, c?.status ?? null, c?.seatQuantity ?? null, o?.observation.currentPeriodEnd ?? null, g.basis.kind === "paid" && o?.observation.collection.kind === "collected" ? o.observation.collection.evidence.collectedAt : null];
  const sql = `WITH authority AS MATERIALIZED (
    SELECT e.org FROM "OrganizationTestAllowanceEnrollment" e JOIN "IsolatedTestRuntime" r ON r.id=e.runtime AND r.account=e.account
    WHERE e.org=$1 AND e.runtime=$2 AND e.account=$3 AND e.body->>'digest'=$4 AND e.revision=$5
    FOR UPDATE OF e), selected AS MATERIALIZED (
    SELECT p.* FROM "AddOnPurchase" p JOIN jsonb_to_recordset($8::jsonb) AS w(id text,"organizationId" text,status text,"deliveredAICreditsCents" integer,"reversedAICreditsCents" integer,"validFor" text,"periodMonth" text,"refundedAt" text) ON p.id=w.id
    WHERE p."organizationId"=$1 AND p."organizationId"=w."organizationId" AND p.status=w.status AND p."deliveredAICreditsCents"=w."deliveredAICreditsCents" AND p."reversedAICreditsCents"=w."reversedAICreditsCents" AND p."validFor"=w."validFor" AND p."periodMonth"=w."periodMonth" AND p."refundedAt" IS NOT DISTINCT FROM (w."refundedAt"::timestamptz AT TIME ZONE 'UTC')
    ORDER BY p.id FOR UPDATE OF p), bound AS MATERIALIZED (
    SELECT p."organizationId" FROM "TenantBillingPlan" p JOIN "OrganizationTestCoverageObservation" o ON o.org=p."organizationId" WHERE p."organizationId"=$1 AND p."lastStripeEventId"=$9 AND p.status=$13 AND p."seatQuantity"=$14 AND p."currentPeriodEndsAt" AT TIME ZONE 'UTC'=$15::timestamptz AND o.revision=$10 AND o."originalDigest"=$11 AND o."evidenceDigest" IS NOT DISTINCT FROM $12::text AND o.body->>'eventToken'=$9 FOR SHARE OF p,o)
  `;
  const identityPredicate = `($9::text IS NULL AND NOT EXISTS(SELECT 1 FROM "OrganizationTestSubscriptionContract" WHERE org=$1) AND NOT EXISTS(SELECT 1 FROM "TenantBillingPlan" WHERE "organizationId"=$1 AND ("stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL)) OR $9::text IS NOT NULL AND EXISTS(SELECT 1 FROM bound))`;
  const predicate = `clock_timestamp()>=$6::timestamptz AND clock_timestamp()<$7::timestamptz
    AND (SELECT count(*) FROM selected)=jsonb_array_length($8::jsonb)
    AND NOT EXISTS(SELECT 1 FROM selected WHERE status NOT IN ('paid','partially_refunded') OR NOT (("validFor"='current_month' AND "periodMonth"=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM')) OR ("validFor"='permanent' AND "refundedAt" IS NULL)))
    AND ${identityPredicate}
    AND ($16::text IS NULL OR clock_timestamp()>=$16::timestamptz)`;
  return { sql, predicate, identityPredicate, args };
}
export async function lockAllocationEnrollmentV2(tx: Prisma.TransactionClient, g: AllocationGuardV2) {
  const state = await readFixtureEnrollment(tx, g.scope, true);
  if (!state || state.enrollment.digest !== g.state.enrollment.digest || state.revision !== g.state.revision || state.paidBasis?.digest !== g.state.paidBasis?.digest) deny();
  return state;
}
/** Explicit awaited lock statement before reading DB time. This avoids relying
 * on SQL boolean evaluation order around potentially waiting authority locks. */
export async function lockAllocationAuthorityV2(tx: Prisma.TransactionClient, g: AllocationGuardV2) {
  const { sql, predicate, args } = allocationAuthoritySQLV2(g, []);
  const rows = await tx.$queryRawUnsafe<Array<{ org: string }>>(sql + `SELECT org FROM authority WHERE ${predicate}`, ...args);
  if (rows.length !== 1) deny();
}
export async function reserveAllocationV2(tx: Prisma.TransactionClient, plan: PricingPlan, input: { organizationId: string; idempotencyKey: string; reservedCents: number; correlationId?: string }, reused: boolean) {
  const g = guards.get(plan); if (!g || g.scope.organizationId !== input.organizationId) deny();
  const state = await lockAllocationEnrollmentV2(tx, g);
  let facts = await readAllocationFactsV2(tx, state), now = await allocationClock(tx);
  let result = resolveAllocationV2(g.basis, g.window, facts, now, reused ? 0 : input.reservedCents);
  await lockSelectedPurchasesV2(tx, result.selectedPurchases);
  await lockAllocationAuthorityV2(tx, g);
  // Re-read complete facts after selected row locks, not a cached net balance.
  facts = await readAllocationFactsV2(tx, state); now = await allocationClock(tx);
  const fresh = resolveAllocationV2(g.basis, g.window, facts, now, reused ? 0 : input.reservedCents);
  if (!sameAllocationJSON(fresh.allocation, result.allocation) || !sameAllocationJSON(fresh.selectedPurchases.map(purchaseFingerprintV2), result.selectedPurchases.map(purchaseFingerprintV2))) deny();
  result = fresh;
  const { sql, predicate, args } = allocationAuthoritySQLV2(g, result.selectedPurchases);
  if (reused) {
    const rows = await tx.$queryRawUnsafe<Array<{ org: string }>>(sql + `SELECT org FROM authority WHERE ${predicate}`, ...args);
    if (rows.length !== 1) deny(); return null;
  }
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; organizationId: string; idempotencyKey: string; reservedCents: number; status: string; expiresAt: Date; createdAt: Date }>>(sql + `INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents",status,"correlationId","expiresAt","createdAt","updatedAt") SELECT $17,$1,$18,$19,'reserved',$20,(clock_timestamp() AT TIME ZONE 'UTC')+interval '5 minutes',clock_timestamp() AT TIME ZONE 'UTC',clock_timestamp() AT TIME ZONE 'UTC' FROM authority WHERE ${predicate} RETURNING *`, ...args, randomUUID(), input.idempotencyKey, input.reservedCents, input.correlationId ?? null);
  const hold = rows[0]; if (rows.length !== 1 || !hold) deny();
  const attribution = createReservationAttributionV2(g.basis, g.window, hold.createdAt, result.allocation);
  await tx.$executeRawUnsafe('INSERT INTO "NewTestReservationAttribution" ("reservationId",org,"enrollmentDigest",body) VALUES ($1,$2,$3,$4::jsonb)', hold.id, input.organizationId, state.enrollment.digest, JSON.stringify(attribution));
  return hold;
}

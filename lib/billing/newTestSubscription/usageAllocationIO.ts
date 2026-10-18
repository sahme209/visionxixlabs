import "server-only";
import type { Prisma } from "@prisma/client";
import type { RecordAIUsageInput, RecordAIUsageResult } from "../recordAIUsageEvent";
import type { CostBreakdown } from "../computeInvocationCost";
import { applyMargin } from "../aiBillingMargin";
import { ANNIVERSARY_POLICY_V2, resolveAllowanceWindowV2, type AllowanceWindowV2 } from "./anniversaryWindow";
import { readAllocationFactsV2, readFixtureEnrollment } from "./fixtureAllocation";
import { allocationAuthoritySQLV2, allocationClock, lockAllocationAuthorityV2, lockSelectedPurchasesV2, newTestAllocationGuard, newTestAllocationPricingPlan, purchaseFingerprintV2 } from "./allocationPlan";
import { resolveAllocationV2, sameAllocationJSON, usageAttributionV2, type HoldV2, type ReservationAttributionV2 } from "./allocationV2";
import { readVerifiedNewTestContract } from "./verifiedContract";
function deny(): never { throw new Error("attributed_usage_unavailable"); }
const cents = (n: number) => Number.isSafeInteger(n) && n >= 0;
async function originalHold(tx: Prisma.TransactionClient, id: string, org?: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ body: ReservationAttributionV2 }>>('SELECT a.body FROM "NewTestReservationAttribution" a WHERE a."reservationId"=$1', id);
  const a = rows[0]?.body;
  if (!a || org && org !== a.organizationId) deny();
  const scope = { runtimeId: a.runtimeId, accountId: a.accountId, organizationId: a.organizationId };
  const marker = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2 FOR SHARE', scope.runtimeId, scope.accountId);
  if (marker.length !== 1) deny();
  const state = await readFixtureEnrollment(tx, scope, true); if (!state || state.enrollment.digest !== a.enrollmentDigest) deny();
  // Existing paid original identity remains necessary even for a late cost.
  // Current positive permission is deliberately not required to settle work
  // already claimed; a negative projection cannot erase financial history.
  const verified = state.paidBasis ? await readVerifiedNewTestContract(tx, scope, scope.organizationId) : null;
  if (state.paidBasis && !verified?.allowance) deny();
  const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "AIUsageReservation" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE', id, scope.organizationId);
  if (locked.length !== 1) deny();
  const facts = await readAllocationFactsV2(tx, state), now = await allocationClock(tx);
  const free = resolveAllowanceWindowV2(state.freeBasis, null, now); if (free.kind !== "available") deny();
  // Classification only, not a Free access grant. All old buckets stay intact.
  resolveAllocationV2(state.freeBasis, free.window, facts, now);
  const hold = facts.holds.find(h => h.id === id); if (!hold?.attribution || !sameAllocationJSON(hold.attribution, a)) deny();
  return { scope, state, facts, now, hold, verified };
}
function originalWindow(hold: HoldV2, bases: Parameters<typeof resolveAllocationV2>[2]["bases"]): { basis: typeof bases[number]; window: AllowanceWindowV2 } {
  const a = hold.attribution; if (!a) deny(); const basis = bases.find(b => b.digest === a.basisDigest); if (!basis) deny();
  return { basis, window: { version: 2, policy: ANNIVERSARY_POLICY_V2, basisDigest: basis.digest, bucketId: a.bucketId, kind: a.kind, start: a.windowStart, end: a.windowEnd, includedCents: basis.kind === "free" ? 200 : basis.terms.monthlyAICreditsCents } };
}
/** Durable state transition on the EXISTING hold. Caller must commit this
 * transaction before the first potentially billable byte. A false result or
 * exception never authorizes dispatch; historical unknown/pending is not retry. */
export async function claimNewTestBillableDispatch(tx: Prisma.TransactionClient, scope: { organizationId: string; userId: string }, id: string): Promise<boolean> {
  const original = await originalHold(tx, id, scope.organizationId), { hold, state } = original;
  const member = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: scope.userId, organizationId: scope.organizationId } } });
  if (!member?.acceptedAt || !["owner", "admin"].includes(member.role)) deny();
  if (hold.status !== "reserved" || hold.usageEventId !== null || hold.expiresAt <= original.now) return false;
  const currentPlan = await newTestAllocationPricingPlan(tx, original.scope, original.verified, state), g = newTestAllocationGuard(currentPlan); if (!g) deny();
  const a = hold.attribution!, { basis, window } = originalWindow(hold, original.facts.bases);
  // A historical paid ceiling is not current paid dispatch permission. Keep
  // already-claimed settlement independent, and keep original Free funding
  // through paid activation; neither branch transfers this reservation.
  if (basis.kind === "paid" && a.allocation.some(c => c.source === "included")
    && (g.basis.kind !== "paid" || g.basis.digest !== basis.digest || g.window.bucketId !== window.bucketId || g.window.start !== window.start || g.window.end !== window.end)) return false;
  const selected = a.allocation.flatMap(c => c.source === "purchase" ? [original.facts.purchases.find(p => p.id === c.purchaseId) ?? deny()] : []);
  await lockSelectedPurchasesV2(tx, selected);
  await lockAllocationAuthorityV2(tx, g);
  // An independent membership UPDATE must conflict with this held row lock.
  // Await it after other potentially waiting locks and before the DB clock.
  const members = await tx.$queryRawUnsafe<Array<{ userId: string; organizationId: string; role: string; acceptedAt: Date | null }>>('SELECT "userId","organizationId",role,"acceptedAt" FROM "OrgMembership" WHERE "userId"=$1 AND "organizationId"=$2 FOR SHARE', scope.userId, scope.organizationId);
  const finalMember = members[0];
  if (members.length !== 1 || !finalMember || finalMember.userId !== scope.userId || finalMember.organizationId !== scope.organizationId || !(finalMember.acceptedAt instanceof Date) || !Number.isFinite(finalMember.acceptedAt.getTime()) || !["owner", "admin"].includes(finalMember.role)) deny();
  const facts = await readAllocationFactsV2(tx, state), now = await allocationClock(tx), current = facts.holds.find(h => h.id === id);
  if (!current || current.status !== "reserved" || current.usageEventId !== null || current.expiresAt <= now || !sameAllocationJSON(current.attribution, a)) return false;
  if (selected.some(p => !facts.purchases.some(f => sameAllocationJSON(purchaseFingerprintV2(f), purchaseFingerprintV2(p))))) deny();
  const withoutOwn = { ...facts, holds: facts.holds.filter(h => h.id !== id) };
  const capacity = resolveAllocationV2(basis, window, withoutOwn, now).capacity;
  if (a.allocation.some(c => c.maxCents > (c.source === "included" ? capacity.includedCents : capacity.purchases.find(p => p.purchaseId === c.purchaseId)?.cents ?? 0))) return false;
  const { sql, predicate, args } = allocationAuthoritySQLV2(g, selected);
  const changed = await tx.$queryRawUnsafe<Array<{ id: string }>>(sql + `UPDATE "AIUsageReservation" h SET status='dispatch_unknown',"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' FROM authority WHERE h.id=$17 AND h."organizationId"=$1 AND h.status='reserved' AND h."usageEventId" IS NULL AND h."expiresAt" AT TIME ZONE 'UTC'>clock_timestamp() AND clock_timestamp()>=$18::timestamptz AND clock_timestamp()<$19::timestamptz AND ${predicate} AND EXISTS(SELECT 1 FROM "OrgMembership" m WHERE m."userId"=$20 AND m."organizationId"=$1 AND m."acceptedAt" IS NOT NULL AND m.role IN ('owner','admin')) RETURNING h.id`, ...args, id, a.windowStart, a.windowEnd, scope.userId);
  return changed.length === 1;
}
/** No provider-specific definitive nonacceptance policy is currently supported.
 * There is intentionally no constructor for this opaque authority. Generic
 * errors/timeouts never release claimed capacity or write a fabricated receipt. */
declare const unusedAuthority: unique symbol;
export type DefinitiveUnusedVerdict = { readonly kind: "provider_definitive_nonacceptance"; readonly [unusedAuthority]: true };
export async function releaseNewTestUnusedDispatch(_tx: Prisma.TransactionClient, _id: string, _verdict: DefinitiveUnusedVerdict): Promise<false> { void _tx; void _id; void _verdict; return false; }
function usageFields(input: RecordAIUsageInput) {
  if (!input.provider?.trim() || !input.model?.trim() || ![input.inputTokens, input.outputTokens, input.cachedReadTokens ?? 0].every(n => cents(n))) deny();
  if (input.metadata && Object.hasOwn(input.metadata, "axiomTestAllocationV2")) deny();
  return { provider: input.provider, model: input.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, cachedReadTokens: input.cachedReadTokens ?? 0 };
}
/** Actual existing UsageEvent creation plus hold linkage/settlement. Must run in
 * one Serializable transaction. It never selects the settlement-time bucket. */
export async function recordAttributedUsageV2(tx: Prisma.TransactionClient, id: string, input: RecordAIUsageInput, cost: CostBreakdown | null): Promise<RecordAIUsageResult> {
  const fields = usageFields(input), gateway = input.provider === "vercel_gateway";
  if (gateway ? !input.externalUsageId || cost !== null : !cost || ![cost.totalCents, cost.inputCents, cost.outputCents, cost.cachedReadCents].every(cents) || cost.totalCents !== cost.inputCents + cost.outputCents + cost.cachedReadCents) deny();
  const { hold, facts } = await originalHold(tx, id, input.organizationId), a = hold.attribution!;
  if (!gateway && cost!.totalCents > hold.reservedCents) deny();
  if (hold.usageEventId) {
    const existing = await tx.usageEvent.findUnique({ where: { id: hold.usageEventId } });
    if (!existing || existing.organizationId !== input.organizationId || existing.provider !== input.provider || (gateway ? existing.externalUsageId !== input.externalUsageId : existing.model !== fields.model || existing.inputTokens !== fields.inputTokens || existing.outputTokens !== fields.outputTokens || existing.cachedReadTokens !== fields.cachedReadTokens || existing.costCents !== cost!.totalCents || existing.billedCents !== cost!.totalCents)
      || !["pending_settlement", "settled"].includes(hold.status)) deny();
    return { recorded: true, usageEventId: existing.id, cost: gateway ? null : cost, ...(gateway ? { pendingSettlement: existing.billingStatus === "pending" } : {}) };
  }
  if (hold.status !== "dispatch_unknown") deny();
  if (gateway && await tx.usageEvent.findUnique({ where: { externalUsageId: input.externalUsageId! } })) deny();
  // Full fact validation above requires every earlier event to have a hold.
  // No foreign/upserted generation can be attached to this one.
  if (facts.usage.some(u => u.id === hold.usageEventId)) deny();
  const receipt = usageAttributionV2(id, a, gateway ? null : cost!.totalCents);
  const metadata = { ...(input.metadata ?? {}), ...(gateway ? { costSource: "gateway_generation_lookup" } : {}), axiomTestAllocationV2: receipt };
  const event = await tx.usageEvent.create({ data: { organizationId: input.organizationId, eventKind: "ai_invocation", ...fields, externalUsageId: input.externalUsageId ?? null, costCents: cost?.totalCents ?? 0, billedCents: cost?.totalCents ?? 0, billingStatus: gateway ? "pending" : "settled", triggeredBy: input.triggeredBy ?? null, correlationId: input.correlationId ?? null, aiInvocationId: input.aiInvocationId ?? null, metadata: metadata as Prisma.InputJsonObject } });
  const changed = await tx.aIUsageReservation.updateMany({ where: { id, organizationId: input.organizationId, status: "dispatch_unknown", usageEventId: null }, data: { usageEventId: event.id, status: gateway ? "pending_settlement" : "settled", ...(gateway ? {} : { settledCents: cost!.totalCents, settledAt: await allocationClock(tx) }) } });
  if (changed.count !== 1) deny();
  return { recorded: true, usageEventId: event.id, cost, ...(gateway ? { pendingSettlement: true } : {}) };
}
export type AttributedGatewayCostV2 = { eventId: string; externalUsageId: string; providerCostCents: number; billedCents: number; model: string; inputTokens: number; outputTokens: number; cachedReadTokens: number };
/** Reuses the existing Gateway margin/cap. Callers must have verified the exact
 * provider generation identity before passing the authoritative cost here. */
export async function settleAttributedUsageV2(tx: Prisma.TransactionClient, input: AttributedGatewayCostV2): Promise<"settled" | "already_settled"> {
  if (![input.providerCostCents, input.billedCents, input.inputTokens, input.outputTokens, input.cachedReadTokens].every(cents) || !input.model?.trim() || input.billedCents !== Math.max(input.providerCostCents, applyMargin(input.providerCostCents))) deny();
  const event = await tx.usageEvent.findUnique({ where: { id: input.eventId } });
  const metadata = event?.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : null;
  const receipt = metadata?.axiomTestAllocationV2 as ReturnType<typeof usageAttributionV2> | undefined;
  if (!event || event.provider !== "vercel_gateway" || event.externalUsageId !== input.externalUsageId || !receipt?.reservationId) deny();
  const { hold } = await originalHold(tx, receipt.reservationId, event.organizationId);
  if (hold.usageEventId !== event.id) deny();
  const billedCents = Math.min(input.billedCents, hold.reservedCents);
  if (hold.status === "settled") { if (event.billingStatus !== "settled" || event.costCents !== input.providerCostCents || event.billedCents !== billedCents || event.model !== input.model || event.inputTokens !== input.inputTokens || event.outputTokens !== input.outputTokens || event.cachedReadTokens !== input.cachedReadTokens) deny(); return "already_settled"; }
  if (hold.status !== "pending_settlement" || event.billingStatus !== "pending") deny();
  const holdWrite = await tx.aIUsageReservation.updateMany({ where: { id: hold.id, organizationId: hold.organizationId, status: "pending_settlement", usageEventId: event.id }, data: { status: "settled", settledCents: billedCents, settledAt: await allocationClock(tx) } });
  if (holdWrite.count !== 1) deny();
  const usageWrite = await tx.usageEvent.updateMany({ where: { id: event.id, organizationId: event.organizationId, externalUsageId: input.externalUsageId, billingStatus: "pending" }, data: { model: input.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, cachedReadTokens: input.cachedReadTokens, costCents: input.providerCostCents, billedCents, billingStatus: "settled", metadata: { ...metadata, axiomTestAllocationV2: usageAttributionV2(hold.id, hold.attribution!, billedCents) } as Prisma.InputJsonObject } });
  if (usageWrite.count !== 1) deny();
  return "settled";
}

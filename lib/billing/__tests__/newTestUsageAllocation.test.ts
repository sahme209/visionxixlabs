import { describe, expect, it, vi } from "vitest";
import type { RecordAIUsageInput } from "../recordAIUsageEvent";
import { settleGatewayGenerationInTransaction, type GatewayUsageTransaction } from "../reconcileGatewayUsage";
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("ai", () => ({ gateway: { getGenerationInfo: vi.fn() } }));
import type { Prisma } from "@prisma/client";
import { createEnrollmentV2, originalCreateProofDigest, paidBasisForOriginalCollection, type VerifiedEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { ANNIVERSARY_POLICY_V2, createAllowanceBasisV2, resolveAllowanceWindowV2 } from "../newTestSubscription/anniversaryWindow";
import { createReservationAttributionV2, usageAttributionV2, resolveAllocationV2, type HoldV2, type UsageV2 } from "../newTestSubscription/allocationV2";
import { collectedEvidenceV2, type CoverageObservation } from "../newTestSubscription/paidCoverage";
import type { Contract, Intent } from "../newTestSubscription/service";
import { readVerifiedNewTestContract } from "../newTestSubscription/verifiedContract";
import { newTestAllocationPricingPlan, readAllocationAllowanceV2 } from "../newTestSubscription/allocationPlan";
import { claimNewTestBillableDispatch, recordAttributedUsageV2, settleAttributedUsageV2 } from "../newTestSubscription/usageAllocationIO";
function fixture(purchased = false) {
  const scope = { runtimeId: "r", accountId: "a", organizationId: "o" }, enrollment = createEnrollmentV2(scope), freeBasis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  const admitted = new Date("2026-10-18T11:00:00Z"), now = new Date("2026-11-18T14:00:00Z"), result = resolveAllowanceWindowV2(freeBasis, null, admitted); if (result.kind !== "available") throw new Error("fixture");
  let a = createReservationAttributionV2(freeBasis, result.window, admitted, purchased ? [{ source: "purchase", purchaseId: "p", maxCents: 100 }] : [{ source: "included", bucketId: result.window.bucketId, maxCents: 100 }]);
  const hold: HoldV2 = { id: "h", organizationId: "o", reservedCents: 100, status: "dispatch_unknown", createdAt: admitted, usageEventId: null, settledCents: null, expiresAt: new Date(admitted.getTime() + 300000), attribution: a };
  const usages: Array<UsageV2 & Record<string, unknown>> = [];
  const purchases = [{ id: "p", organizationId: "o", deliveredAICreditsCents: 500, reversedAICreditsCents: 0, validFor: "permanent", periodMonth: "2026-10", status: "paid", refundedAt: null, createdAt: admitted }];
  const state: VerifiedEnrollmentV2 = { enrollment, freeBasis, paidBasis: null, revision: 1 };
  let paid: { intent: Intent; contract: Contract; observation: CoverageObservation; original: ReturnType<typeof collectedEvidenceV2> } | null = null;
  function activatePaid() {
    const anchor = "2026-10-18T12:00:00.000Z", intent: Intent = { ...scope, allowanceV2: { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest }, livemode: false, id: "intent", state: "bound", email: "fixture@example.invalid", clientIntentKey: "fixture_intent_12345", requestDigest: "d".repeat(64), providerIdempotencyKey: "original_key", canonicalRequest: "fixture original", createdAtMs: 1, retryNotAfterMs: 2, revision: 3, sessionId: "cs", customerId: "cus", subscriptionId: "sub", terms: { catalogVersion: "axiom_public_test_v1", planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "price", unitAmountCents: 2900, monthlyAICreditsCents: 3000, monthlyDeployments: 100 }, originalCreateProof: { runtimeId: scope.runtimeId, accountId: scope.accountId, sessionId: "cs", outboundRequestKey: "original_key", outboundRequestDigest: "d".repeat(64), requestId: "req", statusCode: 200 } };
    const contract: Contract = { ...scope, livemode: false, planId: "pro", catalogVersion: "axiom_public_test_v1", originatingIntentId: intent.id, sessionId: "cs", customerId: "cus", subscriptionId: "sub", status: "active", seatQuantity: 3, eventToken: "evt_paid" };
    const original = collectedEvidenceV2({ ...contract, interval: "monthly", priceId: "price", unitAmountCents: 2900, invoiceId: "in", lineId: "il", subscriptionItemId: "si", paymentId: "inpay", paymentIntentId: "pi", chargeId: "ch", paymentMethodType: "card", currency: "usd", amountCents: 8700, collectedAt: anchor, serviceStart: anchor, serviceEnd: "2026-11-18T12:00:00.000Z" }, { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, originalAnchor: anchor, originalCreateProofDigest: originalCreateProofDigest(intent) });
    state.paidBasis = paidBasisForOriginalCollection(enrollment, intent, original); state.revision = 2;
    paid = { intent, contract, original, observation: { eventToken: contract.eventToken, latestInvoiceId: "in", currentPeriodStart: original.serviceStart, currentPeriodEnd: original.serviceEnd, collection: { kind: "collected", evidence: original } } };
    now.setTime(Date.parse("2026-10-18T13:00:00Z"));
  }
  const raw = vi.fn(async (sql: string) => {
    if (sql.includes('FROM "NewTestReservationAttribution" a')) return [{ body: a }];
    if (sql.includes("to_regclass")) return [{ installed: true, partial: true }];
    if (sql.startsWith("SELECT e.body")) return [{ body: enrollment, revision: state.revision, free: freeBasis, paid: state.paidBasis }];
    if (sql.startsWith('SELECT "userId","organizationId",role,"acceptedAt" FROM "OrgMembership"')) return [{ userId: "owner", organizationId: "o", role: "owner", acceptedAt: admitted }];
    if (sql.includes('UPDATE "AIUsageReservation" h SET')) { hold.status = "dispatch_unknown"; return [{ id: "h" }]; }
    if (sql.startsWith("SELECT clock_timestamp")) return [{ now }];
    if (sql.startsWith('SELECT id FROM "AIUsageReservation"')) return [{ id: "h" }];
    if (sql.startsWith("SELECT h.*")) return [structuredClone(hold)];
    if (sql.startsWith("SELECT c.body")) return paid ? [{ body: paid.contract, periodEnd: new Date(paid.observation.currentPeriodEnd), status: paid.contract.status, seatQuantity: 3, eventToken: paid.contract.eventToken, customer: "cus", subscription: "sub" }] : [];
    if (sql.startsWith('SELECT body FROM "RecurringSubscriptionIntent"')) return paid ? [{ body: paid.intent }] : [];
    if (sql.startsWith("SELECT o.body")) return paid ? [{ body: paid.observation, revision: 1, original: paid.original, current: paid.observation.collection.kind === "collected" ? paid.observation.collection.evidence : null }] : [];
    if (sql.includes("SELECT org FROM authority")) return [{ org: "o" }];
    if (sql.includes('FROM "IsolatedTestRuntime"')) return [{ id: "r" }];
    throw new Error("unowned_test_query");
  });
  const tx = { orgMembership: { findUnique: async () => ({ role: "owner", acceptedAt: admitted }) }, $queryRawUnsafe: raw, usageEvent: { findMany: async () => structuredClone(usages), findUnique: async ({ where }: { where: { id?: string; externalUsageId?: string } }) => structuredClone(usages.find(u => where.id ? u.id === where.id : u.externalUsageId === where.externalUsageId) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const event = { id: "u", ...data } as typeof usages[number]; usages.push(event); return structuredClone(event); }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; billingStatus: string }; data: object }) => { const u = usages.find(u => u.id === where.id && u.billingStatus === where.billingStatus); if (!u) return { count: 0 }; Object.assign(u, data); return { count: 1 }; }) },
    aIUsageReservation: { findUnique: async () => structuredClone(hold), updateMany: vi.fn(async ({ where, data }: { where: { status: string; usageEventId?: string | null }; data: object }) => { if (where.status !== hold.status || where.usageEventId !== undefined && where.usageEventId !== hold.usageEventId) return { count: 0 }; Object.assign(hold, data); return { count: 1 }; }) },
    addOnPurchase: { findMany: async () => structuredClone(purchases) } } as unknown as Prisma.TransactionClient;
  const input: RecordAIUsageInput = { organizationId: "o", provider: "openai", model: "model", inputTokens: 10, outputTokens: 20, metadata: { unrelated: "kept" } };
  function paidIncludedHold(status = "reserved") {
    activatePaid(); const at = new Date("2026-10-18T12:59:00Z"), basis = state.paidBasis!;
    const result = resolveAllowanceWindowV2(basis, { version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "collected", status: "active", basisDigest: basis.digest, evidenceDigest: paid!.original.digest, serviceStart: paid!.original.serviceStart, serviceEnd: paid!.original.serviceEnd, collectedAt: paid!.original.collectedAt }, at);
    if (result.kind !== "available") throw new Error("fixture");
    a = createReservationAttributionV2(basis, result.window, at, [{ source: "included", bucketId: result.window.bucketId, maxCents: 1000 }]);
    Object.assign(hold, { attribution: a, reservedCents: 1000, createdAt: at, expiresAt: new Date(at.getTime() + 300000), status });
  }
  function inactive() { if (!paid) throw new Error("fixture"); paid.contract.status = "past_due"; paid.observation.collection = { kind: "unavailable", reason: "not_collected" }; }
  function freeReservedBeforePaid() {
    const at = new Date("2026-10-18T11:59:00Z"), result = resolveAllowanceWindowV2(freeBasis, null, at); if (result.kind !== "available") throw new Error("fixture");
    a = createReservationAttributionV2(freeBasis, result.window, at, [{ source: "included", bucketId: result.window.bucketId, maxCents: 100 }]);
    Object.assign(hold, { attribution: a, createdAt: at, expiresAt: new Date(at.getTime() + 300000), status: "reserved" });
    activatePaid(); now.setTime(Date.parse("2026-10-18T12:01:00Z"));
  }
  return { tx, state, hold, a, usages, purchases, input, now, scope, activatePaid, paidIncludedHold, inactive, freeReservedBeforePaid };
}
const cost = { totalCents: 80, inputCents: 20, outputCents: 60, cachedReadCents: 0, appliedBatchRate: false };
describe("V2 actual existing usage composition with synthetic cost", () => {
  it.each([false, true])("settles late original Free funding atomically (purchased=%s)", async purchased => {
    const f = fixture(purchased), result = await recordAttributedUsageV2(f.tx, "h", f.input, cost);
    expect(result).toMatchObject({ recorded: true, usageEventId: "u", cost });
    expect(f.hold).toMatchObject({ status: "settled", settledCents: 80, usageEventId: "u" });
    expect(f.usages[0].metadata).toMatchObject({ unrelated: "kept", axiomTestAllocationV2: { bucketId: f.a.bucketId, state: "settled", allocation: [purchased ? { source: "purchase", purchaseId: "p", cents: 80 } : { source: "included", bucketId: f.a.bucketId, cents: 80 }] } });
    const window = resolveAllowanceWindowV2(f.state.freeBasis, null, f.now); if (window.kind !== "available") throw new Error("fixture");
    const remaining = resolveAllocationV2(f.state.freeBasis, window.window, { bases: [f.state.freeBasis], holds: [f.hold], usage: f.usages, purchases: f.purchases }, f.now).remainingCents;
    expect(remaining).toBe(purchased ? 620 : 700); // November Free200 + original remaining420/500.
  });
  it.each([false, true])("retains original funding through paid activation and restores no old balance (purchased=%s)", async purchased => {
    const f = fixture(purchased); f.activatePaid();
    await recordAttributedUsageV2(f.tx, "h", f.input, cost);
    const verified = await readVerifiedNewTestContract(f.tx, f.scope, "o");
    const plan = await newTestAllocationPricingPlan(f.tx, f.scope, verified, f.state), allowance = await readAllocationAllowanceV2(f.tx, plan);
    expect(allowance.baseCents).toBe(3000); expect(allowance.includedRemainingCents).toBe(purchased ? 3420 : 3500);
    expect(f.usages[0].metadata).toMatchObject({ axiomTestAllocationV2: { kind: "free", bucketId: f.a.bucketId } });
    expect(f.purchases[0].deliveredAICreditsCents).toBe(500); expect(f.purchases[0].reversedAICreditsCents).toBe(0);
  });
  it("cannot dispatch a still-reserved paid included1000 under current inactive Free200", async () => {
    const f = fixture(); f.paidIncludedHold(); f.inactive();
    const before = structuredClone({ hold: f.hold, usage: f.usages, purchases: f.purchases });
    expect(await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "h")).toBe(false);
    expect({ hold: f.hold, usage: f.usages, purchases: f.purchases }).toEqual(before);
  });
  it("retains current collected permission for an original paid included dispatch", async () => {
    const f = fixture(); f.paidIncludedHold(); expect(await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "h")).toBe(true);
  });
  it("keeps admitted original Free funding through paid activation without reallocation", async () => {
    const f = fixture(); f.freeReservedBeforePaid(); const original = structuredClone(f.hold.attribution);
    expect(await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "h")).toBe(true);
    expect(f.hold.attribution).toEqual(original); expect(f.hold.attribution!.kind).toBe("free");
  });
  it("settles already-unknown paid usage after inactive status without granting new dispatch", async () => {
    const f = fixture(); f.paidIncludedHold("dispatch_unknown"); f.inactive();
    await recordAttributedUsageV2(f.tx, "h", f.input, cost);
    expect(f.hold).toMatchObject({ status: "settled", settledCents: 80 }); expect(f.usages[0].metadata).toMatchObject({ axiomTestAllocationV2: { kind: "paid", bucketId: f.hold.attribution!.bucketId } });
  });
  it("settles an already-pending paid Gateway record after inactive status", async () => {
    const f = fixture(); f.paidIncludedHold("dispatch_unknown");
    await recordAttributedUsageV2(f.tx, "h", { ...f.input, provider: "vercel_gateway", externalUsageId: "gen_exact" }, null); f.inactive();
    await settleAttributedUsageV2(f.tx, { eventId: "u", externalUsageId: "gen_exact", providerCostCents: 53, billedCents: 80, model: "model", inputTokens: 10, outputTokens: 20, cachedReadTokens: 0 });
    expect(f.hold).toMatchObject({ status: "settled", settledCents: 80 });
  });
  it("links Gateway pending usage before late authoritative settlement and preserves unrelated metadata", async () => {
    const f = fixture(true); f.input.provider = "vercel_gateway";
    const input = { ...f.input, externalUsageId: "gen_exact" };
    await recordAttributedUsageV2(f.tx, "h", input, null);
    expect(f.hold).toMatchObject({ status: "pending_settlement", usageEventId: "u" });
    expect(f.usages[0].metadata).toMatchObject({ unrelated: "kept", costSource: "gateway_generation_lookup", axiomTestAllocationV2: usageAttributionV2("h", f.a, null) });
    await settleAttributedUsageV2(f.tx, { eventId: "u", externalUsageId: "gen_exact", providerCostCents: 53, billedCents: 80, model: "verified_model", inputTokens: 10, outputTokens: 20, cachedReadTokens: 0 });
    expect(f.hold).toMatchObject({ status: "settled", settledCents: 80 }); expect(f.usages[0]).toMatchObject({ billingStatus: "settled", costCents: 53, billedCents: 80 });
    expect(f.usages[0].metadata).toMatchObject({ unrelated: "kept", costSource: "gateway_generation_lookup" });
  });
  it("the existing Gateway settlement composition applies its exact generation identity, margin and cap", async () => {
    const f = fixture(true), input = { ...f.input, provider: "vercel_gateway", externalUsageId: "gen_exact" };
    await recordAttributedUsageV2(f.tx, "h", input, null);
    const event = { id: "u", externalUsageId: "gen_exact", metadata: f.usages[0].metadata };
    const generation = { id: "gen_exact", totalCost: 2, model: "model", providerName: "synthetic", promptTokens: 10, completionTokens: 20, cachedTokens: 0 };
    await expect(settleGatewayGenerationInTransaction(f.tx as unknown as GatewayUsageTransaction, event, { ...generation, id: "foreign" })).rejects.toThrow("gateway_generation_identity_mismatch");
    expect(f.hold.status).toBe("pending_settlement");
    await settleGatewayGenerationInTransaction(f.tx as unknown as GatewayUsageTransaction, event, generation);
    expect(f.usages[0]).toMatchObject({ costCents: 200, billedCents: 100 }); expect(f.hold.settledCents).toBe(100);
  });
  it("reports an exact Gateway settlement replay as historical rather than a second settlement", async () => {
    const f = fixture(true), input = { ...f.input, provider: "vercel_gateway", externalUsageId: "gen_exact" };
    await recordAttributedUsageV2(f.tx, "h", input, null);
    const settled = { eventId: "u", externalUsageId: "gen_exact", providerCostCents: 53, billedCents: 80, model: "model", inputTokens: 10, outputTokens: 20, cachedReadTokens: 0 };
    expect(await settleAttributedUsageV2(f.tx, settled)).toBe("settled");
    expect(await settleAttributedUsageV2(f.tx, settled)).toBe("already_settled"); expect(f.usages).toHaveLength(1);
  });
  it.each(["model", "inputTokens", "outputTokens", "cachedReadTokens"] as const)("rejects a changed sealed Gateway %s on replay without writes", async field => {
    const f = fixture(true), input = { ...f.input, provider: "vercel_gateway", externalUsageId: "gen_exact" };
    await recordAttributedUsageV2(f.tx, "h", input, null);
    const settled = { eventId: "u", externalUsageId: "gen_exact", providerCostCents: 53, billedCents: 80, model: "model", inputTokens: 10, outputTokens: 20, cachedReadTokens: 0 };
    await settleAttributedUsageV2(f.tx, settled); vi.mocked(f.tx.usageEvent.updateMany).mockClear(); vi.mocked(f.tx.aIUsageReservation.updateMany).mockClear();
    const before = structuredClone({ hold: f.hold, usage: f.usages, purchases: f.purchases });
    const changed = field === "model" ? { ...settled, model: "changed" } : { ...settled, [field]: settled[field] + 1 };
    await expect(settleAttributedUsageV2(f.tx, changed)).rejects.toThrow("attributed_usage_unavailable");
    expect(f.tx.usageEvent.updateMany).not.toHaveBeenCalled(); expect(f.tx.aIUsageReservation.updateMany).not.toHaveBeenCalled(); expect({ hold: f.hold, usage: f.usages, purchases: f.purchases }).toEqual(before);
  });
  it.each(["forged_namespace", "over_budget", "wrong_org", "not_claimed"])("refuses %s before usage or hold mutation", async bad => {
    const f = fixture(); if (bad === "forged_namespace") f.input.metadata = { axiomTestAllocationV2: {} };
    if (bad === "wrong_org") f.input.organizationId = "foreign"; if (bad === "not_claimed") f.hold.status = "reserved";
    await expect(recordAttributedUsageV2(f.tx, "h", f.input, bad === "over_budget" ? { ...cost, totalCents: 101 } : cost)).rejects.toThrow();
    expect(f.usages).toHaveLength(0); expect(f.hold.status).toBe(bad === "not_claimed" ? "reserved" : "dispatch_unknown");
  });
  it("returns an exact direct historical settlement without a second debit", async () => {
    const f = fixture(); await recordAttributedUsageV2(f.tx, "h", f.input, cost); await recordAttributedUsageV2(f.tx, "h", f.input, cost);
    expect(f.usages).toHaveLength(1);
    await expect(recordAttributedUsageV2(f.tx, "h", { ...f.input, model: "other" }, cost)).rejects.toThrow();
  });
});

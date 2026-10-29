import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCurrentAIAllowance } from "../currentAIAllowance";
import { withIsolatedWorkspaceScope } from "../isolatedApplication/scope";
import { reserveAICredits } from "../aiCreditReservation";
import { collectedEvidence } from "../newTestSubscription/paidCoverage";
const org = "synthetic_org";
function enable() {
  vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); vi.stubEnv("DATABASE_URL", "postgresql://synthetic:synthetic@127.0.0.1:55432/axiom_new_test_contract_rehearsal");
  vi.stubEnv("DIRECT_URL", ""); vi.stubEnv("AXIOM_ISOLATED_TEST_RUNTIME_ID", "runtime"); vi.stubEnv("AXIOM_ISOLATED_TEST_ACCOUNT_ID", "acct"); vi.stubEnv("AXIOM_ISOLATED_TEST_ORGANIZATIONS", org); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", "");
}
const context = { isAuthenticated: true, organizationId: org, userId: "owner", roles: ["owner"] };
function fixture() {
  const contract = { organizationId: org, originatingIntentId: "intent", catalogVersion: "axiom_public_test_v1", runtimeId: "runtime", accountId: "acct", livemode: false, customerId: "cus", subscriptionId: "sub", sessionId: "cs", planId: "pro" };
  const intent = { organizationId: org, runtimeId: "runtime", accountId: "acct", livemode: false, state: "bound", providerIdempotencyKey: "key", requestDigest: "digest", originalCreateProof: { runtimeId: "runtime", accountId: "acct", sessionId: "cs", outboundRequestKey: "key", outboundRequestDigest: "digest", requestId: "req", statusCode: 200 }, terms: { catalogVersion: "axiom_public_test_v1", planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "price", unitAmountCents: 2900 }, customerId: "cus", subscriptionId: "sub", sessionId: "cs" };
  const original = collectedEvidence({ ...contract, planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "price", unitAmountCents: 2900, invoiceId: "in", lineId: "il", subscriptionItemId: "si", paymentId: "inpay", paymentIntentId: "pi", chargeId: "ch", paymentMethodType: "card", currency: "usd", amountCents: 8700, collectedAt: "2026-10-01T00:00:00.000Z", serviceStart: "2026-10-01T00:00:00.000Z", serviceEnd: "2026-11-01T00:00:00.000Z" });
  const coverage = { revision: 1, original, current: original, body: { eventToken: "evt", latestInvoiceId: "in", currentPeriodStart: original.serviceStart, currentPeriodEnd: original.serviceEnd, collection: { kind: "collected", evidence: original } } };
  let clock = new Date("2026-10-16T00:00:00Z"); let status = "active"; let fence = true;
  const tx = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...args: unknown[]) => sql.startsWith("WITH authority") ? fence && args[12] === coverage.revision ? [{ organizationId: org }] : [] : sql.includes('clock_timestamp()') ? [{ now: clock }] : sql.includes('"IsolatedTestRuntime"') ? [{ id: "runtime" }] : sql.includes('"RecurringSubscriptionIntent"') ? [{ body: intent }] : sql.includes('"OrganizationTestCoverageObservation"') ? [coverage] : [{ body: contract, periodEnd: new Date("2026-11-01T00:00:00Z"), status, seatQuantity: 3, eventToken: "evt", customer: "cus", subscription: "sub" }]),
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: "growth", status: "active" })) },
    orgMembership: { findUnique: vi.fn(async () => ({ acceptedAt: new Date(), role: "owner" })) },
    addOnPurchase: { findMany: vi.fn(async () => []) }, usageEvent: { aggregate: vi.fn(async () => ({ _sum: { billedCents: 100 } })) },
    aIUsageReservation: { aggregate: vi.fn(async () => ({ _sum: { reservedCents: 250 } })), findUnique: vi.fn(async () => ({ reservedCents: 100, status: "reserved" })), updateMany: vi.fn(), create: vi.fn() },
  };
  const repo = { $transaction: <T>(fn: (transaction: typeof tx) => T) => fn(tx) };
  return { allowanceRepo: repo as unknown as Pick<PrismaClient, "$transaction">, coverage, intent, setClock: (now: Date) => { clock = now; }, setStatus: (next: string) => { status = next; }, denyFence: () => { fence = false; }, tx, repo: repo as unknown as Parameters<typeof reserveAICredits>[0] };
}
afterEach(() => vi.unstubAllEnvs());
describe("existing allowance and reservation select verified isolated contract", () => {
  it("reads $30 three-seat public test allocation instead of legacy Growth $200", async () => {
    enable(); const f = fixture();
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.allowanceRepo, org))).toMatchObject({ available: true, baseCents: 3000, heldCents: 250, includedRemainingCents: 2650, overagePolicy: "hard_stop" });
  });
  it("rejects missing provenance and does not silently fall back to legacy", async () => {
    enable(); const f = fixture(); f.tx.$queryRawUnsafe.mockRejectedValue(new Error("missing provenance table"));
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.allowanceRepo, org))).toEqual({ available: false });
  });
  it("cannot use the isolated shared reader outside a supported server-created scope", async () => {
    enable(); const f = fixture(); expect(await readCurrentAIAllowance(f.allowanceRepo, org)).toEqual({ available: false });
  });
  it("rechecks isolated provenance before returning an existing reservation", async () => {
    enable(); const f = fixture(); f.tx.$queryRawUnsafe.mockRejectedValue(new Error("unavailable"));
    expect(await withIsolatedWorkspaceScope(context, "admission", () => reserveAICredits(f.repo, { organizationId: org, idempotencyKey: "existing_intent_12345", reservedCents: 100 }))).toMatchObject({ ok: false, error: "ai_credit_reservation_unavailable" });
  });
  it("does not query new tables or change legacy current allowance", async () => {
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "false"); const f = fixture();
    expect(await readCurrentAIAllowance(f.allowanceRepo, org)).toMatchObject({ available: true, baseCents: 20000 }); expect(f.tx.$queryRawUnsafe).not.toHaveBeenCalled();
  });
  it("expires active allowance without a webhook and ignores stale caller clock", async () => {
    enable(); const f = fixture(); f.setClock(new Date("2026-11-01T00:00:00Z"));
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.allowanceRepo, org, new Date("2026-10-16Z")))).toEqual({ available: false });
    expect(await withIsolatedWorkspaceScope(context, "admission", () => reserveAICredits(f.repo, { organizationId: org, idempotencyKey: "existing_intent_12345", reservedCents: 100 }, new Date("2026-10-16Z")))).toMatchObject({ ok: false });
    expect(f.tx.aIUsageReservation.create).not.toHaveBeenCalled(); expect(f.tx.aIUsageReservation.updateMany).not.toHaveBeenCalled();
  });
  it("requires the final event-token/clock fence even for a reused receipt", async () => {
    enable(); const f = fixture(); f.denyFence();
    expect(await withIsolatedWorkspaceScope(context, "admission", () => reserveAICredits(f.repo, { organizationId: org, idempotencyKey: "existing_intent_12345", reservedCents: 100 }))).toMatchObject({ ok: false });
    expect(f.tx.$queryRawUnsafe.mock.calls.some(([sql]) => sql.startsWith("WITH authority") && sql.includes("FOR SHARE OF p,o") && sql.includes("clock_timestamp()"))).toBe(true);
    expect(f.tx.aIUsageReservation.updateMany).not.toHaveBeenCalled();
  });
  it("a deprivileging coverage revision fences an old paid preflight even with unchanged plan token", async () => {
    enable(); const f = fixture();
    f.tx.aIUsageReservation.findUnique.mockImplementation(async () => { f.coverage.revision++; return { reservedCents: 100, status: "released" }; });
    expect(await withIsolatedWorkspaceScope(context, "admission", () => reserveAICredits(f.repo, { organizationId: org, idempotencyKey: "existing_intent_12345", reservedCents: 100 }))).toMatchObject({ ok: false });
    expect(f.tx.aIUsageReservation.create).not.toHaveBeenCalled(); expect(f.tx.aIUsageReservation.updateMany).not.toHaveBeenCalled();
  });
  it("retains explicit inactive Free only with original collected provenance", async () => {
    enable(); const f = fixture(); f.setStatus("past_due");
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.allowanceRepo, org))).toMatchObject({ available: true, baseCents: 200, includedRemainingCents: 0 });
    f.intent.originalCreateProof.requestId = "";
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.allowanceRepo, org))).toEqual({ available: false });
  });
});

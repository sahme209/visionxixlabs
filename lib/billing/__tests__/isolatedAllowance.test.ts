import { afterEach, describe, expect, it, vi } from "vitest";
import { readCurrentAIAllowance } from "../currentAIAllowance";
import { withIsolatedWorkspaceScope } from "../isolatedApplication/scope";
import { reserveAICredits } from "../aiCreditReservation";
const org = "synthetic_org";
function enable() {
  vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); vi.stubEnv("DATABASE_URL", "postgresql://synthetic:synthetic@127.0.0.1:55432/axiom_new_test_contract_rehearsal");
  vi.stubEnv("DIRECT_URL", ""); vi.stubEnv("AXIOM_ISOLATED_TEST_RUNTIME_ID", "runtime"); vi.stubEnv("AXIOM_ISOLATED_TEST_ACCOUNT_ID", "acct"); vi.stubEnv("AXIOM_ISOLATED_TEST_ORGANIZATIONS", org); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", "");
}
const context = { isAuthenticated: true, organizationId: org, userId: "owner", roles: ["owner"] };
function fixture() {
  const contract = { organizationId: org, originatingIntentId: "intent", catalogVersion: "axiom_public_test_v1", runtimeId: "runtime", accountId: "acct", livemode: false, customerId: "cus", subscriptionId: "sub", sessionId: "cs", planId: "pro" };
  const intent = { organizationId: org, runtimeId: "runtime", accountId: "acct", livemode: false, state: "bound", terms: { catalogVersion: "axiom_public_test_v1", planId: "pro" }, customerId: "cus", subscriptionId: "sub", sessionId: "cs" };
  const tx = {
    $queryRawUnsafe: vi.fn(async (sql: string) => sql.includes('"IsolatedTestRuntime"') ? [{ id: "runtime" }] : sql.includes('"RecurringSubscriptionIntent"') ? [{ body: intent }] : [{ body: contract, status: "active", seatQuantity: 3, eventToken: "evt", customer: "cus", subscription: "sub" }]),
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: "growth", status: "active" })) },
    orgMembership: { findUnique: vi.fn(async () => ({ acceptedAt: new Date(), role: "owner" })) },
    addOnPurchase: { findMany: vi.fn(async () => []) }, usageEvent: { aggregate: vi.fn(async () => ({ _sum: { billedCents: 100 } })) },
    aIUsageReservation: { aggregate: vi.fn(async () => ({ _sum: { reservedCents: 250 } })), findUnique: vi.fn(async () => ({ reservedCents: 100, status: "reserved" })), updateMany: vi.fn(), create: vi.fn() },
  };
  return { tx, repo: { $transaction: (fn: (tx: any) => unknown) => fn(tx) } };
}
afterEach(() => vi.unstubAllEnvs());
describe("existing allowance and reservation select verified isolated contract", () => {
  it("reads $30 three-seat public test allocation instead of legacy Growth $200", async () => {
    enable(); const f = fixture();
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.repo as any, org))).toMatchObject({ available: true, baseCents: 3000, heldCents: 250, includedRemainingCents: 2650, overagePolicy: "hard_stop" });
  });
  it("rejects missing provenance and does not silently fall back to legacy", async () => {
    enable(); const f = fixture(); f.tx.$queryRawUnsafe.mockRejectedValue(new Error("missing provenance table"));
    expect(await withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(f.repo as any, org))).toEqual({ available: false });
  });
  it("cannot use the isolated shared reader outside a supported server-created scope", async () => {
    enable(); const f = fixture(); expect(await readCurrentAIAllowance(f.repo as any, org)).toEqual({ available: false });
  });
  it("rechecks isolated provenance before returning an existing reservation", async () => {
    enable(); const f = fixture(); f.tx.$queryRawUnsafe.mockRejectedValue(new Error("unavailable"));
    expect(await withIsolatedWorkspaceScope(context, "admission", () => reserveAICredits(f.repo, { organizationId: org, idempotencyKey: "existing_intent_12345", reservedCents: 100 }))).toMatchObject({ ok: false, error: "ai_credit_reservation_unavailable" });
  });
  it("does not query new tables or change legacy current allowance", async () => {
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "false"); const f = fixture();
    expect(await readCurrentAIAllowance(f.repo as any, org)).toMatchObject({ available: true, baseCents: 20000 }); expect(f.tx.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

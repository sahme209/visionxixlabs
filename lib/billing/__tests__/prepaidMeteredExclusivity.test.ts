import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoiceItem: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("stripe", () => ({ default: class { invoiceItems = { create: mocks.invoiceItem }; } }));

import { describeAIUsageSettlementGate, settleAIUsageToStripe } from "../settleAIUsageToStripe";
import { METERED_WITH_PREPAID_REASON, meteredSettlementExclusivityFailure, prepaidAICreditsEnabled } from "../prepaidMeteredExclusivity";

function repository() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "usage-1", organizationId: "org-1", billedCents: 3 }]),
    tenantBillingPlan: { findUnique: vi.fn() },
    aIUsageBillingConfig: { findUnique: vi.fn() },
    aIUsageBillingPeriod: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    aIUsageBillingSettlement: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe("metered settlement can never be enabled together with prepaid AI credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every metered opt-in is on, in Stripe test mode.
    vi.stubEnv("AXIOM_AI_USAGE_BILLING_TEST_ENABLED", "true");
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reports prepaid off when neither existing prepaid gate is on", () => {
    expect(prepaidAICreditsEnabled()).toBe(false);
    expect(meteredSettlementExclusivityFailure()).toBeNull();
    expect(describeAIUsageSettlementGate()).toEqual({ enabled: true });
  });

  it.each([
    ["AXIOM_SELF_SERVICE_BILLING_ENABLED", "true"],
    ["AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"],
  ])("fails closed when %s opens prepaid", async (name, value) => {
    vi.stubEnv(name, value);
    expect(prepaidAICreditsEnabled()).toBe(true);
    expect(describeAIUsageSettlementGate()).toEqual({ enabled: false, reason: METERED_WITH_PREPAID_REASON });
    const repo = repository();
    expect(await settleAIUsageToStripe(repo as never)).toEqual({ inspected: 0, reserved: 0, submitted: 0, blocked: 0, deferred: 0 });
    expect(repo.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
  });
});

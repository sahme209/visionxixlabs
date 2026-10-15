import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoiceItem: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("stripe", () => ({ default: class {
  invoiceItems = { create: mocks.invoiceItem };
} }));

import { settleAIUsageToStripe } from "../settleAIUsageToStripe";

const now = new Date("2026-10-15T12:00:00Z");
const record = {
  id: "settlement-1", organizationId: "org-1", usageEventId: "usage-1",
  periodMonth: "2026-10", amountCents: 3, idempotencyKey: "axiom-ai-usage-usage-1",
  status: "reserved", createdAt: new Date(now.getTime() - 60_000),
};

function repository(existing = record) {
  const repo = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "usage-1", organizationId: "org-1", billedCents: 3 }]),
    tenantBillingPlan: { findUnique: vi.fn().mockResolvedValue({ stripeCustomerId: "cus_test" }) },
    aIUsageBillingConfig: { findUnique: vi.fn().mockResolvedValue({ enabled: true, monthlySpendLimitCents: 100, currency: "USD" }) },
    aIUsageBillingPeriod: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    aIUsageBillingSettlement: {
      findUnique: vi.fn().mockResolvedValue(existing), create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(),
  };
  repo.$transaction.mockImplementation(async (operation) => operation(repo));
  return repo;
}

describe("AI usage Stripe settlement retry safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("AXIOM_AI_USAGE_BILLING_TEST_ENABLED", "true");
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    mocks.invoiceItem.mockResolvedValue({ id: "ii_test" });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("holds an unresolved submission after the conservative retry window", async () => {
    const repo = repository({ ...record, createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) });
    const result = await settleAIUsageToStripe(repo);
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingSettlement.updateMany).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingPeriod.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ inspected: 1, reserved: 0, submitted: 0, blocked: 1, deferred: 0 });
  });

  it.each([
    { mismatch: "organization", existing: { ...record, organizationId: "org-other" } },
    { mismatch: "usage event", existing: { ...record, usageEventId: "usage-other" } },
    { mismatch: "larger amount", existing: { ...record, amountCents: 30 } },
    { mismatch: "smaller amount", existing: { ...record, amountCents: 1 } },
  ])("holds a reservation with a mismatched $mismatch without submitting or releasing it", async ({ existing }) => {
    const repo = repository(existing);
    expect(await settleAIUsageToStripe(repo)).toEqual({ inspected: 1, reserved: 0, submitted: 0, blocked: 1, deferred: 0 });
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingSettlement.updateMany).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingSettlement.create).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingPeriod.updateMany).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingPeriod.create).not.toHaveBeenCalled();
  });

  it("retries a recent reservation with its original amount and idempotency key", async () => {
    const repo = repository();
    expect(await settleAIUsageToStripe(repo)).toEqual({ inspected: 1, reserved: 1, submitted: 1, blocked: 0, deferred: 0 });
    expect(mocks.invoiceItem).toHaveBeenCalledWith(expect.objectContaining({ amount: 3, customer: "cus_test" }), { idempotencyKey: record.idempotencyKey });
    expect(repo.aIUsageBillingPeriod.updateMany).not.toHaveBeenCalled();
  });

  it("never resubmits a durably submitted record", async () => {
    const repo = repository({ ...record, status: "submitted" });
    await settleAIUsageToStripe(repo);
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingSettlement.updateMany).not.toHaveBeenCalled();
  });

  it("preserves a recent reservation when the provider outcome is unknown", async () => {
    mocks.invoiceItem.mockRejectedValueOnce(new Error("timeout after acceptance"));
    const repo = repository();
    expect(await settleAIUsageToStripe(repo)).toEqual({ inspected: 1, reserved: 1, submitted: 0, blocked: 0, deferred: 1 });
    expect(repo.aIUsageBillingSettlement.updateMany).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingPeriod.updateMany).not.toHaveBeenCalled();
  });

  it("holds a failed ledger state instead of treating it as an unsubmitted reservation", async () => {
    const repo = repository({ ...record, status: "failed" });
    expect(await settleAIUsageToStripe(repo)).toEqual({ inspected: 1, reserved: 0, submitted: 0, blocked: 1, deferred: 0 });
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
    expect(repo.aIUsageBillingSettlement.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "live", key: "sk_live_fixture", enabled: "true" },
    { mode: "test", key: "sk_live_fixture", enabled: "true" },
    { mode: "test", key: "sk_test_fixture", enabled: "false" },
  ])("rejects disabled or live billing before any repository access: $mode / $enabled", async ({ mode, key, enabled }) => {
    vi.stubEnv("AXIOM_STRIPE_MODE", mode);
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    vi.stubEnv("AXIOM_AI_USAGE_BILLING_TEST_ENABLED", enabled);
    const repo = repository();
    await settleAIUsageToStripe(repo);
    expect(repo.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.invoiceItem).not.toHaveBeenCalled();
  });
});

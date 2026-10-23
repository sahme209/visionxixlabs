import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => {
  let enter!: () => void; let release!: () => void;
  return { entered: new Promise<void>(r => { enter = r; }), enter: () => enter(),
    waiting: new Promise<void>(r => { release = r; }), release: () => release(),
    constructed: vi.fn(), submit: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("stripe", async () => {
  sdk.enter(); await sdk.waiting;
  return { default: class { constructor() { sdk.constructed(); } invoiceItems = { create: sdk.submit }; } };
});
import { settleAIUsageToStripe } from "../settleAIUsageToStripe";
afterEach(() => { sdk.release(); vi.unstubAllEnvs(); });
it("refuses credential rotation while the SDK loads without constructing a provider client", async () => {
  vi.stubEnv("AXIOM_AI_USAGE_BILLING_TEST_ENABLED", "true");
  vi.stubEnv("AXIOM_STRIPE_MODE", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_initial_fixture");
  const record = { id: "settlement", organizationId: "org", usageEventId: "usage", periodMonth: new Date().toISOString().slice(0, 7),
    amountCents: 1, idempotencyKey: "axiom-ai-usage-usage", status: "reserved", attemptCount: 0, createdAt: new Date(Date.now() - 60_000) };
  const repo = { $queryRaw: vi.fn().mockResolvedValue([{ id: "usage", organizationId: "org", billedCents: 1 }]),
    tenantBillingPlan: { findUnique: vi.fn().mockResolvedValue({ stripeCustomerId: "cus_fixture" }) },
    aIUsageBillingConfig: { findUnique: vi.fn().mockResolvedValue({ enabled: true, monthlySpendLimitCents: 100, currency: "usd" }) },
    aIUsageBillingPeriod: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    aIUsageBillingSettlement: { findUnique: vi.fn().mockResolvedValue(record), create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn(),
  };
  repo.$transaction.mockImplementation(async operation => operation(repo));
  const pending = settleAIUsageToStripe(repo);
  await sdk.entered;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_rotated_fixture");
  sdk.release();
  expect(await pending).toMatchObject({ reserved: 1, submitted: 0, deferred: 1 });
  expect(sdk.constructed).not.toHaveBeenCalled(); expect(sdk.submit).not.toHaveBeenCalled();
  expect(repo.aIUsageBillingSettlement.updateMany).toHaveBeenCalledTimes(1);
});

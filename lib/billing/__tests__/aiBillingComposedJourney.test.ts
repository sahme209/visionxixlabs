import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("ai", () => ({ gateway: {} }));
const { invoiceItem } = vi.hoisted(() => ({ invoiceItem: vi.fn() }));
vi.mock("stripe", () => ({ default: class { invoiceItems = { create: invoiceItem }; } }));

import { reconcilePendingGatewayUsage } from "../reconcileGatewayUsage";
import { settleAIUsageToStripe } from "../settleAIUsageToStripe";

// Compose the real reconciliation and settlement IO boundaries over one
// in-memory ledger. Provider SDK responses and persistence are simulated;
// this is deliberately not Stripe/Gateway/SQL acceptance evidence.
function ledger(cap = 100, reservedCredits = 100) {
  const usage = { id: "usage_customer", organizationId: "org_customer", externalUsageId: "gen_customer", billingStatus: "pending", billedCents: 0, costCents: 0 };
  let settlement: null | { id: string; organizationId: string; usageEventId: string; amountCents: number; idempotencyKey: string; status: string; attemptCount: number; createdAt: Date; periodMonth: string } = null;
  let period: null | { reservedCents: number } = null;
  const repository = {
    usageEvent: {
      findMany: vi.fn(async () => usage.billingStatus === "pending" ? [usage] : []),
      updateMany: vi.fn(async ({ data }: { data: Partial<typeof usage> }) => { Object.assign(usage, data); return { count: 1 }; }),
    },
    aIUsageReservation: {
      findUnique: vi.fn(async () => ({ id: "hold_customer", organizationId: usage.organizationId, reservedCents: reservedCredits })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    async $queryRaw<T>(): Promise<T> { return (usage.billingStatus === "settled" ? [usage] : []) as T; },
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ stripeCustomerId: "cus_simulated" })) },
    aIUsageBillingConfig: { findUnique: vi.fn(async () => ({ enabled: true, monthlySpendLimitCents: cap, currency: "USD" })) },
    aIUsageBillingPeriod: {
      findUnique: vi.fn(async () => period),
      create: vi.fn(async ({ data }: { data: { reservedCents: number } }) => { period = { reservedCents: data.reservedCents }; }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    aIUsageBillingSettlement: {
      findUnique: vi.fn(async () => settlement),
      create: vi.fn(async ({ data }: { data: Omit<NonNullable<typeof settlement>, "id" | "attemptCount" | "createdAt"> }) => {
        settlement = { ...data, id: "settlement_customer", attemptCount: 0, createdAt: new Date() }; return settlement;
      }),
      updateMany: vi.fn(async ({ data }: { data: { attemptCount?: { increment: number }; status?: string } }) => {
        if (!settlement) return { count: 0 };
        if (data.attemptCount) settlement.attemptCount += data.attemptCount.increment;
        if (data.status) settlement.status = data.status;
        return { count: 1 };
      }),
    },
  };
  type TransactionalRepository = typeof repository & {
    $transaction<T>(operation: (tx: TransactionalRepository) => Promise<T>): Promise<T>;
  };
  const transactionalRepository: TransactionalRepository = {
    ...repository,
    async $transaction<T>(operation: (tx: TransactionalRepository) => Promise<T>): Promise<T> { return operation(transactionalRepository); },
  };
  return { usage, repository: transactionalRepository, period: () => period, settlement: () => settlement };
}

const receipt = { id: "gen_customer", totalCost: 0.02, model: "provider/model", providerName: "provider", promptTokens: 100, completionTokens: 10, cachedTokens: 0 };

function enableSimulation() {
  vi.stubEnv("AXIOM_AI_USAGE_BILLING_TEST_ENABLED", "true");
  vi.stubEnv("AXIOM_STRIPE_MODE", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_simulated_not_a_credential");
  invoiceItem.mockReset().mockResolvedValue({ id: "ii_simulated" });
}

afterEach(() => vi.unstubAllEnvs());

describe("composed customer AI cost → test invoice-item journey", () => {
  it("carries authoritative cost and 1.5x price through both ledgers exactly once on replay", async () => {
    enableSimulation();
    const state = ledger();
    const lookup = vi.fn().mockResolvedValue(receipt);
    expect(await reconcilePendingGatewayUsage(state.repository, lookup)).toMatchObject({ settled: 1 });
    expect(state.usage).toMatchObject({ costCents: 2, billedCents: 3, billingStatus: "settled" });
    expect(await settleAIUsageToStripe(state.repository)).toMatchObject({ submitted: 1 });
    expect(invoiceItem).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_simulated", amount: 3, currency: "usd", metadata: expect.objectContaining({ organizationId: "org_customer", usageEventId: "usage_customer" }) }), { idempotencyKey: "axiom-ai-usage-usage_customer" });
    expect(state.period()).toEqual({ reservedCents: 3 });
    expect(await reconcilePendingGatewayUsage(state.repository, lookup)).toMatchObject({ inspected: 0 });
    expect(await settleAIUsageToStripe(state.repository)).toMatchObject({ submitted: 0 });
    expect(invoiceItem).toHaveBeenCalledTimes(1);
    expect(state.repository.aIUsageBillingPeriod.create).toHaveBeenCalledTimes(1);
  });

  it("never carries a provider receipt mismatch into the invoice ledger", async () => {
    enableSimulation();
    const state = ledger();
    expect(await reconcilePendingGatewayUsage(state.repository, vi.fn().mockResolvedValue({ ...receipt, id: "gen_other" }))).toMatchObject({ failed: 1 });
    expect(await settleAIUsageToStripe(state.repository)).toMatchObject({ inspected: 0 });
    expect(invoiceItem).not.toHaveBeenCalled();
    expect(state.settlement()).toBeNull();
  });

  it("preserves the approved generation ceiling then blocks an insufficient monthly invoice cap", async () => {
    enableSimulation();
    const state = ledger(1, 2);
    await reconcilePendingGatewayUsage(state.repository, vi.fn().mockResolvedValue(receipt));
    expect(state.usage).toMatchObject({ costCents: 2, billedCents: 2 });
    expect(await settleAIUsageToStripe(state.repository)).toMatchObject({ blocked: 1, submitted: 0 });
    expect(state.period()).toBeNull();
    expect(state.settlement()).toBeNull();
    expect(invoiceItem).not.toHaveBeenCalled();
  });
});

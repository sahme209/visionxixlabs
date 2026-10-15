import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  findPurchase: vi.fn(),
  updatePurchase: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      stripeBillingEvent: { create: mocks.eventCreate },
      addOnPurchase: { findUnique: mocks.findPurchase, update: mocks.updatePurchase, updateMany: mocks.updateMany },
    }),
  },
}));

import { fulfillAICreditCheckout, reverseAICreditRefund } from "../aiCreditFulfillment";

const purchase = {
  id: "purchase-1",
  organizationId: "org-1",
  sku: "ai_credits_small",
  pricePaidCents: 1000,
  deliveredAICreditsCents: 500,
  stripeCheckoutSessionId: "cs_test_1",
  status: "pending",
  appliedAt: null,
};

describe("AI credit Stripe fulfillment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.eventCreate.mockResolvedValue({});
    mocks.findPurchase.mockResolvedValue(purchase);
    mocks.updatePurchase.mockResolvedValue({ ...purchase, status: "paid" });
  });

  it("applies only an exact, paid, USD, catalog-priced session", async () => {
    await fulfillAICreditCheckout(
      { id: "evt_1", type: "checkout.session.completed" },
      { id: "cs_test_1", payment_status: "paid", payment_intent: "pi_test_1", amount_total: 1000, currency: "usd", metadata: { purpose: "axiom_ai_credit_add_on", addOnPurchaseId: "purchase-1", organizationId: "org-1", sku: "ai_credits_small" } },
    );
    expect(mocks.eventCreate).toHaveBeenCalledWith({ data: { id: "evt_1", type: "checkout.session.completed" } });
    expect(mocks.updatePurchase).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "paid", stripePaymentIntentId: "pi_test_1" }) }));
  });

  it("rejects amount tampering before writing the event ledger", async () => {
    await expect(fulfillAICreditCheckout(
      { id: "evt_1", type: "checkout.session.completed" },
      { id: "cs_test_1", payment_status: "paid", payment_intent: "pi_test_1", amount_total: 1, currency: "usd", metadata: { purpose: "axiom_ai_credit_add_on", addOnPurchaseId: "purchase-1", organizationId: "org-1", sku: "ai_credits_small" } },
    )).rejects.toThrow("ai_credit_checkout_invalid");
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("reverses credits proportionally from Stripe's cumulative refund amount", async () => {
    mocks.findPurchase.mockResolvedValue({ ...purchase, status: "paid", stripePaymentIntentId: "pi_test_1" });
    await reverseAICreditRefund(
      { id: "evt_refund", type: "charge.refunded" },
      { payment_intent: "pi_test_1", amount_refunded: 250, currency: "usd" },
    );
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ refundedAmountCents: 250, reversedAICreditsCents: 125, status: "partially_refunded" }),
    }));
  });

  it("never regrants credits when cumulative refund events arrive out of order", async () => {
    const stored = { ...purchase, status: "paid", stripePaymentIntentId: "pi_test_1", refundedAmountCents: 0, reversedAICreditsCents: 0 };
    mocks.findPurchase.mockImplementation(async () => ({ ...stored }));
    mocks.updatePurchase.mockImplementation(async ({ data }) => Object.assign(stored, data));
    mocks.updateMany.mockImplementation(async ({ where, data }) => {
      if (stored.refundedAmountCents > where.refundedAmountCents.lte || stored.reversedAICreditsCents > where.reversedAICreditsCents.lte) return { count: 0 };
      Object.assign(stored, data);
      return { count: 1 };
    });
    for (const [id, amount] of [["full", 1000], ["older_partial", 250], ["older_zero", 0]] as const) {
      await reverseAICreditRefund({ id: `evt_${id}`, type: "charge.refunded" }, { payment_intent: "pi_test_1", amount_refunded: amount, currency: "usd" });
    }
    expect(stored).toMatchObject({ status: "refunded", refundedAmountCents: 1000, reversedAICreditsCents: 500 });
    expect(mocks.eventCreate).toHaveBeenCalledTimes(3);
    expect(mocks.updatePurchase).not.toHaveBeenCalled();
  });

  it("rejects a smaller concurrent refund even when both handlers read the same older snapshot", async () => {
    const stored = { ...purchase, status: "paid", refundedAmountCents: 0, reversedAICreditsCents: 0 };
    let releasePartial!: () => void;
    const partialWait = new Promise<void>((resolve) => { releasePartial = resolve; });
    // Both reads return the pre-refund snapshot; the conditional write must
    // still compare current persisted counters after the larger write wins.
    mocks.findPurchase.mockResolvedValue({ ...stored });
    mocks.updatePurchase.mockImplementation(async ({ data }) => {
      if (data.refundedAmountCents === 250) await partialWait;
      Object.assign(stored, data);
      if (data.refundedAmountCents === 1000) releasePartial();
      return stored;
    });
    mocks.updateMany.mockImplementation(async ({ where, data }) => {
      if (data.refundedAmountCents === 250) await partialWait;
      const matches = stored.refundedAmountCents <= where.refundedAmountCents.lte && stored.reversedAICreditsCents <= where.reversedAICreditsCents.lte;
      if (matches) Object.assign(stored, data);
      if (data.refundedAmountCents === 1000) releasePartial();
      return { count: matches ? 1 : 0 };
    });
    await Promise.all([250, 1000].map((amount) => reverseAICreditRefund(
      { id: `evt_concurrent_${amount}`, type: "charge.refunded" },
      { payment_intent: "pi_test_1", amount_refunded: amount, currency: "usd" },
    )));
    expect(stored).toMatchObject({ status: "refunded", refundedAmountCents: 1000, reversedAICreditsCents: 500 });
    expect(mocks.updatePurchase).not.toHaveBeenCalled();
  });

  it("fully revokes credits on a full refund", async () => {
    mocks.findPurchase.mockResolvedValue({ ...purchase, status: "paid", stripePaymentIntentId: "pi_test_1" });
    await reverseAICreditRefund(
      { id: "evt_refund", type: "charge.refunded" },
      { payment_intent: "pi_test_1", amount_refunded: 1000, currency: "usd" },
    );
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ refundedAmountCents: 1000, reversedAICreditsCents: 500, status: "refunded", refundedAt: expect.any(Date) }),
    }));
  });
});

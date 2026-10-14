import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isStripeWebhookConfigured: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  findFirst: vi.fn(),
  upsertBillingPlan: vi.fn(),
  fulfillCredit: vi.fn(),
  failCredit: vi.fn(),
  refundCredit: vi.fn(),
}));

vi.mock("@/lib/billing/stripeHelper", () => ({
  isStripeWebhookConfigured: mocks.isStripeWebhookConfigured,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));
vi.mock("@/lib/db", () => ({
  prisma: { tenantBillingPlan: { findFirst: mocks.findFirst } },
}));
vi.mock("@/lib/billing/tenantBillingStore", () => ({
  upsertBillingPlan: mocks.upsertBillingPlan,
}));
vi.mock("@/lib/billing/aiCreditFulfillment", () => ({
  fulfillAICreditCheckout: mocks.fulfillCredit,
  recordAICreditCheckoutFailure: mocks.failCredit,
  reverseAICreditRefund: mocks.refundCredit,
}));

const originalBillingFlag = process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;

function request(event: object, signature = "signed") {
  return new NextRequest("https://visionxixlabs.com/api/billing/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: JSON.stringify(event),
  });
}

function subscriptionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        current_period_end: 1_800_000_000,
        cancel_at_period_end: false,
        items: { data: [{ quantity: 3 }] },
        metadata: { organizationId: "org-1", planId: "pro" },
      },
    },
    ...overrides,
  };
}

describe("POST /api/billing/stripe-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = "true";
    mocks.isStripeWebhookConfigured.mockReturnValue(true);
    mocks.verifyWebhookSignature.mockReturnValue({ ok: true });
    mocks.findFirst.mockResolvedValue(null);
    mocks.upsertBillingPlan.mockResolvedValue({ organizationId: "org-1" });
    mocks.fulfillCredit.mockResolvedValue({});
    mocks.failCredit.mockResolvedValue({});
    mocks.refundCredit.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalBillingFlag === undefined) delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    else process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = originalBillingFlag;
  });

  it("stays unavailable until billing is explicitly enabled", async () => {
    delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(503);
    expect(mocks.verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("rejects an invalid Stripe signature", async () => {
    mocks.verifyWebhookSignature.mockReturnValue({ ok: false, reason: "Invalid signature." });
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(401);
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("does not grant entitlements from checkout completion", async () => {
    const event = subscriptionEvent({ type: "checkout.session.completed" });
    const { POST } = await import("../route");
    const response = await POST(request(event));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ignored: "awaiting_subscription_event" });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("fulfills a signed paid AI-credit checkout", async () => {
    const event = {
      id: "evt_credit_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", payment_status: "paid", amount_total: 1000, currency: "usd", payment_intent: "pi_test_1", metadata: { purpose: "axiom_ai_credit_add_on", organizationId: "org-1", addOnPurchaseId: "purchase-1", sku: "ai_credits_small" } } },
    };
    const { POST } = await import("../route");
    expect((await POST(request(event))).status).toBe(200);
    expect(mocks.fulfillCredit).toHaveBeenCalledWith({ id: "evt_credit_1", type: "checkout.session.completed" }, event.data.object);
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("routes cumulative refunds through the credit reversal ledger", async () => {
    const event = { id: "evt_refund_1", type: "charge.refunded", data: { object: { payment_intent: "pi_test_1", amount_refunded: 500, currency: "usd" } } };
    const { POST } = await import("../route");
    expect((await POST(request(event))).status).toBe(200);
    expect(mocks.refundCredit).toHaveBeenCalledWith({ id: "evt_refund_1", type: "charge.refunded" }, event.data.object);
  });

  it("fails closed when a subscription event lacks authoritative identifiers", async () => {
    const event = subscriptionEvent({ id: undefined });
    const { POST } = await import("../route");
    const response = await POST(request(event));
    expect(response.status).toBe(400);
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("accepts an already applied event without mutating the plan", async () => {
    mocks.findFirst.mockResolvedValueOnce({ organizationId: "org-1" });
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ replay: true });
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("rejects customer or subscription ownership conflicts", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ organizationId: "org-other" });
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(409);
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("does not mutate entitlements when verification storage is unavailable", async () => {
    mocks.findFirst.mockRejectedValue(new Error("database unavailable"));
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(503);
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("maps the public Pro plan to the existing growth entitlement", async () => {
    const { POST } = await import("../route");
    const response = await POST(request(subscriptionEvent()));
    expect(response.status).toBe(200);
    expect(mocks.upsertBillingPlan).toHaveBeenCalledWith({
      organizationId: "org-1",
      tier: "growth",
      status: "active",
      trialEndsAt: null,
      currentPeriodEndsAt: new Date(1_800_000_000 * 1000),
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      cancelAtPeriodEnd: false,
      lastStripeEventId: "evt_1",
      seatQuantity: 3,
    });
  });

  it("fails closed when an active subscription has no valid seat quantity", async () => {
    const event = subscriptionEvent();
    event.data.object.items = { data: [] };
    const { POST } = await import("../route");
    const response = await POST(request(event));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "stripe.seat_quantity_invalid" } });
    expect(mocks.upsertBillingPlan).not.toHaveBeenCalled();
  });
});

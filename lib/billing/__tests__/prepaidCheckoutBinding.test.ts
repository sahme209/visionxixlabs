import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAddOnCheckoutSession, recoverAddOnCheckoutSession } from "../stripeHelper";

const { create, retrieve } = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create, retrieve } };
  },
}));

const purchase = {
  purchaseId: "purchase_123",
  organizationId: "org_123",
  sku: "credit_pack",
  priceCents: 2000,
  displayName: "AI credits",
  email: "owner@example.com",
  successUrl: "https://example.com/account",
  cancelUrl: "https://example.com/plans",
  idempotencyKey: "purchase_123",
};
const sessionId = "cs_test_valid";
const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_valid";
const metadata = {
  purpose: "axiom_ai_credit_add_on",
  addOnPurchaseId: purchase.purchaseId,
  organizationId: purchase.organizationId,
  sku: purchase.sku,
};

function openSession() {
  return {
    id: sessionId,
    url: checkoutUrl,
    livemode: false,
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    currency: "usd",
    amount_total: purchase.priceCents,
    client_reference_id: purchase.organizationId,
    metadata,
  };
}

describe("prepaid checkout binding", () => {
  beforeEach(() => {
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    vi.resetAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the exact bound hosted session on creation and recovery", async () => {
    create.mockResolvedValue(openSession());
    retrieve.mockResolvedValue(openSession());
    await expect(createAddOnCheckoutSession(purchase)).resolves.toEqual({ ok: true, url: checkoutUrl, sessionId });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      client_reference_id: purchase.organizationId,
      metadata,
    }), { idempotencyKey: purchase.idempotencyKey });
    await expect(recoverAddOnCheckoutSession({ ...purchase, sessionId })).resolves.toBe(checkoutUrl);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith(sessionId);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["malformed session ID", { id: ["cs_test_valid"] }],
    ["live session", { livemode: true }],
    ["recurring session", { mode: "subscription" }],
    ["completed session", { status: "complete" }],
    ["paid session", { payment_status: "paid" }],
    ["expired session", { expires_at: 1 }],
    ["different currency", { currency: "eur" }],
    ["different price", { amount_total: purchase.priceCents - 1 }],
    ["different customer reference", { client_reference_id: "org_other" }],
    ["different organization metadata", { metadata: { ...metadata, organizationId: "org_other" } }],
    ["different purchase", { metadata: { ...metadata, addOnPurchaseId: "purchase_other" } }],
    ["different credit pack", { metadata: { ...metadata, sku: "other_pack" } }],
    ["different purpose", { metadata: { ...metadata, purpose: "other_purchase" } }],
    ["untrusted URL", { url: "https://checkout.stripe.com.example.com/pay" }],
  ])("withholds a checkout link for %s", async (_label, overrides) => {
    const response = { ...openSession(), ...overrides };
    create.mockResolvedValue(response);
    retrieve.mockResolvedValue(response);
    await expect(createAddOnCheckoutSession(purchase)).resolves.toMatchObject({ ok: false, outcome: "unknown" });
    await expect(recoverAddOnCheckoutSession({ ...purchase, sessionId })).resolves.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("withholds recovery if Stripe returns a different test session ID", async () => {
    retrieve.mockResolvedValue({ ...openSession(), id: "cs_test_other" });
    await expect(recoverAddOnCheckoutSession({ ...purchase, sessionId })).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

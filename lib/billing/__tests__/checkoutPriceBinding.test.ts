import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("stripe", () => ({ default: class Stripe { prices = { retrieve: mocks.retrieve }; checkout = { sessions: { create: mocks.create } }; } }));
import { createCheckoutSession } from "../stripeHelper";
const input = { organizationId: "org_test", email: "owner@example.invalid", planId: "pro" as const, billingInterval: "monthly" as const, seatCount: 2, successUrl: "https://example.invalid/success", cancelUrl: "https://example.invalid/cancel" };
const price = { id: "price_test", livemode: false, active: true, type: "recurring", currency: "usd", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: { id: "prod_test", active: true, livemode: false } };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AXIOM_STRIPE_MODE", "test"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic"); vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_test"); mocks.retrieve.mockResolvedValue(price); mocks.create.mockResolvedValue({ url: "https://checkout.stripe.com/synthetic" }); });
afterEach(() => vi.unstubAllEnvs());
describe("Checkout price binding before provider session creation", () => {
  it("creates only the verified published price and workspace seat quantity", async () => {
    expect((await createCheckoutSession(input)).ok).toBe(true);
    expect(mocks.retrieve).toHaveBeenCalledWith("price_test", { expand: ["product"] });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription", line_items: [{ price: "price_test", quantity: 2 }], metadata: expect.objectContaining({ organizationId: "org_test", planId: "pro", billingInterval: "monthly", seatCount: "2" }) }));
  });
  it.each([{ unit_amount: 499 }, { livemode: true }, { active: false }, { product: { id: "prod_test", active: false, livemode: false } }])("does not dispatch checkout for incompatible price %j", async patch => {
    mocks.retrieve.mockResolvedValue({ ...price, ...patch });
    expect((await createCheckoutSession(input)).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not dispatch checkout when price retrieval fails", async () => {
    mocks.retrieve.mockRejectedValue(new Error("synthetic transport failure"));
    expect((await createCheckoutSession(input)).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

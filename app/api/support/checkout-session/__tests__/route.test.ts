import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isSameOriginRequest: vi.fn(),
  checkRateLimit: vi.fn(),
  readiness: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
}));

vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/supporters/core", async (original) => ({
  ...(await original<typeof import("@/lib/supporters/core")>()),
  supporterCheckoutReadiness: mocks.readiness,
}));
vi.mock("@/lib/db", () => ({ prisma: { foundingSupporterPurchase: { upsert: mocks.upsert, update: mocks.update } } }));
vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: mocks.createSession, retrieve: mocks.retrieveSession } };
  },
}));

import { POST } from "../route";

function request(amountCents = 100, key = "supporter-checkout-0001") {
  return new NextRequest("https://visionxixlabs.com/api/support/checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://visionxixlabs.com", "idempotency-key": key },
    body: JSON.stringify({ amountCents, email: "supporter@example.com", recognitionConsent: false, updatesOptIn: true, acceptedTerms: true }),
  });
}

describe("POST /api/support/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.readiness.mockReturnValue({ ready: true, reason: null });
    mocks.upsert.mockResolvedValue({ id: "support_1", correlationId: "supporter-checkout-0001", email: "supporter@example.com", amountCents: 100, stripeCheckoutSessionId: null });
    mocks.createSession.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    mocks.update.mockResolvedValue({});
  });

  it("creates an isolated $1 hosted Checkout session", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: expect.objectContaining({ currency: "usd", unit_amount: 100 }) }],
      metadata: { supporterPurchaseId: "support_1", purpose: "axiom_founding_supporter" },
    }), { idempotencyKey: "supporter_supporter-checkout-0001" });
  });

  it("returns the existing open session for a duplicate checkout key", async () => {
    mocks.upsert.mockResolvedValue({ id: "support_1", correlationId: "supporter-checkout-0001", email: "supporter@example.com", amountCents: 100, stripeCheckoutSessionId: "cs_test_existing" });
    mocks.retrieveSession.mockResolvedValue({ id: "cs_test_existing", status: "open", url: "https://checkout.stripe.com/c/pay/cs_test_existing" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("fails closed before database or Stripe work when staging is not ready", async () => {
    mocks.readiness.mockReturnValue({ ready: false, reason: "not configured" });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});

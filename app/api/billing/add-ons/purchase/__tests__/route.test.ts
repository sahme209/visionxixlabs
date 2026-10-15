import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  isSameOriginRequest: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/db", () => ({ prisma: { addOnPurchase: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany } } }));
vi.mock("@/lib/billing/stripeHelper", () => ({ createAddOnCheckoutSession: mocks.createCheckout }));

import { POST } from "../route";

function request(body: object = { sku: "ai_credits_small" }, key = "checkout_key_123456") {
  return new NextRequest("https://visionxixlabs.com/api/billing/add-ons/purchase", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key, origin: "https://visionxixlabs.com" },
    body: JSON.stringify(body),
  });
}

describe("AI credit checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = "true";
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", userId: "user-1", email: "owner@example.com", roles: ["owner"] });
    mocks.create.mockResolvedValue({ id: "purchase-1", organizationId: "org-1", sku: "ai_credits_small", status: "pending", pricePaidCents: 1000, deliveredAICreditsCents: 500, validFor: "current_month", createdAt: new Date() });
    mocks.update.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.createCheckout.mockResolvedValue({ ok: true, url: "https://checkout.stripe.test/session", sessionId: "cs_test_1" });
  });

  it("rejects cross-origin requests", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    expect((await POST(request() as never)).status).toBe(403);
  });

  it("rejects stale workspace context before creating an intent", async () => {
    expect((await POST(request({ sku: "ai_credits_small", organizationId: "org-other" }) as never)).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("requires an organization administrator", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    expect((await POST(request() as never)).status).toBe(403);
  });

  it("requires a replay-safe idempotency key", async () => {
    expect((await POST(request({}, "short") as never)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a server-priced pending purchase and returns the real Stripe URL", async () => {
    const response = await POST(request() as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, url: "https://checkout.stripe.test/session" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pricePaidCents: 1000, deliveredAICreditsCents: 500, status: "pending" }),
    }));
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 1000, purchaseId: "purchase-1" }));
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "purchase-1" }, data: { stripeCheckoutSessionId: "cs_test_1" } });
  });

  it("preserves pending intent when provider outcome is unknown", async () => {
    mocks.createCheckout.mockResolvedValue({ ok: false, outcome: "unknown", reason: "Stripe secret key sk_test_should_not_reach_the_browser" });
    const response = await POST(request() as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "stripe_checkout_unavailable",
      message: "Checkout outcome is uncertain. Keep this purchase reference and contact support; do not start another purchase.",
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

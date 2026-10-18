import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const ports = vi.hoisted(() => ({ checkout: 0, webhook: 0 }));
vi.mock("../ownedCheckoutBridge/http", () => ({ ownedCheckoutPost: async () => { ports.checkout++; return NextResponse.json({ owned: "checkout" }, { status: 409 }); }, ownedWebhookPost: async () => { ports.webhook++; return NextResponse.json({ owned: "webhook" }, { status: 503 }); } }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => { throw new Error("legacy_must_not_dispatch"); } }));
vi.mock("@/lib/billing/stripeHelper", () => ({ createCheckoutSession: async () => { throw new Error("legacy_must_not_dispatch"); }, verifyWebhookSignature: () => { throw new Error("legacy_must_not_dispatch"); }, isStripeWebhookConfigured: () => false }));
vi.mock("@/lib/billing/aiCreditFulfillment", () => ({}));
vi.mock("@/lib/billing/reconcileSubscriptionEvent", () => ({}));
describe("existing billing HTTP routes compose the owned lane before legacy gates", () => {
  it("returns the owned Checkout result even when public billing remains disabled", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
    try { const route = await import("../../../app/api/billing/checkout-session/route"); const result = await route.POST(new NextRequest("http://127.0.0.1:4100/api/billing/checkout-session", { method: "POST" })); expect(result.status).toBe(409); expect(await result.json()).toEqual({ owned: "checkout" }); expect(ports.checkout).toBe(1); } finally { vi.unstubAllEnvs(); }
  });
  it("returns the owned raw webhook result before ambient webhook helpers", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
    try { const route = await import("../../../app/api/billing/stripe-webhook/route"); const result = await route.POST(new NextRequest("http://127.0.0.1:4100/api/billing/stripe-webhook", { method: "POST" })); expect(await result.json()).toEqual({ owned: "webhook" }); expect(ports.webhook).toBe(1); } finally { vi.unstubAllEnvs(); }
  });
});

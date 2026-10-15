/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://example.test"}
 */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const io = vi.hoisted(() => ({ create: vi.fn(), find: vi.fn(), update: vi.fn(), updateMany: vi.fn(), transaction: vi.fn(), stripeCreate: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: io.push }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_1", userId: "owner_1", email: "owner@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => true }));
vi.mock("@/lib/db", () => ({ prisma: { addOnPurchase: { create: io.create, findUnique: io.find, update: io.update, updateMany: io.updateMany }, $transaction: io.transaction } }));
vi.mock("stripe", () => ({ default: class { checkout = { sessions: { create: io.stripeCreate } }; } }));
import { PurchaseAddOnButton } from "@/components/billing/PurchaseAddOnButton";
import { POST as purchase } from "@/app/api/billing/add-ons/purchase/route";
import { POST as webhook } from "@/app/api/billing/stripe-webhook/route";

const initial = () => ({ id: "purchase_1", organizationId: "org_1", sku: "ai_credits_small", pricePaidCents: 1000, deliveredAICreditsCents: 500, validFor: "current_month", status: "pending", stripeCheckoutSessionId: null as string | null, appliedAt: null as Date | null, createdAt: new Date() });
let row = initial();
let events = new Set<string>();

function request() {
  return new NextRequest("https://example.test/api/billing/add-ons/purchase", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", "idempotency-key": "checkout_intent_key_1" }, body: JSON.stringify({ sku: "ai_credits_small" }) });
}
function paidEvent(id = "evt_paid") {
  const body = JSON.stringify({ id, type: "checkout.session.completed", data: { object: { id: "cs_test_lost", payment_status: "paid", payment_intent: "pi_test_paid", amount_total: 1000, currency: "usd", metadata: { purpose: "axiom_ai_credit_add_on", addOnPurchaseId: row.id, organizationId: row.organizationId, sku: row.sku } } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_simulated_fixture").update(`${timestamp}.${body}`).digest("hex");
  return new NextRequest("https://example.test/api/billing/stripe-webhook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signature}` }, body });
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "true");
  vi.stubEnv("AXIOM_STRIPE_MODE", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_simulated_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_simulated_fixture");
  row = initial();
  events = new Set();
  io.create.mockResolvedValue(row);
  io.find.mockImplementation(async () => ({ ...row }));
  io.update.mockImplementation(async ({ data }) => Object.assign(row, data));
  io.updateMany.mockImplementation(async ({ data }) => { Object.assign(row, data); return { count: 1 }; });
  // Simulated atomic event ledger + purchase write, not real SQL evidence.
  io.transaction.mockImplementation(async (operation) => {
    const before = { ...row };
    const stagedEvents = new Set(events);
    try {
      const result = await operation({ stripeBillingEvent: { create: async ({ data }: { data: { id: string } }) => {
        if (stagedEvents.has(data.id)) throw Object.assign(new Error("replay"), { code: "P2002" });
        stagedEvents.add(data.id);
      } }, addOnPurchase: { findUnique: io.find, update: io.update, updateMany: io.updateMany } });
      events = stagedEvents;
      return result;
    } catch (error) { row = before; throw error; }
  });
  io.stripeCreate.mockRejectedValue(new Error("response lost after provider session creation"));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("uncertain credit Checkout → late signed fulfillment", () => {
  it("composes the actual customer button, route, helper and provider response through redirect", async () => {
    io.stripeCreate.mockResolvedValue({ id: "cs_test_confirmed", url: "https://checkout.stripe.test/confirmed" });
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      requests.push(options);
      const headers = new Headers(options.headers);
      headers.set("origin", "https://example.test");
      return purchase(new NextRequest("https://example.test/api/billing/add-ons/purchase", {
        method: options.method, body: options.body, headers,
      }));
    });
    render(createElement(PurchaseAddOnButton, { sku: "ai_credits_small", organizationId: "org_1" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await waitFor(() => expect(io.push).toHaveBeenCalledWith("https://checkout.stripe.test/confirmed"));
    const key = (requests[0].headers as Record<string, string>)["Idempotency-Key"];
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
    expect(io.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: key, pricePaidCents: 1000 }) }));
    expect(io.stripeCreate).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: `ai-credit:org_1:${key}` });
    expect(row.stripeCheckoutSessionId).toBe("cs_test_confirmed");
  });

  it("retains pending intent after a lost response, refuses recreation, then fulfills the signed paid event once", async () => {
    expect((await purchase(request())).status).toBe(503);
    expect(row.status).toBe("pending");
    expect(io.updateMany).not.toHaveBeenCalled();
    expect(io.stripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ addOnPurchaseId: "purchase_1", organizationId: "org_1" }),
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 1000 }) })],
    }), { idempotencyKey: "ai-credit:org_1:checkout_intent_key_1" });
    io.create.mockRejectedValue(Object.assign(new Error("existing intent"), { code: "P2002" }));
    const retry = await purchase(request());
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({ error: "checkout_reconciliation_required" });
    expect(io.stripeCreate).toHaveBeenCalledTimes(1);
    expect((await webhook(paidEvent())).status).toBe(200);
    expect(row).toMatchObject({ status: "paid", stripeCheckoutSessionId: "cs_test_lost", deliveredAICreditsCents: 500 });
    expect(await (await webhook(paidEvent())).json()).toMatchObject({ replay: true });
    expect(io.update).toHaveBeenCalledTimes(1);
    expect(events.size).toBe(1);
  });

  it.each([23 * 60 * 60 * 1000, 24 * 60 * 60 * 1000, -1000, NaN])("blocks provider dispatch for unsafe intent age %s", async (age) => {
    row.createdAt = new Date(Date.now() - age);
    expect((await purchase(request())).status).toBe(409);
    expect(io.stripeCreate).not.toHaveBeenCalled();
    expect(row.status).toBe("pending");
  });

  it("never substitutes changed financial terms into a persisted intent", async () => {
    row.pricePaidCents = 900;
    expect((await purchase(request())).status).toBe(409);
    expect(io.stripeCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["organizationId", "org_other"], ["sku", "ai_credits_medium"],
    ["pricePaidCents", 900], ["deliveredAICreditsCents", 999], ["validFor", "permanent"],
  ])("blocks a mismatched persisted %s before Stripe", async (field, value) => {
    Object.assign(row, { [field]: value });
    expect((await purchase(request())).status).toBe(409);
    expect(io.stripeCreate).not.toHaveBeenCalled();
  });

  it("keeps an uncertain intent pending when a signed session has the wrong amount", async () => {
    await purchase(request());
    row.pricePaidCents = 900;
    expect((await webhook(paidEvent())).status).toBe(400);
    expect(row.status).toBe("pending");
    expect(events.size).toBe(0);
    expect(io.update).not.toHaveBeenCalled();
  });

  it("marks a known pre-dispatch mode rejection failed without contacting Stripe", async () => {
    vi.stubEnv("AXIOM_STRIPE_MODE", "live");
    expect((await purchase(request())).status).toBe(503);
    expect(io.stripeCreate).not.toHaveBeenCalled();
    expect(row.status).toBe("failed");
  });
});

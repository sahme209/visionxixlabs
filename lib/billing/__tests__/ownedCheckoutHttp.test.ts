import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ user: { isAuthenticated: true, userId: "owner", organizationId: "org", email: "owned@example.invalid", roles: ["owner"] }, calls: [] as unknown[], result: { kind: "checkout_ready", url: "https://checkout.stripe.com/c/pay/cs_test" } as Record<string, unknown> }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => state.user }));
vi.mock("../ownedCheckoutBridge/client", () => ({ requestOwnedCheckout: async (command: unknown) => { state.calls.push(command); return state.result; } }));
const env = { AXIOM_OWNED_CHECKOUT_BRIDGE: "v1", AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: "runtime", AXIOM_ISOLATED_TEST_ACCOUNT_ID: "acct-test", AXIOM_ISOLATED_TEST_ORGANIZATIONS: "org", DATABASE_URL: "postgresql://postgres:opaque@127.0.0.1:5999/axiom_new_test_contract_rehearsal", NEXTAUTH_URL: "http://127.0.0.1:4100", AXIOM_OWNED_CHECKOUT_DIRECTORY: "/tmp/axiom-owned-checkout-" + "b".repeat(32), AXIOM_OWNED_CHECKOUT_SESSION: "a".repeat(32), AXIOM_OWNED_CHECKOUT_CAPABILITY: "c".repeat(64), NODE_ENV: "development" };
function checkout(body: unknown, origin = env.NEXTAUTH_URL) { return new NextRequest(env.NEXTAUTH_URL + "/api/billing/checkout-session", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
const body = { planId: "pro", billingInterval: "monthly", expectedOrganizationId: "org", clientIntentKey: "purchase_key_123456789" };
beforeEach(() => { for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v); state.calls = []; state.user.roles = ["owner"]; state.user.organizationId = "org"; }); afterEach(() => vi.unstubAllEnvs());
describe("owned existing HTTP composition (synthetic private worker port)", () => {
  it("uses actual authenticated actor and sends no caller price/seat/proof/url", async () => {
    const h = await import("../ownedCheckoutBridge/http");
    const response = await h.ownedCheckoutPost(checkout(body)); expect(response?.status).toBe(200); expect(await response?.json()).toMatchObject({ data: { ok: true, url: state.result.url } });
    expect(state.calls).toEqual([{ kind: "checkout", userId: "owner", organizationId: "org", clientIntentKey: body.clientIntentKey, planId: "pro", interval: "monthly" }]);
  });
  it("refuses foreign origin/workspace, demotion, injected financial fields and oversized bodies before private dispatch", async () => {
    const h = await import("../ownedCheckoutBridge/http");
    for (const req of [checkout(body, "https://foreign.invalid"), checkout({ ...body, expectedOrganizationId: "foreign" }), checkout({ ...body, seatQuantity: 99 }), checkout({ ...body, userId: "foreign" }), checkout({ ...body, extra: "x".repeat(17000) })]) expect((await h.ownedCheckoutPost(req))?.status).toBeGreaterThanOrEqual(400);
    state.user.roles = ["read_only"]; expect((await h.ownedCheckoutPost(checkout(body)))?.status).toBe(403); expect(state.calls).toHaveLength(0);
  });
  it("preserves raw signed Unicode webhook bytes without session-based authority", async () => {
    const h = await import("../ownedCheckoutBridge/http"); state.result = { kind: "reconciled", outcome: "replay" }; state.user.roles = []; const raw = '{"description":"é €"}';
    const req = new NextRequest(env.NEXTAUTH_URL + "/api/billing/stripe-webhook", { method: "POST", headers: { "stripe-signature": "synthetic-signed" }, body: raw });
    const response = await h.ownedWebhookPost(req); expect(response?.status).toBe(200); expect(state.calls).toEqual([{ kind: "reconcile", body: Buffer.from(raw).toString("base64"), signature: "synthetic-signed" }]);
  });
  it("keeps a fresh unavailable reconciliation retryable instead of acknowledging delivery", async () => {
    const h = await import("../ownedCheckoutBridge/http"); state.result = { kind: "reconciled", outcome: "unavailable" };
    const req = new NextRequest(env.NEXTAUTH_URL + "/api/billing/stripe-webhook", { method: "POST", headers: { "stripe-signature": "synthetic-signed" }, body: "{}" });
    expect((await h.ownedWebhookPost(req))?.status).toBe(503); expect(state.calls).toHaveLength(1);
  });
  it("reads current owned intent state for SSR without treating it as entitlement", async () => {
    const h = await import("../ownedCheckoutBridge/http"); state.result = { kind: "intent_state", state: "unknown" };
    expect(await h.ownedPlansIntentState("owner", "org")).toBe("unknown"); expect(state.calls).toEqual([{ kind: "status", userId: "owner", organizationId: "org" }]);
    state.result = { kind: "unavailable" }; expect(await h.ownedPlansIntentState("owner", "org")).toBe("unavailable");
    const count = state.calls.length; expect(await h.ownedPlansIntentState("owner", "foreign")).toBe("unavailable"); expect(state.calls).toHaveLength(count);
  });
  it("does not select the bridge outside its owned lane", async () => {
    const h = await import("../ownedCheckoutBridge/http"); vi.stubEnv("AXIOM_OWNED_CHECKOUT_BRIDGE", "false"); expect(await h.ownedCheckoutPost(checkout(body))).toBeNull(); expect(state.calls).toHaveLength(0);
  });
});

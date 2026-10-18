import { describe, expect, it, vi } from "vitest";
const env = { AXIOM_OWNED_CHECKOUT_BRIDGE: "v1", AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: "runtime", AXIOM_ISOLATED_TEST_ACCOUNT_ID: "acct-test", AXIOM_ISOLATED_TEST_ORGANIZATIONS: "org", DATABASE_URL: "postgresql://postgres:opaque@127.0.0.1:5999/axiom_new_test_contract_rehearsal", NEXTAUTH_URL: "http://127.0.0.1:4100", AXIOM_OWNED_CHECKOUT_DIRECTORY: "/tmp/axiom-owned-checkout-" + "b".repeat(32), AXIOM_OWNED_CHECKOUT_SESSION: "a".repeat(32), AXIOM_OWNED_CHECKOUT_CAPABILITY: "c".repeat(64), NODE_ENV: "development" };
describe("owned bridge server-selected scope", () => {
  it("is absent by default and only selects the exact marked owned configuration", async () => {
    const c = await import("../ownedCheckoutBridge/configuration");
    expect(c.ownedCheckoutConfiguration({})).toBeNull();
    expect(c.ownedCheckoutConfiguration({ AXIOM_OWNED_CHECKOUT_BRIDGE: "false" })).toBeNull();
    expect(c.ownedCheckoutConfiguration(env)).toMatchObject({ version: "axiom_owned_checkout_v1", organizationId: "org" });
    for (const change of [{ NODE_ENV: "production" }, { VERCEL: "1" }, { AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "false" }, { AXIOM_ISOLATED_TEST_ORGANIZATIONS: "org,foreign" }, { DATABASE_URL: "postgresql://postgres:opaque@remote/axiom_new_test_contract_rehearsal" }, { DIRECT_URL: "postgresql://other" }, { NEXTAUTH_URL: "https://public.invalid" }, { AXIOM_OWNED_CHECKOUT_DIRECTORY: "/tmp/caller" }, { AXIOM_OWNED_CHECKOUT_CAPABILITY: "short" }, { AXIOM_OWNED_CHECKOUT_BRIDGE: "v2" }]) expect(() => c.ownedCheckoutConfiguration({ ...env, ...change })).toThrow("owned_checkout_scope_required");
  });
  it("allows only three additional owned HTTP method/path pairs and never server actions", async () => {
    const c = await import("../ownedCheckoutBridge/configuration");
    for (const [path, method] of [["/plans", "GET"], ["/api/billing/checkout-session", "POST"], ["/api/billing/stripe-webhook", "POST"]]) expect(c.ownedCheckoutHttpAllowed(path, method, env)).toBe(true);
    for (const [path, method] of [["/plans", "POST"], ["/api/billing/checkout-session", "GET"], ["/api/support/stripe-webhook", "POST"], ["/api/billing/portal", "POST"], ["/api/ai/generate", "POST"]]) expect(c.ownedCheckoutHttpAllowed(path, method, env)).toBe(false);
    expect(c.ownedCheckoutHttpAllowed("/plans", "GET", {})).toBe(false);
  });
  it("selects owned HTTP while preserving unconditional isolated SDK denial", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    try {
      const r = await import("../isolatedApplication/runtime");
      expect(r.isolatedHttpAllowed("/plans", "GET")).toBe(true);
      expect(r.isolatedHttpAllowed("/api/billing/checkout-session", "POST")).toBe(true);
      expect(r.isolatedHttpAllowed("/api/support/checkout-session", "POST")).toBe(false);
      expect(() => r.denyIsolatedExternalIO()).toThrow("isolated_provider_io_disabled");
    } finally { vi.unstubAllEnvs(); }
  });

});

import { describe, expect, it } from "vitest";
const manifest = { version: "axiom_owned_checkout_v1", session: "a".repeat(32), runtimeId: "runtime", accountId: "acct-test", organizationId: "org", origin: "http://127.0.0.1:4100", directory: "/tmp/axiom-owned-checkout-" + "b".repeat(32), capability: "c".repeat(64) } as const;
describe("owned synthetic factory cannot select a real account/provider", () => {
  it("refuses foreign and genuine account identifiers before building a provider", async () => {
    const f = await import("./fixtures/ownedCheckoutSyntheticProvider");
    for (const accountId of ["acct_1SpEdeFet66ERY29", "acct-live", "foreign"]) expect(() => f.ownedSyntheticPriceMap({ ...manifest, accountId })).toThrow("owned_synthetic_scope_required");
    expect(f.ownedSyntheticPriceMap(manifest)).toEqual({ "pro:monthly": "price_owned_synthetic_pro_monthly", "pro:annual": "price_owned_synthetic_pro_annual", "enterprise:monthly": "price_owned_synthetic_enterprise_monthly", "enterprise:annual": "price_owned_synthetic_enterprise_annual" });
  });
});

import { describe, expect, it } from "vitest";
import { matchesPublicStripePrice } from "../publicStripePrice";
const input = { planId: "pro" as const, interval: "monthly" as const, expectedPriceId: "price_pro", livemode: true };
const price = () => ({ id: "price_pro", active: true, livemode: true, currency: "usd", unit_amount: 2900, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: { id: "axiom_pro_v1", active: true, livemode: true } });
describe("public Stripe price contract", () => {
  it.each([["pro", "monthly", 2900, "month"], ["pro", "annual", 27840, "year"], ["enterprise", "monthly", 7900, "month"], ["enterprise", "annual", 75840, "year"]] as const)("matches %s %s published amount", (planId, interval, unit_amount, period) => {
    expect(matchesPublicStripePrice({ ...price(), unit_amount, recurring: { interval: period, interval_count: 1, usage_type: "licensed" } }, { ...input, planId, interval }, true)).toBe(true);
  });
  it.each([{ unit_amount: 499 }, { unit_amount: 29000 }, { currency: "eur" }, { livemode: false }, { id: "other" }, { type: "one_time" }, { billing_scheme: "tiered" }, { transform_quantity: { divide_by: 2, round: "up" } }, { recurring: { interval: "month", interval_count: 2, usage_type: "licensed" } }, { recurring: { interval: "month", interval_count: 1, usage_type: "metered" } }])("rejects incompatible recurring terms %j", patch => {
    expect(matchesPublicStripePrice({ ...price(), ...patch }, input, true)).toBe(false);
  });
  it("blocks archived products or prices before creating checkout", () => {
    expect(matchesPublicStripePrice({ ...price(), active: false }, input, true)).toBe(false);
    expect(matchesPublicStripePrice({ ...price(), product: { ...price().product, active: false } }, input, true)).toBe(false);
    expect(matchesPublicStripePrice({ ...price(), product: "unexpanded" }, input, true)).toBe(false);
  });
  it("still reconciles an existing subscription after price archival", () => {
    expect(matchesPublicStripePrice({ ...price(), active: false }, input, false)).toBe(true);
  });
});

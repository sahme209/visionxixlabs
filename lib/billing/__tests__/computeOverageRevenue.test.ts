import { describe, it, expect } from "vitest";
import { computeOverageRevenue } from "../computeOverageRevenue";
import { findPlan } from "../planRegistry";

const STARTER  = findPlan("starter");
const GROWTH   = findPlan("growth");
const BUSINESS = findPlan("business");
const ENTERPRISE = findPlan("enterprise");

describe("computeOverageRevenue — under-cap", () => {
  it("zero AI cost → no overage", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 0 });
    expect(r.overageCostCents).toBe(0);
    expect(r.overageRevenueCents).toBe(0);
  });

  it("AI cost below included credits → no overage", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 15_000 }); // < $200
    expect(r.overageCostCents).toBe(0);
    expect(r.overageRevenueCents).toBe(0);
  });

  it("AI cost exactly equals included credits → no overage", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 20_000 });
    expect(r.overageCostCents).toBe(0);
  });
});

describe("computeOverageRevenue — Growth (metered_billing, 2x markup)", () => {
  it("$300 spend on $200 pool → $100 overage cost, $200 revenue (2x markup)", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 30_000 });
    expect(r.overageCostCents).toBe(10_000);
    expect(r.overageRevenueCents).toBe(20_000);
    expect(r.markupMultiplier).toBeCloseTo(2.0, 5);
  });

  it("$1000 spend on $200 pool → $800 overage cost, $1600 revenue", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 100_000 });
    expect(r.overageCostCents).toBe(80_000);
    expect(r.overageRevenueCents).toBe(160_000);
  });
});

describe("computeOverageRevenue — Business (~1.67x markup)", () => {
  it("$1000 spend on $750 pool → $250 overage cost, ~$417 revenue", () => {
    const r = computeOverageRevenue({ plan: BUSINESS, totalAICostCents: 100_000 });
    expect(r.overageCostCents).toBe(25_000);
    // Markup: (500/300 + 2500/1500) / 2 = (1.667 + 1.667) / 2 = 1.667
    expect(r.markupMultiplier).toBeCloseTo(1.667, 2);
    expect(r.overageRevenueCents).toBe(Math.floor(25_000 * (500 / 300 + 2500 / 1500) / 2));
  });
});

describe("computeOverageRevenue — hard_stop / custom_contract", () => {
  it("Starter (hard_stop): overage cost still computed, revenue is 0 (no metered billing)", () => {
    const r = computeOverageRevenue({ plan: STARTER, totalAICostCents: 10_000 });
    expect(r.overageCostCents).toBe(10_000 - STARTER.entitlements.includedAICreditsCents);
    expect(r.overageRevenueCents).toBe(0);
    expect(r.markupMultiplier).toBe(0);
  });

  it("Enterprise (custom_contract): no metered overage, revenue 0", () => {
    const r = computeOverageRevenue({ plan: ENTERPRISE, totalAICostCents: 100_000_000 });
    expect(r.overageCostCents).toBeGreaterThan(0);
    expect(r.overageRevenueCents).toBe(0);
  });
});

describe("computeOverageRevenue — defensive cases", () => {
  it("negative total AI cost (defensive) → no overage", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: -1000 });
    expect(r.overageCostCents).toBe(0);
    expect(r.overageRevenueCents).toBe(0);
  });

  it("flooring: $1.005 overage cost × 2 = $2.01 (200 cents)", () => {
    const r = computeOverageRevenue({ plan: GROWTH, totalAICostCents: 20_100 });
    expect(r.overageCostCents).toBe(100);
    expect(r.overageRevenueCents).toBe(200);
  });
});

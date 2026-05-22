import { describe, it, expect } from "vitest";
import { computePlanMargin, estimateStripeFee } from "../computePlanMargin";
import { findPlan } from "../planRegistry";

const STARTER  = findPlan("starter");
const GROWTH   = findPlan("growth");
const BUSINESS = findPlan("business");
const ENTERPRISE = findPlan("enterprise");

const baseInput = (overrides: Partial<Parameters<typeof computePlanMargin>[0]> = {}) => ({
  plan: STARTER,
  aiCostCents: 0,
  infraCostCents: 0,
  paymentProcessingCents: 0,
  supportCostCents: 0,
  overageRevenueCents: 0,
  ...overrides,
});

describe("computePlanMargin — happy paths", () => {
  it("Starter at zero usage = 100% gross margin", () => {
    const r = computePlanMargin(baseInput({ plan: STARTER }));
    expect(r.monthlyRevenueCents).toBe(19900);
    expect(r.totalCostCents).toBe(0);
    expect(r.grossMarginCents).toBe(19900);
    expect(r.grossMarginRatio).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it("Growth with $50 AI + $30 infra + $24 Stripe + $0 support = ~87% margin", () => {
    const r = computePlanMargin({
      plan: GROWTH,
      aiCostCents: 5_000,
      infraCostCents: 3_000,
      paymentProcessingCents: 2_400,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.totalCostCents).toBe(10_400);
    expect(r.grossMarginCents).toBe(79_900 - 10_400);
    expect(r.warnings).toEqual([]);
  });

  it("Business with reasonable usage = positive margin, no warnings", () => {
    const r = computePlanMargin({
      plan: BUSINESS,
      aiCostCents: 30_000,    // $300 of the $750 included
      infraCostCents: 10_000,
      paymentProcessingCents: 7_500,
      supportCostCents: 5_000,
      overageRevenueCents: 0,
    });
    expect(r.grossMarginCents).toBeGreaterThan(0);
    expect(r.warnings).toEqual([]);
  });
});

describe("computePlanMargin — warnings", () => {
  it("ai_cost_above_plan_price fires when AI exceeds plan price", () => {
    const r = computePlanMargin({
      plan: STARTER,
      aiCostCents: 25_000,    // $250 > $199 plan price
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).toContain("ai_cost_above_plan_price");
    expect(r.warnings).toContain("ai_credit_pool_exhausted");
  });

  it("ai_cost_above_50pct_of_plan_price fires between 50% and 100%", () => {
    const r = computePlanMargin({
      plan: GROWTH,
      aiCostCents: 50_000,    // $500 of $799 = 62%
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).toContain("ai_cost_above_50pct_of_plan_price");
    expect(r.warnings).not.toContain("ai_cost_above_plan_price");
  });

  it("negative_gross_margin fires when costs > revenue (non-enterprise)", () => {
    const r = computePlanMargin({
      plan: STARTER,
      aiCostCents: 30_000,
      infraCostCents: 5_000,
      paymentProcessingCents: 1_000,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).toContain("negative_gross_margin");
    expect(r.grossMarginCents).toBeLessThan(0);
  });

  it("negative_gross_margin does NOT fire on enterprise (expected during onboarding)", () => {
    const r = computePlanMargin({
      plan: ENTERPRISE,
      aiCostCents: 1_000_000_000,
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).not.toContain("negative_gross_margin");
  });

  it("enterprise without price emits enterprise_should_have_custom_contract", () => {
    const r = computePlanMargin(baseInput({ plan: ENTERPRISE }));
    expect(r.warnings).toContain("enterprise_should_have_custom_contract");
    expect(r.monthlyRevenueCents).toBeNull();
    expect(r.grossMarginCents).toBeNull();
  });

  it("metered_billing plan exhausted + no overage revenue = no_overage_revenue_on_overage_plan", () => {
    const r = computePlanMargin({
      plan: GROWTH,
      aiCostCents: 25_000,    // exceeds $200 included credits
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).toContain("no_overage_revenue_on_overage_plan");
    expect(r.warnings).toContain("ai_credit_pool_exhausted");
  });

  it("metered_billing plan exhausted + overage revenue logged = no overage warning", () => {
    const r = computePlanMargin({
      plan: GROWTH,
      aiCostCents: 25_000,
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 10_000,
    });
    expect(r.warnings).not.toContain("no_overage_revenue_on_overage_plan");
  });

  it("ai_credit_pool_exhausted fires on hard_stop Starter at 100% credit usage", () => {
    const r = computePlanMargin({
      plan: STARTER,
      aiCostCents: STARTER.entitlements.includedAICreditsCents,
      infraCostCents: 0,
      paymentProcessingCents: 0,
      supportCostCents: 0,
      overageRevenueCents: 0,
    });
    expect(r.warnings).toContain("ai_credit_pool_exhausted");
    // Starter is hard_stop → no overage warning
    expect(r.warnings).not.toContain("no_overage_revenue_on_overage_plan");
  });
});

describe("computePlanMargin — ratios", () => {
  it("aiCostRatio is null when plan price is null (enterprise)", () => {
    const r = computePlanMargin(baseInput({ plan: ENTERPRISE, aiCostCents: 1000 }));
    expect(r.aiCostRatio).toBeNull();
  });

  it("aiCostRatio = aiCost / planPrice", () => {
    const r = computePlanMargin(baseInput({ plan: GROWTH, aiCostCents: 7990 }));
    expect(r.aiCostRatio).toBeCloseTo(0.1, 5);
  });

  it("grossMarginRatio at 100% margin", () => {
    const r = computePlanMargin(baseInput({ plan: STARTER }));
    expect(r.grossMarginRatio).toBe(1);
  });

  it("grossMarginRatio at negative margin", () => {
    const r = computePlanMargin(baseInput({ plan: STARTER, aiCostCents: 39800 }));
    expect(r.grossMarginRatio).toBe(-1);
  });
});

describe("estimateStripeFee", () => {
  it("$10 charge → 29¢ + 30¢ = 59¢", () => {
    expect(estimateStripeFee(1000)).toBe(59);
  });
  it("zero or negative → 0", () => {
    expect(estimateStripeFee(0)).toBe(0);
    expect(estimateStripeFee(-100)).toBe(0);
  });
});

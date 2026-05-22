import { describe, it, expect } from "vitest";
import { preflightAICreditCheck } from "../preflightAICreditCheck";
import { findPlan } from "../planRegistry";

const STARTER = findPlan("starter");      // $25 credits, hard_stop
const GROWTH = findPlan("growth");        // $200 credits, metered_billing
const BUSINESS = findPlan("business");    // $750 credits, metered_billing
const ENTERPRISE = findPlan("enterprise"); // $5000 credits, custom_contract

describe("preflightAICreditCheck — Starter (hard_stop)", () => {
  it("zero usage → allow, below_70", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 0 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("below_70");
    expect(r.remainingCents).toBe(2500);
  });

  it("at 50% → allow, below_70", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 1250 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("below_70");
  });

  it("at 70% → allow, warn_70", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 1750 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("warn_70");
  });

  it("at 90% → allow, warn_90", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 2250 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("warn_90");
  });

  it("at 100% → BLOCK (hard_stop)", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 2500 });
    expect(r.kind).toBe("block");
    expect(r.reason).toBe("credit_pool_exhausted");
    expect(r.threshold).toBe("exhausted");
    expect(r.remainingCents).toBe(0);
  });

  it("expected additional cost can push to exhausted from below", () => {
    const r = preflightAICreditCheck({
      plan: STARTER,
      currentAICostCents: 2400,
      expectedAdditionalCostCents: 500,
    });
    expect(r.kind).toBe("block");
    expect(r.threshold).toBe("exhausted");
  });
});

describe("preflightAICreditCheck — Growth (metered_billing)", () => {
  it("100% reached → allow (overage bills downstream)", () => {
    const r = preflightAICreditCheck({ plan: GROWTH, currentAICostCents: 20_000 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("exhausted");
    expect(r.reason).toBeNull();
  });

  it("over 100% → still allow", () => {
    const r = preflightAICreditCheck({ plan: GROWTH, currentAICostCents: 50_000 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("exhausted");
    expect(r.projectedRatio).toBeCloseTo(2.5, 5);
  });

  it("at 70% → allow, warn_70", () => {
    const r = preflightAICreditCheck({ plan: GROWTH, currentAICostCents: 14_000 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("warn_70");
  });
});

describe("preflightAICreditCheck — Business (metered_billing)", () => {
  it("at 100% → allow (overage bills downstream)", () => {
    const r = preflightAICreditCheck({ plan: BUSINESS, currentAICostCents: 75_000 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("exhausted");
  });
});

describe("preflightAICreditCheck — Enterprise (custom_contract)", () => {
  it("massively over baseline → still allow (custom contract)", () => {
    const r = preflightAICreditCheck({ plan: ENTERPRISE, currentAICostCents: 10_000_000 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("exhausted");
    expect(r.reason).toBeNull();
  });
});

describe("preflightAICreditCheck — defensive cases", () => {
  it("negative additional cost is treated as zero", () => {
    const r = preflightAICreditCheck({
      plan: STARTER,
      currentAICostCents: 0,
      expectedAdditionalCostCents: -1000,
    });
    expect(r.kind).toBe("allow");
    expect(r.projectedRatio).toBe(0);
  });

  it("remainingCents clamps at 0 when over pool", () => {
    const r = preflightAICreditCheck({ plan: STARTER, currentAICostCents: 100_000 });
    expect(r.remainingCents).toBe(0);
  });

  it("projectedRatio is uncapped (operator dashboard can show 200%, 300%, etc.)", () => {
    const r = preflightAICreditCheck({ plan: GROWTH, currentAICostCents: 60_000 });
    expect(r.projectedRatio).toBe(3);
  });
});

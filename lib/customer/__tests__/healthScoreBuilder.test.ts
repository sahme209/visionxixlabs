/**
 * Vitest unit tests for the pure customer health-score builder.
 */

import { describe, it, expect } from "vitest";
import { buildHealthScore, type TenantSignals } from "../healthScoreBuilder";

const SIGNALS = (overrides: Partial<TenantSignals> = {}): TenantSignals => ({
  tenureDays: 60,
  weeklyActiveOperators: 5,
  totalOperators: 8,
  ticketsLast30d: 3,
  badCsatTicketsLast30d: 0,
  latestNps: 30,
  invoicesPaidOnTime: true,
  onboardingComplete: true,
  ...overrides,
});

describe("healthScoreBuilder", () => {
  it("happy path → green tier", () => {
    const r = buildHealthScore(SIGNALS({ weeklyActiveOperators: 8, totalOperators: 8, latestNps: 60 }));
    expect(r.tier).toBe("green");
  });

  it("zero activity → score drops with zero_activity factor", () => {
    const r = buildHealthScore(SIGNALS({ weeklyActiveOperators: 0, totalOperators: 8 }));
    expect(r.breakdown.some((b) => b.factor === "zero_activity" && b.delta === -30)).toBe(true);
  });

  it("heavy ticket volume → score drops", () => {
    const r = buildHealthScore(SIGNALS({ ticketsLast30d: 30 }));
    expect(r.breakdown.some((b) => b.factor === "heavy_ticket_volume" && b.delta === -15)).toBe(true);
  });

  it("bad CSAT subtracts up to 10", () => {
    const r = buildHealthScore(SIGNALS({ badCsatTicketsLast30d: 5 }));
    const bad = r.breakdown.find((b) => b.factor === "bad_csat")!;
    expect(bad.delta).toBe(-10); // capped
  });

  it("promoter NPS adds 15", () => {
    const r = buildHealthScore(SIGNALS({ latestNps: 80 }));
    expect(r.breakdown.some((b) => b.factor === "promoter_nps" && b.delta === 15)).toBe(true);
  });

  it("detractor NPS subtracts 15", () => {
    const r = buildHealthScore(SIGNALS({ latestNps: -20 }));
    expect(r.breakdown.some((b) => b.factor === "detractor_nps")).toBe(true);
  });

  it("invoice late → -10", () => {
    const r = buildHealthScore(SIGNALS({ invoicesPaidOnTime: false }));
    expect(r.breakdown.some((b) => b.factor === "invoice_late" && b.delta === -10)).toBe(true);
  });

  it("onboarding stuck after >14d tenure → -10", () => {
    const r = buildHealthScore(SIGNALS({ onboardingComplete: false, tenureDays: 30 }));
    expect(r.breakdown.some((b) => b.factor === "onboarding_stuck")).toBe(true);
  });

  it("score clamped 0..100", () => {
    const r = buildHealthScore({
      tenureDays: 365, weeklyActiveOperators: 0, totalOperators: 100,
      ticketsLast30d: 999, badCsatTicketsLast30d: 100,
      latestNps: -100, invoicesPaidOnTime: false, onboardingComplete: false,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.tier).toBe("red");
  });

  it("yellow tier when score in 40-69", () => {
    // base 50 − low activity 10 − heavy tickets 15 + passive nps 5
    // + paid on time 5 + onboarding done 5 = 40 → yellow.
    const r = buildHealthScore(SIGNALS({
      weeklyActiveOperators: 1, totalOperators: 10, latestNps: 0,
      ticketsLast30d: 25,
    }));
    expect(r.tier).toBe("yellow");
  });
});

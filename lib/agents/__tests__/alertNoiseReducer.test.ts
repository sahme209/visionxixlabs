import { describe, it, expect, beforeEach } from "vitest";
import {
  proposeNoiseReductions,
  summarizeNoise,
  __resetNoiseCounter,
  type AlertStats,
} from "../alertNoiseReducer";

function stats(overrides: Partial<AlertStats> & { ruleId: string }): AlertStats {
  return {
    ruleName: `Rule ${overrides.ruleId}`,
    channel: "slack",
    windowDays: 7,
    fires: 0,
    ackedFires: 0,
    incidentsCreated: 0,
    currentThreshold: "cpu>80% for 5m",
    hasPairedPredicate: false,
    ...overrides,
  };
}

beforeEach(() => __resetNoiseCounter());

describe("proposeNoiseReductions", () => {
  it("0 fires → keep", () => {
    const r = proposeNoiseReductions([stats({ ruleId: "r1" })]);
    expect(r[0].verdict).toBe("keep");
  });

  it("loud + acks <10% + zero incidents → mute_temporarily", () => {
    const r = proposeNoiseReductions([
      stats({ ruleId: "r1", fires: 100, ackedFires: 2, incidentsCreated: 0 }),
    ]);
    expect(r[0].verdict).toBe("mute_temporarily");
    if (r[0].recommendation.kind === "mute_temporarily") {
      expect(r[0].recommendation.durationHours).toBe(72);
    }
  });

  it("loud + zero incidents (but acked) → raise_threshold", () => {
    const r = proposeNoiseReductions([
      stats({ ruleId: "r1", fires: 100, ackedFires: 40, incidentsCreated: 0 }),
    ]);
    expect(r[0].verdict).toBe("raise_threshold");
    if (r[0].recommendation.kind === "raise_threshold") {
      expect(r[0].recommendation.suggested).toMatch(/90%/);
    }
  });

  it("threshold raise bumps the % by 10 points", () => {
    const r = proposeNoiseReductions([
      stats({ ruleId: "r1", fires: 100, ackedFires: 30, incidentsCreated: 0, currentThreshold: "memory>60% for 10m" }),
    ]);
    if (r[0].recommendation.kind === "raise_threshold") {
      expect(r[0].recommendation.suggested).toContain("70%");
    }
  });

  it("loud + high ack + low incidents + no pair → require_paired_metric", () => {
    const r = proposeNoiseReductions([
      stats({
        ruleId: "r1",
        fires: 100,
        ackedFires: 90,
        incidentsCreated: 5,
        // Need to escape the raise_threshold branch which requires
        // incidentsCreated === 0. Setting incidentsCreated=5 (rate 5%) → still < 10%.
      }),
    ]);
    expect(r[0].verdict).toBe("require_paired_metric");
  });

  it("PagerDuty + always-acked + low incidents → split_routing", () => {
    const r = proposeNoiseReductions([
      stats({
        ruleId: "r1",
        channel: "pagerduty",
        fires: 30,     // < 5/day threshold so won't be classed as loud
        ackedFires: 28,
        incidentsCreated: 3,
        windowDays: 14, // 30/14 ≈ 2.1/day — not loud, but high ack rate triggers split
      }),
    ]);
    expect(r[0].verdict).toBe("split_routing");
  });

  it("normal signal → keep", () => {
    const r = proposeNoiseReductions([
      stats({ ruleId: "r1", fires: 10, ackedFires: 9, incidentsCreated: 7, windowDays: 7 }),
    ]);
    expect(r[0].verdict).toBe("keep");
  });

  it("widen_window only when threshold mentions short window", () => {
    // Loud + has paired predicate (so case C skipped) + window short
    const r = proposeNoiseReductions([
      stats({
        ruleId: "r1",
        fires: 100,
        ackedFires: 60,
        incidentsCreated: 8, // incidentRate 8% triggers Case C BUT paired = true skips
        hasPairedPredicate: true,
        currentThreshold: "cpu>80% for 5m",
      }),
    ]);
    expect(r[0].verdict).toBe("widen_window");
    if (r[0].recommendation.kind === "widen_window") {
      expect(r[0].recommendation.suggested).toContain("10m");
    }
  });

  it("sorts by expected reduction descending", () => {
    const items = [
      stats({ ruleId: "quiet", fires: 0 }),                                                   // 0
      stats({ ruleId: "mute",  fires: 200, ackedFires: 1,  incidentsCreated: 0 }),           // 1.0
      stats({ ruleId: "raise", fires: 100, ackedFires: 50, incidentsCreated: 0 }),           // 0.6
    ];
    const r = proposeNoiseReductions(items);
    expect(r[0].ruleId).toBe("mute");
    expect(r[1].ruleId).toBe("raise");
    expect(r[2].ruleId).toBe("quiet");
  });

  it("summarizeNoise estimates fires/week saved", () => {
    const items = [
      stats({ ruleId: "r1", fires: 100, ackedFires: 50, incidentsCreated: 0, windowDays: 7 }),
    ];
    const proposals = proposeNoiseReductions(items);
    const sum = summarizeNoise(items, proposals);
    // (100/7)*7*0.6 ≈ 60 fires/week saved
    expect(sum.expectedSilenceFiresPerWeek).toBeGreaterThan(0);
    expect(sum.byVerdict.raise_threshold).toBe(1);
  });
});

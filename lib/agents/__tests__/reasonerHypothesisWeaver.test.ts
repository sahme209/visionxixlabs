/**
 * Vitest unit tests for the pure reasoner hypothesis weaver.
 */

import { describe, it, expect } from "vitest";
import { weaveHypotheses, type DetectorSignal } from "../reasonerHypothesisWeaver";

const SIG = (id: string, kind: DetectorSignal["kind"], target: string, confidence: number): DetectorSignal =>
  ({ id, kind, target, confidence, evidence: `${kind} on ${target}` });

describe("reasonerHypothesisWeaver", () => {
  it("empty signals → empty hypotheses", () => {
    expect(weaveHypotheses([])).toEqual([]);
  });

  it("one signal → one hypothesis with mapped kind", () => {
    const r = weaveHypotheses([SIG("s1", "drift", "svc-a", 0.8)]);
    expect(r.length).toBe(1);
    expect(r[0].kind).toBe("drift_remediation_needed");
    expect(r[0].target).toBe("svc-a");
    expect(r[0].confidence).toBe(0.8);
    expect(r[0].signalIds).toEqual(["s1"]);
  });

  it("multiple signals for same (kind, target) merge into one hypothesis", () => {
    const r = weaveHypotheses([
      SIG("s1", "drift", "svc-a", 0.5),
      SIG("s2", "drift", "svc-a", 0.9),
    ]);
    expect(r.length).toBe(1);
    expect(r[0].signalIds.length).toBe(2);
    expect(r[0].confidence).toBeCloseTo(0.7, 2);
  });

  it("different targets → separate hypotheses", () => {
    const r = weaveHypotheses([
      SIG("s1", "drift", "svc-a", 0.5),
      SIG("s2", "drift", "svc-b", 0.5),
    ]);
    expect(r.length).toBe(2);
  });

  it("sorted by confidence desc", () => {
    const r = weaveHypotheses([
      SIG("s1", "drift", "low",  0.2),
      SIG("s2", "drift", "high", 0.9),
    ]);
    expect(r[0].target).toBe("high");
    expect(r[1].target).toBe("low");
  });

  it("expectedNextAgents differs by hypothesis kind", () => {
    const drift = weaveHypotheses([SIG("s", "drift", "x", 0.5)])[0];
    const cost  = weaveHypotheses([SIG("s", "cost_anomaly", "x", 0.5)])[0];
    expect(drift.expectedNextAgents).toContain("simulator");
    expect(cost.expectedNextAgents).toContain("approver");
  });

  it("confidence clamped to [0, 1]", () => {
    const r = weaveHypotheses([SIG("s1", "drift", "x", 2.5), SIG("s2", "drift", "x", -3)]);
    expect(r[0].confidence).toBe(0.5);
  });

  it("each signal kind maps to a distinct hypothesis kind", () => {
    const r = weaveHypotheses([
      SIG("a", "drift",            "1", 0.5),
      SIG("b", "cost_anomaly",     "2", 0.5),
      SIG("c", "slo_burn",         "3", 0.5),
      SIG("d", "vuln_kev",         "4", 0.5),
      SIG("e", "policy_violation", "5", 0.5),
      SIG("f", "saturation",       "6", 0.5),
    ]);
    const kinds = new Set(r.map((h) => h.kind));
    expect(kinds.size).toBe(6);
  });
});

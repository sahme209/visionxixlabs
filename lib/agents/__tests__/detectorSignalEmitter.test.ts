/**
 * Vitest unit tests for the pure detector signal emitter.
 */

import { describe, it, expect } from "vitest";
import { emitDetectorSignals } from "../detectorSignalEmitter";

describe("detectorSignalEmitter", () => {
  it("empty inputs → no signals", () => {
    expect(emitDetectorSignals({})).toEqual([]);
  });

  it("drift severity=ok is skipped", () => {
    const r = emitDetectorSignals({
      drift: [{ id: "d1", target: "svc-a", severity: "ok", reason: "no drift" }],
    });
    expect(r).toEqual([]);
  });

  it("drift severity=high → drift signal with confidence 0.8", () => {
    const r = emitDetectorSignals({
      drift: [{ id: "d1", target: "svc-a", severity: "high", reason: "PAB drift" }],
    });
    expect(r.length).toBe(1);
    expect(r[0].kind).toBe("drift");
    expect(r[0].confidence).toBe(0.8);
  });

  it("cost anomaly with positive delta emits cost_anomaly", () => {
    const r = emitDetectorSignals({
      cost: [{ id: "c1", service: "checkout", deltaUsd: 200, deltaPct: 50 }],
    });
    expect(r[0].kind).toBe("cost_anomaly");
    expect(r[0].target).toBe("checkout");
    expect(r[0].confidence).toBeCloseTo(0.5, 5);
  });

  it("cost anomaly with zero/negative delta is skipped", () => {
    expect(emitDetectorSignals({
      cost: [{ id: "c1", service: "x", deltaUsd: 0, deltaPct: 0 }],
    })).toEqual([]);
  });

  it("slo burn verdict=ok skipped", () => {
    expect(emitDetectorSignals({
      sloBurn: [{ id: "s1", service: "x", burnRate: 0.5, verdict: "ok" }],
    })).toEqual([]);
  });

  it("slo burn → confidence scales with burnRate / 3", () => {
    const r = emitDetectorSignals({
      sloBurn: [{ id: "s1", service: "x", burnRate: 1.5, verdict: "burning_fast" }],
    });
    expect(r[0].confidence).toBeCloseTo(0.5, 5);
  });

  it("vuln_kev severity=critical → confidence 0.95", () => {
    const r = emitDetectorSignals({
      kev: [{ id: "v1", cveId: "CVE-2026-1234", affectedTarget: "node-a", severity: "critical" }],
    });
    expect(r[0].kind).toBe("vuln_kev");
    expect(r[0].confidence).toBe(0.95);
  });

  it("policy violations emit fixed-confidence policy_violation signals", () => {
    const r = emitDetectorSignals({
      policy: [{ id: "p1", target: "bucket-a", ruleId: "require_tag" }],
    });
    expect(r[0].kind).toBe("policy_violation");
    expect(r[0].confidence).toBe(0.7);
  });

  it("saturation only emits when observedPeak > targetPeak", () => {
    const skipped = emitDetectorSignals({
      saturation: [{ id: "s1", service: "x", observedPeak: 0.5, targetPeak: 0.7 }],
    });
    expect(skipped).toEqual([]);
    const r = emitDetectorSignals({
      saturation: [{ id: "s1", service: "x", observedPeak: 0.85, targetPeak: 0.7 }],
    });
    expect(r[0].kind).toBe("saturation");
  });

  it("signals sorted by confidence desc", () => {
    const r = emitDetectorSignals({
      drift: [{ id: "d1", target: "low",  severity: "low",  reason: "" }],
      kev:   [{ id: "v1", cveId: "x", affectedTarget: "hi", severity: "critical" }],
    });
    expect(r[0].kind).toBe("vuln_kev");
    expect(r[1].kind).toBe("drift");
  });
});

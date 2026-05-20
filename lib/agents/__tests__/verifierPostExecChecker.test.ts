/**
 * Vitest unit tests for the pure verifier post-execution checker.
 */

import { describe, it, expect } from "vitest";
import { runVerification, type PostExecExpectation, type PostExecObservation } from "../verifierPostExecChecker";

const E = (key: string, expectedValue: unknown): PostExecExpectation =>
  ({ key, expectedValue, reason: `${key} required` });
const O = (key: string, observedValue: unknown): PostExecObservation =>
  ({ key, observedValue });

describe("verifierPostExecChecker", () => {
  it("all expectations met → pass", () => {
    const r = runVerification({
      expectations: [E("encryption.atRest", true), E("publicAccessBlock", "all")],
      observations: [O("encryption.atRest", true), O("publicAccessBlock", "all")],
    });
    expect(r.verdict).toBe("pass");
    expect(r.expectationFailedCount).toBe(0);
  });

  it("missing observation → row fails + overall fail (no passes)", () => {
    const r = runVerification({
      expectations: [E("encryption.atRest", true)],
      observations: [],
    });
    expect(r.rows[0].passed).toBe(false);
    expect(r.verdict).toBe("fail");
  });

  it("0 passed expectations → verdict fail", () => {
    const r = runVerification({
      expectations: [E("a", true), E("b", true)],
      observations: [O("a", false), O("b", false)],
    });
    expect(r.verdict).toBe("fail");
  });

  it("partial_pass when 1+ failed but most passed and metrics ok", () => {
    const r = runVerification({
      expectations: [E("a", true), E("b", true), E("c", true)],
      observations: [O("a", true), O("b", true), O("c", false)],
    });
    expect(r.verdict).toBe("partial_pass");
  });

  it("metricsDelta latencyRatio > 1.5 → fail despite expectation pass", () => {
    const r = runVerification({
      expectations: [E("a", true)],
      observations: [O("a", true)],
      metricsDelta: { p95LatencyRatio: 2.0 },
    });
    expect(r.metricChecks.latencyAcceptable).toBe(false);
    expect(r.verdict).toBe("fail");
  });

  it("metricsDelta errorRateDelta > 0.01 → fail", () => {
    const r = runVerification({
      expectations: [E("a", true)],
      observations: [O("a", true)],
      metricsDelta: { errorRateDelta: 0.05 },
    });
    expect(r.verdict).toBe("fail");
  });

  it("metricChecks null when not supplied", () => {
    const r = runVerification({
      expectations: [E("a", true)],
      observations: [O("a", true)],
    });
    expect(r.metricChecks.latencyAcceptable).toBeNull();
    expect(r.metricChecks.errorRateAcceptable).toBeNull();
  });

  it("rows carry expected + observed for the UI", () => {
    const r = runVerification({
      expectations: [E("encryption.atRest", true)],
      observations: [O("encryption.atRest", false)],
    });
    expect(r.rows[0].expected).toBe(true);
    expect(r.rows[0].observed).toBe(false);
  });
});

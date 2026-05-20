/**
 * Pure verifier-agent post-execution checker.
 *
 * AFTER a change ships through real change control (IaC PR + apply),
 * the verifier agent confirms that the observed state matches the
 * intent declared at approval time. This module folds the post-check
 * inputs into a single typed verdict the auditor agent writes to the
 * durable rationale row.
 *
 * Pure / deterministic.
 */

export interface PostExecExpectation {
  key: string;                     // dotted path
  expectedValue: unknown;
  reason: string;
}

export interface PostExecObservation {
  key: string;
  observedValue: unknown;
}

export interface VerificationInput {
  expectations: readonly PostExecExpectation[];
  observations: readonly PostExecObservation[];
  /** Optional p95 latency / error-rate compared to pre-change baseline. */
  metricsDelta?: {
    p95LatencyRatio?: number;     // 1.0 = same as before, 1.5 = 50% worse
    errorRateDelta?: number;      // +0.01 = +1pp
  };
}

export interface VerifierRow {
  key: string;
  passed: boolean;
  expected: unknown;
  observed: unknown;
  reason: string;
}

export interface VerificationResult {
  rows: VerifierRow[];
  expectationPassedCount: number;
  expectationFailedCount: number;
  /** Optional metric checks. */
  metricChecks: {
    latencyAcceptable: boolean | null;     // null if not supplied
    errorRateAcceptable: boolean | null;
  };
  verdict: "pass" | "partial_pass" | "fail";
}

export function runVerification(input: VerificationInput): VerificationResult {
  const obsByKey = new Map<string, unknown>();
  for (const o of input.observations) obsByKey.set(o.key, o.observedValue);

  const rows: VerifierRow[] = input.expectations.map((e) => {
    const observed = obsByKey.has(e.key) ? obsByKey.get(e.key) : undefined;
    const passed = obsByKey.has(e.key) && observed === e.expectedValue;
    return { key: e.key, passed, expected: e.expectedValue, observed, reason: e.reason };
  });

  const expectationPassedCount = rows.filter((r) => r.passed).length;
  const expectationFailedCount = rows.length - expectationPassedCount;

  // Metric checks: latency ratio <= 1.5 is acceptable; error-rate delta <= 0.01 is acceptable.
  const md = input.metricsDelta;
  const latencyAcceptable = typeof md?.p95LatencyRatio === "number" ? md.p95LatencyRatio <= 1.5 : null;
  const errorRateAcceptable = typeof md?.errorRateDelta === "number" ? md.errorRateDelta <= 0.01 : null;

  let verdict: VerificationResult["verdict"];
  const metricBad = (latencyAcceptable === false) || (errorRateAcceptable === false);
  if (expectationFailedCount === 0 && !metricBad) {
    verdict = "pass";
  } else if (expectationPassedCount > 0 && expectationFailedCount <= 1 && !metricBad) {
    verdict = "partial_pass";
  } else {
    verdict = "fail";
  }

  return {
    rows,
    expectationPassedCount,
    expectationFailedCount,
    metricChecks: { latencyAcceptable, errorRateAcceptable },
    verdict,
  };
}

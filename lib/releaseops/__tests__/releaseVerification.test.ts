import { describe, expect, it } from "vitest";
import { verifyRelease } from "../releaseVerification";

describe("release verification", () => {
  it("is healthy only from real signals and names what is missing", () => {
    expect(verifyRelease({ newIssues: [], monitors: { alerting: 0, warning: 0, ok: 3, noData: 0 }, verifyChecks: [{ key: "smoke", status: "passed" }] })).toEqual({ verdict: "healthy", reasons: ["No new errors, no alerting monitors and Verify checks passing."], missing: [] });
    expect(verifyRelease({ newIssues: null, monitors: null, verifyChecks: null })).toEqual({ verdict: "no_signals", reasons: [], missing: ["new errors (connect Sentry)", "monitors (connect Datadog)", "Verify-stage check results"] });
    expect(verifyRelease({ newIssues: [], monitors: null, verifyChecks: [] })).toMatchObject({ verdict: "healthy", missing: ["monitors (connect Datadog)", "Verify-stage check results"] });
  });
  it("asks to investigate small regressions and calls clear failures unhealthy", () => {
    expect(verifyRelease({ newIssues: [{ level: "warning", count: 2 }], monitors: { alerting: 0, warning: 1, ok: 2, noData: 0 }, verifyChecks: null })).toMatchObject({ verdict: "investigate", reasons: ["1 new issue first seen in this release.", "1 monitor is warning."] });
    expect(verifyRelease({ newIssues: [{ level: "error", count: 150 }], monitors: null, verifyChecks: null })).toMatchObject({ verdict: "unhealthy", reasons: ["1 new error issue (150 events) first seen in this release."] });
    expect(verifyRelease({ newIssues: [], monitors: { alerting: 2, warning: 0, ok: 0, noData: 0 }, verifyChecks: [{ key: "smoke", status: "failed" }] })).toMatchObject({ verdict: "unhealthy", reasons: ["2 monitors are alerting.", "Verify checks not passing: smoke."] });
  });
});

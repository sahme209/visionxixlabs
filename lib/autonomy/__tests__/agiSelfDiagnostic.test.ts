/**
 * Vitest unit tests for the AGI self-diagnostic.
 *
 * The diagnostic itself is pure-local. These tests verify that
 * every spine assertion fires (no silent skip), and that the
 * overall health score lands in [0, 1].
 */

import { describe, it, expect } from "vitest";
import { runAgiSelfDiagnostic } from "../agiSelfDiagnostic";

describe("agi self-diagnostic", () => {
  it("runs every spine check and returns a [0, 1] health score", () => {
    const r = runAgiSelfDiagnostic();
    expect(r.totalChecks).toBeGreaterThanOrEqual(8);
    expect(r.passCount + r.failCount).toBe(r.totalChecks);
    expect(r.healthScore).toBeGreaterThanOrEqual(0);
    expect(r.healthScore).toBeLessThanOrEqual(1);
  });

  it("passes the SCP deny + allow path checks", () => {
    const r = runAgiSelfDiagnostic();
    const deny  = r.checks.find((c) => c.id === "scp.simulator_deny_path");
    const allow = r.checks.find((c) => c.id === "scp.simulator_allow_path");
    expect(deny?.verdict).toBe("pass");
    expect(allow?.verdict).toBe("pass");
  });

  it("passes the help search primary + no_match checks", () => {
    const r = runAgiSelfDiagnostic();
    const primary  = r.checks.find((c) => c.id === "help.search_primary");
    const nomatch  = r.checks.find((c) => c.id === "help.search_no_match_honest");
    expect(primary?.verdict).toBe("pass");
    expect(nomatch?.verdict).toBe("pass");
  });

  it("passes the validation matrix evidence completeness check", () => {
    const r = runAgiSelfDiagnostic();
    const c = r.checks.find((x) => x.id === "validation.matrix_evidence");
    expect(c?.verdict).toBe("pass");
  });

  it("includes per-check durations", () => {
    const r = runAgiSelfDiagnostic();
    for (const c of r.checks) {
      expect(typeof c.durationMs).toBe("number");
      expect(c.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});

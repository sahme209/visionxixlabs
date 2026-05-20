/**
 * Vitest unit tests for the pure prerequisite verifier.
 */

import { describe, it, expect } from "vitest";
import { verifyPrerequisites, type TenantState } from "../prerequisiteVerifier";

const STATE: TenantState = {
  approverRoles: ["platform_admin"],
  featureFlags: { s3_pab_tightening: "on", risky_feature: "off" },
  serviceHealth: { checkout: "operational", payments: "degraded" },
  boundaryClass: "low_blast_radius",
  tier: "growth",
};

describe("prerequisiteVerifier", () => {
  it("empty prereqs → allPassed=true", () => {
    const r = verifyPrerequisites([], STATE);
    expect(r.allPassed).toBe(true);
    expect(r.passedCount).toBe(0);
    expect(r.failedCount).toBe(0);
  });

  it("approver_role check passes when role present", () => {
    const r = verifyPrerequisites(
      [{ kind: "approver_role", selector: "approver_role:platform_admin", reason: "" }],
      STATE,
    );
    expect(r.allPassed).toBe(true);
    expect(r.rows[0].detail).toContain("present");
  });

  it("approver_role fails when role missing", () => {
    const r = verifyPrerequisites(
      [{ kind: "approver_role", selector: "approver_role:auditor", reason: "" }],
      STATE,
    );
    expect(r.allPassed).toBe(false);
    expect(r.rows[0].detail).toContain("missing");
  });

  it("feature_flag default expected is 'on'", () => {
    const onR = verifyPrerequisites(
      [{ kind: "feature_flag", selector: "feature_flag:s3_pab_tightening", reason: "" }],
      STATE,
    );
    const offR = verifyPrerequisites(
      [{ kind: "feature_flag", selector: "feature_flag:risky_feature", reason: "" }],
      STATE,
    );
    expect(onR.allPassed).toBe(true);
    expect(offR.allPassed).toBe(false);
  });

  it("service_health passes only when 'operational'", () => {
    const ok = verifyPrerequisites(
      [{ kind: "service_health", selector: "service_health:checkout", reason: "" }],
      STATE,
    );
    const degraded = verifyPrerequisites(
      [{ kind: "service_health", selector: "service_health:payments", reason: "" }],
      STATE,
    );
    expect(ok.allPassed).toBe(true);
    expect(degraded.allPassed).toBe(false);
  });

  it("boundary_class exact match", () => {
    const r = verifyPrerequisites(
      [{ kind: "boundary_class", selector: "boundary_class:low_blast_radius", reason: "" }],
      STATE,
    );
    expect(r.allPassed).toBe(true);
  });

  it("tier_minimum compares rank", () => {
    const ok = verifyPrerequisites(
      [{ kind: "tier_minimum", selector: "tier_minimum:starter", reason: "" }],
      STATE,
    );
    const need = verifyPrerequisites(
      [{ kind: "tier_minimum", selector: "tier_minimum:enterprise", reason: "" }],
      STATE,
    );
    expect(ok.allPassed).toBe(true);
    expect(need.allPassed).toBe(false);
  });

  it("mixed pass / fail tallies correctly", () => {
    const r = verifyPrerequisites(
      [
        { kind: "approver_role",   selector: "approver_role:platform_admin", reason: "" },
        { kind: "service_health",  selector: "service_health:payments",      reason: "" },
        { kind: "tier_minimum",    selector: "tier_minimum:starter",         reason: "" },
      ],
      STATE,
    );
    expect(r.passedCount).toBe(2);
    expect(r.failedCount).toBe(1);
    expect(r.allPassed).toBe(false);
  });
});

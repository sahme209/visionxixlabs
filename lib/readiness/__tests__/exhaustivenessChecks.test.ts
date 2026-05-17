/**
 * Vitest unit tests for the exhaustiveness self-tests.
 *
 * These tests would have caught all four recent fix-up commits:
 *   - missing release_governance / pipeline_health in changeTypeFor
 *   - missing release_governance / pipeline_health in verificationFor
 *   - missing "github" key in the reasoner's scopeText record
 *   - missing release_governance / pipeline_health in CATEGORY_LABEL
 *
 * Each cascade-style bug would have flipped one of these checks to
 * `ok: false` with the precise missing key.
 */

import { describe, it, expect } from "vitest";
import {
  SECURITY_CHECK_CATEGORIES,
  SECURITY_CHECK_SCOPES,
  SECURITY_CHECK_SEVERITIES,
  SECURITY_CHECK_STATUSES,
  auditAllExhaustiveness,
} from "../exhaustivenessChecks";
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
} from "../../securityScanner/securityScanner";

describe("security scanner enum exhaustiveness", () => {
  it("CATEGORY_LABEL covers every SecurityCheckCategory", () => {
    for (const cat of SECURITY_CHECK_CATEGORIES) {
      expect(CATEGORY_LABEL[cat]).toBeDefined();
      expect(typeof CATEGORY_LABEL[cat]).toBe("string");
    }
  });

  it("SEVERITY_LABEL covers every SecurityCheckSeverity", () => {
    for (const sev of SECURITY_CHECK_SEVERITIES) {
      expect(SEVERITY_LABEL[sev]).toBeDefined();
    }
  });

  it("STATUS_LABEL covers every SecurityCheckStatus", () => {
    for (const st of SECURITY_CHECK_STATUSES) {
      expect(STATUS_LABEL[st]).toBeDefined();
    }
  });

  it("SECURITY_CHECK_SCOPES list contains the github scope (regression)", () => {
    expect(SECURITY_CHECK_SCOPES).toContain("github");
  });

  it("auditAllExhaustiveness reports ok for every label record", () => {
    const results = auditAllExhaustiveness();
    for (const result of results) {
      expect(result.ok, `${result.recordName} should be exhaustive`).toBe(true);
    }
  });
});

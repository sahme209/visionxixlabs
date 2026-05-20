/**
 * Vitest unit tests for the pure least-privilege analyzer.
 */

import { describe, it, expect } from "vitest";
import { analyzeLeastPrivilege } from "../leastPrivilegeAnalyzer";

describe("leastPrivilegeAnalyzer", () => {
  it("empty input → ok severity, zero counts", () => {
    const r = analyzeLeastPrivilege({ attachedActions: [], observedActions: [] });
    expect(r.attachedCount).toBe(0);
    expect(r.severity).toBe("ok");
    expect(r.overGrantRatio).toBe(0);
  });

  it("identifies unused actions", () => {
    const r = analyzeLeastPrivilege({
      attachedActions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      observedActions: ["s3:GetObject"],
    });
    expect(r.unusedActions).toEqual(["s3:DeleteObject", "s3:PutObject"]);
    expect(r.overGrantRatio).toBeCloseTo(2 / 3, 5);
  });

  it("identifies missing actions (privilege escalation hint)", () => {
    const r = analyzeLeastPrivilege({
      attachedActions: ["s3:GetObject"],
      observedActions: ["s3:GetObject", "iam:CreateUser"],
    });
    expect(r.missingActions).toEqual(["iam:CreateUser"]);
    expect(r.severity).toBe("high");
  });

  it("alwaysKeepPrefixes excludes those from unused list", () => {
    const r = analyzeLeastPrivilege({
      attachedActions: ["iam:CreateUser", "s3:DeleteBucket"],
      observedActions: [],
      alwaysKeepPrefixes: ["iam:"],
    });
    expect(r.unusedActions).toEqual(["s3:DeleteBucket"]);
    expect(r.tightenedActions).toContain("iam:CreateUser");
  });

  it("severity ladder by overGrantRatio: <0.25 low, <0.5 medium, >=0.5 high", () => {
    // 1/5 = 0.2 → low
    const low = analyzeLeastPrivilege({
      attachedActions: ["a", "b", "c", "d", "e"],
      observedActions: ["a", "b", "c", "d"],
    });
    // 2/5 = 0.4 → medium
    const med = analyzeLeastPrivilege({
      attachedActions: ["a", "b", "c", "d", "e"],
      observedActions: ["a", "b", "c"],
    });
    // 3/5 = 0.6 → high
    const high = analyzeLeastPrivilege({
      attachedActions: ["a", "b", "c", "d", "e"],
      observedActions: ["a", "b"],
    });
    expect(low.severity).toBe("low");
    expect(med.severity).toBe("medium");
    expect(high.severity).toBe("high");
  });

  it("tightenedActions = observed ∪ alwaysKeep-attached", () => {
    const r = analyzeLeastPrivilege({
      attachedActions: ["iam:Get", "s3:PutObject"],
      observedActions: ["s3:GetObject"],
      alwaysKeepPrefixes: ["iam:"],
    });
    expect(r.tightenedActions).toEqual(["iam:Get", "s3:GetObject"]);
  });

  it("trims whitespace and drops empty entries", () => {
    const r = analyzeLeastPrivilege({
      attachedActions: ["  s3:GetObject  ", "", "s3:GetObject"],
      observedActions: ["s3:GetObject"],
    });
    expect(r.attachedCount).toBe(1);
    expect(r.unusedActions).toEqual([]);
  });
});

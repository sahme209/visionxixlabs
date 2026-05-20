/**
 * Vitest unit tests for the pure policy-gate evaluator.
 */

import { describe, it, expect } from "vitest";
import { evaluatePolicy, type PolicyContext, type PolicyRule } from "../policyGateEvaluator";

const CTX: PolicyContext = {
  proposedActions: ["s3:PutBucketPolicy"],
  affectedTags: { cost_center: "engineering", env: "prod" },
  blastRadius: "service",
  approverRoles: ["platform_admin"],
  terraformSigned: true,
};

describe("policyGateEvaluator", () => {
  it("empty rules → pass", () => {
    const r = evaluatePolicy([], CTX);
    expect(r.overall).toBe("pass");
    expect(r.failedCount).toBe(0);
  });

  it("require_tag present → pass", () => {
    const rule: PolicyRule = { id: "r1", kind: "require_tag", args: { key: "cost_center" }, reason: "" };
    const r = evaluatePolicy([rule], CTX);
    expect(r.overall).toBe("pass");
  });

  it("require_tag missing → fail", () => {
    const rule: PolicyRule = { id: "r1", kind: "require_tag", args: { key: "ghost" }, reason: "" };
    const r = evaluatePolicy([rule], CTX);
    expect(r.overall).toBe("fail");
    expect(r.rows[0].detail).toContain("missing");
  });

  it("forbid_action triggers when present", () => {
    const rule: PolicyRule = { id: "r1", kind: "forbid_action", args: { action: "s3:PutBucketPolicy" }, reason: "" };
    const r = evaluatePolicy([rule], CTX);
    expect(r.overall).toBe("fail");
  });

  it("forbid_action passes when absent", () => {
    const rule: PolicyRule = { id: "r1", kind: "forbid_action", args: { action: "iam:DeleteUser" }, reason: "" };
    const r = evaluatePolicy([rule], CTX);
    expect(r.overall).toBe("pass");
  });

  it("max_blast_radius enforces rank ladder", () => {
    const rule: PolicyRule = { id: "r1", kind: "max_blast_radius", args: { max: "service" }, reason: "" };
    expect(evaluatePolicy([rule], CTX).overall).toBe("pass");
    expect(evaluatePolicy([rule], { ...CTX, blastRadius: "org" }).overall).toBe("fail");
  });

  it("require_role checks approverRoles list", () => {
    const rule: PolicyRule = { id: "r1", kind: "require_role", args: { role: "security" }, reason: "" };
    expect(evaluatePolicy([rule], CTX).overall).toBe("fail");
    expect(evaluatePolicy([rule], { ...CTX, approverRoles: ["security"] }).overall).toBe("pass");
  });

  it("require_signed_terraform respects flag", () => {
    const rule: PolicyRule = { id: "r1", kind: "require_signed_terraform", args: {}, reason: "" };
    expect(evaluatePolicy([rule], CTX).overall).toBe("pass");
    expect(evaluatePolicy([rule], { ...CTX, terraformSigned: false }).overall).toBe("fail");
  });

  it("mixed rules tally passed + failed correctly", () => {
    const rules: PolicyRule[] = [
      { id: "a", kind: "require_tag", args: { key: "cost_center" }, reason: "" },     // pass
      { id: "b", kind: "require_tag", args: { key: "ghost" }, reason: "" },           // fail
      { id: "c", kind: "max_blast_radius", args: { max: "service" }, reason: "" },    // pass
    ];
    const r = evaluatePolicy(rules, CTX);
    expect(r.passedCount).toBe(2);
    expect(r.failedCount).toBe(1);
    expect(r.overall).toBe("fail");
  });
});

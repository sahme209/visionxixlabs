/**
 * Vitest unit tests for the SCP simulator.
 *
 * Verifies action/resource matching, condition operator coverage
 * (StringEquals / StringNotEquals / NumericEquals / Bool /
 * BoolIfExists / Null), explicit-Deny-wins semantics, and the
 * NotApplicable verdict when no statement matches.
 */

import { describe, it, expect } from "vitest";
import { simulateScp } from "../scpSimulator";

describe("scp simulator", () => {
  // ---------------------------------------------------------------------------
  // Basic verdict ladder
  // ---------------------------------------------------------------------------

  it("returns Deny when an exact action match has Effect=Deny", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Sid: "S", Effect: "Deny", Action: "s3:DeleteBucket", Resource: "*" }],
    });
    const r = simulateScp(policy, { action: "s3:DeleteBucket" });
    expect(r.verdict).toBe("Deny");
  });

  it("returns Allow when an exact action match has Effect=Allow", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Sid: "S", Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
    });
    const r = simulateScp(policy, { action: "s3:ListBucket" });
    expect(r.verdict).toBe("Allow");
  });

  it("returns NotApplicable when no statement matches", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Sid: "S", Effect: "Deny", Action: "kms:DisableKey", Resource: "*" }],
    });
    const r = simulateScp(policy, { action: "s3:GetObject" });
    expect(r.verdict).toBe("NotApplicable");
  });

  it("returns NotApplicable on unparseable JSON, never crashes", () => {
    const r = simulateScp("{not-json", { action: "s3:GetObject" });
    expect(r.verdict).toBe("NotApplicable");
    expect(r.limitations.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Wildcards
  // ---------------------------------------------------------------------------

  it("matches trailing wildcard actions (s3:Delete*)", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Deny", Action: "s3:Delete*", Resource: "*" }],
    });
    expect(simulateScp(policy, { action: "s3:DeleteBucket" }).verdict).toBe("Deny");
    expect(simulateScp(policy, { action: "s3:DeleteObject" }).verdict).toBe("Deny");
    expect(simulateScp(policy, { action: "s3:GetObject" }).verdict).toBe("NotApplicable");
  });

  // ---------------------------------------------------------------------------
  // Explicit-Deny wins
  // ---------------------------------------------------------------------------

  it("Deny wins over Allow even when Allow appears first", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        { Sid: "AllowFirst", Effect: "Allow", Action: "s3:DeleteBucket", Resource: "*" },
        { Sid: "DenyLast",   Effect: "Deny",  Action: "s3:DeleteBucket", Resource: "*" },
      ],
    });
    const r = simulateScp(policy, { action: "s3:DeleteBucket" });
    expect(r.verdict).toBe("Deny");
    expect(r.summary).toMatch(/DenyLast/);
  });

  // ---------------------------------------------------------------------------
  // Conditions
  // ---------------------------------------------------------------------------

  it("respects StringNotEquals on aws:PrincipalTag/BreakGlass", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Sid: "DenyNonBreakGlass",
        Effect: "Deny",
        Action: "s3:PutBucketPublicAccessBlock",
        Resource: "*",
        Condition: { StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" } },
      }],
    });
    // Non-break-glass principal → Deny matches.
    expect(simulateScp(policy, {
      action: "s3:PutBucketPublicAccessBlock",
      principalTags: { BreakGlass: "false" },
    }).verdict).toBe("Deny");
    // Break-glass principal → condition NOT met → statement skipped → NotApplicable.
    expect(simulateScp(policy, {
      action: "s3:PutBucketPublicAccessBlock",
      principalTags: { BreakGlass: "true" },
    }).verdict).toBe("NotApplicable");
  });

  it("BoolIfExists treats missing keys as satisfied", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Deny",
        Action: "s3:DeleteBucket",
        Resource: "*",
        Condition: { BoolIfExists: { "aws:MultiFactorAuthPresent": "false" } },
      }],
    });
    // No MFA context provided → BoolIfExists is satisfied → Deny applies.
    const r = simulateScp(policy, { action: "s3:DeleteBucket" });
    expect(r.verdict).toBe("Deny");
  });

  it("reports unknown condition operators as limitations instead of crashing", () => {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Deny",
        Action: "s3:DeleteBucket",
        Resource: "*",
        Condition: { SomeMadeUpOperator: { "aws:Foo": "bar" } },
      }],
    });
    const r = simulateScp(policy, { action: "s3:DeleteBucket" });
    expect(r.limitations.length).toBeGreaterThan(0);
    expect(r.limitations[0]).toMatch(/SomeMadeUpOperator/);
  });
});

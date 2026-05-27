import { describe, expect, it } from "vitest";
import {
  detectDrift,
  diffAttributes,
  severityFor,
  type DeclaredResource,
  type ObservedResource,
} from "../driftDetector";

describe("diffAttributes", () => {
  it("returns sorted list of differing keys", () => {
    expect(diffAttributes({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 })).toEqual(["b"]);
    expect(diffAttributes({ a: 1, b: 2 }, { b: 99, c: 3 })).toEqual(["a", "b", "c"]);
  });
  it("treats deep-equal objects as equal", () => {
    expect(diffAttributes({ tag: { env: "prod", owner: "platform" } }, { tag: { env: "prod", owner: "platform" } })).toEqual([]);
  });
  it("treats deep-different objects as differing", () => {
    expect(diffAttributes({ tag: { env: "prod" } }, { tag: { env: "stage" } })).toEqual(["tag"]);
  });
  it("treats arrays element-wise", () => {
    expect(diffAttributes({ subnets: ["a", "b"] }, { subnets: ["a", "b"] })).toEqual([]);
    expect(diffAttributes({ subnets: ["a", "b"] }, { subnets: ["a", "c"] })).toEqual(["subnets"]);
  });
});

describe("severityFor", () => {
  it("sensitive drift → critical regardless of count", () => {
    expect(severityFor(1, true)).toBe("critical");
    expect(severityFor(1, true, "dev")).toBe("critical");
  });
  it("prod tier escalates severity", () => {
    expect(severityFor(1, false, "prod")).toBe("medium");
    expect(severityFor(3, false, "prod")).toBe("high");
  });
  it("non-prod uses count thresholds", () => {
    expect(severityFor(1, false, "dev")).toBe("low");
    expect(severityFor(2, false, "dev")).toBe("medium");
    expect(severityFor(5, false, "dev")).toBe("high");
  });
});

describe("detectDrift", () => {
  const decl = (over: Partial<DeclaredResource> = {}): DeclaredResource => ({
    resourceKind: "aws_resource",
    resourceId: "arn:aws:ec2:us-east-1:111:instance/i-abc",
    displayName: "web-server-1",
    applicationId: "app_web",
    environmentTier: "prod",
    attributes: { instance_type: "t3.medium", volume_type: "gp3" },
    ...over,
  });
  const obs = (over: Partial<ObservedResource> = {}): ObservedResource => ({
    resourceKind: "aws_resource",
    resourceId: "arn:aws:ec2:us-east-1:111:instance/i-abc",
    displayName: "web-server-1",
    attributes: { instance_type: "t3.medium", volume_type: "gp3" },
    ...over,
  });

  it("clean state → no findings, summary zeros", () => {
    const r = detectDrift({ declared: [decl()], observed: [obs()] });
    expect(r.findings).toEqual([]);
    expect(r.summary).toEqual({ totalResources: 1, driftedCount: 0, bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } });
  });

  it("attribute drift → finding with summarized message", () => {
    const r = detectDrift({
      declared: [decl()],
      observed: [obs({ attributes: { instance_type: "t3.medium", volume_type: "gp2" } })],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].differingKeys).toEqual(["volume_type"]);
    expect(r.findings[0].summary).toContain("volume_type changed");
    expect(r.findings[0].severity).toBe("medium"); // prod tier, 1 diff
  });

  it("sensitive-attribute drift → critical severity", () => {
    const r = detectDrift({
      declared: [decl({
        sensitiveAttributeKeys: ["security_group_ids"],
        attributes: { instance_type: "t3.medium", security_group_ids: ["sg-abc"] },
      })],
      observed: [obs({
        attributes: { instance_type: "t3.medium", security_group_ids: ["sg-abc", "sg-xyz-unknown"] },
      })],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].severity).toBe("critical");
    expect(r.findings[0].sensitiveDrift).toBe(true);
  });

  it("missingFromRuntime when declared but not observed", () => {
    const r = detectDrift({
      declared: [decl({ resourceId: "i-deleted" })],
      observed: [],
    });
    expect(r.findings).toEqual([]);
    expect(r.missingFromRuntime).toHaveLength(1);
    expect(r.missingFromRuntime[0].resourceId).toBe("i-deleted");
  });

  it("unmanagedDiscovered when observed but not declared", () => {
    const r = detectDrift({
      declared: [],
      observed: [obs({ resourceId: "i-out-of-band", displayName: "shadow-vm" })],
    });
    expect(r.findings).toEqual([]);
    expect(r.unmanagedDiscovered).toHaveLength(1);
    expect(r.unmanagedDiscovered[0].displayName).toBe("shadow-vm");
  });

  it("bySeverity buckets across mixed findings", () => {
    const r = detectDrift({
      declared: [
        decl({ resourceId: "r1", environmentTier: "prod" }), // 1 diff → medium
        decl({
          resourceId: "r2", environmentTier: "prod",
          attributes: { a: 1, b: 2, c: 3, d: 4 },
        }), // 4 diffs → high
        decl({
          resourceId: "r3", environmentTier: "dev",
          sensitiveAttributeKeys: ["x"], attributes: { x: 1 },
        }), // sensitive → critical
      ],
      observed: [
        obs({ resourceId: "r1", attributes: { instance_type: "t3.medium", volume_type: "gp2" } }),
        obs({ resourceId: "r2", attributes: { a: 9, b: 9, c: 9, d: 9 } }),
        obs({ resourceId: "r3", attributes: { x: 2 } }),
      ],
    });
    expect(r.findings).toHaveLength(3);
    expect(r.summary.bySeverity).toMatchObject({ medium: 1, high: 1, critical: 1 });
  });
});

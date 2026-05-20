/**
 * Vitest unit tests for the pure tag governance auditor.
 */

import { describe, it, expect } from "vitest";
import { auditTags, type TaggedResource } from "../tagGovernanceAuditor";

const R = (id: string, service: string, tags: Record<string, string> = {}): TaggedResource =>
  ({ id, service, tags });

describe("tagGovernanceAuditor", () => {
  it("empty input → coverage=1, zero counts", () => {
    const r = auditTags({ resources: [], requiredTagKeys: ["cost_center"] });
    expect(r.totalResources).toBe(0);
    expect(r.coverage).toBe(1);
    expect(r.totalMissing).toBe(0);
    expect(r.fullyTaggedCount).toBe(0);
  });

  it("flags resources missing required tags", () => {
    const r = auditTags({
      resources: [R("a", "svc", { env: "prod" }), R("b", "svc", { env: "prod", cost_center: "marketing" })],
      requiredTagKeys: ["env", "cost_center"],
    });
    expect(r.offenders.length).toBe(1);
    expect(r.offenders[0].resourceId).toBe("a");
    expect(r.offenders[0].missingTags).toEqual(["cost_center"]);
    expect(r.fullyTaggedCount).toBe(1);
    expect(r.totalMissing).toBe(1);
  });

  it("flags invalid value when pattern doesn't match", () => {
    const r = auditTags({
      resources: [R("a", "svc", { env: "PROD" })],
      requiredTagKeys: ["env"],
      valuePatterns: { env: /^(prod|stage|dev)$/ },
    });
    expect(r.offenders[0].invalidValueTags).toEqual(["env"]);
    expect(r.offenders[0].missingTags).toEqual([]);
    expect(r.totalInvalid).toBe(1);
  });

  it("treats empty-string tag value as missing", () => {
    const r = auditTags({
      resources: [R("a", "svc", { env: "" })],
      requiredTagKeys: ["env"],
    });
    expect(r.offenders[0].missingTags).toEqual(["env"]);
  });

  it("sorts offenders by issue count descending then by id", () => {
    const r = auditTags({
      resources: [
        R("zz", "svc"),                              // 2 missing
        R("aa", "svc", { env: "prod" }),             // 1 missing
        R("mm", "svc", { env: "prod", cc: "ok" }),   // fully tagged
      ],
      requiredTagKeys: ["env", "cc"],
    });
    expect(r.offenders.map((o) => o.resourceId)).toEqual(["zz", "aa"]);
  });

  it("coverage is fullyTagged / total", () => {
    const r = auditTags({
      resources: [
        R("a", "svc", { env: "prod" }),                       // missing cost_center
        R("b", "svc", { env: "prod", cost_center: "x" }),     // ok
        R("c", "svc", { env: "prod", cost_center: "y" }),     // ok
        R("d", "svc", { env: "prod", cost_center: "z" }),     // ok
      ],
      requiredTagKeys: ["env", "cost_center"],
    });
    expect(r.coverage).toBe(0.75);
  });

  it("no required tags → all resources fully tagged", () => {
    const r = auditTags({ resources: [R("a", "svc"), R("b", "svc", { x: "y" })], requiredTagKeys: [] });
    expect(r.coverage).toBe(1);
    expect(r.fullyTaggedCount).toBe(2);
  });
});

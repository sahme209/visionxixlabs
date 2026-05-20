/**
 * Vitest unit tests for the pure baseline differ.
 */

import { describe, it, expect } from "vitest";
import { diffAgainstBaseline, type BaselineSet, type ResourceConfig } from "../baselineDiffer";

const BASE: BaselineSet = {
  resourceType: "aws_s3_bucket",
  assertions: [
    { key: "encryption.atRest", expectedValue: true,  reason: "Encrypt-at-rest required." },
    { key: "versioning",        expectedValue: true,  reason: "Versioning required."     },
    { key: "publicAccessBlock", expectedValue: "all", reason: "PAB must be 'all'."        },
  ],
};

const R = (id: string, config: Record<string, unknown>): ResourceConfig => ({
  id, resourceType: "aws_s3_bucket", config,
});

describe("baselineDiffer", () => {
  it("no resources → ok severity, zero totals", () => {
    const r = diffAgainstBaseline({ resources: [], baselines: [BASE] });
    expect(r.totals).toEqual({ ok: 0, violation: 0, unknown: 0 });
    expect(r.severity).toBe("ok");
  });

  it("missing baseline for a resource type → resource skipped", () => {
    const r = diffAgainstBaseline({
      resources: [{ id: "x", resourceType: "unknown_type", config: { encryption: { atRest: true } } }],
      baselines: [BASE],
    });
    expect(r.rows.length).toBe(0);
  });

  it("baseline-compliant config → all ok", () => {
    const r = diffAgainstBaseline({
      resources: [R("a", { encryption: { atRest: true }, versioning: true, publicAccessBlock: "all" })],
      baselines: [BASE],
    });
    expect(r.totals.ok).toBe(3);
    expect(r.severity).toBe("ok");
  });

  it("wrong value → violation", () => {
    const r = diffAgainstBaseline({
      resources: [R("a", { encryption: { atRest: false }, versioning: true, publicAccessBlock: "all" })],
      baselines: [BASE],
    });
    const v = r.rows.find((row) => row.key === "encryption.atRest")!;
    expect(v.status).toBe("violation");
    expect(r.totals.violation).toBe(1);
    expect(r.severity).toBe("medium");
  });

  it("missing key → unknown", () => {
    const r = diffAgainstBaseline({
      resources: [R("a", { versioning: true, publicAccessBlock: "all" })], // missing encryption
      baselines: [BASE],
    });
    const u = r.rows.find((row) => row.key === "encryption.atRest")!;
    expect(u.status).toBe("unknown");
    expect(r.severity).toBe("low");
  });

  it("5+ violations → high severity", () => {
    const baseline: BaselineSet = {
      resourceType: "aws_s3_bucket",
      assertions: [
        { key: "a", expectedValue: true, reason: "" },
        { key: "b", expectedValue: true, reason: "" },
        { key: "c", expectedValue: true, reason: "" },
        { key: "d", expectedValue: true, reason: "" },
        { key: "e", expectedValue: true, reason: "" },
      ],
    };
    const r = diffAgainstBaseline({
      resources: [R("x", { a: false, b: false, c: false, d: false, e: false })],
      baselines: [baseline],
    });
    expect(r.severity).toBe("high");
  });

  it("perResource sorted by violations desc then unknowns desc", () => {
    const r = diffAgainstBaseline({
      resources: [
        R("clean", { encryption: { atRest: true }, versioning: true, publicAccessBlock: "all" }),
        R("violator", { encryption: { atRest: false }, versioning: false, publicAccessBlock: "all" }),
        R("ghost", {}),  // 3 unknowns
      ],
      baselines: [BASE],
    });
    expect(r.perResource[0].resourceId).toBe("violator");
    expect(r.perResource[1].resourceId).toBe("ghost");
    // "clean" has zero issues and shouldn't appear
    expect(r.perResource.find((p) => p.resourceId === "clean")).toBeUndefined();
  });

  it("nested key paths resolved correctly", () => {
    const r = diffAgainstBaseline({
      resources: [R("a", { encryption: { atRest: true }, versioning: true, publicAccessBlock: "all" })],
      baselines: [BASE],
    });
    const row = r.rows.find((x) => x.key === "encryption.atRest")!;
    expect(row.status).toBe("ok");
  });
});

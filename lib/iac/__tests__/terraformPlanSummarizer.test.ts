/**
 * Vitest unit tests for the pure terraform-plan summarizer.
 */

import { describe, it, expect } from "vitest";
import { summarizeTerraformPlan, type PlanResourceChange } from "../terraformPlanSummarizer";

const CHANGE = (address: string, provider: string, actions: string[]): PlanResourceChange => ({ address, provider, actions });

describe("terraformPlanSummarizer", () => {
  it("empty input → noop severity", () => {
    const r = summarizeTerraformPlan([]);
    expect(r.rows.length).toBe(0);
    expect(r.severity).toBe("noop");
  });

  it("create only → low severity", () => {
    const r = summarizeTerraformPlan([CHANGE("aws_s3_bucket.a", "aws", ["create"])]);
    expect(r.severity).toBe("low");
    expect(r.counts.create).toBe(1);
  });

  it("single delete → medium severity (1 destructive)", () => {
    const r = summarizeTerraformPlan([CHANGE("aws_s3_bucket.a", "aws", ["delete"])]);
    expect(r.severity).toBe("medium");
    expect(r.destructive.length).toBe(1);
  });

  it("five+ destructive → high severity", () => {
    const r = summarizeTerraformPlan([
      CHANGE("a", "aws", ["delete"]),
      CHANGE("b", "aws", ["delete"]),
      CHANGE("c", "aws", ["delete"]),
      CHANGE("d", "aws", ["delete"]),
      CHANGE("e", "aws", ["delete"]),
    ]);
    expect(r.severity).toBe("high");
    expect(r.destructive.length).toBe(5);
  });

  it("delete+create normalized to 'replace'", () => {
    const r = summarizeTerraformPlan([CHANGE("a", "aws", ["delete", "create"])]);
    expect(r.rows[0].kind).toBe("replace");
    expect(r.destructive.length).toBe(1);
  });

  it("counts per provider", () => {
    const r = summarizeTerraformPlan([
      CHANGE("aws_x.a", "aws", ["create"]),
      CHANGE("aws_x.b", "aws", ["update"]),
      CHANGE("google_x.a", "google", ["create"]),
    ]);
    expect(r.byProvider).toEqual([{ provider: "aws", count: 2 }, { provider: "google", count: 1 }]);
  });

  it("unknown actions fall through to 'no-op'", () => {
    const r = summarizeTerraformPlan([CHANGE("a", "aws", ["something-weird"])]);
    expect(r.rows[0].kind).toBe("no-op");
    expect(r.severity).toBe("noop");
  });

  it("'read' is non-destructive, non-mutating → noop", () => {
    const r = summarizeTerraformPlan([CHANGE("a", "aws", ["read"])]);
    expect(r.rows[0].kind).toBe("read");
    expect(r.severity).toBe("noop");
  });
});

/**
 * Vitest unit tests for the pure proposal-impact tracker.
 */

import { describe, it, expect } from "vitest";
import { buildImpactReport, type RawImpactRow } from "../proposalImpactTracker";

const ROW = (target: RawImpactRow["target"], status: RawImpactRow["status"], updatedAt: string): RawImpactRow =>
  ({ target, status, updatedAt });

describe("proposal impact tracker", () => {
  it("empty input → zero totals + zeroed per-target rows", () => {
    const r = buildImpactReport([]);
    expect(r.totals.total).toBe(0);
    expect(r.funnel.pending).toBe(0);
    expect(r.perTarget.length).toBe(5);
    expect(r.perTarget.every((t) => t.total === 0 && t.lastActivityAt === null)).toBe(true);
  });

  it("counts per status across the full population", () => {
    const r = buildImpactReport([
      ROW("runbook_recipe", "pending", "2026-05-20T01:00:00.000Z"),
      ROW("runbook_recipe", "approved", "2026-05-20T02:00:00.000Z"),
      ROW("runbook_recipe", "applied", "2026-05-20T03:00:00.000Z"),
      ROW("runbook_recipe", "rejected", "2026-05-20T04:00:00.000Z"),
    ]);
    expect(r.totals).toEqual({ pending: 1, approved: 1, applied: 1, rejected: 1, superseded: 0, total: 4 });
    expect(r.funnel).toEqual({ pending: 1, approved: 1, applied: 1 });
  });

  it("computes ship rate = applied / (approved + applied + rejected)", () => {
    const r = buildImpactReport([
      ROW("policy_template", "approved", "2026-05-20T01:00:00.000Z"),
      ROW("policy_template", "applied", "2026-05-20T02:00:00.000Z"),
      ROW("policy_template", "applied", "2026-05-20T03:00:00.000Z"),
      ROW("policy_template", "rejected", "2026-05-20T04:00:00.000Z"),
    ]);
    const t = r.perTarget.find((x) => x.target === "policy_template")!;
    expect(t.shipRate).toBeCloseTo(2 / 4, 5);
    expect(t.approvalRate).toBeCloseTo(1 / 4, 5);
  });

  it("ship rate is 0 when nothing is decided yet (only pending)", () => {
    const r = buildImpactReport([
      ROW("charter_default", "pending", "2026-05-20T01:00:00.000Z"),
      ROW("charter_default", "pending", "2026-05-20T02:00:00.000Z"),
    ]);
    const t = r.perTarget.find((x) => x.target === "charter_default")!;
    expect(t.pending).toBe(2);
    expect(t.shipRate).toBe(0);
    expect(t.approvalRate).toBe(0);
  });

  it("tracks lastActivityAt as the max updatedAt within the target", () => {
    const r = buildImpactReport([
      ROW("help_entry", "approved", "2026-05-20T01:00:00.000Z"),
      ROW("help_entry", "approved", "2026-05-20T09:00:00.000Z"),
      ROW("help_entry", "approved", "2026-05-20T03:00:00.000Z"),
    ]);
    const t = r.perTarget.find((x) => x.target === "help_entry")!;
    expect(t.lastActivityAt).toBe("2026-05-20T09:00:00.000Z");
  });

  it("ignores rows with unknown target", () => {
    const r = buildImpactReport([
      { target: "not_a_target" as RawImpactRow["target"], status: "approved", updatedAt: "2026-05-20T01:00:00.000Z" },
      ROW("tier_cap", "approved", "2026-05-20T02:00:00.000Z"),
    ]);
    expect(r.totals.total).toBe(1);
    expect(r.perTarget.find((t) => t.target === "tier_cap")!.approved).toBe(1);
  });

  it("always emits all 5 target rows even when none have data", () => {
    const r = buildImpactReport([
      ROW("tier_cap", "approved", "2026-05-20T01:00:00.000Z"),
    ]);
    expect(r.perTarget.length).toBe(5);
    expect(r.perTarget.map((t) => t.target)).toEqual([
      "runbook_recipe", "policy_template", "charter_default", "help_entry", "tier_cap",
    ]);
  });
});

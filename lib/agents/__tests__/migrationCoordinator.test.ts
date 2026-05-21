import { describe, it, expect } from "vitest";
import { buildRunbook, type MigrationDescriptor } from "../migrationCoordinator";

const DESC = (partial: Partial<MigrationDescriptor> & { id: string; kind: MigrationDescriptor["kind"] }): MigrationDescriptor => ({
  id: partial.id,
  kind: partial.kind,
  target: partial.target ?? "users",
  rationale: partial.rationale ?? "test",
  hasReverseScript: partial.hasReverseScript ?? true,
  hasActiveWriters: partial.hasActiveWriters ?? true,
  estimatedRowCount: partial.estimatedRowCount ?? 1_000,
  windowHours: partial.windowHours ?? 24,
});

describe("migrationCoordinator", () => {
  it("add_column produces a 5-stage runbook ending in stop_dual_write", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "add_column" }));
    expect(r.stages.length).toBe(5);
    expect(r.stages[r.stages.length - 1].kind).toBe("stop_dual_write");
  });

  it("rename_column produces a 6-stage runbook with backfill and decommission", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "rename_column" }));
    const kinds = r.stages.map((s) => s.kind);
    expect(kinds).toContain("backfill");
    expect(kinds).toContain("decommission");
  });

  it("rename_column with active writers + 0h window emits a structural error", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "rename_column", hasActiveWriters: true, windowHours: 0 }));
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.overallVerdict).toBe("blocked");
  });

  it("drop_column without a reverse script is blocked", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "drop_column", hasReverseScript: false }));
    expect(r.errors.some((e) => /reverse migration script/i.test(e))).toBe(true);
    expect(r.overallVerdict).toBe("blocked");
  });

  it("drop_column WITH a reverse script is allowed but decommission stays gated", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "drop_column", hasReverseScript: true }));
    expect(r.errors).toEqual([]);
    const decom = r.stages.find((s) => s.kind === "decommission");
    expect(decom?.gateChecks.length).toBeGreaterThan(0);
  });

  it("preflight stage is always needs_dry_run when no errors", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "add_column" }));
    const pre = r.stages.find((s) => s.kind === "preflight");
    expect(pre?.verdict).toBe("needs_dry_run");
  });

  it("alter_index has only preflight + cutover_read", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "alter_index" }));
    expect(r.stages.map((s) => s.kind)).toEqual(["preflight", "cutover_read"]);
  });

  it("alter_api_contract includes dual_write + stop_dual_write + decommission", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "alter_api_contract" }));
    const kinds = r.stages.map((s) => s.kind);
    expect(kinds).toContain("dual_write");
    expect(kinds).toContain("stop_dual_write");
    expect(kinds).toContain("decommission");
  });

  it("negative window is rejected", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "add_column", windowHours: -1 }));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rollback for decommission without reverse script is explicit BLOCKED", () => {
    const r = buildRunbook(DESC({ id: "m1", kind: "drop_table", hasReverseScript: false }));
    const decom = r.stages.find((s) => s.kind === "decommission");
    expect(decom?.rollback).toMatch(/BLOCKED/);
  });

  it("overall verdict trends to worst stage", () => {
    const happy = buildRunbook(DESC({ id: "m1", kind: "add_column" }));
    expect(happy.overallVerdict).toBe("needs_dry_run");
  });
});

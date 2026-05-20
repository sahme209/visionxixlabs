/**
 * Vitest unit tests for the pure tenant data export builder.
 */

import { describe, it, expect } from "vitest";
import { buildTenantDataExport, type TenantDataExportInput } from "../tenantDataExportBuilder";

const FIXED: TenantDataExportInput = {
  tenantId: "tenant-42",
  generatedAt: "2026-05-20T12:00:00.000Z",
  slices: {
    proposals: [{ id: "p-1", target: "runbook_recipe", status: "approved" }],
    busMessages: [{ id: "m-1", sender: "detector", kind: "broadcast_signal" }],
    rationaleRows: [{ id: "r-1", decisionKind: "approve_proposal" }],
    outboundRecords: [{ id: "o-1", kind: "approval_packet_ready", outcome: "ok" }],
    billingPlan: { tier: "growth", capRemaining: 80_000 },
  },
};

describe("tenantDataExportBuilder", () => {
  it("emits the schema + safety contract + tenant id", () => {
    const e = buildTenantDataExport(FIXED);
    expect(e.schema).toBe("axiom.tenant.data_export");
    expect(e.schemaVersion).toBe(1);
    expect(e.safetyContract).toBe("audit_read_only");
    expect(e.tenantId).toBe("tenant-42");
  });

  it("counts every slice", () => {
    const e = buildTenantDataExport(FIXED);
    expect(e.counts).toEqual({ proposals: 1, busMessages: 1, rationaleRows: 1, outboundRecords: 1 });
  });

  it("integrityHash is deterministic for identical inputs", () => {
    const a = buildTenantDataExport(FIXED).integrityHash;
    const b = buildTenantDataExport(FIXED).integrityHash;
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("integrityHash changes when content changes", () => {
    const base = buildTenantDataExport(FIXED).integrityHash;
    const mutated = buildTenantDataExport({
      ...FIXED,
      slices: { ...FIXED.slices, proposals: [...FIXED.slices.proposals, { id: "p-2", target: "policy_template", status: "rejected" }] },
    }).integrityHash;
    expect(base).not.toBe(mutated);
  });

  it("uses default scopeNote when none supplied", () => {
    const e = buildTenantDataExport(FIXED);
    expect(e.scopeNote.toLowerCase()).toContain("approval-only-no-execution");
  });

  it("respects operator-supplied scopeNote", () => {
    const e = buildTenantDataExport({ ...FIXED, scopeNote: "GDPR DSAR #99" });
    expect(e.scopeNote).toBe("GDPR DSAR #99");
  });

  it("slices are preserved verbatim in the output", () => {
    const e = buildTenantDataExport(FIXED);
    expect(e.slices).toEqual(FIXED.slices);
  });
});

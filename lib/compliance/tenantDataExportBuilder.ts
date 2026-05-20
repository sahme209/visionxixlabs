/**
 * Pure tenant data export builder.
 *
 * GDPR-style "give me everything you have about my tenant" assembly.
 * Caller fetches raw rows from Prisma per slice; this module shapes
 * them into a single deterministic JSON document with an integrity
 * hash over a canonical-key-sorted body — same property as the
 * compliance evidence packet.
 *
 * Pure. No DB.
 */

import { createHash } from "node:crypto";

export interface TenantDataExportInput {
  tenantId: string;
  generatedAt: string;
  /** Operator-readable description of what slices the operator chose. */
  scopeNote?: string;
  slices: {
    proposals: readonly unknown[];
    busMessages: readonly unknown[];
    rationaleRows: readonly unknown[];
    outboundRecords: readonly unknown[];
    billingPlan: unknown;
  };
}

export interface TenantDataExport {
  schema: "axiom.tenant.data_export";
  schemaVersion: 1;
  tenantId: string;
  generatedAt: string;
  safetyContract: "audit_read_only";
  scopeNote: string;
  counts: {
    proposals: number;
    busMessages: number;
    rationaleRows: number;
    outboundRecords: number;
  };
  slices: TenantDataExportInput["slices"];
  integrityHash: string;
}

const sortJson = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(sortJson);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortJson(obj[k]);
    return out;
  }
  return input;
};

const canonicalJson = (input: unknown): string => JSON.stringify(sortJson(input));

export function buildTenantDataExport(input: TenantDataExportInput): TenantDataExport {
  const body: Omit<TenantDataExport, "integrityHash"> = {
    schema: "axiom.tenant.data_export",
    schemaVersion: 1,
    tenantId: input.tenantId,
    generatedAt: input.generatedAt,
    safetyContract: "audit_read_only",
    scopeNote: input.scopeNote ?? "Full tenant data export. Approval-only-no-execution platform — no operator decisions are reversed by this export.",
    counts: {
      proposals: input.slices.proposals.length,
      busMessages: input.slices.busMessages.length,
      rationaleRows: input.slices.rationaleRows.length,
      outboundRecords: input.slices.outboundRecords.length,
    },
    slices: input.slices,
  };
  const integrityHash = createHash("sha256").update(canonicalJson(body)).digest("hex");
  return { ...body, integrityHash };
}

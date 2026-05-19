/**
 * Decision rationale CSV exporter.
 *
 * Pure-function CSV builder for the Prisma-backed
 * AutonomyDecisionRationale rows. Compliance reviewers paste this
 * into their auditor template; the format is intentionally minimal
 * (no rich types) so any spreadsheet tool can ingest it.
 *
 * Hard rules:
 *   - Pure: no DB call, no I/O. Caller fetches rows + feeds them in.
 *   - RFC 4180 quoting: every field is wrapped in quotes, internal
 *     `"` characters are escaped as `""`, embedded newlines stay.
 *   - Column order is stable. Adding a new column is an explicit edit.
 */

export interface RationaleCsvRow {
  id: string;
  candidateId: string;
  title: string;
  charterMode: string;
  boundaryClass: string;
  outcome: string;
  haltedAtStage?: string | null;
  haltReason?: string | null;
  proposedIntent: string;
  durationMs: number;
  evidenceRefs: string[];
  createdAt: string;
}

const COLUMNS: Array<{ header: string; pick: (r: RationaleCsvRow) => string }> = [
  { header: "id",             pick: (r) => r.id },
  { header: "candidate_id",   pick: (r) => r.candidateId },
  { header: "title",          pick: (r) => r.title },
  { header: "charter_mode",   pick: (r) => r.charterMode },
  { header: "boundary_class", pick: (r) => r.boundaryClass },
  { header: "outcome",        pick: (r) => r.outcome },
  { header: "halted_at_stage",pick: (r) => r.haltedAtStage ?? "" },
  { header: "halt_reason",    pick: (r) => r.haltReason ?? "" },
  { header: "proposed_intent",pick: (r) => r.proposedIntent },
  { header: "duration_ms",    pick: (r) => String(r.durationMs) },
  { header: "evidence_refs",  pick: (r) => r.evidenceRefs.join(" | ") },
  { header: "created_at",     pick: (r) => r.createdAt },
];

export function buildRationaleCsv(rows: RationaleCsvRow[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.map((c) => quote(c.header)).join(","));
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => quote(c.pick(r))).join(","));
  }
  // CRLF line endings match RFC 4180 and Excel's expectations.
  return lines.join("\r\n") + "\r\n";
}

function quote(value: string): string {
  // Replace inner double-quotes with doubled double-quotes per RFC 4180.
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Audit log export for owners and admins (enterprise: SIEM import, auditor requests). Pure.
 *
 * Exports the same fields the Audit & Security page shows: no detail payloads. CSV cells that a
 * spreadsheet would treat as formulas are prefixed with an apostrophe.
 */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;
export const AUDIT_EXPORT_DAYS = [1, 7, 30, 90] as const;
export type AuditExportFormat = "csv" | "ndjson";
export interface AuditExportRow { id: string; occurredAt: Date; action: string; outcome: string; actorKind: string | null; actorUserId: string | null; entityRef: string | null; correlationId: string | null; source: string | null; errorCode: string | null }

export const AUDIT_EXPORT_COLUMNS = ["occurredAt", "action", "outcome", "actorKind", "actorUserId", "entityRef", "correlationId", "source", "errorCode", "id"] as const;

function csvCell(value: string | null): string {
  if (value === null) return "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const plain = (r: AuditExportRow) => ({ occurredAt: r.occurredAt.toISOString(), action: r.action, outcome: r.outcome, actorKind: r.actorKind, actorUserId: r.actorUserId, entityRef: r.entityRef, correlationId: r.correlationId, source: r.source, errorCode: r.errorCode, id: r.id });

export function serializeAuditExport(rows: readonly AuditExportRow[], format: AuditExportFormat): string {
  if (format === "ndjson") return rows.map((r) => JSON.stringify(plain(r))).join("\n") + (rows.length ? "\n" : "");
  const lines = [AUDIT_EXPORT_COLUMNS.join(",")];
  for (const r of rows) { const p = plain(r); lines.push(AUDIT_EXPORT_COLUMNS.map((c) => csvCell(p[c])).join(",")); }
  return lines.join("\r\n") + "\r\n";
}

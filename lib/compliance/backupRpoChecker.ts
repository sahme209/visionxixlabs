/**
 * Pure backup / RPO compliance checker.
 *
 * For each data resource, confirm its most-recent successful backup is
 * within the declared RPO (recovery point objective). Flag overdue
 * backups + missing-history entries.
 *
 * Pure / deterministic. No DB / network.
 */

export interface BackupTarget {
  resourceId: string;
  resourceLabel: string;
  /** RPO in hours. */
  rpoHours: number;
}

export interface BackupRun {
  resourceId: string;
  succeededAtIso: string;
  sizeBytes: number;
}

export interface BackupComplianceRow {
  resourceId: string;
  resourceLabel: string;
  rpoHours: number;
  lastSuccessAt: string | null;
  hoursSinceLastSuccess: number | null;
  status: "ok" | "approaching" | "overdue" | "no_backups";
}

export interface BackupComplianceReport {
  rows: BackupComplianceRow[];
  totals: { ok: number; approaching: number; overdue: number; no_backups: number };
  severity: "ok" | "low" | "medium" | "high";
}

const HOUR_MS = 60 * 60 * 1000;

function statusOf(hoursSince: number | null, rpoHours: number): BackupComplianceRow["status"] {
  if (hoursSince === null) return "no_backups";
  if (hoursSince > rpoHours) return "overdue";
  // Within 20% of RPO → approaching.
  if (hoursSince >= rpoHours * 0.8) return "approaching";
  return "ok";
}

function severityOf(t: BackupComplianceReport["totals"]): BackupComplianceReport["severity"] {
  if (t.overdue + t.no_backups >= 3) return "high";
  if (t.overdue + t.no_backups >= 1) return "medium";
  if (t.approaching > 0) return "low";
  return "ok";
}

export function checkBackupCompliance(input: {
  targets: readonly BackupTarget[];
  runs: readonly BackupRun[];
  nowIso?: string;
}): BackupComplianceReport {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const latestByResource = new Map<string, Date>();
  for (const r of input.runs) {
    const at = new Date(r.succeededAtIso);
    const cur = latestByResource.get(r.resourceId);
    if (!cur || at > cur) latestByResource.set(r.resourceId, at);
  }

  const rows: BackupComplianceRow[] = [];
  const totals = { ok: 0, approaching: 0, overdue: 0, no_backups: 0 };

  for (const t of input.targets) {
    const last = latestByResource.get(t.resourceId) ?? null;
    const hoursSince = last
      ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / HOUR_MS))
      : null;
    const status = statusOf(hoursSince, t.rpoHours);
    rows.push({
      resourceId: t.resourceId,
      resourceLabel: t.resourceLabel,
      rpoHours: t.rpoHours,
      lastSuccessAt: last ? last.toISOString() : null,
      hoursSinceLastSuccess: hoursSince,
      status,
    });
    totals[status] += 1;
  }

  // Sort: no_backups → overdue → approaching → ok.
  const rank: Record<BackupComplianceRow["status"], number> = { no_backups: 0, overdue: 1, approaching: 2, ok: 3 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.resourceLabel < b.resourceLabel ? -1 : 1));

  return { rows, totals, severity: severityOf(totals) };
}

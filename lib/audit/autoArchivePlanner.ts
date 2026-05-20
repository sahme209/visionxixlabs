/**
 * Pure auto-archive planner.
 *
 * Given a list of audit records + a retention policy, decide which
 * records are eligible to archive (older than retentionDays AND in a
 * terminal status). Operators apply the plan via a separate step —
 * this module only PLANS, it never deletes.
 *
 * Pure / deterministic. No DB.
 */

export type ArchiveStatus = "active" | "decided" | "archived" | "expired";

export interface ArchiveCandidate {
  id: string;
  kind: string;
  status: ArchiveStatus;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export interface ArchivePlanInput {
  records: readonly ArchiveCandidate[];
  retentionDays: number;
  now?: string;            // ISO; defaults to "now"
  /** Statuses considered terminal for archiving. Default ["decided", "expired"]. */
  terminalStatuses?: readonly ArchiveStatus[];
}

export interface ArchivePlanRow {
  id: string;
  kind: string;
  status: ArchiveStatus;
  /** Reason this row is or isn't eligible. */
  reason: "eligible" | "too_recent" | "not_terminal" | "already_archived";
  ageDays: number;
}

export interface ArchivePlan {
  totalConsidered: number;
  eligibleCount: number;
  byKind: Array<{ kind: string; eligible: number; total: number }>;
  rows: ArchivePlanRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const ageDaysOf = (updatedAt: string, now: Date): number =>
  Math.floor((now.getTime() - new Date(updatedAt).getTime()) / DAY_MS);

export function planAutoArchive(input: ArchivePlanInput): ArchivePlan {
  const now = input.now ? new Date(input.now) : new Date();
  const retentionDays = Math.max(0, input.retentionDays);
  const terminal = new Set<ArchiveStatus>(input.terminalStatuses ?? ["decided", "expired"]);

  const perKind = new Map<string, { eligible: number; total: number }>();
  const rows: ArchivePlanRow[] = [];

  for (const r of input.records) {
    const ageDays = ageDaysOf(r.updatedAt, now);
    let reason: ArchivePlanRow["reason"];
    if (r.status === "archived") reason = "already_archived";
    else if (!terminal.has(r.status)) reason = "not_terminal";
    else if (ageDays < retentionDays) reason = "too_recent";
    else reason = "eligible";

    rows.push({ id: r.id, kind: r.kind, status: r.status, reason, ageDays });
    const k = perKind.get(r.kind) ?? { eligible: 0, total: 0 };
    k.total += 1;
    if (reason === "eligible") k.eligible += 1;
    perKind.set(r.kind, k);
  }

  const eligibleCount = rows.filter((r) => r.reason === "eligible").length;
  const byKind = [...perKind.entries()]
    .map(([kind, v]) => ({ kind, eligible: v.eligible, total: v.total }))
    .sort((a, b) => b.eligible - a.eligible);

  return { totalConsidered: input.records.length, eligibleCount, byKind, rows };
}

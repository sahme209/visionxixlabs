/**
 * Pure GDPR Data-Subject-Request workflow tracker.
 *
 * EU GDPR Art 12-22: a data subject can ask for access / portability
 * / erasure / rectification. The controller has 30 days (with up to
 * 60 days extension when justified). This module folds open DSRs +
 * verification status + per-system tracker rows into a typed
 * workflow report.
 *
 * Pure / deterministic.
 */

export type DsrKind = "access" | "portability" | "erasure" | "rectification" | "restriction" | "objection";

export type SystemStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface SystemTrackerRow {
  systemId: string;        // e.g. "postgres-prod"
  status: SystemStatus;
  /** ISO of last status update. */
  lastUpdatedIso: string;
  blockedReason?: string;
}

export interface DsrRecord {
  id: string;
  /** Pseudonymous subject id (never the raw email). */
  subjectId: string;
  kind: DsrKind;
  /** ISO timestamp the DSR was opened. */
  openedAtIso: string;
  /** True iff the requester's identity has been verified. */
  identityVerified: boolean;
  /** True iff an extension to the 30-day deadline was granted. */
  extensionGranted: boolean;
  systems: readonly SystemTrackerRow[];
  closedAtIso?: string;
}

export interface DsrRow {
  id: string;
  kind: DsrKind;
  subjectId: string;
  /** Days remaining before the legal deadline. Negative = breached. */
  daysRemaining: number;
  daysSinceOpened: number;
  systemsTotal: number;
  systemsCompleted: number;
  systemsBlocked: number;
  status: "draft" | "verifying" | "in_progress" | "completed" | "overdue" | "blocked";
  /** True iff every system completed. */
  ready: boolean;
}

export interface DsrReport {
  rows: DsrRow[];
  overdueCount: number;
  /** Earliest deadline approaching across the open population. */
  nextDeadlineIso: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_DEADLINE_DAYS = 30;
const EXTENDED_DEADLINE_DAYS = 60;

function statusOf(input: {
  identityVerified: boolean;
  systems: readonly SystemTrackerRow[];
  daysRemaining: number;
  closedAtIso?: string;
}): DsrRow["status"] {
  if (input.closedAtIso) return "completed";
  if (input.daysRemaining < 0) return "overdue";
  if (!input.identityVerified) return "verifying";
  if (input.systems.length === 0) return "draft";
  if (input.systems.every((s) => s.status === "completed")) return "completed";
  if (input.systems.some((s) => s.status === "blocked")) return "blocked";
  return "in_progress";
}

export function trackDsrs(input: {
  records: readonly DsrRecord[];
  nowIso?: string;
}): DsrReport {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const rows: DsrRow[] = [];
  let overdueCount = 0;
  let earliestDeadline: number | null = null;

  for (const r of input.records) {
    const opened = new Date(r.openedAtIso);
    const deadlineDays = r.extensionGranted ? EXTENDED_DEADLINE_DAYS : BASE_DEADLINE_DAYS;
    const deadlineMs = opened.getTime() + deadlineDays * DAY_MS;
    const daysRemaining = Math.ceil((deadlineMs - now.getTime()) / DAY_MS);
    const daysSinceOpened = Math.floor((now.getTime() - opened.getTime()) / DAY_MS);

    const completed = r.systems.filter((s) => s.status === "completed").length;
    const blocked = r.systems.filter((s) => s.status === "blocked").length;

    const status = statusOf({
      identityVerified: r.identityVerified,
      systems: r.systems,
      daysRemaining,
      closedAtIso: r.closedAtIso,
    });
    if (status === "overdue") overdueCount += 1;

    if (!r.closedAtIso) {
      if (earliestDeadline === null || deadlineMs < earliestDeadline) earliestDeadline = deadlineMs;
    }

    rows.push({
      id: r.id,
      kind: r.kind,
      subjectId: r.subjectId,
      daysRemaining,
      daysSinceOpened,
      systemsTotal: r.systems.length,
      systemsCompleted: completed,
      systemsBlocked: blocked,
      status,
      ready: status === "completed",
    });
  }

  rows.sort((a, b) => {
    const rank: Record<DsrRow["status"], number> = {
      overdue: 0, blocked: 1, verifying: 2, draft: 3, in_progress: 4, completed: 5,
    };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.daysRemaining - b.daysRemaining;
  });

  return {
    rows,
    overdueCount,
    nextDeadlineIso: earliestDeadline === null ? null : new Date(earliestDeadline).toISOString(),
  };
}

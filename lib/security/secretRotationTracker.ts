/**
 * Pure secret-rotation tracker.
 *
 * Walks a list of secrets (label + lastRotatedAt + maxAgeDays) and
 * categorizes each as ok / due_soon / overdue. Reports the next
 * action's earliest dueDate so the cockpit can show a hard deadline.
 *
 * Pure / deterministic. No DB.
 */

export interface SecretRecord {
  id: string;
  label: string;
  /** ISO timestamp of the last rotation. */
  lastRotatedAt: string;
  /** Max age in days before rotation is required. */
  maxAgeDays: number;
}

export interface SecretStatus {
  id: string;
  label: string;
  ageDays: number;
  dueInDays: number;       // Negative = overdue.
  status: "ok" | "due_soon" | "overdue";
  nextDueAt: string;       // ISO of when rotation becomes due.
}

export interface SecretRotationReport {
  rows: SecretStatus[];
  okCount: number;
  dueSoonCount: number;
  overdueCount: number;
  /** Earliest nextDueAt across all rows (or null when empty). */
  nextActionDueAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;

const isoOf = (d: Date): string => d.toISOString();

export function trackSecretRotation(input: { secrets: readonly SecretRecord[]; now?: string }): SecretRotationReport {
  const now = input.now ? new Date(input.now) : new Date();
  const rows: SecretStatus[] = [];

  for (const s of input.secrets) {
    const last = new Date(s.lastRotatedAt);
    const ageDays = Math.floor((now.getTime() - last.getTime()) / DAY_MS);
    const dueInDays = s.maxAgeDays - ageDays;
    const nextDueAt = isoOf(new Date(last.getTime() + s.maxAgeDays * DAY_MS));
    const status: SecretStatus["status"] =
      dueInDays < 0 ? "overdue"
      : dueInDays <= DUE_SOON_DAYS ? "due_soon"
      : "ok";
    rows.push({ id: s.id, label: s.label, ageDays, dueInDays, status, nextDueAt });
  }

  rows.sort((a, b) => a.dueInDays - b.dueInDays);

  const okCount = rows.filter((r) => r.status === "ok").length;
  const dueSoonCount = rows.filter((r) => r.status === "due_soon").length;
  const overdueCount = rows.filter((r) => r.status === "overdue").length;
  const nextActionDueAt = rows.length === 0 ? null : rows[0].nextDueAt;

  return { rows, okCount, dueSoonCount, overdueCount, nextActionDueAt };
}

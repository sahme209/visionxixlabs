/**
 * Pure 30-day summary of recorded workflow executions for the Deployments KPI
 * tiles. Only recorded facts are counted: a run is succeeded or failed only
 * when its stored conclusion says so and it has a completion time; duration is
 * recorded creation to recorded completion (queue time included).
 */
export const OUTCOME_WINDOW_DAYS = 30;
export const OUTCOME_ROW_LIMIT = 5000;
export interface ExecutionOutcomeRow { status: string; conclusion: string | null; createdAt: Date; completedAt: Date | null }
export interface DeploymentOutcomeSummary {
  windowDays: number;
  recorded: number;
  inProgress: number;
  succeeded: number;
  failed: number;
  successRate: number | null;
  medianSeconds: number | null;
  truncated: boolean;
  /** Recorded runs created per UTC day, oldest first, one entry per day of the window. */
  daily: number[];
  /** Recorded runs created in the 30 days before this window, or null when unknown. */
  previousRecorded: number | null;
}
const FAILED = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);
const ACTIVE = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);

export function summarizeDeploymentOutcomes(rows: readonly ExecutionOutcomeRow[], truncated: boolean, now: Date = new Date(), previousRecorded: number | null = null): DeploymentOutcomeSummary {
  let inProgress = 0, succeeded = 0, failed = 0;
  const daily = new Array<number>(OUTCOME_WINDOW_DAYS).fill(0);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const row of rows) {
    const day = Date.UTC(row.createdAt.getUTCFullYear(), row.createdAt.getUTCMonth(), row.createdAt.getUTCDate());
    const index = OUTCOME_WINDOW_DAYS - 1 - Math.round((today - day) / 86_400_000);
    if (index >= 0 && index < OUTCOME_WINDOW_DAYS) daily[index]++;
  }
  const durations: number[] = [];
  for (const row of rows) {
    const done = row.completedAt instanceof Date && !Number.isNaN(row.completedAt.getTime());
    if (!done) { if (ACTIVE.has(row.status)) inProgress++; continue; }
    if (row.conclusion === "success") succeeded++;
    else if (row.conclusion && FAILED.has(row.conclusion)) failed++;
    else continue;
    const seconds = (row.completedAt!.getTime() - row.createdAt.getTime()) / 1000;
    if (Number.isFinite(seconds) && seconds >= 0) durations.push(seconds);
  }
  durations.sort((a, b) => a - b);
  const mid = durations.length >> 1;
  const medianSeconds = durations.length === 0 ? null : Math.round(durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2);
  const decided = succeeded + failed;
  return { windowDays: OUTCOME_WINDOW_DAYS, recorded: rows.length, inProgress, succeeded, failed,
    successRate: decided === 0 ? null : Math.round((succeeded / decided) * 1000) / 10, medianSeconds, truncated,
    daily, previousRecorded: truncated ? null : previousRecorded };
}

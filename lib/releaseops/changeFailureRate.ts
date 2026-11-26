/**
 * Change failure rate from recorded releases (pure). A finished release counts as a failed change
 * when it ended failed or rolled back, or when an incident was reported against it. Releases that
 * never finished are not counted. This is a recorded signal, not DORA certification.
 */
export interface FinishedRelease { id: string; status: string; actualDeployEnd: Date | null }
export interface ChangeFailureSummary { finished: number; failedChanges: number; byReason: { failedOrRolledBack: number; incidentOnly: number }; ratePercent: number | null }

const FINISHED = new Set(["deployed", "failed", "rolled_back"]);

export function changeFailureRate(releases: readonly FinishedRelease[], releaseIdsWithIncidents: ReadonlySet<string>): ChangeFailureSummary {
  const finished = releases.filter((r) => FINISHED.has(r.status) && r.actualDeployEnd);
  let failedOrRolledBack = 0, incidentOnly = 0;
  for (const r of finished) {
    if (r.status === "failed" || r.status === "rolled_back") failedOrRolledBack += 1;
    else if (releaseIdsWithIncidents.has(r.id)) incidentOnly += 1;
  }
  const failedChanges = failedOrRolledBack + incidentOnly;
  return { finished: finished.length, failedChanges, byReason: { failedOrRolledBack, incidentOnly }, ratePercent: finished.length ? Math.round((failedChanges / finished.length) * 1000) / 10 : null };
}

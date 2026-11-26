/**
 * Stability early warning (agentic automation priority 4). Pure.
 *
 * Compares the change failure rate of the last 7 days with the 90 days before it. When recent
 * changes fail noticeably more often, V19 raises a warning on the Overview and Insights and asks for a
 * reason before production deployments, so teams slow down before an incident instead of after.
 * Small samples never warn: at least 3 recent failed changes are needed.
 */
import { changeFailureRate, type FinishedRelease } from "./changeFailureRate";

export const RECENT_DAYS = 7;
export const BASELINE_DAYS = 90;
export type StabilityLevel = "steady" | "elevated" | "insufficient_data";
export interface StabilityWarning {
  level: StabilityLevel;
  recent: { finished: number; failed: number; ratePercent: number | null };
  baseline: { finished: number; failed: number; ratePercent: number | null };
  message: string;
}

export function stabilityWarning(releases: readonly FinishedRelease[], releaseIdsWithIncidents: ReadonlySet<string>, now: Date): StabilityWarning {
  const recentStart = now.getTime() - RECENT_DAYS * 86_400_000;
  const baselineStart = recentStart - BASELINE_DAYS * 86_400_000;
  const inRange = (from: number, to: number) => releases.filter((r) => r.actualDeployEnd && r.actualDeployEnd.getTime() >= from && r.actualDeployEnd.getTime() < to);
  const r = changeFailureRate(inRange(recentStart, now.getTime() + 1), releaseIdsWithIncidents);
  const b = changeFailureRate(inRange(baselineStart, recentStart), releaseIdsWithIncidents);
  const recent = { finished: r.finished, failed: r.failedChanges, ratePercent: r.ratePercent };
  const baseline = { finished: b.finished, failed: b.failedChanges, ratePercent: b.ratePercent };
  if (r.finished < 3) return { level: "insufficient_data", recent, baseline, message: "Too few releases finished in the last 7 days to judge stability." };
  const base = b.ratePercent ?? 0;
  const elevated = r.failedChanges >= 3 && r.ratePercent !== null && r.ratePercent >= Math.max(base * 2, base + 15, 20);
  if (!elevated) return { level: "steady", recent, baseline, message: `Recent change failure rate is ${r.ratePercent}%, in line with ${b.ratePercent === null ? "no earlier baseline" : `${b.ratePercent}% over the 90 days before`}.` };
  return { level: "elevated", recent, baseline, message: `${r.failedChanges} of ${r.finished} releases in the last 7 days failed, rolled back or caused an incident (${r.ratePercent}%), against ${b.ratePercent === null ? "no earlier baseline" : `${b.ratePercent}% before`}. Slow down production changes until the cause is understood.` };
}

export interface StabilityRepo {
  release: { findMany(args: { where: { organizationId: string; actualDeployEnd: { gte: Date } }; take: number; select: { id: true; status: true; actualDeployEnd: true } }): Promise<FinishedRelease[]> };
  deploymentIncident: { findMany(args: { where: { organizationId: string; releaseId: { in: string[] } }; take: number; select: { releaseId: true } }): Promise<Array<{ releaseId: string | null }>> };
}

/** IO boundary. Returns null when records cannot be read, so callers show nothing rather than a guess. */
export async function readStabilityWarning(repo: StabilityRepo, organizationId: string, now: Date): Promise<StabilityWarning | null> {
  try {
    const releases = await repo.release.findMany({ where: { organizationId, actualDeployEnd: { gte: new Date(now.getTime() - (RECENT_DAYS + BASELINE_DAYS) * 86_400_000) } }, take: 5000, select: { id: true, status: true, actualDeployEnd: true } });
    const ids = releases.map((r) => r.id);
    const incidents = ids.length ? await repo.deploymentIncident.findMany({ where: { organizationId, releaseId: { in: ids } }, take: 10000, select: { releaseId: true } }) : [];
    return stabilityWarning(releases, new Set(incidents.map((i) => i.releaseId).filter((v): v is string => typeof v === "string")), now);
  } catch {
    return null;
  }
}

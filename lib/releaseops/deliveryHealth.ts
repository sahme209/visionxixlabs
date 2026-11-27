/**
 * Delivery health per environment (parity: deployment target and delegate health). Pure.
 *
 * Built only from recorded runs: how recently the environment's pipeline ran, how often it
 * succeeded, how long runs take, and whether any run is stuck or lost tracking. It describes the
 * delivery path V19 can observe, not the live state of the customer's systems.
 */
export type DeliveryHealth = "healthy" | "degraded" | "failing" | "idle";

export interface HealthRun { environmentId: string; status: string; conclusion: string | null; createdAt: Date; completedAt: Date | null; lastObservedAt: Date | null }
export interface HealthEnvironment { id: string; name: string; displayOrder: number }
export interface EnvironmentHealth {
  environmentId: string; name: string; health: DeliveryHealth; reasons: string[];
  runs: number; succeeded: number; failed: number; successRate: number | null;
  medianMinutes: number | null; lastRunAt: string | null; lastOutcome: "succeeded" | "failed" | "running" | "other" | null;
  stuck: number; untracked: number;
}

const FAILED = new Set(["failure", "timed_out", "startup_failure", "cancelled"]);
export const STUCK_QUEUED_MINUTES = 30;
export const STUCK_RUNNING_MINUTES = 120;
const WINDOW_DAYS = 30;

const outcome = (r: HealthRun): EnvironmentHealth["lastOutcome"] =>
  r.status === "completed" ? (r.conclusion === "success" ? "succeeded" : r.conclusion && FAILED.has(r.conclusion) ? "failed" : "other")
    : r.status === "queued" || r.status === "in_progress" || r.status === "reserved" ? "running" : "other";

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

export function summarizeDeliveryHealth(runs: readonly HealthRun[], environments: readonly HealthEnvironment[], now: Date): EnvironmentHealth[] {
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  return [...environments].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)).map((env) => {
    const own = runs.filter((r) => r.environmentId === env.id && r.createdAt.getTime() >= since).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const finished = own.filter((r) => r.status === "completed");
    const succeeded = finished.filter((r) => r.conclusion === "success").length;
    const failed = finished.filter((r) => r.conclusion && FAILED.has(r.conclusion)).length;
    const decided = succeeded + failed;
    const durations = finished.filter((r) => r.completedAt).map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / 60_000).filter((m) => m >= 0);
    const age = (r: HealthRun) => (now.getTime() - r.createdAt.getTime()) / 60_000;
    const stuck = own.filter((r) => (r.status === "queued" && age(r) > STUCK_QUEUED_MINUTES) || (r.status === "in_progress" && age(r) > STUCK_RUNNING_MINUTES)).length;
    const untracked = own.filter((r) => r.status === "tracking_unavailable").length;
    const successRate = decided ? Math.round((succeeded / decided) * 100) : null;
    const lastThree = finished.slice(0, 3);
    const reasons: string[] = [];
    let health: DeliveryHealth;
    if (own.length === 0) { health = "idle"; reasons.push(`No runs in the last ${WINDOW_DAYS} days.`); }
    else if (lastThree.length === 3 && lastThree.every((r) => r.conclusion && FAILED.has(r.conclusion))) { health = "failing"; reasons.push("The last 3 finished runs failed."); }
    else if (successRate !== null && decided >= 4 && successRate < 50) { health = "failing"; reasons.push(`Only ${successRate}% of finished runs succeeded.`); }
    else {
      if (stuck) reasons.push(`${stuck} run${stuck === 1 ? " looks" : "s look"} stuck (queued over ${STUCK_QUEUED_MINUTES} minutes or running over ${STUCK_RUNNING_MINUTES / 60} hours).`);
      if (untracked) reasons.push(`${untracked} run${untracked === 1 ? "" : "s"} lost tracking.`);
      if (successRate !== null && successRate < 80) reasons.push(`${successRate}% of finished runs succeeded.`);
      health = reasons.length ? "degraded" : "healthy";
    }
    return {
      environmentId: env.id, name: env.name, health, reasons, runs: own.length, succeeded, failed, successRate,
      medianMinutes: median(durations), lastRunAt: own[0]?.createdAt.toISOString() ?? null, lastOutcome: own[0] ? outcome(own[0]) : null, stuck, untracked,
    };
  });
}

/** "45 min", "3.2 h", "13 d". */
export function formatRunMinutes(min: number): string {
  if (min < 120) return `${Math.round(min)} min`;
  if (min < 2880) return `${Math.round((min / 60) * 10) / 10} h`;
  return `${Math.round(min / 1440)} d`;
}

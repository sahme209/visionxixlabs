/**
 * Release verification verdict (parity: continuous verification). Pure.
 *
 * Combines the signals V19 can read after a deployment: new errors first seen in the release (Sentry),
 * alerting monitors for the service (Datadog), and reported Verify-stage check results. Gives one plain
 * verdict with the reasons behind it. Missing signals are named, never assumed healthy.
 */
export interface VerificationSignals {
  newIssues: Array<{ level: string | null; count: number | null }> | null;
  monitors: { alerting: number; warning: number; ok: number; noData: number } | null;
  verifyChecks: Array<{ key: string; status: string }> | null;
}
export type VerificationVerdict = "healthy" | "investigate" | "unhealthy" | "no_signals";
export interface Verification { verdict: VerificationVerdict; reasons: string[]; missing: string[] }

export function verifyRelease(s: VerificationSignals): Verification {
  const reasons: string[] = []; const missing: string[] = [];
  let level = 0; // 0 healthy, 1 investigate, 2 unhealthy
  const raise = (n: number, why: string) => { level = Math.max(level, n); reasons.push(why); };
  if (s.newIssues === null) missing.push("new errors (connect Sentry)");
  else {
    const fatal = s.newIssues.filter((i) => i.level === "fatal" || i.level === "error");
    const events = s.newIssues.reduce((n, i) => n + (i.count ?? 0), 0);
    if (fatal.length >= 3 || events >= 100) raise(2, `${fatal.length} new error ${fatal.length === 1 ? "issue" : "issues"} (${events} events) first seen in this release.`);
    else if (s.newIssues.length > 0) raise(1, `${s.newIssues.length} new ${s.newIssues.length === 1 ? "issue" : "issues"} first seen in this release.`);
  }
  if (s.monitors === null) missing.push("monitors (connect Datadog)");
  else {
    if (s.monitors.alerting > 0) raise(2, `${s.monitors.alerting} ${s.monitors.alerting === 1 ? "monitor is" : "monitors are"} alerting.`);
    if (s.monitors.warning > 0) raise(1, `${s.monitors.warning} ${s.monitors.warning === 1 ? "monitor is" : "monitors are"} warning.`);
    if (s.monitors.noData > 0 && s.monitors.ok === 0 && s.monitors.alerting === 0) raise(1, "Monitors report no data.");
  }
  if (s.verifyChecks === null || s.verifyChecks.length === 0) missing.push("Verify-stage check results");
  else {
    const failed = s.verifyChecks.filter((c) => c.status !== "passed");
    if (failed.length) raise(2, `Verify checks not passing: ${failed.map((c) => c.key).join(", ")}.`);
  }
  const anySignal = s.newIssues !== null || s.monitors !== null || (s.verifyChecks !== null && s.verifyChecks.length > 0);
  if (!anySignal) return { verdict: "no_signals", reasons: [], missing };
  return { verdict: level === 2 ? "unhealthy" : level === 1 ? "investigate" : "healthy", reasons: reasons.length ? reasons : ["No new errors, no alerting monitors and Verify checks passing."], missing };
}

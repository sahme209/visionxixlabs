/**
 * Release risk radar: a pre-approval coverage view built only from the recorded release context.
 * Each axis states what is recorded and how complete it is. It is not a probability, a prediction
 * or an approval decision; unknown stays unknown.
 */
import type { ReleaseContextSummary } from "../tauri/deploymentRequestSummary";

export type RadarLevel = "covered" | "attention" | "gap" | "unknown";
export interface RadarAxis {
  id: "scope" | "review" | "readiness" | "validation" | "recovery" | "observation" | "window";
  label: string;
  level: RadarLevel;
  /** 0..1 coverage for drawing; unknown draws at 0. */
  coverage: number;
  detail: string;
}

const COVERAGE: Record<RadarLevel, number> = { covered: 1, attention: 0.55, gap: 0.2, unknown: 0 };
const axis = (id: RadarAxis["id"], label: string, level: RadarLevel, detail: string): RadarAxis => ({ id, label, level, coverage: COVERAGE[level], detail });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildReleaseRiskRadar(context: ReleaseContextSummary, now = new Date()): RadarAxis[] {
  const { scope, approval, readiness, recovery, observation, window } = context;
  const production = (scope.targetEnvironment ?? "").toLowerCase().includes("prod");
  const breadth = scope.applicationCount + scope.repositoryCount;
  const scopeAxis = scope.targetEnvironment === null && breadth === 0
    ? axis("scope", "Blast radius", "unknown", "No target or scope recorded")
    : axis("scope", "Blast radius", breadth > 4 || (production && breadth > 2) ? "attention" : "covered",
      `${plural(scope.applicationCount, "application")} · ${plural(scope.repositoryCount, "repository", "repositories")}${scope.targetEnvironment ? ` · ${scope.targetEnvironment}` : ""}`);

  const prNotNeeded = approval.noPrRequired || approval.prStatus === "not_applicable";
  const reviewAxis = prNotNeeded ? axis("review", "Code review", "covered", "PR review not required for this request")
    : approval.prStatus === "approved" ? axis("review", "Code review", "covered", "PR approval recorded")
    : approval.prStatus === "pending" ? axis("review", "Code review", "attention", "PR review pending")
    : approval.prStatus === "changes_requested" || approval.prStatus === "rejected" ? axis("review", "Code review", "gap", `PR ${approval.prStatus.replaceAll("_", " ")}`)
    : axis("review", "Code review", "unknown", "PR state not recorded");

  const blockers = readiness.blockers.length;
  const readinessAxis = readiness.approvalDecision === "ready_for_human_approval" && blockers === 0
    ? axis("readiness", "Readiness", "covered", "Ready for human approval")
    : axis("readiness", "Readiness", blockers > 2 ? "gap" : "attention", blockers ? `${plural(blockers, "blocker")} recorded` : "Needs attention");

  const validationAxis = readiness.validationStepCount === 0
    ? axis("validation", "Validation plan", readiness.deferredValidation ? "attention" : "gap", readiness.deferredValidation ? "Validation deferred" : "No validation steps planned")
    : axis("validation", "Validation plan", readiness.deferredValidation ? "attention" : "covered", `${plural(readiness.validationStepCount, "planned step")}${readiness.deferredValidation ? " · deferred" : ""}`);

  const rollback = recovery.rollbackAvailability;
  const recoveryAxis = rollback === "yes"
    ? axis("recovery", "Recovery", recovery.backupRequired && recovery.evidenceCount === 0 ? "attention" : "covered",
      `Rollback planned${recovery.backupRequired ? ` · backup required, ${plural(recovery.evidenceCount, "evidence item")}` : ""}`)
    : rollback === "not_applicable" ? axis("recovery", "Recovery", "covered", "Rollback not applicable")
    : rollback === "no" ? axis("recovery", "Recovery", production ? "gap" : "attention", "No rollback planned")
    : axis("recovery", "Recovery", "unknown", "Rollback plan not recorded");

  const observationAxis = observation.recordedMonitoringPlan
    ? axis("observation", "Observation", "attention", "Monitoring plan recorded · live monitoring not connected")
    : axis("observation", "Observation", "gap", "No monitoring plan recorded");

  let windowAxis: RadarAxis;
  if (!window) windowAxis = axis("window", "Change window", production ? "attention" : "unknown", "No change window recorded");
  else {
    const end = Date.parse(window.endUtc); const start = Date.parse(window.startUtc);
    windowAxis = !Number.isFinite(end) || !Number.isFinite(start) ? axis("window", "Change window", "unknown", "Window could not be read")
      : end < now.getTime() ? axis("window", "Change window", "gap", "Recorded window has ended")
      : axis("window", "Change window", "covered", `Window recorded (${window.displayTimeZone})`);
  }
  return [scopeAxis, reviewAxis, readinessAxis, validationAxis, recoveryAxis, observationAxis, windowAxis];
}

/** Counts per level, for a one-line summary beside the radar. */
export function summarizeRadar(axes: readonly RadarAxis[]): Record<RadarLevel, number> {
  const out: Record<RadarLevel, number> = { covered: 0, attention: 0, gap: 0, unknown: 0 };
  for (const a of axes) out[a.level] += 1;
  return out;
}

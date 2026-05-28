/**
 * Phase 509 — Autonomous Incident Triage engine.
 *
 * Pure decision function. Given an incident's full state — severity,
 * release context, related advisor recommendations, similar past
 * incidents, business impact signal — it projects:
 *
 *   • priority (P0..P3) — possibly upgraded above the operator-set
 *     severity when surrounding signals warrant
 *   • suggestedOwnerTeam — first-pass routing
 *   • estimatedTimeToMitigateMinutes — heuristic based on similar
 *     past incidents and severity
 *   • recommendedRunbook — closed-union runbook key (or null)
 *   • autoEscalate — should this page on-call immediately?
 *   • confidence
 *   • rationale — operator-readable explanation
 *
 * Engine version pinned in output for replay.
 */

export const INCIDENT_TRIAGE_ENGINE_VERSION = "incident-triage-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const TRIAGE_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type TriagePriority = (typeof TRIAGE_PRIORITIES)[number];

export const TRIAGE_RUNBOOKS = [
  "checkout_outage",
  "auth_outage",
  "data_loss",
  "elevated_error_rate",
  "rollback_drill",
  "perf_regression",
  "third_party_dependency_outage",
  "infra_capacity",
] as const;
export type TriageRunbook = (typeof TRIAGE_RUNBOOKS)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface IncidentTriageInputs {
  incident: {
    id: string;
    severity: string;       // operator-set: low|medium|high|critical
    title: string;
    summary: string | null;
    reportedAtIso: string;
  };
  release: {
    id: string;
    status: string;         // closed-union
    releaseTag: string | null;
    isProduction: boolean;
    deployedAtIso: string | null;
  };
  /** How many other open critical incidents on the same release? */
  openCriticalIncidentsOnThisRelease: number;
  /** Are there pending advisor recs already (block_deploy, rollback)? */
  pendingAdvisorBlockKinds: string[];
  /** Past incidents in the last 30 days that match this title shape. */
  similarHistoricalIncidents: number;
  /** Median minutes-to-mitigate from similar historical incidents (or 0). */
  medianHistoricalMitigationMinutes: number;
  /** Free-text business impact hint from the report (optional). */
  businessImpactHint: string | null;
  /** Active release freeze in effect? */
  isInPlannedFreeze: boolean;
  /** Current time for deadlines. */
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface IncidentTriageOutput {
  engineVersion: string;
  generatedAtIso: string;
  priority: TriagePriority;
  suggestedOwnerTeam: string;
  estimatedTimeToMitigateMinutes: number;
  recommendedRunbook: TriageRunbook | null;
  autoEscalate: boolean;
  confidence: number;
  rationale: string;
  /** Auto-derived next-action deadline (now + a function of priority). */
  responseDeadlineIso: string;
}

/* ──────────────────────────────────────────────────────────────────
   Pure engine.
   ────────────────────────────────────────────────────────────── */

const PRIORITY_RANK: Record<TriagePriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function severityToBasePriority(severity: string): TriagePriority {
  if (severity === "critical") return "P0";
  if (severity === "high") return "P1";
  if (severity === "medium") return "P2";
  return "P3";
}

/**
 * Project an incident's full state into a structured triage.
 * Deterministic — same inputs always produce same outputs.
 */
export function triageDeploymentIncident(input: IncidentTriageInputs): IncidentTriageOutput {
  const rationaleParts: string[] = [];
  let priority = severityToBasePriority(input.incident.severity);
  rationaleParts.push(`Base priority ${priority} from operator-set severity "${input.incident.severity}".`);

  // ── Priority upgrade rules ────────────────────────────────────
  // If multiple critical incidents on same release → upgrade by one tier (clamped at P0).
  if (input.openCriticalIncidentsOnThisRelease >= 2 && PRIORITY_RANK[priority] > 0) {
    const upgraded = priority === "P3" ? "P2" : priority === "P2" ? "P1" : "P0";
    rationaleParts.push(`Upgraded to ${upgraded}: ${input.openCriticalIncidentsOnThisRelease} other open critical incidents on the same release.`);
    priority = upgraded;
  }

  // If advisor already issued a block_deploy or rollback → likely P0/P1 territory.
  if (input.pendingAdvisorBlockKinds.includes("block_deploy") || input.pendingAdvisorBlockKinds.includes("rollback")) {
    if (PRIORITY_RANK[priority] > 1) {
      rationaleParts.push(`Upgraded to P1: advisor already issued ${input.pendingAdvisorBlockKinds.join(", ")}.`);
      priority = "P1";
    } else {
      rationaleParts.push(`Advisor block signals (${input.pendingAdvisorBlockKinds.join(", ")}) align with current priority.`);
    }
  }

  // Business-impact hint overrides toward P0 when strong language present.
  if (input.businessImpactHint && /\b(revenue|paying customers?|outage|down|cannot (login|order|check ?out|pay)|sla breach)\b/i.test(input.businessImpactHint)) {
    if (PRIORITY_RANK[priority] > 0) {
      rationaleParts.push(`Upgraded to P0: business-impact hint matches a revenue/outage signal.`);
      priority = "P0";
    }
  }

  // Production releases get more conservative triage.
  if (input.release.isProduction && PRIORITY_RANK[priority] > 1 && PRIORITY_RANK[severityToBasePriority(input.incident.severity)] <= 2) {
    // Don't upgrade dramatically — just nudge one tier toward urgent for prod.
    if (priority === "P3") {
      rationaleParts.push(`Nudged to P2: prod release context.`);
      priority = "P2";
    }
  }

  // Planned freeze + new incident → suggests something major broke despite freeze; bump.
  if (input.isInPlannedFreeze && PRIORITY_RANK[priority] > 0) {
    const before = priority;
    priority = priority === "P3" ? "P2" : priority === "P2" ? "P1" : "P0";
    if (priority !== before) {
      rationaleParts.push(`Upgraded from ${before} to ${priority}: incident landed during a planned freeze.`);
    }
  }

  // ── Owner team routing ─────────────────────────────────────────
  const suggestedOwnerTeam = pickOwnerTeam(input.incident.title, input.incident.summary, input.release);
  rationaleParts.push(`Routed to "${suggestedOwnerTeam}" based on incident title keywords.`);

  // ── Runbook recommendation ─────────────────────────────────────
  const recommendedRunbook = pickRunbook(input.incident.title, input.incident.summary);
  if (recommendedRunbook) rationaleParts.push(`Recommended runbook: ${recommendedRunbook}.`);

  // ── Mitigation ETA ─────────────────────────────────────────────
  const estimatedTimeToMitigateMinutes = estimateMitigationMinutes(
    priority,
    input.medianHistoricalMitigationMinutes,
    input.similarHistoricalIncidents,
  );
  rationaleParts.push(
    input.similarHistoricalIncidents > 0
      ? `ETA ${estimatedTimeToMitigateMinutes}min: ${input.similarHistoricalIncidents} similar historical incident${input.similarHistoricalIncidents === 1 ? "" : "s"} (median ${input.medianHistoricalMitigationMinutes}min) + priority adjustment.`
      : `ETA ${estimatedTimeToMitigateMinutes}min: no historical baseline — using priority defaults.`,
  );

  // ── Auto-escalate ──────────────────────────────────────────────
  const autoEscalate = priority === "P0" || (priority === "P1" && input.release.isProduction);
  if (autoEscalate) rationaleParts.push("Auto-escalate to on-call: priority + production context warrant immediate page.");

  // ── Confidence ─────────────────────────────────────────────────
  // Confidence rises with historical baseline + clean keyword match.
  let confidence = 55;
  if (input.similarHistoricalIncidents >= 3) confidence += 15;
  if (recommendedRunbook) confidence += 10;
  if (input.pendingAdvisorBlockKinds.length > 0) confidence += 8;
  if (input.businessImpactHint) confidence += 5;
  confidence = Math.min(95, confidence);

  // ── Response deadline by priority ──────────────────────────────
  const deadlineMinutes = priority === "P0" ? 15 : priority === "P1" ? 60 : priority === "P2" ? 240 : 1440;
  const responseDeadlineIso = new Date(input.now.getTime() + deadlineMinutes * 60_000).toISOString();

  return {
    engineVersion: INCIDENT_TRIAGE_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    priority,
    suggestedOwnerTeam,
    estimatedTimeToMitigateMinutes,
    recommendedRunbook,
    autoEscalate,
    confidence,
    rationale: rationaleParts.join(" "),
    responseDeadlineIso,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers.
   ────────────────────────────────────────────────────────────── */

function pickOwnerTeam(title: string, summary: string | null, release: IncidentTriageInputs["release"]): string {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  if (/(checkout|pay(ment)?|stripe|cart)/.test(text)) return "payments";
  if (/(auth|sign[ -]?in|login|sso|oauth)/.test(text)) return "identity";
  if (/(database|postgres|migrat(ion|e))/.test(text)) return "data-platform";
  if (/(api gateway|edge|cdn|cache)/.test(text)) return "edge";
  if (/(k8s|kube(rnetes)?|pod|node|deploy)/.test(text)) return "platform-sre";
  if (/(infra|aws|azure|gcp|terraform|iac)/.test(text)) return "infra";
  if (/(observabilit|logging|metric|trace|grafana|datadog)/.test(text)) return "observability";
  if (/(latency|perf(ormance)?|p9[0-9]|slow)/.test(text)) return "performance";
  // Fallback: a production release defaults to platform-sre; otherwise owning app team unknown.
  return release.isProduction ? "platform-sre" : "release-captain";
}

function pickRunbook(title: string, summary: string | null): TriageRunbook | null {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  if (/(checkout|cart|pay(ment)?)/.test(text)) return "checkout_outage";
  if (/(auth|login|sign[ -]?in|sso)/.test(text)) return "auth_outage";
  if (/(data loss|deleted|corrupt|missing rows)/.test(text)) return "data_loss";
  if (/(rollback|revert)/.test(text)) return "rollback_drill";
  if (/(latency|p9[0-9]|slow|perf(ormance)?)/.test(text)) return "perf_regression";
  if (/(third[- ]party|vendor|dependency|external service)/.test(text)) return "third_party_dependency_outage";
  if (/(capacity|out of memory|disk full|exhausted|saturat)/.test(text)) return "infra_capacity";
  // Generic catch-all: 5xx / 500 / error rate.
  if (/(5xx|500|error rate|errors? spike|elevated errors?)/.test(text)) return "elevated_error_rate";
  return null;
}

function estimateMitigationMinutes(priority: TriagePriority, historicalMedian: number, historicalCount: number): number {
  // Defaults if no history.
  const defaults: Record<TriagePriority, number> = { P0: 30, P1: 90, P2: 240, P3: 1440 };
  if (historicalCount === 0) return defaults[priority];
  // Weighted: history median + a priority-driven floor.
  const floor = priority === "P0" ? 15 : priority === "P1" ? 30 : priority === "P2" ? 60 : 120;
  return Math.max(floor, Math.round(historicalMedian));
}

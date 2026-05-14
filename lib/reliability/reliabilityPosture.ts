/**
 * Reliability posture aggregator — pure function over the typed reliability
 * primitives. The Reliability Center UI and the Command Center reliability
 * strip both read from this so their math stays identical.
 */

import type { DataSource } from "@/lib/domain/source";
import type { ComponentHealth, SystemHealth } from "./systemHealth";
import { aggregateHealth, COMPONENT_LABEL } from "./systemHealth";
import type { CircuitSnapshot } from "./circuitBreaker";
import type { DeadLetterRecord } from "./deadLetter";
import type { WorkflowDiagnosis, RecoveryFleetSummary } from "./workflowRecovery";

// ---------------------------------------------------------------------------
// Posture inputs
// ---------------------------------------------------------------------------

export interface ReliabilityPostureInputs {
  source: DataSource;
  components: ComponentHealth[];
  circuits: CircuitSnapshot[];
  deadLetters: DeadLetterRecord[];
  fleet: RecoveryFleetSummary;
  /** Number of jobs currently in retrying/queued. */
  retryingJobs: number;
  /** Number of jobs that succeeded after a retry in the last 24h. */
  successfulRetries24h: number;
  /** Number of provider rate-limit pauses in the last 24h. */
  rateLimitPauses24h: number;
}

// ---------------------------------------------------------------------------
// Posture output
// ---------------------------------------------------------------------------

export type ReliabilitySemantic = "neutral" | "success" | "warning" | "error";

export interface ReliabilityCheck {
  id: string;
  label: string;
  detail: string;
  semantic: ReliabilitySemantic;
}

export interface ReliabilityPosture {
  source: DataSource;
  score: number;
  semantic: ReliabilitySemantic;
  health: SystemHealth;
  checks: ReliabilityCheck[];
  openCircuits: CircuitSnapshot[];
  unresolvedDeadLetters: DeadLetterRecord[];
  actionableDiagnoses: WorkflowDiagnosis[];
  retryingJobs: number;
  rateLimitPauses24h: number;
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

export function buildReliabilityPosture(input: ReliabilityPostureInputs): ReliabilityPosture {
  const health = aggregateHealth(input.components);
  const openCircuits = input.circuits.filter((c) => c.state !== "closed");
  const unresolvedDeadLetters = input.deadLetters.filter((d) => !d.resolvedAt);
  const checks: ReliabilityCheck[] = [];

  checks.push({
    id: "system.overall",
    label: "System overall",
    detail:
      health.overall === "healthy" ? "All components within health thresholds." :
      health.overall === "degraded" ? "Some components degraded." :
      health.overall === "failing"  ? "One or more components failing." :
      health.overall === "unavailable" ? "Critical components unavailable." :
                                       "Some components have no recent observation.",
    semantic:
      health.overall === "healthy" ? "success" :
      health.overall === "degraded" || health.overall === "unknown" ? "warning" :
                                       "error",
  });

  checks.push({
    id: "workflows.actionable",
    label: "Workflow health",
    detail: input.fleet.total === 0
      ? "No workflow runs yet."
      : input.fleet.actionable.length === 0
        ? `${input.fleet.healthy}/${input.fleet.total} runs healthy.`
        : `${input.fleet.actionable.length} run(s) need attention (${input.fleet.stalled} stalled · ${input.fleet.stuck} stuck · ${input.fleet.failed} failed).`,
    semantic: input.fleet.actionable.length === 0 ? "success" : input.fleet.actionable.length > 5 ? "error" : "warning",
  });

  checks.push({
    id: "circuits.state",
    label: "Circuit breakers",
    detail: openCircuits.length === 0
      ? "All integrations operating with closed circuits."
      : `${openCircuits.length} integration(s) paused: ${openCircuits.map((c) => c.target).slice(0, 3).join(", ")}${openCircuits.length > 3 ? "…" : ""}.`,
    semantic: openCircuits.length === 0 ? "success" : openCircuits.length > 2 ? "error" : "warning",
  });

  checks.push({
    id: "deadletter.unresolved",
    label: "Dead-letter queue",
    detail: unresolvedDeadLetters.length === 0
      ? "No unresolved dead-letter items."
      : `${unresolvedDeadLetters.length} item(s) awaiting operator review.`,
    semantic: unresolvedDeadLetters.length === 0 ? "success" : unresolvedDeadLetters.length > 10 ? "error" : "warning",
  });

  checks.push({
    id: "retries.in_flight",
    label: "Retries in flight",
    detail: input.retryingJobs === 0
      ? `No active retries. ${input.successfulRetries24h} succeeded after retry in the last 24h.`
      : `${input.retryingJobs} job(s) currently retrying.`,
    semantic: input.retryingJobs > 20 ? "warning" : "neutral",
  });

  checks.push({
    id: "ratelimit.recent",
    label: "Provider rate limits",
    detail: input.rateLimitPauses24h === 0
      ? "No provider rate-limit pauses in the last 24h."
      : `${input.rateLimitPauses24h} pause(s) in the last 24h — Axiom is throttling cooperatively.`,
    semantic: input.rateLimitPauses24h > 50 ? "warning" : "neutral",
  });

  // Score: weighted average across checks
  const weight: Record<ReliabilitySemantic, number> = { success: 1, neutral: 0.85, warning: 0.5, error: 0 };
  const score = checks.length === 0 ? 1 : checks.reduce((s, c) => s + weight[c.semantic], 0) / checks.length;
  const semantic: ReliabilitySemantic = score >= 0.9 ? "success" : score >= 0.6 ? "warning" : "error";

  void COMPONENT_LABEL; // referenced for tree-shaking insurance — keep the import

  return {
    source: input.source,
    score,
    semantic,
    health,
    checks,
    openCircuits,
    unresolvedDeadLetters,
    actionableDiagnoses: input.fleet.actionable,
    retryingJobs: input.retryingJobs,
    rateLimitPauses24h: input.rateLimitPauses24h,
  };
}

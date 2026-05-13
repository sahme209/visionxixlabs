/**
 * Reasoning trace model — typed contracts for the 12-step agent loop.
 *
 * Every recommendation produced by Axiom carries an auditable trace through
 * 6 phases: observe → interpret → reason → plan → verify → execute. Each
 * step records evidence, confidence, duration, and outcome.
 *
 * UI components consume ReasoningTraceData; mappers convert AxiomAgentRun
 * Prisma rows into this shape.
 */

import type { CloudProvider } from "@/lib/connectors/interface";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export type ReasoningPhase = "observe" | "interpret" | "reason" | "plan" | "verify" | "execute";

export type ReasoningStepStatus = "complete" | "active" | "pending" | "failed" | "skipped";

export interface ReasoningEvidence {
  /** Short label for the data point. */
  label: string;
  /** Value as a string (already formatted for display). */
  value: string;
  /** Optional: source resource the evidence came from. */
  source?: ResourceRef;
}

export interface ReasoningStep {
  id: string;
  phase: ReasoningPhase;
  /** One-line label like "Captured 14-day metric snapshot". */
  label: string;
  /** Longer detail. */
  detail: string;
  status: ReasoningStepStatus;
  /** Per-step confidence in [0, 1]. Optional. */
  confidence?: number;
  /** Wall-clock duration. */
  durationMs?: number;
  /** Up to ~5 pieces of supporting evidence. */
  evidence?: ReasoningEvidence[];
  /** If this step depends on another step completing first. */
  dependsOn?: string[];
}

export type RecommendationRisk = "low" | "medium" | "high";

export interface RecommendationOutput {
  /** The specific action recommended. */
  action: string;
  /** What changes when this action is applied. */
  impact: string;
  risk: RecommendationRisk;
  /** Expected monthly cost change. Positive = savings. */
  monthlySavingsUsd?: number;
  /** Expected RTO if the action is rolled back. */
  rollbackRtoSec?: number;
  /** Whether approval is required (always true for high risk). */
  approvalRequired: boolean;
}

export interface ReasoningTraceData {
  /** Stable identifier across UI + DB. */
  runId: string;
  /** Provider this reasoning applies to. */
  provider: CloudProvider;
  /** Short, headline statement of what the agent reasoned about. */
  title: string;
  /** One-paragraph summary of the analysis. */
  summary: string;
  /** Why this matters operationally / financially / from a risk standpoint. */
  whyItMatters: string;
  /** Composite confidence in [0, 1] for the full trace. */
  confidence: number;
  steps: ReasoningStep[];
  /** Affected resources (ResourceRef list) — typed, queryable. */
  affectedResources?: ResourceRef[];
  /** Final recommendation surfaced to the operator. */
  recommendation?: RecommendationOutput;
  /** Wall-clock start. */
  startedAt: string;
  /** Wall-clock finish, if the trace is complete. */
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHASE_ORDER: ReasoningPhase[] = ["observe", "interpret", "reason", "plan", "verify", "execute"];

/** Sort steps by phase order, then by id stability. */
export function sortStepsByPhase(steps: ReasoningStep[]): ReasoningStep[] {
  return [...steps].sort((a, b) => {
    const pa = PHASE_ORDER.indexOf(a.phase);
    const pb = PHASE_ORDER.indexOf(b.phase);
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
}

/** Compute composite confidence as average of step confidences that are set. */
export function computeCompositeConfidence(steps: ReasoningStep[]): number {
  const conf = steps.map((s) => s.confidence).filter((c): c is number => typeof c === "number");
  if (conf.length === 0) return 0;
  return conf.reduce((s, c) => s + c, 0) / conf.length;
}

/** Total wall-clock duration across all steps. */
export function totalDurationMs(steps: ReasoningStep[]): number {
  return steps.reduce((s, step) => s + (step.durationMs ?? 0), 0);
}

/** Find the current active step (if any). */
export function currentStep(steps: ReasoningStep[]): ReasoningStep | undefined {
  return steps.find((s) => s.status === "active");
}

/** Determine if approval is required based on recommendation + step state. */
export function approvalRequired(trace: ReasoningTraceData): boolean {
  if (trace.recommendation?.approvalRequired) return true;
  if (trace.recommendation?.risk === "high") return true;
  return false;
}

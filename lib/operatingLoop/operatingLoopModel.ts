/**
 * Axiom canonical operating loop — coordination layer.
 *
 * This module DOES NOT replace existing subsystems. It is a typed
 * contract that lets the platform answer one question:
 *
 *     "For this provider / connector, where are we in the journey from
 *      setup to next-action — and what is safe to do next?"
 *
 * The builder (`operatingLoopBuilder`) populates this shape by querying
 * validators, scanners, security scanner, remediation pipeline, etc.
 * The runner (`operatingLoopRunner`) executes only the safe stages.
 *
 * Hard rule: Stage status is derived honestly from real subsystem state.
 * The loop never claims "passing" on a stage it didn't actually verify.
 */

import type { OrganizationId, UserId, CorrelationId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Stage identity — the 16 canonical stages
// ---------------------------------------------------------------------------

export type OperatingLoopStageId =
  | "setup"
  | "validation"
  | "scan"
  | "snapshot"
  | "findings"
  | "recommendations"
  | "remediation"
  | "simulation"
  | "policy"
  | "approval"
  | "desktop_review"
  | "preflight"
  | "verification"
  | "audit"
  | "memory"
  | "next_action";

export const CANONICAL_STAGES: OperatingLoopStageId[] = [
  "setup",
  "validation",
  "scan",
  "snapshot",
  "findings",
  "recommendations",
  "remediation",
  "simulation",
  "policy",
  "approval",
  "desktop_review",
  "preflight",
  "verification",
  "audit",
  "memory",
  "next_action",
];

// ---------------------------------------------------------------------------
// Status taxonomy
// ---------------------------------------------------------------------------

export type OperatingLoopStageStatus =
  | "not_started"
  | "passing"
  | "partial"
  | "preview"
  | "blocked"
  | "failed"
  | "completed"
  | "skipped"
  | "requires_input"
  | "requires_approval";

export type OperatingLoopRunStatus =
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed"
  | "paused_for_approval"
  | "paused_for_user_input";

export type OperatingLoopProvider =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "security_scanner"
  | "desktop";

export type SourceMode = "live" | "partial" | "preview" | "expanding" | "disabled" | "unknown";

// ---------------------------------------------------------------------------
// Stage + run records
// ---------------------------------------------------------------------------

/** Pointer to an artifact produced by a stage. Used to thread evidence. */
export interface EvidenceRef {
  kind: "snapshot" | "finding" | "recommendation" | "remediation" | "simulation" | "approval" | "handoff" | "audit_event" | "trace" | "memory_record" | "next_action";
  id: string;
  /** Short label rendered in UI. */
  label?: string;
  /** Optional URL the operator can open. */
  href?: string;
}

export interface OperatingLoopStage {
  id: OperatingLoopStageId;
  /** Human-readable name shown in UI. */
  name: string;
  status: OperatingLoopStageStatus;
  /** Which subsystem the data came from (e.g. "lib/cloud/aws/awsValidator.ts"). */
  sourceSystem: string;
  /** Source-mode honesty for this stage. */
  sourceMode: SourceMode;
  /** Confidence in the data backing this stage in [0, 1]. */
  confidence: number;
  /** Evidence threaded forward from upstream stages. */
  inputRefs: EvidenceRef[];
  /** Evidence produced by this stage. */
  outputRefs: EvidenceRef[];
  /** Honest blockers — every one corresponds to a reason status !== "passing". */
  blockers: { code: string; detail: string; resolveHref?: string }[];
  /** What the operator can safely do now to make this stage progress. */
  safeNextAction?: { label: string; href: string };
  /** Honest one-line summary the UI surfaces. */
  summary: string;
  /** Last update wall-clock — `undefined` when never run. */
  updatedAt?: string;
}

export interface OperatingLoopRun {
  id: string;
  organizationId: OrganizationId;
  /** Optional acting user — set when the loop was started by an operator. */
  actorUserId?: UserId;
  /** Provider this loop is about (a single canonical provider per run). */
  provider: OperatingLoopProvider;
  /** Optional connector hint (e.g. "github_app" vs "github_pat"). */
  connector?: string;
  /** Best-available source-mode rollup (most-honest of the stage modes). */
  sourceMode: SourceMode;
  /** Stage we are currently parked at. */
  currentStage: OperatingLoopStageId;
  /** Run status rollup. */
  status: OperatingLoopRunStatus;
  startedAt: string;
  completedAt?: string;
  /** Stages in canonical order — exactly 16 entries. */
  stages: OperatingLoopStage[];
  /** Stable correlation id for audit/trace cross-reference. */
  correlationId: CorrelationId;
  /** Audit event ids written during this run. */
  auditEventIds: string[];
  /** Trace ids written during this run. */
  traceIds: string[];
  /** Aggregate evidence collected across all stages. */
  evidenceRefs: EvidenceRef[];
  /** Honest one-paragraph summary the Command Center renders. */
  summary: string;
  /** Highest-leverage next action across all stages. */
  topSafeNextAction?: { label: string; href: string };
  /** Stages that still require operator/approver attention. */
  attentionRequired: { stageId: OperatingLoopStageId; reason: string }[];
}

// ---------------------------------------------------------------------------
// Stage-naming helper
// ---------------------------------------------------------------------------

export const STAGE_LABELS: Record<OperatingLoopStageId, string> = {
  setup:           "Setup",
  validation:      "Validation",
  scan:            "Scan",
  snapshot:        "Snapshot",
  findings:        "Findings",
  recommendations: "Recommendations",
  remediation:     "Remediation",
  simulation:      "Simulation",
  policy:          "Policy",
  approval:        "Approval",
  desktop_review:  "Desktop review",
  preflight:       "Pre-flight",
  verification:    "Verification",
  audit:           "Audit",
  memory:          "Memory",
  next_action:     "Next action",
};

/** Returns true when the stage transitively unblocks further safe automation. */
export function isPassingStatus(s: OperatingLoopStageStatus): boolean {
  return s === "passing" || s === "completed" || s === "preview" || s === "partial";
}

/** Returns true when the stage cannot progress automatically. */
export function isHaltingStatus(s: OperatingLoopStageStatus): boolean {
  return s === "blocked" || s === "failed" || s === "requires_input" || s === "requires_approval";
}

/** Pick the most-honest source mode across a set (preview/partial beat live when present). */
export function rollupSourceMode(modes: SourceMode[]): SourceMode {
  if (modes.length === 0) return "unknown";
  if (modes.includes("disabled")) return "disabled";
  if (modes.includes("preview")) return "preview";
  if (modes.includes("partial")) return "partial";
  if (modes.includes("expanding")) return "expanding";
  if (modes.includes("live")) return "live";
  return "unknown";
}

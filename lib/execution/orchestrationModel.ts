/**
 * Execution Orchestration Model.
 *
 * The canonical type for the end-to-end governed execution flow:
 *   finding → candidate → plan → simulation → policy → approval
 *     → preflight → desktop review → execution_ready → verification
 *     → rollback readiness → audit → memory.
 *
 * This model is the *coordinating* type. It composes existing modules:
 * remediation candidate id, simulation result id, approval id, plan id,
 * desktop handoff id, audit trace ids — without duplicating their shape.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Stage + status
// ---------------------------------------------------------------------------

export type OrchestrationStage =
  | "identified"
  | "planned"
  | "simulated"
  | "policy_checked"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "dry_run_ready"
  | "dry_run_completed"
  | "desktop_review_ready"
  | "execution_ready"
  | "execution_blocked"
  | "verification_pending"
  | "verified"
  | "rollback_ready"
  | "rollback_required"
  | "completed"
  | "failed"
  | "cancelled";

export type OrchestrationStatus =
  | "preview_only"
  | "blocked"
  | "waiting_for_approval"
  | "approved_for_review"
  | "approved_for_dry_run"
  | "approved_for_execution_later"
  | "running_preflight"
  | "ready_for_verification"
  | "completed"
  | "failed"
  | "unsafe";

export type OrchestrationRisk = "low" | "medium" | "high" | "critical";

export type OrchestrationSourceMode = "live" | "preview" | "planned" | "blocked";

// ---------------------------------------------------------------------------
// References to underlying typed records
// ---------------------------------------------------------------------------

export interface OrchestrationReferences {
  /** RemediationCandidate id from lib/remediation. */
  remediationCandidateId?: string;
  /** ExecutionPlan id from existing execution plan builder. */
  executionPlanId?: string;
  /** SimulationResult id. */
  simulationId?: string;
  /** ChangeSet id. */
  changeSetId?: string;
  /** OrchestrationApproval id from lib/approvals. */
  approvalRequestId?: string;
  /** Policy decision id. */
  policyDecisionId?: string;
  /** Desktop handoff id. */
  desktopHandoffId?: string;
  /** Workflow run id. */
  workflowId?: string;
  /** Audit event ids emitted by this orchestration. */
  auditEventIds: string[];
  /** Trace ids covering this orchestration. */
  traceIds: string[];
}

// ---------------------------------------------------------------------------
// Orchestration record
// ---------------------------------------------------------------------------

export interface ExecutionOrchestration {
  id: string;
  tenantId?: string;
  provider: CloudProvider | "github" | "desktop" | "multi";

  /** Underlying signal that started this orchestration. */
  sourceFindingId?: string;

  /** Current stage. */
  stage: OrchestrationStage;
  /** Coarser-grained status the UI surfaces. */
  status: OrchestrationStatus;
  riskLevel: OrchestrationRisk;
  sourceMode: OrchestrationSourceMode;

  /** Refs into typed underlying records. */
  references: OrchestrationReferences;

  /** Concise headline rendered in lists. */
  title: string;
  /** Plain-language description. */
  description?: string;

  createdBy?: string;
  createdAt: string;
  updatedAt: string;

  /** Evidence pointers (id + label) consumed by the UI / audit. */
  evidenceRefs: { label: string; ref: string }[];

  /** When non-null, this is the safe action the operator can take now. */
  safeNextAction?: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Labels + semantics
// ---------------------------------------------------------------------------

export const ORCHESTRATION_STAGE_LABEL: Record<OrchestrationStage, string> = {
  identified:             "Identified",
  planned:                "Planned",
  simulated:              "Simulated",
  policy_checked:         "Policy checked",
  approval_requested:     "Approval requested",
  approved:               "Approved",
  rejected:               "Rejected",
  dry_run_ready:          "Dry-run ready",
  dry_run_completed:      "Dry-run completed",
  desktop_review_ready:   "Desktop review ready",
  execution_ready:        "Execution ready",
  execution_blocked:      "Execution blocked",
  verification_pending:   "Verification pending",
  verified:               "Verified",
  rollback_ready:         "Rollback ready",
  rollback_required:      "Rollback required",
  completed:              "Completed",
  failed:                 "Failed",
  cancelled:              "Cancelled",
};

export const ORCHESTRATION_STATUS_LABEL: Record<OrchestrationStatus, string> = {
  preview_only:                "Preview only",
  blocked:                     "Blocked",
  waiting_for_approval:        "Waiting for approval",
  approved_for_review:         "Approved for review",
  approved_for_dry_run:        "Approved for dry-run",
  approved_for_execution_later: "Approved for execution (later)",
  running_preflight:           "Running preflight",
  ready_for_verification:      "Ready for verification",
  completed:                   "Completed",
  failed:                      "Failed",
  unsafe:                      "Unsafe",
};

export const STATUS_SEMANTIC: Record<OrchestrationStatus, "pass" | "warn" | "fail" | "neutral"> = {
  preview_only:                "warn",
  blocked:                     "fail",
  waiting_for_approval:        "warn",
  approved_for_review:         "pass",
  approved_for_dry_run:        "pass",
  approved_for_execution_later: "pass",
  running_preflight:           "warn",
  ready_for_verification:      "pass",
  completed:                   "pass",
  failed:                      "fail",
  unsafe:                      "fail",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newOrchestrationId(scope: string): string {
  return `orc.${scope}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
}

export function isTerminalStage(stage: OrchestrationStage): boolean {
  return stage === "completed" || stage === "failed" || stage === "cancelled" || stage === "rejected";
}

/** Map an orchestration stage to its safe status. */
export function defaultStatusForStage(stage: OrchestrationStage): OrchestrationStatus {
  switch (stage) {
    case "identified":
    case "planned":
    case "simulated":
    case "policy_checked":         return "preview_only";
    case "approval_requested":     return "waiting_for_approval";
    case "approved":               return "approved_for_review";
    case "rejected":               return "blocked";
    case "dry_run_ready":          return "approved_for_dry_run";
    case "dry_run_completed":      return "approved_for_execution_later";
    case "desktop_review_ready":   return "approved_for_review";
    case "execution_ready":        return "approved_for_execution_later";
    case "execution_blocked":      return "blocked";
    case "verification_pending":   return "running_preflight";
    case "verified":               return "ready_for_verification";
    case "rollback_ready":         return "approved_for_review";
    case "rollback_required":      return "unsafe";
    case "completed":              return "completed";
    case "failed":                 return "failed";
    case "cancelled":              return "blocked";
  }
}

/**
 * Remediation Model.
 *
 * Canonical type surface for the closed-loop remediation system.
 * Every finding / blocker / recommendation is normalised into a typed
 * `RemediationCandidate` carrying its source, policy verdict, approval
 * + rollback + verification requirements, preview availability, desktop
 * eligibility, and audit obligations.
 *
 * Nothing here executes a change. The model only describes *prepared*
 * remediation work the operator can review and approve.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type RemediationStatus =
  | "identified"
  | "needs_validation"
  | "ready_for_plan"
  | "plan_generated"
  | "blocked_by_policy"
  | "requires_approval"
  | "approved"
  | "ready_for_review"
  | "ready_for_desktop"
  | "execution_disabled"
  | "verification_pending"
  | "completed"
  | "failed"
  | "cancelled";

export type ChangeType =
  | "configuration_change"
  | "security_hardening"
  | "cost_optimization"
  | "reliability_improvement"
  | "pipeline_governance"
  | "desktop_review"
  | "documentation_only"
  | "manual_external_required";

export type AutomationLevel =
  | "fully_manual"
  | "operator_assisted"
  | "approval_gated_assist"
  | "approval_gated_apply"
  | "not_supported";

export type RemediationRisk = "low" | "medium" | "high" | "critical";

export type RemediationSource = "live" | "preview" | "planned" | "blocked";

export type PolicyVerdict =
  | "allowed"
  | "requires_approval"
  | "requires_two_approvers"
  | "blocked"
  | "no_policy_match";

export type ApprovalRequirement = "none" | "single_approver" | "two_approvers" | "policy_blocked";

export type RollbackRequirement =
  | "rollback_documented"
  | "rollback_terraform_revert"
  | "rollback_cli_revert"
  | "rollback_redeploy_previous_tag"
  | "rollback_feature_flag_revert"
  | "rollback_not_available"
  | "rollback_not_required";

export type VerificationRequirement =
  | "rescan_resource"
  | "rerun_security_check"
  | "post_deploy_smoke_test"
  | "rollback_drill"
  | "manual_review"
  | "no_verification";

export type DesktopEligibility = "eligible" | "not_eligible" | "preview_only" | "execution_disabled";

// ---------------------------------------------------------------------------
// Sub-shapes
// ---------------------------------------------------------------------------

export interface RemediationProposedChange {
  /** Plain-language summary of the proposed change. */
  summary: string;
  /** Optional structural change description. */
  payload?: Record<string, string>;
}

export interface RemediationCapabilityRef {
  domain: "aws" | "azure" | "gcp" | "github" | "desktop" | "security_scanner" | "platform";
  capability: string;
}

export interface RemediationEvidence {
  label: string;
  ref: string;
}

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

export interface RemediationCandidate {
  id: string;
  /** Tenant id from currentContext (kept as string for transport). */
  tenantId?: string;

  /** Underlying finding / recommendation / blocker id (must always be present). */
  sourceFindingId: string;
  /** Optional recommendation id (when the candidate came from the brain). */
  sourceRecommendationId?: string;

  provider: CloudProvider | "github" | "desktop" | "platform";
  /** Connector / sub-system this targets (e.g. "aws.s3", "github.branch_protection"). */
  connector: string;
  /** Resource ids in the customer environment this touches. */
  resourceIds: string[];

  category: ChangeType;
  title: string;
  description: string;

  riskLevel: RemediationRisk;
  impactSummary: string;
  proposedChange: RemediationProposedChange;
  changeType: ChangeType;
  automationLevel: AutomationLevel;
  /** Honest source — every UI surface labels off this. */
  sourceMode: RemediationSource;
  /** 0..1 — confidence in the underlying signal. */
  confidence: number;
  evidence: RemediationEvidence[];

  requiredCapabilities: RemediationCapabilityRef[];
  requiredPermissions: string[];

  policyDecision: PolicyVerdict;
  approvalRequirement: ApprovalRequirement;
  rollbackRequirement: RollbackRequirement;
  verificationRequirement: VerificationRequirement;
  auditRequirement: "required" | "optional";

  desktopReviewEligibility: DesktopEligibility;

  status: RemediationStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const REMEDIATION_STATUS_LABEL: Record<RemediationStatus, string> = {
  identified:             "Identified",
  needs_validation:       "Needs validation",
  ready_for_plan:         "Ready for plan",
  plan_generated:         "Plan generated",
  blocked_by_policy:      "Blocked by policy",
  requires_approval:      "Requires approval",
  approved:               "Approved",
  ready_for_review:       "Ready for review",
  ready_for_desktop:      "Ready for desktop",
  execution_disabled:     "Execution disabled",
  verification_pending:   "Verification pending",
  completed:              "Completed",
  failed:                 "Failed",
  cancelled:              "Cancelled",
};

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  configuration_change:        "Configuration change",
  security_hardening:          "Security hardening",
  cost_optimization:           "Cost optimisation",
  reliability_improvement:     "Reliability improvement",
  pipeline_governance:         "Pipeline governance",
  desktop_review:              "Desktop review",
  documentation_only:          "Documentation only",
  manual_external_required:    "Manual external action",
};

export const RISK_LABEL: Record<RemediationRisk, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

export const REMEDIATION_STATUS_SEMANTIC: Record<RemediationStatus, "pass" | "warn" | "fail" | "neutral"> = {
  identified:           "neutral",
  needs_validation:     "warn",
  ready_for_plan:       "neutral",
  plan_generated:       "pass",
  blocked_by_policy:    "fail",
  requires_approval:    "warn",
  approved:             "pass",
  ready_for_review:     "pass",
  ready_for_desktop:    "pass",
  execution_disabled:   "warn",
  verification_pending: "warn",
  completed:            "pass",
  failed:               "fail",
  cancelled:            "neutral",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<RemediationStatus, RemediationStatus[]> = {
  identified:           ["needs_validation", "ready_for_plan", "blocked_by_policy", "cancelled"],
  needs_validation:     ["ready_for_plan", "blocked_by_policy", "cancelled"],
  ready_for_plan:       ["plan_generated", "blocked_by_policy", "cancelled"],
  plan_generated:       ["requires_approval", "ready_for_review", "blocked_by_policy", "execution_disabled", "cancelled"],
  blocked_by_policy:    ["cancelled", "identified"],
  requires_approval:    ["approved", "cancelled", "blocked_by_policy"],
  approved:             ["ready_for_review", "ready_for_desktop", "verification_pending"],
  ready_for_review:     ["ready_for_desktop", "verification_pending", "cancelled"],
  ready_for_desktop:    ["verification_pending", "cancelled"],
  execution_disabled:   ["cancelled", "identified"],
  verification_pending: ["completed", "failed"],
  completed:            [],
  failed:               ["identified"],
  cancelled:            [],
};

export function canTransition(from: RemediationStatus, to: RemediationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(status: RemediationStatus): RemediationStatus[] {
  return TRANSITIONS[status] ?? [];
}

/** Generate a stable id from source — keeps idempotent pipeline runs cheap. */
export function candidateIdFor(sourceFindingId: string, connector: string): string {
  return `rem.${connector}.${sourceFindingId}`;
}

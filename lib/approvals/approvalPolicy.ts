/**
 * Approval Policy.
 *
 * Decides — given the risk + change type + source type — whether an
 * approval is required, which role(s) must approve, and what extra
 * reviewer gates apply (security / finance / production owner).
 *
 * Strict rules:
 *  1. High-risk changes always require approval.
 *  2. Production-impacting changes require approval.
 *  3. IAM/security changes require approval.
 *  4. Public-exposure changes require approval.
 *  5. Cost-impacting changes may require finance approval.
 *  6. ReleaseOps production changes require approval.
 *  7. Desktop local execution requires approval.
 *  8. Unknown impact requires manual review.
 *  9. Preview-mode operations cannot be approved for live execution.
 *  10. Rejected approvals cannot be reused.
 */

import type { ApprovalRisk, ApproverRole, ApprovalSourceType } from "@/lib/approvals/approvalModel";
import type { ChangeType } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ApprovalPolicyInput {
  sourceType: ApprovalSourceType;
  changeType: ChangeType | "release" | "desktop";
  risk: ApprovalRisk;
  /** Whether the underlying change touches production-tagged resources. */
  touchesProduction: boolean;
  /** Whether the underlying change has unknown blast radius. */
  unknownImpact: boolean;
  /** Whether the underlying provider mode is live. */
  sourceModeLive: boolean;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ApprovalPolicyDecision {
  approvalRequired: boolean;
  primaryRole: ApproverRole;
  additionalReviewers: ApproverRole[];
  /** Hours until the approval auto-expires. */
  ttlHours: number;
  /** Whether two distinct approvers are required. */
  twoApproverQuorum: boolean;
  /** Whether dry-run is allowed once approved. */
  dryRunAllowed: boolean;
  /** Whether execution is allowed once approved (separate from dry-run). */
  executionAllowedLater: boolean;
  /** Whether desktop review is allowed once approved. */
  desktopReviewAllowed: boolean;
  reasons: string[];
  policyId: string;
}

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

const POLICY_ID = "policy.approvals.v1";

function ttlFor(risk: ApprovalRisk): number {
  switch (risk) {
    case "critical": return 12;
    case "high":     return 24;
    case "medium":   return 48;
    case "low":      return 72;
  }
}

export function evaluateApprovalPolicy(input: ApprovalPolicyInput): ApprovalPolicyDecision {
  const reasons: string[] = [];
  const additional: ApproverRole[] = [];
  let primaryRole: ApproverRole = "approver";
  let twoApprover = false;
  let approvalRequired = false;

  // Rule 1: high-risk
  if (input.risk === "critical" || input.risk === "high") {
    approvalRequired = true;
    twoApprover = input.risk === "critical";
    reasons.push("rule-1: high-risk change requires approval");
  }
  // Rule 2: production-impacting
  if (input.touchesProduction) {
    approvalRequired = true;
    additional.push("production_owner");
    reasons.push("rule-2: production-impacting change requires production owner approval");
  }
  // Rule 3 / 4: IAM / security / public exposure
  if (input.changeType === "security_hardening") {
    approvalRequired = true;
    additional.push("security_reviewer");
    reasons.push("rule-3/4: IAM / security / public-exposure change requires security review");
  }
  // Rule 5: cost-impacting
  if (input.changeType === "cost_optimization") {
    approvalRequired = approvalRequired || input.risk !== "low";
    if (input.risk !== "low") {
      additional.push("finance_reviewer");
      reasons.push("rule-5: cost-impacting change may require finance reviewer");
    }
  }
  // Rule 6: ReleaseOps prod
  if (input.changeType === "release" && input.touchesProduction) {
    approvalRequired = true;
    twoApprover = true;
    additional.push("production_owner");
    reasons.push("rule-6: production release requires production owner + second approver");
  }
  // Rule 7: desktop local execution
  if (input.sourceType === "desktop_handoff" && input.changeType === "desktop") {
    approvalRequired = true;
    reasons.push("rule-7: desktop local execution requires explicit approval");
  }
  // Rule 8: unknown impact
  if (input.unknownImpact) {
    approvalRequired = true;
    reasons.push("rule-8: unknown impact requires manual review");
  }

  // Default medium / low cases — still ask for approval beyond review-only.
  if (input.changeType !== "documentation_only" && input.changeType !== "desktop_review" && input.risk === "medium") {
    approvalRequired = true;
    reasons.push("default: medium-risk operational change requires approval");
  }

  // Two-approver quorum if multiple reviewer types are required.
  if (additional.length >= 2 || twoApprover) {
    primaryRole = "two_approver_quorum";
    twoApprover = true;
  }

  // Rule 9: preview source mode cannot be approved for live execution.
  const executionAllowedLater = input.sourceModeLive;
  if (!input.sourceModeLive) {
    reasons.push("rule-9: source is not live; approval cannot authorise live execution");
  }
  const dryRunAllowed = input.sourceModeLive;
  const desktopReviewAllowed = true;

  return {
    approvalRequired,
    primaryRole,
    additionalReviewers: dedupe(additional),
    ttlHours: ttlFor(input.risk),
    twoApproverQuorum: twoApprover,
    dryRunAllowed,
    executionAllowedLater,
    desktopReviewAllowed,
    reasons,
    policyId: POLICY_ID,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Approval policy layer — typed rules for when actions require human approval
 * and who can approve. The policy engine evaluates a proposed action against
 * configured rules and returns the approval requirement.
 *
 * Defaults are deliberately strict. Orgs can loosen specific paths via
 * configuration, but the agent itself cannot self-escalate.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

export type ActionRisk = "low" | "medium" | "high";

export type BlastRadius = "contained" | "moderate" | "broad";

/** Action class — used to group similar operations for policy targeting. */
export type ActionClass =
  | "cost_optimization"     // Rightsize, decommission idle, schedule stop
  | "security_remediation"  // Close public access, rotate keys, tighten SG
  | "drift_correction"      // Restore desired state from baseline
  | "scaling"               // Up/down scaling of compute or storage
  | "iam_modification"      // IAM policy / role / binding changes
  | "network_modification"  // VPC, subnet, peering, firewall changes
  | "database_modification" // Parameter group, instance type, replica changes
  | "secret_rotation"
  | "release_promotion"     // ReleaseOps promotion through environments
  | "release_rollback"
  | "other";

// ---------------------------------------------------------------------------
// Approver model
// ---------------------------------------------------------------------------

export type ApproverScope = "any_member" | "approver_role" | "resource_owner" | "environment_owner" | "external_change_management";

export interface ApprovalRequirement {
  /** Number of distinct approvers required. */
  count: number;
  /** Who can serve as an approver. */
  scope: ApproverScope;
  /** External CR (ServiceNow, PagerDuty) required before approval flows complete. */
  externalChangeRequest?: boolean;
  /** Block window — approval cannot be auto-applied if request was older than this. */
  expirySec?: number;
}

// ---------------------------------------------------------------------------
// Proposed action input
// ---------------------------------------------------------------------------

export interface ProposedAction {
  provider: CloudProvider;
  actionClass: ActionClass;
  /** Number of cloud resources this action affects. */
  affectedResources: number;
  /** Environment this action runs against. */
  environment?: "production" | "staging" | "development" | "qa";
  /** Risk classification from the planner. */
  risk: ActionRisk;
  /** Is a pre-verified rollback path available? */
  rollbackVerified: boolean;
  /** Measured rollback RTO in seconds. */
  rollbackRtoSec?: number;
  /** Per-action-class success streak — used by Trust Ladder. */
  successStreak?: number;
}

// ---------------------------------------------------------------------------
// Trust Ladder configuration
// ---------------------------------------------------------------------------

export interface TrustLadderConfig {
  /** Action classes the org has explicitly opted into auto-apply for. */
  autoApplyClasses: ActionClass[];
  /** Minimum consecutive successful outcomes required to auto-apply. */
  successStreakThreshold: number;
  /** Hard cap: action classes that can NEVER be auto-applied. */
  blockedFromAutoApply: ActionClass[];
}

const DEFAULT_TRUST_LADDER: TrustLadderConfig = {
  autoApplyClasses: [],   // Opt-in by org — none by default
  successStreakThreshold: 25,
  blockedFromAutoApply: [
    "iam_modification",
    "network_modification",
    "database_modification",
    "secret_rotation",
    "release_rollback",
  ],
};

// ---------------------------------------------------------------------------
// Policy evaluation result
// ---------------------------------------------------------------------------

export interface PolicyDecision {
  /** Whether the action can proceed at all. */
  allowed: boolean;
  /** If not allowed, why. */
  blockReason?: string;
  /** Whether human approval is required before apply. */
  approvalRequired: boolean;
  /** Approval requirement details. */
  requirement?: ApprovalRequirement;
  /** Whether the action qualifies for Trust Ladder auto-apply. */
  autoApplyEligible: boolean;
  /** Human-readable explanation of the decision. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

function blastRadiusFromCount(affected: number): BlastRadius {
  if (affected <= 5) return "contained";
  if (affected <= 20) return "moderate";
  return "broad";
}

/**
 * Evaluate a proposed action against the approval policy.
 * Returns a typed decision the execution engine + UI can both consume.
 */
export function evaluatePolicy(
  action: ProposedAction,
  ladder: TrustLadderConfig = DEFAULT_TRUST_LADDER
): PolicyDecision {
  const blast = blastRadiusFromCount(action.affectedResources);

  // Block conditions — these are hard "no" outcomes.
  if (!action.rollbackVerified && action.risk !== "low") {
    return {
      allowed: false,
      blockReason: "Rollback path not verified for medium/high risk action.",
      approvalRequired: true,
      autoApplyEligible: false,
      explanation: "Pre-verified rollback is required for any non-low-risk action. Verify the rollback path before this can proceed.",
    };
  }

  if (action.environment === "production" && action.risk === "high" && blast === "broad") {
    // Broad blast + high risk in production = require multi-party approval, no auto-apply
    return {
      allowed: true,
      approvalRequired: true,
      requirement: { count: 2, scope: "approver_role", externalChangeRequest: true, expirySec: 86400 },
      autoApplyEligible: false,
      explanation: "Broad blast radius + high risk in production requires multi-party approval and an external change request.",
    };
  }

  // Trust Ladder evaluation
  const optInClass = ladder.autoApplyClasses.includes(action.actionClass);
  const blockedClass = ladder.blockedFromAutoApply.includes(action.actionClass);
  const streak = action.successStreak ?? 0;
  const meetsStreak = streak >= ladder.successStreakThreshold;

  const autoApplyEligible =
    action.risk === "low" &&
    optInClass &&
    !blockedClass &&
    meetsStreak &&
    action.rollbackVerified;

  if (autoApplyEligible) {
    return {
      allowed: true,
      approvalRequired: false,
      autoApplyEligible: true,
      explanation: `Auto-apply eligible: low-risk + opt-in action class + success streak ${streak}/${ladder.successStreakThreshold} + verified rollback.`,
    };
  }

  // Default: approval required. Tier varies by risk.
  if (action.risk === "high") {
    return {
      allowed: true,
      approvalRequired: true,
      requirement: { count: 2, scope: "approver_role", expirySec: 86400 },
      autoApplyEligible: false,
      explanation: "High-risk action requires multi-party approval.",
    };
  }

  if (action.risk === "medium") {
    return {
      allowed: true,
      approvalRequired: true,
      requirement: { count: 1, scope: "approver_role", expirySec: 86400 },
      autoApplyEligible: false,
      explanation: "Medium-risk action requires single-approver review with verified rollback.",
    };
  }

  // Low risk, not Trust-Ladder eligible
  return {
    allowed: true,
    approvalRequired: true,
    requirement: { count: 1, scope: "any_member", expirySec: 86400 },
    autoApplyEligible: false,
    explanation: "Low-risk action — single approval required by default. Trust Ladder can promote this class to auto-apply after measured success.",
  };
}

/**
 * Pretty-format a policy decision for UI consumption. Stable structure
 * suitable for rendering in approval prompts.
 */
export function decisionSummary(decision: PolicyDecision): {
  status: "blocked" | "auto" | "approval";
  headline: string;
  detail: string;
} {
  if (!decision.allowed) {
    return {
      status: "blocked",
      headline: "Blocked at governance gate",
      detail: decision.blockReason ?? decision.explanation,
    };
  }
  if (decision.autoApplyEligible) {
    return {
      status: "auto",
      headline: "Auto-apply eligible",
      detail: decision.explanation,
    };
  }
  return {
    status: "approval",
    headline: decision.requirement
      ? `Requires ${decision.requirement.count} approval${decision.requirement.count > 1 ? "s" : ""}`
      : "Requires approval",
    detail: decision.explanation,
  };
}

export { DEFAULT_TRUST_LADDER };

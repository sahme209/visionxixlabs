/**
 * Next-Best-Action Engine — typed contract.
 *
 * Consumes the PriorityReport (the ranked output of the Priority Engine)
 * and emits operator action recommendations classified by safety level.
 *
 * Every action is mapped to a literal safetyLevel that cannot be elevated
 * by user input. Mutation safety levels are NEVER produced by this engine.
 *
 * No fake automation. No hidden chain-of-thought. The mapping from a
 * priority item to an action is deterministic and auditable.
 */

export type ActionSafetyLevel =
  /** Pure read-only operation. Safe to suggest at any time. */
  | "safe_readonly"
  /** Opens a review surface for human inspection. No state change. */
  | "safe_review"
  /** Renders a preview (Terraform/CLI/simulation). No real mutation. */
  | "safe_preview"
  /** Action requires explicit operator approval before downstream effects. */
  | "approval_required"
  /** Cannot proceed until external config is supplied. */
  | "blocked_by_config"
  /** Cannot proceed until a policy decision is satisfied. */
  | "blocked_by_policy"
  /** Disabled by safety contract — the engine will never emit this. */
  | "disabled";

export type ActionType =
  | "configure_credentials"
  | "validate_source"
  | "run_readonly_scan"
  | "run_readonly_sync"
  | "review_finding"
  | "prepare_remediation"
  | "create_simulation"
  | "request_approval"
  | "review_on_desktop"
  | "export_evidence"
  | "review_policy_blocker"
  | "review_risk_queue"
  | "open_trust_center"
  | "assign_owner"
  | "review_setup_wizard"
  | "review_integration_health"
  | "review_recurring_issue";

export type ActionUrgency = "now" | "this_week" | "this_month" | "scheduled";

export interface NextActionItem {
  id: string;
  rank: number;
  title: string;
  description: string;
  actionType: ActionType;
  safetyLevel: ActionSafetyLevel;
  urgency: ActionUrgency;

  /** Operator-readable rationale (consumes the priority item's whyItMatters). */
  reasonSummary: string;
  /** What the operator should expect after performing the action. */
  expectedOutcome: string;
  /** Is the action reversible? (Always true for the actions this engine emits.) */
  reversible: true;
  /** Can the operator run this right now? false when blocked. */
  canRunNow: boolean;
  /** Block reason when canRunNow=false. */
  blockedReason?: string;

  sourceSystem: string;
  sourceMode: string;

  /** Backlink to the priority item this action was derived from. */
  linkedPriorityId?: string;

  route: { label: string; href: string };
  evidenceRefs: string[];
  limitations: string[];
}

export interface NextActionReport {
  generatedAt: string;
  tenantId?: string;
  items: NextActionItem[];
  summary: {
    total: number;
    canRunNow: number;
    approvalRequired: number;
    blockedByConfig: number;
    blockedByPolicy: number;
    bySafetyLevel: Record<ActionSafetyLevel, number>;
  };
  /** Hard-literal contract — this engine never emits mutation actions. */
  safetyContract: "no_mutation_actions_emitted";
  limitations: string[];
  /** Where to go from the aggregator view. */
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual / label helpers
// ---------------------------------------------------------------------------

export const SAFETY_LABEL: Record<ActionSafetyLevel, string> = {
  safe_readonly:      "Safe · read-only",
  safe_review:        "Safe · review",
  safe_preview:       "Safe · preview",
  approval_required:  "Approval required",
  blocked_by_config:  "Blocked · config",
  blocked_by_policy:  "Blocked · policy",
  disabled:           "Disabled",
};

export const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  configure_credentials:        "Configure credentials",
  validate_source:              "Validate source",
  run_readonly_scan:            "Run read-only scan",
  run_readonly_sync:            "Run read-only sync",
  review_finding:               "Review finding",
  prepare_remediation:          "Prepare remediation",
  create_simulation:            "Create simulation",
  request_approval:             "Request approval",
  review_on_desktop:            "Review on desktop",
  export_evidence:              "Export evidence",
  review_policy_blocker:        "Review policy blocker",
  review_risk_queue:            "Review risk queue",
  open_trust_center:            "Open Trust Center",
  assign_owner:                 "Assign owner",
  review_setup_wizard:          "Review setup wizard",
  review_integration_health:    "Review integration health",
  review_recurring_issue:       "Review recurring issue",
};

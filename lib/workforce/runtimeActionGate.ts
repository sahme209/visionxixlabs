/**
 * Workforce runtime action gate.
 *
 * Heart of Phase 362. Pure function (no DB, no I/O) that maps an
 * engineer action attempt to a typed verdict the caller MUST honor
 * before any external mutation. Bound at the boundary:
 *
 *   1. Caller assembles EngineerActionAttempt (workspaceId, engineerId,
 *      module, tool, action, riskLevel, requestedBy, metadata).
 *   2. Caller passes the canonical engineer + the workspace-tightened
 *      approval rule (read from AgentEngineerRecord; falls back to the
 *      canonical defaultApprovalRule).
 *   3. Gate returns ActionVerdict — closed-union of allowed,
 *      requires_approval, blocked.
 *   4. Caller MUST act on the verdict — execute, stage approval, or
 *      refuse.
 *
 * Invariant enforced:
 *   - blocked_always never collapses to anything else.
 *   - read-only actions can only be auto-allowed when the rule allows
 *     it AND the action is genuinely read-only.
 *   - dangerous actions default to blocked even when the rule is
 *     looser (defense in depth).
 *   - workspace override can tighten, never loosen — separate helper
 *     canTightenApprovalRule().
 */

import type {
  AgentEngineer,
  ApprovalRule,
} from "./agentWorkforceRegistry";

export type ActionRiskLevel = "read_only" | "low" | "medium" | "high" | "critical";

export interface EngineerActionAttempt {
  /** Workspace this action is happening in. */
  workspaceId: string;
  /** Stable engineer id from the registry. */
  engineerId: string;
  /** Module / sub-tool this action belongs to. */
  module?: string;
  /** Connector / tool this action targets. */
  connector?: string;
  /** Free-text action label — e.g. "scan_repo", "apply_terraform". */
  action: string;
  /** Risk level declared by the caller. */
  riskLevel: ActionRiskLevel;
  /** Whether this action only reads (never mutates). */
  isReadOnly: boolean;
  /** Operator/agent attempting the action. */
  requestedBy: string;
  /** Optional structured metadata for audit + approval packets. */
  metadata?: Record<string, string | number | boolean>;
}

export type AuditTopic =
  | "engineer.action_attempted"
  | "engineer.action_allowed"
  | "engineer.action_requires_approval"
  | "engineer.action_blocked"
  | "engineer.approval_created"
  | "engineer.policy_override_updated"
  | "engineer.registry_synced";

export type RuntimeDecision = "allowed" | "requires_approval" | "blocked";

export interface ActionVerdict {
  decision: RuntimeDecision;
  /** The approval rule in force at the moment of decision. */
  effectiveRule: ApprovalRule;
  /** Where the effective rule came from. */
  policySource: "canonical_default" | "workspace_override" | "engineer_disabled" | "engineer_unknown" | "policy_block_invariant" | "risk_floor_block";
  /** Reason copy for the UI + audit row. */
  reason: string;
  /** Audit topic to emit immediately. */
  auditTopic: AuditTopic;
  /** Number of approvers required when decision === "requires_approval". */
  requiredApprovers: number;
  /** Safe operator-readable next step. */
  safeNextStep: string;
}

export interface ResolveContext {
  /** Canonical engineer from agentWorkforceRegistry. May be undefined when caller passed an unknown id. */
  engineer: AgentEngineer | undefined;
  /** Workspace-tightened approval rule if the admin tightened it. */
  workspaceOverride?: ApprovalRule;
  /** Whether the admin disabled this engineer in this workspace. */
  workspaceEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Tightening invariant
// ---------------------------------------------------------------------------

/**
 * Strict ordering of approval rules from loosest to tightest.
 * The gate uses this to enforce: workspace overrides can only move
 * along this list to the right.
 */
const RULE_TIGHTNESS: Record<ApprovalRule, number> = {
  no_approval_needed:      0,
  single_approver:         1,
  two_step_approval:       2,
  incident_commander_only: 3,
  blocked_always:          4,
};

export function canTightenApprovalRule(from: ApprovalRule, to: ApprovalRule): boolean {
  // Allow keeping the same rule (idempotent set) AND only allow moves to a
  // strictly higher tightness. Never allow loosening below the canonical floor.
  return RULE_TIGHTNESS[to] >= RULE_TIGHTNESS[from];
}

/**
 * Returns the tightest of two rules. Used to combine canonical + override.
 * Never loosens.
 */
export function tightest(a: ApprovalRule, b: ApprovalRule): ApprovalRule {
  return RULE_TIGHTNESS[a] >= RULE_TIGHTNESS[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Risk-floor: dangerous actions can't be auto-allowed even if the rule is loose
// ---------------------------------------------------------------------------

const RISK_FLOOR: Record<ActionRiskLevel, ApprovalRule> = {
  read_only: "no_approval_needed",
  low:       "no_approval_needed",
  medium:    "single_approver",
  high:      "two_step_approval",
  critical:  "two_step_approval",
};

/**
 * Defense in depth — a critical action ALWAYS requires at least
 * two-step approval, regardless of what the engineer's rule says.
 */
function applyRiskFloor(rule: ApprovalRule, risk: ActionRiskLevel): ApprovalRule {
  return tightest(rule, RISK_FLOOR[risk]);
}

// ---------------------------------------------------------------------------
// Main gate
// ---------------------------------------------------------------------------

export function evaluateEngineerActionAttempt(
  attempt: EngineerActionAttempt,
  ctx: ResolveContext,
): ActionVerdict {
  // Case 1 — engineer not in the registry. Block conservatively.
  if (!ctx.engineer) {
    return {
      decision: "blocked",
      effectiveRule: "blocked_always",
      policySource: "engineer_unknown",
      reason: `Unknown engineer id "${attempt.engineerId}" — refusing to execute.`,
      auditTopic: "engineer.action_blocked",
      requiredApprovers: 0,
      safeNextStep: "Re-sync the workforce registry for this workspace or pick a known engineer id.",
    };
  }

  // Case 2 — engineer explicitly disabled in this workspace.
  if (ctx.workspaceEnabled === false) {
    return {
      decision: "blocked",
      effectiveRule: "blocked_always",
      policySource: "engineer_disabled",
      reason: `Engineer "${ctx.engineer.displayName}" is disabled in this workspace.`,
      auditTopic: "engineer.action_blocked",
      requiredApprovers: 0,
      safeNextStep: "Workspace admin can re-enable in /dashboard/workforce/<id>/edit.",
    };
  }

  // Case 3 — internal_admin engineer leaked into a client workspace.
  // The sync function should never have created the record, but defend
  // against it here as well.
  if (ctx.engineer.productLayer === "internal_admin" && !attempt.workspaceId.startsWith("ws_internal_admin")) {
    return {
      decision: "blocked",
      effectiveRule: "blocked_always",
      policySource: "engineer_disabled",
      reason: `Internal-only engineer "${ctx.engineer.displayName}" is not available in client workspaces.`,
      auditTopic: "engineer.action_blocked",
      requiredApprovers: 0,
      safeNextStep: "Use a client-layer engineer or run this from the VisionXIXLabs internal workspace.",
    };
  }

  // Combine the canonical default + any workspace override (tighter only),
  // then apply the risk floor. Track whether the override actually moved
  // the rule so policySource reflects what truly won.
  const canonical = ctx.engineer.approvalRule;
  const override = ctx.workspaceOverride;
  const overrideEffective =
    override !== undefined &&
    canTightenApprovalRule(canonical, override) &&
    RULE_TIGHTNESS[override] > RULE_TIGHTNESS[canonical];
  const baseRule = overrideEffective ? override : canonical;
  const effectiveRule = applyRiskFloor(baseRule, attempt.riskLevel);

  // Case 4 — policy invariant: blocked_always means blocked.
  if (effectiveRule === "blocked_always") {
    return {
      decision: "blocked",
      effectiveRule,
      policySource: "policy_block_invariant",
      reason: `Action class "${attempt.action}" is policy-blocked for ${ctx.engineer.displayName}.`,
      auditTopic: "engineer.action_blocked",
      requiredApprovers: 0,
      safeNextStep: "This action class never runs — even with approval. Audit row written.",
    };
  }

  // Case 5 — read-only actions can fast-path only under no_approval_needed AND only
  // when the caller honestly declared the action as read-only.
  if (effectiveRule === "no_approval_needed" && attempt.isReadOnly && attempt.riskLevel === "read_only") {
    return {
      decision: "allowed",
      effectiveRule,
      policySource: overrideEffective ? "workspace_override" : "canonical_default",
      reason: `Read-only action — no approval gate applies.`,
      auditTopic: "engineer.action_allowed",
      requiredApprovers: 0,
      safeNextStep: "Action allowed to proceed. Audit row written.",
    };
  }

  // Case 6 — declared read-only but risk-level says otherwise (caller bug). Block.
  if (attempt.isReadOnly && attempt.riskLevel !== "read_only") {
    return {
      decision: "blocked",
      effectiveRule,
      policySource: "risk_floor_block",
      reason: `Caller declared isReadOnly=true but riskLevel="${attempt.riskLevel}" — inconsistency, refusing.`,
      auditTopic: "engineer.action_blocked",
      requiredApprovers: 0,
      safeNextStep: "Fix the caller: read-only actions must declare riskLevel='read_only'.",
    };
  }

  // Case 7 — any other rule means approval required.
  const requiredApprovers =
    effectiveRule === "two_step_approval"       ? 2 :
    effectiveRule === "incident_commander_only" ? 1 :
    effectiveRule === "single_approver"         ? 1 :
                                                  0;

  return {
    decision: "requires_approval",
    effectiveRule,
    policySource: overrideEffective ? "workspace_override" : "canonical_default",
    reason: `Action requires ${requiredApprovers === 2 ? "two approvals" : "one approval"} per workspace policy.`,
    auditTopic: "engineer.action_requires_approval",
    requiredApprovers,
    safeNextStep: `Approval request created — surface in /dashboard/approvals for ${ctx.engineer.displayName}.`,
  };
}

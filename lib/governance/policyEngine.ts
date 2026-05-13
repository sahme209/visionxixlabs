/**
 * Governance policy engine.
 *
 * Evaluates a proposed action against the configured policy pack and the
 * tenant's autonomy level. Returns a typed PolicyEvaluationResult the
 * execution control plane + UI both consume.
 *
 * Pure function over typed inputs. Decisions are deterministic and explainable.
 */

import {
  type PolicyRule,
  type PolicySignalMap,
  type PolicyDecision,
  type PolicySeverity,
  ruleMatches,
} from "@/lib/governance/policyModel";
import { DEFAULT_POLICY_PACK } from "@/lib/governance/defaultPolicies";
import { type TenantAutonomy, type AutonomyLevel, specFor } from "@/lib/governance/autonomyLevels";

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export interface MatchedRule {
  rule: PolicyRule;
  /** Why this rule matched — list of (signal, op, value) tuples that fired. */
  matchedConditions: { signal: string; op: string; value?: unknown }[];
}

export interface PolicyEvaluationResult {
  /** Final decision from the engine. */
  decision: PolicyDecision;
  /** Whether the action is allowed to proceed. */
  allowed: boolean;
  /** Whether approval is required before apply. */
  approvalRequired: boolean;
  /** Whether the action is blocked entirely. */
  blocked: boolean;
  /** Severity of the strongest matching rule. */
  severity: PolicySeverity;
  /** Number of approvers required (max across matched rules). */
  approversRequired: number;
  /** Approver role (most-restrictive across matched rules). */
  approverRole?: string;
  /** Rollback plan required by any matched rule. */
  rollbackRequired: boolean;
  /** Audit event required by any matched rule. */
  auditRequired: boolean;
  /** Verification check kinds required by any matched rule. */
  verificationsRequired: string[];
  /** Rules that matched, in priority order (block > require_approval > allow). */
  matched: MatchedRule[];
  /** Autonomy ceiling — true if the action is within the tenant's autonomy level. */
  withinAutonomyCeiling: boolean;
  /** Plain-English reason. */
  reason: string;
  /** Safe next action the user can take. */
  safeNextAction: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface EngineConfig {
  /** Tenant's active autonomy state. */
  autonomy: TenantAutonomy;
  /** Active rule pack — defaults to DEFAULT_POLICY_PACK if omitted. */
  rules?: PolicyRule[];
}

const SEVERITY_ORDER: PolicySeverity[] = ["info", "low", "medium", "high", "critical"];
const DECISION_PRIORITY: Record<PolicyDecision, number> = { allow: 0, require_approval: 1, block: 2 };

const APPROVER_RESTRICTIVENESS: Record<string, number> = {
  any_member: 0,
  resource_owner: 1,
  approver_role: 2,
  environment_owner: 3,
  external_change_management: 4,
};

/**
 * Evaluate a proposed action against the policy pack.
 */
export function evaluateAction(signals: PolicySignalMap, config: EngineConfig): PolicyEvaluationResult {
  const rules = config.rules ?? DEFAULT_POLICY_PACK;
  const matched: MatchedRule[] = [];

  for (const rule of rules) {
    if (ruleMatches(rule, signals)) {
      matched.push({
        rule,
        matchedConditions: rule.conditions.map((c) => ({ signal: c.signal, op: c.op, value: c.value })),
      });
    }
  }

  // Sort matched rules: block > require_approval > allow, then by severity
  matched.sort((a, b) => {
    const dDiff = DECISION_PRIORITY[b.rule.decision] - DECISION_PRIORITY[a.rule.decision];
    if (dDiff !== 0) return dDiff;
    return SEVERITY_ORDER.indexOf(b.rule.severity) - SEVERITY_ORDER.indexOf(a.rule.severity);
  });

  // Compose final result
  let decision: PolicyDecision = "allow";
  for (const m of matched) {
    if (DECISION_PRIORITY[m.rule.decision] > DECISION_PRIORITY[decision]) decision = m.rule.decision;
  }

  const blocked = decision === "block";
  const approvalRequired = decision === "require_approval";

  // Approvers required = max across matched rules
  const approversRequired = Math.max(0, ...matched.map((m) => m.rule.requiredApprovers ?? 0));
  // Approver role = most restrictive across matched rules
  let approverRole: string | undefined;
  for (const m of matched) {
    if (!m.rule.requiredApproverRole) continue;
    if (!approverRole || (APPROVER_RESTRICTIVENESS[m.rule.requiredApproverRole] ?? 0) > (APPROVER_RESTRICTIVENESS[approverRole] ?? 0)) {
      approverRole = m.rule.requiredApproverRole;
    }
  }

  const rollbackRequired = matched.some((m) => m.rule.requireRollback === true);
  const auditRequired = matched.some((m) => m.rule.requireAudit === true);
  const verificationsRequired = uniqueStrings(matched.flatMap((m) => m.rule.requireVerifications ?? []));

  const severity = matched.length === 0
    ? "info"
    : (matched[0]?.rule.severity ?? "info");

  // Autonomy ceiling check
  const withinAutonomyCeiling = checkAutonomyCeiling(signals, config.autonomy.level);

  // If autonomy ceiling is breached, force approval
  let finalDecision = decision;
  let finalApprovalRequired = approvalRequired;
  if (!withinAutonomyCeiling && finalDecision === "allow") {
    finalDecision = "require_approval";
    finalApprovalRequired = true;
  }

  const reason = buildReason(matched, signals, withinAutonomyCeiling);
  const safeNextAction = buildSafeNextAction(finalDecision, matched, withinAutonomyCeiling, config.autonomy.level);

  return {
    decision: finalDecision,
    allowed: !blocked && (!finalApprovalRequired || finalApprovalRequired),
    approvalRequired: finalApprovalRequired,
    blocked,
    severity,
    approversRequired,
    approverRole,
    rollbackRequired,
    auditRequired,
    verificationsRequired,
    matched,
    withinAutonomyCeiling,
    reason,
    safeNextAction,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkAutonomyCeiling(signals: PolicySignalMap, level: AutonomyLevel): boolean {
  const spec = specFor(level);
  // Apply / auto_apply actions require level 4+ / 5
  const isApply = signals.action_type === "apply" || signals.action_type === "execute";
  const isAutoApply = signals.action_type === "auto_apply";

  if (isAutoApply && level < 5) return false;
  if (isApply && !spec.capabilities.includes("execution_with_approval") && !spec.capabilities.includes("auto_apply_low_risk_only")) {
    return false;
  }
  return true;
}

function buildReason(matched: MatchedRule[], signals: PolicySignalMap, withinAutonomy: boolean): string {
  if (matched.length === 0 && withinAutonomy) return "No policy rules matched — action allowed under current autonomy level.";
  if (!withinAutonomy) return "Action exceeds the tenant's current autonomy ceiling.";
  const top = matched[0];
  if (top.rule.decision === "block") return `Blocked by ${top.rule.name} (${top.rule.id}).`;
  if (top.rule.decision === "require_approval") return `Approval required by ${top.rule.name} (${top.rule.id}).`;
  return `Allowed by all matched rules. Audit/rollback/verification requirements still apply.`;
  void signals;
}

function buildSafeNextAction(decision: PolicyDecision, matched: MatchedRule[], withinAutonomy: boolean, level: AutonomyLevel): string {
  if (!withinAutonomy) {
    return `Raise autonomy level (currently ${level}) via tenant policy — or downgrade the proposed action.`;
  }
  if (decision === "block") {
    const top = matched.find((m) => m.rule.decision === "block");
    if (top?.rule.requireRollback) return "Verify rollback path and re-evaluate.";
    return "Address the blocker indicated by the matched rule, then re-evaluate.";
  }
  if (decision === "require_approval") {
    return "Route to approver and proceed once approval is captured.";
  }
  return "Proceed with apply — audit + verification will run automatically.";
}

function uniqueStrings(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

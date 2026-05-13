/**
 * Policy explanation — turns a PolicyEvaluationResult into typed,
 * user-friendly UI-ready data. No black-box governance.
 */

import type { PolicyEvaluationResult, MatchedRule } from "@/lib/governance/policyEngine";
import type { TenantAutonomy } from "@/lib/governance/autonomyLevels";

export interface PolicyExplanation {
  /** Headline status: allowed / approval / blocked / autonomy-blocked. */
  status: "allowed" | "approval" | "blocked" | "autonomy_blocked";
  /** Severity hint for UI emphasis. */
  severity: "info" | "warning" | "critical";
  /** Headline sentence. */
  headline: string;
  /** Detail paragraph. */
  detail: string;
  /** Bulleted list of rules that fired. */
  appliedRules: { id: string; name: string; severity: string; decision: string }[];
  /** Evidence list — what signals drove each matched rule. */
  evidence: { ruleId: string; conditions: { signal: string; op: string; value?: unknown }[] }[];
  /** What the user can do next. */
  nextStep: string;
  /** Whether rollback is required. */
  rollbackRequired: boolean;
  /** Whether audit is required. */
  auditRequired: boolean;
  /** Verifications required. */
  verificationsRequired: string[];
  /** Approval information. */
  approval?: {
    role?: string;
    count: number;
  };
  /** Autonomy context surfaced to the user. */
  autonomy: {
    currentLevel: number;
    withinCeiling: boolean;
  };
}

/**
 * Build a user-facing explanation from a typed policy result.
 */
export function explain(result: PolicyEvaluationResult, autonomy: TenantAutonomy): PolicyExplanation {
  const status: PolicyExplanation["status"] =
    result.blocked ? "blocked" :
    !result.withinAutonomyCeiling ? "autonomy_blocked" :
    result.approvalRequired ? "approval" :
    "allowed";

  const severity: PolicyExplanation["severity"] =
    status === "blocked" ? "critical" :
    status === "autonomy_blocked" ? "warning" :
    status === "approval" ? "warning" :
    "info";

  const headline =
    status === "blocked" ? "Blocked at governance gate" :
    status === "autonomy_blocked" ? `Above current autonomy ceiling (Level ${autonomy.level})` :
    status === "approval" ? `Approval required · ${result.approversRequired || 1} approver${result.approversRequired === 1 ? "" : "s"}` :
    "Allowed under current policy";

  return {
    status,
    severity,
    headline,
    detail: result.reason,
    appliedRules: result.matched.map((m) => ({
      id: m.rule.id,
      name: m.rule.name,
      severity: m.rule.severity,
      decision: m.rule.decision,
    })),
    evidence: result.matched.map((m) => ({
      ruleId: m.rule.id,
      conditions: m.matchedConditions,
    })),
    nextStep: result.safeNextAction,
    rollbackRequired: result.rollbackRequired,
    auditRequired: result.auditRequired,
    verificationsRequired: result.verificationsRequired,
    approval: result.approvalRequired
      ? { role: result.approverRole, count: result.approversRequired || 1 }
      : undefined,
    autonomy: {
      currentLevel: autonomy.level,
      withinCeiling: result.withinAutonomyCeiling,
    },
  };
}

/**
 * Build a one-line summary of which rules drove a decision — used for audit logs.
 */
export function auditSummary(matched: MatchedRule[]): string {
  if (matched.length === 0) return "no policy rules matched";
  return matched.map((m) => `${m.rule.id}(${m.rule.decision})`).join(" · ");
}

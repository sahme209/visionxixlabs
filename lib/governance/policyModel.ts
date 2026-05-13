/**
 * Governance policy model — typed rule definitions.
 *
 * Rules are deliberately structured (predicate + decision + metadata) so
 * they can be evaluated deterministically, audited, and explained to users.
 * No free-text logic.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// Policy categories + decisions
// ---------------------------------------------------------------------------

export type PolicyCategory =
  | "security"
  | "cost"
  | "compliance"
  | "reliability"
  | "release_governance"
  | "execution_safety"
  | "desktop_execution"
  | "access_control"
  | "auditability"
  | "rollback"
  | "autonomy_boundary";

export type PolicyDecision = "allow" | "require_approval" | "block";

export type PolicySeverity = "info" | "low" | "medium" | "high" | "critical";

export type ApproverRole = "any_member" | "approver_role" | "resource_owner" | "environment_owner" | "external_change_management";

// ---------------------------------------------------------------------------
// Scope of a policy
// ---------------------------------------------------------------------------

export interface PolicyScope {
  /** Empty array = any provider. */
  providers?: CloudProvider[];
  /** Empty array = any resource type. */
  resourceTypes?: string[];
  /** Empty array = any action type. */
  actionTypes?: string[];
  /** Empty array = any environment. */
  environments?: ("production" | "staging" | "development" | "qa")[];
}

// ---------------------------------------------------------------------------
// Condition predicate model
//
// Conditions are evaluated as ALL-MUST-MATCH against the proposed action's
// signal map. Each condition is a typed comparator over a signal name.
// ---------------------------------------------------------------------------

export type ConditionOp =
  | "equals" | "not_equals"
  | "in" | "not_in"
  | "greater_than" | "less_than" | "gte" | "lte"
  | "is_true" | "is_false"
  | "matches"           // string regex
  | "contains";

export interface PolicyCondition {
  /** Signal name to evaluate (e.g., "risk", "blast_radius", "rollback_verified"). */
  signal: string;
  op: ConditionOp;
  /** Comparison value. Type depends on op. */
  value?: string | number | boolean | string[];
}

// ---------------------------------------------------------------------------
// Rule structure
// ---------------------------------------------------------------------------

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  scope: PolicyScope;
  severity: PolicySeverity;
  /** ALL conditions must match for the rule to fire. */
  conditions: PolicyCondition[];
  /** Decision when the rule matches. */
  decision: PolicyDecision;
  /** Required approver role when decision === "require_approval". */
  requiredApproverRole?: ApproverRole;
  /** Number of approvers required. */
  requiredApprovers?: number;
  /** Rule requires a verified rollback plan to proceed. */
  requireRollback?: boolean;
  /** Rule requires an immutable audit event before/after. */
  requireAudit?: boolean;
  /** Rule requires specific verification check kinds. */
  requireVerifications?: string[];
  /** Whether the rule is currently active. */
  enabled: boolean;
  /** Provenance — who shipped or modified this rule. */
  source: "default" | "tenant" | "vendor_recommended";
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Signal map — the input the engine evaluates against
// ---------------------------------------------------------------------------

export interface PolicySignalMap {
  provider?: CloudProvider;
  resource_type?: string;
  action_type?: string;
  environment?: "production" | "staging" | "development" | "qa";
  risk?: "low" | "medium" | "high";
  blast_radius?: "contained" | "moderate" | "broad" | "critical";
  monthly_cost_impact_usd?: number;
  security_impact?: "none" | "low" | "high";
  data_impact?: "none" | "low" | "high";
  rollback_verified?: boolean;
  rollback_complexity?: "trivial" | "moderate" | "complex" | "high";
  verification_coverage?: number; // 0..1
  confidence?: number;            // 0..1
  user_role?: string;
  tenant_policy_id?: string;
  release_environment?: "production" | "staging" | "development" | "qa";
  desktop_runtime_present?: boolean;
  desktop_workstation_mode?: boolean;
  provider_permissions_verified?: boolean;
  is_destructive?: boolean;
  /** Additional ad-hoc signals can be injected. */
  [key: string]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Condition evaluation — pure function
// ---------------------------------------------------------------------------

export function evaluateCondition(condition: PolicyCondition, signals: PolicySignalMap): boolean {
  const value = signals[condition.signal];
  const compare = condition.value;

  switch (condition.op) {
    case "equals": return value === compare;
    case "not_equals": return value !== compare;
    case "in": return Array.isArray(compare) && (compare as Array<string | number>).includes(value as string | number);
    case "not_in": return Array.isArray(compare) && !(compare as Array<string | number>).includes(value as string | number);
    case "greater_than": return typeof value === "number" && typeof compare === "number" && value > compare;
    case "less_than": return typeof value === "number" && typeof compare === "number" && value < compare;
    case "gte": return typeof value === "number" && typeof compare === "number" && value >= compare;
    case "lte": return typeof value === "number" && typeof compare === "number" && value <= compare;
    case "is_true": return value === true;
    case "is_false": return value === false;
    case "matches": {
      if (typeof value !== "string" || typeof compare !== "string") return false;
      try { return new RegExp(compare).test(value); } catch { return false; }
    }
    case "contains": {
      if (typeof value !== "string" || typeof compare !== "string") return false;
      return value.includes(compare);
    }
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Rule predicate — pure function
// ---------------------------------------------------------------------------

export function ruleMatches(rule: PolicyRule, signals: PolicySignalMap): boolean {
  if (!rule.enabled) return false;
  // Scope filters
  if (rule.scope.providers?.length && signals.provider && !rule.scope.providers.includes(signals.provider)) return false;
  if (rule.scope.resourceTypes?.length && signals.resource_type && !rule.scope.resourceTypes.includes(signals.resource_type)) return false;
  if (rule.scope.actionTypes?.length && signals.action_type && !rule.scope.actionTypes.includes(signals.action_type)) return false;
  if (rule.scope.environments?.length && signals.environment && !rule.scope.environments.includes(signals.environment)) return false;
  // All conditions must match
  return rule.conditions.every((c) => evaluateCondition(c, signals));
}

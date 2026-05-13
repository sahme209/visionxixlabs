/**
 * Default enterprise policy pack.
 *
 * 15 baseline rules every tenant gets by default. Each rule is explicit,
 * scoped, and explainable. Rules can be disabled or overridden per tenant
 * but cannot be silently bypassed by the agent.
 */

import type { PolicyRule } from "@/lib/governance/policyModel";

const NOW = new Date().toISOString();

function rule(partial: Omit<PolicyRule, "source" | "createdAt" | "updatedAt" | "enabled"> & { enabled?: boolean }): PolicyRule {
  return {
    enabled: true,
    source: "default",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

export const DEFAULT_POLICY_PACK: PolicyRule[] = [
  // 1. Block destructive actions without explicit approval
  rule({
    id: "default.destructive_requires_approval",
    name: "Destructive actions require explicit approval",
    description: "Any destructive action (delete / destroy / terminate) requires explicit multi-party approval and a verified rollback plan.",
    category: "execution_safety",
    severity: "critical",
    scope: {},
    conditions: [{ signal: "is_destructive", op: "is_true" }],
    decision: "require_approval",
    requiredApproverRole: "approver_role",
    requiredApprovers: 2,
    requireRollback: true,
    requireAudit: true,
  }),

  // 2. Require approval for production-impacting changes
  rule({
    id: "default.production_requires_approval",
    name: "Production changes require approval",
    description: "Any change targeting a production environment requires approval routed through the production-environment owner.",
    category: "release_governance",
    severity: "high",
    scope: { environments: ["production"] },
    conditions: [{ signal: "environment", op: "equals", value: "production" }],
    decision: "require_approval",
    requiredApproverRole: "environment_owner",
    requiredApprovers: 1,
    requireRollback: true,
    requireAudit: true,
  }),

  // 3. Require rollback plan for high-risk changes
  rule({
    id: "default.high_risk_requires_rollback",
    name: "High-risk changes require verified rollback",
    description: "Any plan with high risk classification is blocked unless rollback is verified.",
    category: "rollback",
    severity: "high",
    scope: {},
    conditions: [
      { signal: "risk", op: "equals", value: "high" },
      { signal: "rollback_verified", op: "is_false" },
    ],
    decision: "block",
    requireRollback: true,
  }),

  // 4. Require audit event for every execution plan
  rule({
    id: "default.audit_required",
    name: "Audit event required for every execution",
    description: "Every applied execution plan must produce an immutable audit event.",
    category: "auditability",
    severity: "high",
    scope: {},
    conditions: [{ signal: "action_type", op: "matches", value: ".+" }],
    decision: "allow",
    requireAudit: true,
  }),

  // 5. Require verification steps before marking execution complete
  rule({
    id: "default.verification_required",
    name: "Verification required after apply",
    description: "Every applied plan must include post-apply verification before marked complete.",
    category: "execution_safety",
    severity: "medium",
    scope: {},
    conditions: [{ signal: "action_type", op: "matches", value: ".+" }],
    decision: "allow",
    requireVerifications: ["post.state", "post.health"],
  }),

  // 6. Block execution if confidence is below threshold
  rule({
    id: "default.low_confidence_blocked",
    name: "Block execution when confidence is below 0.6",
    description: "Execution plans with confidence below 0.6 are blocked at the governance gate.",
    category: "execution_safety",
    severity: "high",
    scope: {},
    conditions: [{ signal: "confidence", op: "less_than", value: 0.6 }],
    decision: "block",
  }),

  // 7. Block execution if blast radius is unknown for high-risk action
  rule({
    id: "default.unknown_blast_radius_blocked_high_risk",
    name: "Unknown blast radius blocked for high risk",
    description: "Plans without a computed blast radius cannot proceed when risk is high.",
    category: "execution_safety",
    severity: "high",
    scope: {},
    conditions: [
      { signal: "risk", op: "equals", value: "high" },
      { signal: "blast_radius", op: "not_in", value: ["contained", "moderate", "broad", "critical"] },
    ],
    decision: "block",
  }),

  // 8. Require approval for security group / firewall changes
  rule({
    id: "default.firewall_change_requires_approval",
    name: "Firewall changes require approval",
    description: "Security group / NSG / firewall rule changes require approver-role review.",
    category: "security",
    severity: "high",
    scope: { resourceTypes: ["network.firewall"] },
    conditions: [{ signal: "resource_type", op: "equals", value: "network.firewall" }],
    decision: "require_approval",
    requiredApproverRole: "approver_role",
    requiredApprovers: 1,
    requireRollback: true,
    requireAudit: true,
  }),

  // 9. Require approval for IAM permission changes
  rule({
    id: "default.iam_change_requires_approval",
    name: "IAM changes require approval",
    description: "IAM principal/role/policy changes require approver-role review and audit.",
    category: "access_control",
    severity: "high",
    scope: { resourceTypes: ["identity.principal", "identity.role", "identity.policy"] },
    conditions: [{ signal: "resource_type", op: "matches", value: "^identity\\." }],
    decision: "require_approval",
    requiredApproverRole: "approver_role",
    requiredApprovers: 1,
    requireRollback: true,
    requireAudit: true,
  }),

  // 10. Require approval for database / storage changes
  rule({
    id: "default.database_change_requires_approval",
    name: "Database / storage changes require approval",
    description: "Database parameter / storage configuration changes require approval and rollback verification.",
    category: "reliability",
    severity: "high",
    scope: { resourceTypes: ["database.relational", "database.cache", "database.nosql", "storage.object", "storage.block"] },
    conditions: [{ signal: "resource_type", op: "matches", value: "^(database|storage)\\." }],
    decision: "require_approval",
    requiredApproverRole: "resource_owner",
    requiredApprovers: 1,
    requireRollback: true,
    requireAudit: true,
  }),

  // 11. Require approval for ReleaseOps production deployment blockers
  rule({
    id: "default.release_production_blocker",
    name: "Production deployment blockers require approval",
    description: "ReleaseOps production deployments blocked at the readiness gate require explicit approval to override.",
    category: "release_governance",
    severity: "high",
    scope: { environments: ["production"] },
    conditions: [{ signal: "release_environment", op: "equals", value: "production" }],
    decision: "require_approval",
    requiredApproverRole: "environment_owner",
    requiredApprovers: 1,
    requireAudit: true,
  }),

  // 12. Require audit for Terraform export
  rule({
    id: "default.terraform_export_audited",
    name: "Terraform export requires audit",
    description: "Every Terraform export action is audit-logged with the requester identity.",
    category: "auditability",
    severity: "medium",
    scope: {},
    conditions: [{ signal: "action_type", op: "equals", value: "terraform_export" }],
    decision: "allow",
    requireAudit: true,
  }),

  // 13. Require local confirmation for desktop execution handoff
  rule({
    id: "default.desktop_handoff_local_confirm",
    name: "Desktop handoff requires local confirmation",
    description: "Plans handed off to the desktop runtime require local user confirmation before any apply.",
    category: "desktop_execution",
    severity: "medium",
    scope: {},
    conditions: [{ signal: "desktop_runtime_present", op: "is_true" }],
    decision: "require_approval",
    requiredApproverRole: "any_member",
    requiredApprovers: 1,
    requireAudit: true,
  }),

  // 14. Prevent silent autonomy escalation
  rule({
    id: "default.no_silent_autonomy_escalation",
    name: "Autonomy escalation requires explicit policy change",
    description: "Axiom cannot escalate its own autonomy level. Only an organization admin can raise the autonomy level via tenant policy.",
    category: "autonomy_boundary",
    severity: "critical",
    scope: {},
    conditions: [{ signal: "action_type", op: "equals", value: "autonomy_increase" }],
    decision: "block",
  }),

  // 15. Prevent execution if provider permissions are unverified
  rule({
    id: "default.permissions_must_be_verified",
    name: "Provider permissions must be verified before apply",
    description: "Execution plans cannot apply unless the provider's assume-role / Service Principal / Service Account is currently valid.",
    category: "execution_safety",
    severity: "critical",
    scope: {},
    conditions: [{ signal: "provider_permissions_verified", op: "is_false" }],
    decision: "block",
  }),
];

export function getPolicyRule(id: string): PolicyRule | undefined {
  return DEFAULT_POLICY_PACK.find((r) => r.id === id);
}

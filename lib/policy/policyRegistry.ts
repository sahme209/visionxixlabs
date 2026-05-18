/**
 * Policy Registry.
 *
 * Single source of truth for every policy Axiom enforces. Every entry
 * is a declarative rule referenced by the policy evaluator + UI. The
 * registry is closed — adding a policy requires updating this file
 * (and writing an evidence-backed rationale).
 *
 * No policy in this registry enables mutation. The registry is the
 * spine that refuses unsafe automation.
 */

import "server-only";

import type { PolicyRecord } from "./policyModel";

export const POLICY_REGISTRY: PolicyRecord[] = [
  // ------------------------------------------------------------ Read-only
  {
    id: "policy.read_only_by_default",
    category: "read_only_enforcement",
    enforcement: "enforced_always",
    severity: "critical",
    title: "Read-only by default",
    description: "Every provider adapter ships read-only. Mutating call paths are not wired anywhere.",
    rationale: "Read-only by default is the foundation that prevents an accidental apply from any code path.",
    appliesTo: ["aws", "azure", "gcp", "github", "desktop"],
    blockedActions: ["aws_resource_mutation", "azure_resource_mutation", "gcp_resource_mutation", "github_repo_mutation"],
    evidenceRef: "lib/cloud/aws/awsLiveInventory.ts (Describe/List/Get only)",
  },

  // ------------------------------------------------------------ Approval required
  {
    id: "policy.approval_required_for_mutation",
    category: "approval_required",
    enforcement: "enforced_always",
    severity: "critical",
    title: "Mutation requires explicit approval",
    description: "Even when mutation paths land in a future release, they will route through the approval engine.",
    rationale: "The Approval Engine is the human-supervised gate that prevents silent autonomy escalation.",
    appliesTo: ["remediation", "simulation", "desktop_handoff", "scheduled_scans"],
    blockedActions: ["auto_apply_terraform", "auto_apply_cli", "auto_mutate_provider"],
    evidenceRef: "lib/approvals/approvalPolicy.ts",
  },
  {
    id: "policy.approval_required_high_blast",
    category: "approval_required",
    enforcement: "enforced_always",
    severity: "high",
    title: "High blast-radius changes require approval",
    description: "Changes with blast radius >= 'broad' require role-based approval before any downstream effect.",
    rationale: "Blast radius classification keeps low-risk reviews from being held up while high-risk ones get explicit attention.",
    appliesTo: ["remediation", "approvals"],
    blockedActions: ["bypass_high_risk_approval"],
    evidenceRef: "lib/approvals/approvalPolicy.ts:blastRadius",
  },

  // ------------------------------------------------------------ No mutation
  {
    id: "policy.terraform_apply_disabled",
    category: "no_mutation",
    enforcement: "enforced_always",
    severity: "critical",
    title: "Terraform apply disabled",
    description: "No code path in Axiom executes 'terraform apply'. Plan generation only.",
    rationale: "The terraform boundary is enforced in lib/execution/terraformBoundary.ts.",
    appliesTo: ["remediation", "execution"],
    blockedActions: ["terraform_apply"],
    evidenceRef: "lib/execution/terraformBoundary.ts",
  },
  {
    id: "policy.cli_apply_disabled",
    category: "no_mutation",
    enforcement: "enforced_always",
    severity: "critical",
    title: "CLI apply disabled",
    description: "Generated CLI commands are text-only previews; no executor exists.",
    rationale: "Preview generators produce text. There is no runtime that executes them.",
    appliesTo: ["remediation", "execution"],
    blockedActions: ["cli_apply"],
    evidenceRef: "lib/execution/cliPreviewGenerator.ts",
  },

  // ------------------------------------------------------------ No desktop execution
  {
    id: "policy.desktop_local_execution_disabled",
    category: "no_desktop_execution",
    enforcement: "enforced_always",
    severity: "critical",
    title: "Desktop local execution disabled",
    description: "DesktopState.localExecutionStatus is a TypeScript literal 'disabled' and cannot be promoted.",
    rationale: "Hardening prevents any local apply path from ever being added to the desktop runtime without a TS change + review.",
    appliesTo: ["desktop"],
    blockedActions: ["desktop_local_apply"],
    evidenceRef: "lib/desktop/desktopStateModel.ts:DesktopState.localExecutionStatus",
  },

  // ------------------------------------------------------------ Evidence required
  {
    id: "policy.evidence_required_for_approval",
    category: "evidence_required",
    enforcement: "enforced_always",
    severity: "high",
    title: "Approval packets require evidence refs",
    description: "Approval packets without canonical evidence refs are marked 'missing_evidence' and cannot be approved.",
    rationale: "Auditors need a verifiable evidence trail back to canonical state.",
    appliesTo: ["approvals", "trust_center", "evidence_export"],
    blockedActions: ["approve_without_evidence"],
    evidenceRef: "lib/intelligence/approvalPacketBuilder.ts",
  },

  // ------------------------------------------------------------ Source mode required
  {
    id: "policy.source_mode_labeled_everywhere",
    category: "sourceMode_required",
    enforcement: "enforced_always",
    severity: "medium",
    title: "Every operational object carries sourceMode",
    description: "Every priority / risk / posture / approval / evidence record carries a typed sourceMode literal.",
    rationale: "Preview data lowering confidence is only possible when sourceMode is universally present.",
    appliesTo: ["axiom_os", "priority", "risk", "approval", "trust"],
    blockedActions: ["render_unlabeled_state"],
    evidenceRef: "lib/axiomOS/axiomOSModel.ts:AxiomOSSourceMode",
  },

  // ------------------------------------------------------------ Trust boundary
  {
    id: "policy.no_autonomy_self_escalation",
    category: "trust_boundary",
    enforcement: "enforced_always",
    severity: "critical",
    title: "Autonomy cannot self-escalate",
    description: "safetyContract fields are TypeScript literal types — the agent cannot widen its own boundary.",
    rationale: "If the agent could widen its boundary, the entire safety contract is meaningless.",
    appliesTo: ["axiom_os", "automation_boundary", "approval", "desktop"],
    blockedActions: ["self_grant_admin", "expand_safety_contract"],
    evidenceRef: "lib/axiomOS/axiomOSModel.ts:safetyStatus literal type",
  },

  // ------------------------------------------------------------ Credential safety
  {
    id: "policy.no_raw_credential_storage",
    category: "credential_safety",
    enforcement: "enforced_always",
    severity: "critical",
    title: "No raw credential storage in app or desktop",
    description: "Provider credentials live in env vars / OS keychain — never in app state, audit records, or evidence bundles.",
    rationale: "Storing credentials in app state would defeat redaction policy.",
    appliesTo: ["aws", "azure", "gcp", "github", "desktop", "evidence"],
    blockedActions: ["credential_export"],
    evidenceRef: "lib/api/dtoMappers.ts (redactor)",
  },
  {
    id: "policy.audit_redaction",
    category: "credential_safety",
    enforcement: "enforced_always",
    severity: "high",
    title: "Audit + evidence redaction",
    description: "Every audit / evidence path runs through the canonical redactor before persistence or export.",
    rationale: "Without redaction, evidence export would leak production secrets to auditors.",
    appliesTo: ["audit", "evidence_export", "trust"],
    blockedActions: ["unredacted_export"],
    evidenceRef: "lib/audit/secureAudit.ts + lib/api/dtoMappers.ts",
  },

  // ------------------------------------------------------------ Export control
  {
    id: "policy.tenant_scoped_export",
    category: "export_control",
    enforcement: "enforced_always",
    severity: "high",
    title: "Evidence exports are tenant-scoped",
    description: "Every export bundle is built from the authenticated tenant's records only.",
    rationale: "Cross-tenant evidence leakage would be a breach. Tenant scope is enforced at the route layer.",
    appliesTo: ["evidence_export", "trust_center"],
    blockedActions: ["cross_tenant_export"],
    evidenceRef: "app/api/trust/export/route.ts (tenantId guard)",
  },

  // ------------------------------------------------------------ Role permission
  {
    id: "policy.role_permission_required",
    category: "role_permission",
    enforcement: "advisory",
    severity: "medium",
    title: "Role-permission gates on sensitive actions",
    description: "Sensitive actions (approve_plan, export_evidence, manage_members) check role permissions. Currently advisory until full RBAC ships.",
    rationale: "Full RBAC is Phase 3 of the production execution plan. Advisory state surfaces the boundary today.",
    appliesTo: ["approvals", "evidence_export", "settings"],
    blockedActions: ["unauthorized_admin_action"],
    evidenceRef: "lib/approvals/approvalPolicy.ts (preliminary)",
  },

  // ------------------------------------------------------------ Scheduled scan safety
  {
    id: "policy.scheduled_scan_read_only",
    category: "scheduled_scan_safety",
    enforcement: "enforced_always",
    severity: "high",
    title: "Scheduled scans are read-only",
    description: "Every scheduled task wires through read-only adapters — apply paths are never reachable from the scheduler.",
    rationale: "An apply path reachable from a scheduler bypasses operator review by design.",
    appliesTo: ["scheduled_scans", "aws", "github", "security_scanner"],
    blockedActions: ["scheduled_apply"],
    evidenceRef: "lib/scheduler/scheduledScanRunner.ts (when wired)",
  },
];

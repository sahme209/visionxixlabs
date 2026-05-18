/**
 * Automation Boundary Detector.
 *
 * Returns the canonical boundary classification for every action class
 * Axiom can perform. This is the spine the platform leans on to refuse
 * unsafe automation — every other engine references this table.
 *
 * The detector is pure and deterministic. No SDK calls. No persistence.
 * The boundary is a closed exhaustive Record over the AutomationActionClass
 * union — TypeScript exhaustiveness catches missing entries at compile time.
 */

import "server-only";

import {
  type AutomationActionClass,
  type AutomationBoundaryEntry,
  type AutomationBoundaryReport,
  type BoundaryClassification,
} from "./automationBoundaryModel";

const BOUNDARIES: Record<AutomationActionClass, AutomationBoundaryEntry> = {
  // ----- READ-ONLY -----
  axiom_os_state_fetch: {
    actionClass: "axiom_os_state_fetch",
    classification: "readonly_allowed",
    label: "Axiom OS state fetch",
    description: "Compose and return the canonical AxiomOSState shape.",
    reason: "Pure read-only composition over canonical builders. No SDK calls.",
    surface: "/api/axiom-os/state",
    evidenceRef: "lib/axiomOS/axiomOSStateBuilder.ts:buildAxiomOSState",
  },
  operating_graph_fetch: {
    actionClass: "operating_graph_fetch",
    classification: "readonly_allowed",
    label: "Operating Graph fetch",
    description: "Project canonical state into the typed node/edge graph.",
    reason: "Pure projection. Never mutates.",
    surface: "/api/operating-graph",
    evidenceRef: "lib/operatingGraph/operatingGraphBuilder.ts:buildOperatingGraph",
  },
  integration_health_fetch: {
    actionClass: "integration_health_fetch",
    classification: "readonly_allowed",
    label: "Integration Health fetch",
    description: "Per-source health rollup with honest missingConfig.",
    reason: "Pure projection over canonical state.",
    surface: "/api/integrations/health",
    evidenceRef: "lib/integrations/integrationHealthChecker.ts:buildIntegrationHealthReport",
  },
  priority_fetch: {
    actionClass: "priority_fetch",
    classification: "readonly_allowed",
    label: "Priority report fetch",
    description: "Ranked operational priorities with explainable scoring.",
    reason: "Pure-function scoring over canonical state.",
    surface: "/api/intelligence/priorities",
    evidenceRef: "lib/intelligence/priorityEngine.ts:buildPriorityReport",
  },
  next_action_fetch: {
    actionClass: "next_action_fetch",
    classification: "readonly_allowed",
    label: "Next-best-action fetch",
    description: "Safe action recommendations from priority queue.",
    reason: "Closed mapping with no mutation entries in the union.",
    surface: "/api/intelligence/next-actions",
    evidenceRef: "lib/intelligence/nextActionEngine.ts:buildNextActions",
  },
  executive_summary_fetch: {
    actionClass: "executive_summary_fetch",
    classification: "readonly_allowed",
    label: "Executive summary fetch",
    description: "30-second leadership view.",
    reason: "Pure projection.",
    surface: "/api/intelligence/executive-summary",
    evidenceRef: "lib/intelligence/executiveSummaryBuilder.ts:buildExecutiveSummary",
  },
  trust_summary_fetch: {
    actionClass: "trust_summary_fetch",
    classification: "readonly_allowed",
    label: "Trust summary fetch",
    description: "Composite controls + evidence summary.",
    reason: "Pure projection over evidence collector + control registry.",
    surface: "/api/trust/summary",
    evidenceRef: "app/api/trust/summary/route.ts",
  },
  audit_event_list: {
    actionClass: "audit_event_list",
    classification: "readonly_allowed",
    label: "Audit event list",
    description: "Returns immutable audit records.",
    reason: "Read-only. Audit events are append-only by construction.",
    surface: "/dashboard/audit",
    evidenceRef: "lib/audit/secureAudit.ts",
  },
  evidence_list: {
    actionClass: "evidence_list",
    classification: "readonly_allowed",
    label: "Evidence list",
    description: "Returns tenant-scoped evidence records.",
    reason: "Read-only.",
    surface: "/api/trust/evidence",
    evidenceRef: "app/api/trust/evidence/route.ts",
  },

  // ----- READ-ONLY EXTERNAL -----
  aws_validate: {
    actionClass: "aws_validate",
    classification: "readonly_allowed",
    label: "AWS validate",
    description: "AssumeRole + GetCallerIdentity only.",
    reason: "STS read-only. No EC2/IAM mutation possible from this path.",
    surface: "/api/aws/validate",
    evidenceRef: "lib/cloud/aws/awsValidator.ts:validateAwsConnection",
  },
  aws_readonly_scan: {
    actionClass: "aws_readonly_scan",
    classification: "readonly_allowed",
    label: "AWS read-only scan",
    description: "EC2 / S3 / RDS / VPC / SG / IAM Describe / List / Get calls.",
    reason: "Pipeline only emits read-only SDK calls. Auditable by inventory module.",
    surface: "/api/aws/scan",
    evidenceRef: "lib/cloud/aws/awsLiveInventory.ts",
  },
  github_validate: {
    actionClass: "github_validate",
    classification: "readonly_allowed",
    label: "GitHub validate",
    description: "GET /user equivalent only.",
    reason: "PAT or App token validated read-only.",
    surface: "/api/github/validate",
    evidenceRef: "lib/connectors/github/githubValidator.ts",
  },
  github_readonly_sync: {
    actionClass: "github_readonly_sync",
    classification: "readonly_allowed",
    label: "GitHub read-only sync",
    description: "Repos / workflows / branch protection / deployment env discovery.",
    reason: "Scanner emits only GET calls; never PATCH / POST mutations.",
    surface: "/api/github/sync",
    evidenceRef: "lib/connectors/github/githubLiveScanner.ts",
  },
  azure_validate: {
    actionClass: "azure_validate",
    classification: "disabled_until_credentials",
    label: "Azure validate",
    description: "Service principal getToken + ARM REST validate.",
    reason: "Requires AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID.",
    surface: "/api/azure/validate",
    evidenceRef: "lib/cloud/azure/azureValidator.ts",
  },
  gcp_validate: {
    actionClass: "gcp_validate",
    classification: "disabled_until_credentials",
    label: "GCP validate",
    description: "Service account validation via resource-manager.",
    reason: "Requires GCP_PROJECT_ID + service account credentials.",
    surface: "/api/gcp/validate",
    evidenceRef: "lib/cloud/gcp/gcpValidator.ts",
  },
  security_scan_run: {
    actionClass: "security_scan_run",
    classification: "readonly_allowed",
    label: "Security scanner run",
    description: "Pure-function checks over current platform signals.",
    reason: "No SDK calls; no mutations. Output is a typed SecurityScanOutcome.",
    surface: "/api/security-scan",
    evidenceRef: "lib/securityScanner/securityScanner.ts:runSecurityScan",
  },

  // ----- PREVIEW / SIMULATION -----
  remediation_plan_build: {
    actionClass: "remediation_plan_build",
    classification: "preview_allowed",
    label: "Remediation plan build",
    description: "Compose remediation candidates with Terraform / CLI previews + rollback + verification.",
    reason: "Generates strings only. No apply path reachable.",
    surface: "/api/remediation/plan",
    evidenceRef: "lib/remediation/remediationPipeline.ts:runRemediationPipeline",
  },
  simulation_create: {
    actionClass: "simulation_create",
    classification: "simulation_allowed",
    label: "Simulation create",
    description: "Run candidate against in-memory digital twin only.",
    reason: "Mutates twin only — never the real cloud.",
    surface: "/api/simulations/create",
    evidenceRef: "lib/simulation/executionSimulator.ts",
  },
  terraform_plan_generate: {
    actionClass: "terraform_plan_generate",
    classification: "preview_allowed",
    label: "Terraform plan generate",
    description: "Emit HCL text for operator review.",
    reason: "Text generation only. Apply path is blocked by terraformBoundary.",
    surface: "/api/execution/terraform-preview",
    evidenceRef: "lib/execution/terraformPreviewGenerator.ts",
  },
  cli_preview_generate: {
    actionClass: "cli_preview_generate",
    classification: "preview_allowed",
    label: "CLI preview generate",
    description: "Emit shell command text for operator review.",
    reason: "Text generation only. Apply path is blocked.",
    surface: "/api/execution/cli-preview",
    evidenceRef: "lib/execution/cliPreviewGenerator.ts",
  },
  rollback_plan_generate: {
    actionClass: "rollback_plan_generate",
    classification: "preview_allowed",
    label: "Rollback plan generate",
    description: "Emit rollback steps for operator review.",
    reason: "Text generation only.",
    surface: "/api/execution/rollback-preview",
    evidenceRef: "lib/execution/rollbackPlanGenerator.ts",
  },
  verification_checklist_generate: {
    actionClass: "verification_checklist_generate",
    classification: "preview_allowed",
    label: "Verification checklist generate",
    description: "Emit verification steps for operator review.",
    reason: "Text generation only.",
    surface: "/api/execution/verification-checklist",
    evidenceRef: "lib/execution/verificationChecklist.ts",
  },

  // ----- DESKTOP REVIEW -----
  desktop_pair_session: {
    actionClass: "desktop_pair_session",
    classification: "desktop_review_allowed",
    label: "Desktop pair session",
    description: "Pair a desktop runtime via signed HMAC token.",
    reason: "Pairing creates a review session only; no execution capability.",
    surface: "/api/desktop/session",
    evidenceRef: "lib/desktop/desktopAuthPolicy.ts",
  },
  desktop_receive_handoff: {
    actionClass: "desktop_receive_handoff",
    classification: "desktop_review_allowed",
    label: "Desktop receive handoff",
    description: "Receive a signed handoff for local review.",
    reason: "Handoff is review-only; apply is blocked.",
    surface: "/api/desktop/handoff",
    evidenceRef: "lib/desktop/handoffValidator.ts",
  },
  desktop_review_item: {
    actionClass: "desktop_review_item",
    classification: "desktop_review_allowed",
    label: "Desktop review item",
    description: "Open a review item on the desktop workstation.",
    reason: "Review only. localExecutionStatus = 'disabled' literal.",
    surface: "desktop app review inbox",
    evidenceRef: "lib/desktop/desktopStateModel.ts:DesktopState.localExecutionStatus",
  },
  desktop_local_execute: {
    actionClass: "desktop_local_execute",
    classification: "unsafe_never_automate",
    label: "Desktop local execute",
    description: "Run an apply locally on the operator's machine.",
    reason: "Hard-blocked. localExecutionStatus = 'disabled' is a TypeScript literal.",
    surface: "(never wired)",
    evidenceRef: "lib/desktop/desktopStateModel.ts",
  },

  // ----- APPROVAL FLOW -----
  approval_request_create: {
    actionClass: "approval_request_create",
    classification: "approval_required",
    label: "Approval request create",
    description: "Submit a candidate to the approval queue.",
    reason: "Request is bookkeeping only — does not auto-approve.",
    surface: "/api/orchestration/approvals",
    evidenceRef: "lib/approvals/approvalEngine.ts:requestApproval",
  },
  approval_decide_in_engine: {
    actionClass: "approval_decide_in_engine",
    classification: "approval_required",
    label: "Approval decide in engine",
    description: "Human-driven approve/reject decision.",
    reason: "Decision is audited; apply still gated on downstream stages.",
    surface: "/api/orchestration/approvals/[id]/decide",
    evidenceRef: "app/api/orchestration/approvals/[id]/decide/route.ts",
  },
  approval_packet_view: {
    actionClass: "approval_packet_view",
    classification: "readonly_allowed",
    label: "Approval packet view",
    description: "Bundle canonical decision context for review.",
    reason: "Pure projection.",
    surface: "/api/intelligence/approval-packets",
    evidenceRef: "lib/intelligence/approvalPacketBuilder.ts",
  },

  // ----- AUDIT / EVIDENCE -----
  audit_event_emit: {
    actionClass: "audit_event_emit",
    classification: "readonly_allowed",
    label: "Audit event emit",
    description: "Append immutable audit event to the secure store.",
    reason: "Append-only by construction. No mutation of prior records.",
    surface: "lib/audit/secureAudit.ts",
    evidenceRef: "lib/audit/secureAudit.ts:record",
  },
  evidence_record_create: {
    actionClass: "evidence_record_create",
    classification: "readonly_allowed",
    label: "Evidence record create",
    description: "Create a tenant-scoped evidence record (redacted).",
    reason: "Creating a record is bookkeeping only. No external action.",
    surface: "lib/compliance/evidenceCollector.ts",
    evidenceRef: "lib/compliance/evidenceCollector.ts",
  },
  evidence_export_bundle: {
    actionClass: "evidence_export_bundle",
    classification: "readonly_allowed",
    label: "Evidence export bundle",
    description: "Build signed compliance bundle for download.",
    reason: "Bundle is built from existing records — no new data created.",
    surface: "/api/trust/export",
    evidenceRef: "lib/compliance/evidenceBundle.ts:buildComplianceBundle",
  },

  // ----- HARD-BLOCKED MUTATION CLASSES -----
  terraform_apply: {
    actionClass: "terraform_apply",
    classification: "unsafe_never_automate",
    label: "Terraform apply",
    description: "Apply a Terraform plan to real infrastructure.",
    reason: "Hard-blocked by terraformBoundary policy + missing wiring.",
    surface: "(never wired)",
    evidenceRef: "lib/execution/terraformBoundary.ts",
  },
  cli_apply: {
    actionClass: "cli_apply",
    classification: "unsafe_never_automate",
    label: "CLI apply",
    description: "Execute generated CLI commands against real provider.",
    reason: "Hard-blocked. Generators emit text only; no executor exists.",
    surface: "(never wired)",
    evidenceRef: "lib/execution/cliPreviewGenerator.ts",
  },
  aws_resource_mutation: {
    actionClass: "aws_resource_mutation",
    classification: "unsafe_never_automate",
    label: "AWS resource mutation",
    description: "Create / modify / delete AWS resources via SDK.",
    reason: "Hard-blocked. AWS adapter has no mutating call paths.",
    surface: "(never wired)",
    evidenceRef: "lib/cloud/aws/awsLiveInventory.ts",
  },
  azure_resource_mutation: {
    actionClass: "azure_resource_mutation",
    classification: "unsafe_never_automate",
    label: "Azure resource mutation",
    description: "Create / modify / delete Azure resources via ARM.",
    reason: "Hard-blocked.",
    surface: "(never wired)",
    evidenceRef: "lib/cloud/azure/azureValidator.ts",
  },
  gcp_resource_mutation: {
    actionClass: "gcp_resource_mutation",
    classification: "unsafe_never_automate",
    label: "GCP resource mutation",
    description: "Create / modify / delete GCP resources.",
    reason: "Hard-blocked.",
    surface: "(never wired)",
    evidenceRef: "lib/cloud/gcp/gcpValidator.ts",
  },
  github_repo_mutation: {
    actionClass: "github_repo_mutation",
    classification: "unsafe_never_automate",
    label: "GitHub repository mutation",
    description: "Create / modify / delete repository settings or content.",
    reason: "Hard-blocked.",
    surface: "(never wired)",
    evidenceRef: "lib/connectors/github/githubLiveScanner.ts",
  },
  github_workflow_mutation: {
    actionClass: "github_workflow_mutation",
    classification: "unsafe_never_automate",
    label: "GitHub workflow mutation",
    description: "Modify workflow files or trigger destructive workflow runs.",
    reason: "Hard-blocked.",
    surface: "(never wired)",
    evidenceRef: "lib/connectors/github/githubLiveScanner.ts",
  },
  credential_export: {
    actionClass: "credential_export",
    classification: "unsafe_never_automate",
    label: "Credential export",
    description: "Read raw credentials and expose them outside the platform.",
    reason: "Hard-blocked. Redaction policy prevents this from any output path.",
    surface: "(never wired)",
    evidenceRef: "lib/api/dtoMappers.ts (redactor)",
  },
  privilege_escalation: {
    actionClass: "privilege_escalation",
    classification: "unsafe_never_automate",
    label: "Privilege escalation",
    description: "Grant new permissions to the agent or a user.",
    reason: "Hard-blocked.",
    surface: "(never wired)",
    evidenceRef: "lib/approvals/approvalPolicy.ts",
  },
  autonomy_self_escalation: {
    actionClass: "autonomy_self_escalation",
    classification: "unsafe_never_automate",
    label: "Autonomy self-escalation",
    description: "Allow the agent to widen its own safetyContract or boundaries.",
    reason: "Hard-blocked. safetyContract fields are TypeScript literals.",
    surface: "(never wired)",
    evidenceRef: "lib/axiomOS/axiomOSModel.ts:safetyStatus literal",
  },
};

export interface BuildAutomationBoundaryInput {
  /** No tenant scope needed — boundaries are platform-wide. */
  reserved?: never;
}

export async function buildAutomationBoundaryReport(
  _input?: BuildAutomationBoundaryInput,
): Promise<AutomationBoundaryReport> {
  const entries = Object.values(BOUNDARIES);

  const count = (c: BoundaryClassification) =>
    entries.filter((e) => e.classification === c).length;

  return {
    generatedAt: new Date().toISOString(),
    entries,
    summary: {
      total:                    entries.length,
      readonly:                 count("readonly_allowed"),
      preview:                  count("preview_allowed"),
      simulation:               count("simulation_allowed"),
      desktopReview:            count("desktop_review_allowed"),
      approvalRequired:         count("approval_required"),
      disabledUntilPolicy:      count("disabled_until_policy"),
      disabledUntilCredentials: count("disabled_until_credentials"),
      unsafeNeverAutomate:      count("unsafe_never_automate"),
    },
    safetyContract: "boundaries_declared_no_action_taken",
    limitations: [
      "This detector declares boundaries — it never executes any of them.",
      "Adding a new action class requires updating the closed union in automationBoundaryModel.ts (TS exhaustiveness enforced).",
    ],
    safeNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
  };
}

/** Pure lookup for the closed boundary table. */
export function classifyAction(actionClass: AutomationActionClass): BoundaryClassification {
  return BOUNDARIES[actionClass].classification;
}

/** Pure lookup — returns the full canonical boundary entry. */
export function boundaryEntryFor(actionClass: AutomationActionClass): AutomationBoundaryEntry {
  return BOUNDARIES[actionClass];
}

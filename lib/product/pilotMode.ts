/**
 * Axiom pilot mode — typed contract for "what is and isn't allowed
 * during a controlled first enterprise pilot."
 *
 * This module is intentionally **declarative**. It does NOT introduce a
 * second runner or duplicate the launch-readiness runner. It defines
 * the typed pilot contract + a thin builder that derives the current
 * pilot status from existing canonical state (AxiomOSStateBuilder,
 * env, control registry).
 *
 * Hard rules encoded at the type level:
 *  - `localExecutionDisabled: true` (literal)
 *  - `terraformApplyEnabled: false` (literal)
 *  - `cliApplyEnabled: false` (literal)
 *  - `githubMutationEnabled: false` (literal)
 *  - `productionDeploymentEnabled: false` (literal)
 *  - `complianceCertificationsClaimed: false` (literal)
 *  - `guaranteedSavingsClaimed: false` (literal)
 *
 * The pilot mode is read-only data. UI surfaces, the operating-loop
 * runner, and approval gates already enforce the actual behaviour —
 * this shape lets the product *communicate* that contract honestly.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Pilot mode shape
// ---------------------------------------------------------------------------

export type PilotAction =
  | "aws_validate"
  | "aws_read_only_scan"
  | "github_validate"
  | "github_read_only_sync"
  | "azure_preview_validate"
  | "azure_preview_scan"
  | "gcp_preview_validate"
  | "gcp_preview_scan"
  | "security_scan_run"
  | "remediation_plan_generate"
  | "simulation_create"
  | "approval_request_create"
  | "desktop_handoff_create"
  | "desktop_handoff_review"
  | "evidence_export"
  | "readiness_validate"
  | "axiom_os_safe_loop"
  | "cloud_mutation"
  | "terraform_apply"
  | "cli_apply"
  | "github_mutation"
  | "production_deployment"
  | "desktop_local_execution";

export type PilotActionStatus =
  | "allowed"
  | "preview_only"
  | "approval_required"
  | "blocked_by_config"
  | "blocked_by_safety";

export interface PilotActionEntry {
  action: PilotAction;
  status: PilotActionStatus;
  reason?: string;
  safeNextAction?: { label: string; href: string };
}

export interface PilotChecklistItem {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "todo" | "blocked";
  route?: string;
  blocker?: string;
  sourceMode: "live" | "partial_live" | "preview" | "blocked" | "unknown";
}

export interface PilotMode {
  /** Honest pilot-stage label rendered in the product. */
  stage: "controlled_pilot" | "demo_only" | "internal_test";
  generatedAt: string;
  /** Tenant identity. */
  tenantId: OrganizationId;

  /** Safety contract — every flag is a literal so the type-checker enforces it. */
  safety: {
    localExecutionDisabled: true;
    terraformApplyEnabled: false;
    cliApplyEnabled: false;
    githubMutationEnabled: false;
    productionDeploymentEnabled: false;
    complianceCertificationsClaimed: false;
    guaranteedSavingsClaimed: false;
    readOnlyByDefault: true;
    approvalGated: true;
    auditEmissionRequired: true;
    sourceModeLabellingRequired: true;
  };

  /** Per-action allow/preview/block status. */
  actions: PilotActionEntry[];

  /** Concrete pilot checklist — items the operator should walk through. */
  checklist: PilotChecklistItem[];

  /** Customer-facing acceptable limitations (the buyer sees this in Trust Center). */
  acceptableLimitations: string[];

  /** Items the operator must acknowledge before running the pilot. */
  requiredAcknowledgements: string[];

  /** Persistence + credential hints honestly surfaced. */
  preconditions: {
    persistenceConfigured: boolean;
    awsLiveConfigured: boolean;
    githubLiveConfigured: boolean;
    azureLiveConfigured: boolean;
    gcpLiveConfigured: boolean;
    desktopSigningKeyConfigured: boolean;
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildPilotModeInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildPilotMode(input: BuildPilotModeInput): Promise<PilotMode> {
  const generatedAt = new Date().toISOString();
  const env = loadAppEnv();
  const axiomOS = await buildAxiomOSState({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });

  const aws = axiomOS.providers.find((p) => p.provider === "aws");
  const github = axiomOS.providers.find((p) => p.provider === "github");
  const azure = axiomOS.providers.find((p) => p.provider === "azure");
  const gcp = axiomOS.providers.find((p) => p.provider === "gcp");

  const awsLive = aws?.mode === "live";
  const githubLive = github?.mode === "live";

  // Stage — honest pick.
  const stage: PilotMode["stage"] =
    awsLive || githubLive ? "controlled_pilot" :
    env.databaseUrlSet ? "internal_test" :
    "demo_only";

  // Per-action status derived from real signals.
  const actions: PilotActionEntry[] = [
    actionEntry("aws_validate",            awsLive ? "allowed" : aws?.mode === "preview" ? "preview_only" : "blocked_by_config", aws?.safeNextAction, awsBlockerReason(aws)),
    actionEntry("aws_read_only_scan",      awsLive ? "allowed" : "preview_only", aws?.safeNextAction, awsBlockerReason(aws)),
    actionEntry("github_validate",         githubLive ? "allowed" : github?.mode === "preview" ? "preview_only" : "blocked_by_config", github?.safeNextAction, ghBlockerReason(github)),
    actionEntry("github_read_only_sync",   githubLive ? "allowed" : "preview_only", github?.safeNextAction, ghBlockerReason(github)),
    actionEntry("azure_preview_validate",  "preview_only", azure?.safeNextAction, "Azure live validation requires AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID."),
    actionEntry("azure_preview_scan",      "preview_only", azure?.safeNextAction, "Azure live inventory traversal is preview today — preview snapshot ships."),
    actionEntry("gcp_preview_validate",    "preview_only", gcp?.safeNextAction,   "GCP live validation requires GCP_PROJECT_ID + (GCP_SERVICE_ACCOUNT_JSON or GCP_CLIENT_EMAIL+GCP_PRIVATE_KEY)."),
    actionEntry("gcp_preview_scan",        "preview_only", gcp?.safeNextAction,   "GCP live inventory traversal is preview today — preview snapshot ships."),
    actionEntry("security_scan_run",       "allowed", { label: "Open security scanner", href: "/dashboard/security-scanner" }),
    actionEntry("remediation_plan_generate", "allowed",   { label: "Open remediation", href: "/dashboard/remediation" }),
    actionEntry("simulation_create",       "allowed", { label: "Open simulations", href: "/dashboard/simulations" }),
    actionEntry("approval_request_create", "approval_required", { label: "Open approval center", href: "/dashboard/orchestration/approvals" }, "Approval requests are routed to a human approver before any execution path opens."),
    actionEntry("desktop_handoff_create",  env.desktopHandoffSigningKeySet ? "allowed" : "preview_only", { label: "Open desktop", href: "/desktop" }, env.desktopHandoffSigningKeySet ? undefined : "DESKTOP_HANDOFF_SIGNING_KEY not configured — using NEXTAUTH_SECRET fallback."),
    actionEntry("desktop_handoff_review",  "approval_required", { label: "Open desktop", href: "/desktop" }, "Local apply is blocked — desktop is a review surface only."),
    actionEntry("evidence_export",         "allowed", { label: "Open Trust Center", href: "/dashboard/trust" }),
    actionEntry("readiness_validate",      "allowed", { label: "Open readiness", href: "/api/readiness/launch" }),
    actionEntry("axiom_os_safe_loop",      "allowed", { label: "Run safe loop", href: "/api/axiom-os/run-safe-loop" }),
    // Hard-blocked actions — the safety contract forbids these in pilot.
    actionEntry("cloud_mutation",          "blocked_by_safety", undefined, "Cloud mutation is disabled in pilot. Read-only by default."),
    actionEntry("terraform_apply",         "blocked_by_safety", undefined, "Terraform apply is disabled in pilot."),
    actionEntry("cli_apply",               "blocked_by_safety", undefined, "CLI apply is disabled in pilot."),
    actionEntry("github_mutation",         "blocked_by_safety", undefined, "GitHub mutation is disabled in pilot."),
    actionEntry("production_deployment",   "blocked_by_safety", undefined, "Production deployment is disabled in pilot."),
    actionEntry("desktop_local_execution", "blocked_by_safety", undefined, "Local desktop execution is disabled. Desktop is a review-only surface."),
  ];

  const checklist: PilotChecklistItem[] = [
    item("create_workspace",      "Workspace ready",                      "complete", "/dashboard/command-center", "live"),
    item("review_pilot_mode",     "Acknowledge pilot mode + safety boundaries", "todo", "/dashboard/trust", "live"),
    item("aws_setup",             "Review AWS read-only setup",           awsLive ? "complete" : "todo", aws?.safeNextAction?.href ?? "/docs/aws-setup", awsLive ? "live" : "preview"),
    item("aws_validate",          "Validate AWS connection",              awsLive ? "complete" : "todo", "/api/aws/validate", awsLive ? "live" : "preview"),
    item("aws_scan_or_preview",   "Run AWS scan (live or preview)",       "in_progress", "/api/aws/scan", awsLive ? "live" : "preview"),
    item("github_setup",          "Review GitHub setup",                  githubLive ? "complete" : "todo", github?.safeNextAction?.href ?? "/docs/github-setup", githubLive ? "live" : "preview"),
    item("github_sync_or_preview","Run GitHub sync (live or preview)",    "in_progress", "/api/github/sync", githubLive ? "live" : "preview"),
    item("security_scan",         "Run security scanner",                 "in_progress", "/api/security-scan", "live"),
    item("remediation",           "Generate remediation candidate",       "in_progress", "/dashboard/remediation", "preview"),
    item("simulation",            "Create simulation",                    "in_progress", "/dashboard/simulations", "preview"),
    item("approval_policy",       "Review approval policy",               env.databaseUrlSet ? "in_progress" : "todo", "/dashboard/orchestration/approvals", env.databaseUrlSet ? "partial_live" : "preview"),
    item("trust_center",          "Review Trust Center",                  "todo", "/dashboard/trust", "live"),
    item("evidence_export",       "Export evidence bundle",               "todo", "/api/trust/export", "live"),
    item("acknowledge_limits",    "Acknowledge limitations",              "todo", "/dashboard/trust", "live"),
  ];

  const acceptableLimitations = [
    "Execution remains disabled by default — every change is approval-gated.",
    "Simulations are planning tools, not proof of applied change.",
    "Azure / GCP live inventory traversal is preview today (validators are live).",
    "Desktop binaries are signed but not yet publicly distributed.",
    "Compliance certifications (SOC 2 / ISO / HIPAA / PCI) are not claimed — Axiom provides audit-ready evidence, not certification.",
    "Cost telemetry is not connected — no dollar savings claims.",
    "Findings depend on the access scope granted to Axiom by the operator's IAM role / GitHub App.",
  ];

  const requiredAcknowledgements = [
    "I understand Axiom operates read-only by default during pilot.",
    "I understand Terraform apply, CLI apply, and production deployment are disabled.",
    "I understand simulations describe proposed changes — they are NOT applied.",
    "I understand findings reflect what Axiom can observe given current access scope.",
    "I understand Axiom does not claim compliance certifications.",
    "I will review the Trust Center evidence before approving any plan.",
  ];

  return {
    stage,
    generatedAt,
    tenantId: input.tenantId,
    safety: {
      localExecutionDisabled: true,
      terraformApplyEnabled: false,
      cliApplyEnabled: false,
      githubMutationEnabled: false,
      productionDeploymentEnabled: false,
      complianceCertificationsClaimed: false,
      guaranteedSavingsClaimed: false,
      readOnlyByDefault: true,
      approvalGated: true,
      auditEmissionRequired: true,
      sourceModeLabellingRequired: true,
    },
    actions,
    checklist,
    acceptableLimitations,
    requiredAcknowledgements,
    preconditions: {
      persistenceConfigured: env.databaseUrlSet,
      awsLiveConfigured: awsLive,
      githubLiveConfigured: githubLive,
      azureLiveConfigured: azure?.mode === "live",
      gcpLiveConfigured: gcp?.mode === "live",
      desktopSigningKeyConfigured: env.desktopHandoffSigningKeySet,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionEntry(
  action: PilotAction,
  status: PilotActionStatus,
  safeNextAction?: { label: string; href: string },
  reason?: string,
): PilotActionEntry {
  return { action, status, reason, safeNextAction };
}

function item(
  id: string,
  title: string,
  status: PilotChecklistItem["status"],
  route: string | undefined,
  sourceMode: PilotChecklistItem["sourceMode"],
): PilotChecklistItem {
  return { id, title, status, route, sourceMode };
}

function awsBlockerReason(provider: { mode: string; missingRequirements: string[] } | undefined): string | undefined {
  if (!provider) return "AWS provider not initialised.";
  if (provider.mode === "live") return undefined;
  if (provider.missingRequirements.length > 0) {
    return `AWS live mode requires: ${provider.missingRequirements.slice(0, 3).join(", ")}`;
  }
  return `AWS is in ${provider.mode} mode — preview ships honestly.`;
}

function ghBlockerReason(provider: { mode: string; missingRequirements: string[] } | undefined): string | undefined {
  if (!provider) return "GitHub provider not initialised.";
  if (provider.mode === "live") return undefined;
  if (provider.missingRequirements.length > 0) {
    return `GitHub live mode requires: ${provider.missingRequirements.slice(0, 3).join(", ")}`;
  }
  return `GitHub is in ${provider.mode} mode — preview ships honestly.`;
}

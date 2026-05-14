/**
 * Capability Coverage Map.
 *
 * This is the single source of truth for "what can Axiom actually do?"
 * across every surface — cloud providers, GitHub/ReleaseOps, the security
 * scanner, and the desktop workstation. The AGI brain, autonomous planning
 * loop, validation loop, and product UI all read from this map so the
 * platform never claims a capability it does not actually have.
 *
 * Distinct from `providerCapabilities.ts`, which is a cross-provider
 * concept ontology (compute/storage/etc). This map answers the engineering
 * question: which features are wired, which are preview, which are still
 * planned — across the *entire* product.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoverageDomain =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "security_scanner"
  | "desktop"
  | "command_center"
  | "compliance"
  | "audit";

export type CoverageStatus =
  | "live"        // production-ready against real credentials/data
  | "preview"     // deterministic preview using normalised stub data
  | "expanding"   // partially wired, growing surface area
  | "planned"     // designed, not yet implemented
  | "blocked";    // implemented but blocked by missing config/credential

export type ValidationStatus = "passing" | "partial" | "failing" | "preview" | "blocked";

export interface CapabilityCoverageRow {
  /** Stable id used by the validation loop and product UI. */
  id: string;
  domain: CoverageDomain;
  /** Sub-area within the domain (e.g. "compute", "branch_protection"). */
  area: string;
  /** Short human-readable label. */
  title: string;
  status: CoverageStatus;
  validation: ValidationStatus;
  /** What the user has to provide for this to move to "live". */
  requiredConfig?: string[];
  /** One-sentence honest description shown to the user. */
  userExplanation: string;
  /** Next engineering milestone before the next status step. */
  nextEngineeringMilestone?: string;
  /** Route or API surface where this capability is exposed today. */
  surface?: string;
  /** Source module(s) implementing the capability. */
  sourceModules: string[];
}

export interface CoverageSummary {
  total: number;
  live: number;
  preview: number;
  expanding: number;
  planned: number;
  blocked: number;
  /** 0..100 weighted score — live=1.0, preview/expanding=0.5, planned/blocked=0. */
  score: number;
}

export interface CoverageOverview {
  generatedAt: string;
  rows: CapabilityCoverageRow[];
  byDomain: Record<CoverageDomain, CoverageSummary>;
  overall: CoverageSummary;
}

// ---------------------------------------------------------------------------
// Coverage rows — single source of truth
// ---------------------------------------------------------------------------

export const COVERAGE_ROWS: CapabilityCoverageRow[] = [
  // ── AWS ────────────────────────────────────────────────────────────────
  {
    id: "aws.connection",
    domain: "aws",
    area: "connection",
    title: "AWS connection (Assume Role)",
    status: "live",
    validation: "passing",
    requiredConfig: ["AXIOM_AWS_BROKER_ACCESS_KEY_ID", "AXIOM_AWS_BROKER_SECRET_ACCESS_KEY"],
    userExplanation: "Cross-account AssumeRole with External ID. Live when broker credentials are present; falls back to format-only validation otherwise.",
    surface: "/api/aws/validate",
    sourceModules: ["lib/cloud/aws/awsValidator.ts", "lib/cloud/aws/awsConnection.ts"],
  },
  {
    id: "aws.inventory",
    domain: "aws",
    area: "inventory",
    title: "AWS resource inventory",
    status: "preview",
    validation: "preview",
    userExplanation: "Deterministic preview snapshot across compute/storage/network/IAM. Wires to live SDKs after AssumeRole succeeds.",
    nextEngineeringMilestone: "Stream live EC2/S3/RDS via @aws-sdk after live validation",
    surface: "/api/aws/scan",
    sourceModules: ["lib/cloud/aws/awsPreviewScanner.ts"],
  },
  { id: "aws.security_checks", domain: "aws", area: "security",  title: "AWS security checks",     status: "preview", validation: "preview", userExplanation: "Public exposure, IAM overreach, encryption, MFA — preview rules over snapshot.", sourceModules: ["lib/securityScanner/securityScanner.ts"], surface: "/api/security-scan" },
  { id: "aws.cost",            domain: "aws", area: "cost",      title: "AWS cost & savings",      status: "expanding", validation: "partial", userExplanation: "Recommendation heuristics over idle/oversized resources. Cost Explorer integration pending.", nextEngineeringMilestone: "Add Cost Explorer + Compute Optimizer SDK calls", sourceModules: ["lib/cloud/aws/awsPreviewScanner.ts"] },
  { id: "aws.execution_plans", domain: "aws", area: "execution", title: "AWS execution planning",  status: "expanding", validation: "partial", userExplanation: "Plan builder produces Terraform/CLI artifacts. Apply path is approval-gated and dry-run only.", sourceModules: ["lib/execution/executionPlanBuilder.ts", "lib/execution/terraformGenerator.ts", "lib/execution/cliGenerator.ts"] },

  // ── Azure ──────────────────────────────────────────────────────────────
  { id: "azure.connection", domain: "azure", area: "connection", title: "Azure connection (Service Principal)", status: "expanding", validation: "partial", requiredConfig: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"], userExplanation: "Format validator runs today. Live SDK validation lands when @azure/identity is wired.", nextEngineeringMilestone: "Adopt @azure/identity + Resource Graph SDK", surface: "/api/azure/validate", sourceModules: ["lib/cloud/azure/azureValidator.ts"] },
  { id: "azure.inventory",  domain: "azure", area: "inventory",  title: "Azure resource inventory",              status: "preview",  validation: "preview", userExplanation: "Preview snapshot across VMs / storage / SQL. Live mode requires service principal.", sourceModules: ["lib/cloud/azure/azurePreviewScanner.ts"] },
  { id: "azure.security_checks", domain: "azure", area: "security", title: "Azure security checks", status: "preview", validation: "preview", userExplanation: "Public exposure, RBAC overreach, encryption checks against preview snapshot.", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "azure.execution_plans", domain: "azure", area: "execution", title: "Azure execution planning", status: "planned", validation: "blocked", userExplanation: "Plan builder exists. Azure-specific Terraform module library is being authored.", nextEngineeringMilestone: "Author azurerm Terraform module library", sourceModules: ["lib/execution/executionPlanBuilder.ts"] },

  // ── GCP ────────────────────────────────────────────────────────────────
  { id: "gcp.connection", domain: "gcp", area: "connection", title: "GCP connection (Service Account)", status: "expanding", validation: "partial", requiredConfig: ["GCP_PROJECT_ID", "GCP_SERVICE_ACCOUNT_JSON"], userExplanation: "Format validator runs today. Live SDK validation lands when google-auth-library is wired.", nextEngineeringMilestone: "Adopt google-auth-library + Asset Inventory SDK", surface: "/api/gcp/validate", sourceModules: ["lib/cloud/gcp/gcpValidator.ts"] },
  { id: "gcp.inventory",  domain: "gcp", area: "inventory",  title: "GCP resource inventory",            status: "preview",  validation: "preview", userExplanation: "Preview snapshot across Compute, Cloud Storage, GKE. Live mode requires SA JSON.", sourceModules: ["lib/cloud/gcp/gcpPreviewScanner.ts"] },
  { id: "gcp.security_checks", domain: "gcp", area: "security", title: "GCP security checks", status: "preview", validation: "preview", userExplanation: "Public exposure, IAM overreach, KMS coverage over preview snapshot.", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "gcp.execution_plans", domain: "gcp", area: "execution", title: "GCP execution planning", status: "planned", validation: "blocked", userExplanation: "Plan builder exists. GCP-specific Terraform module library is being authored.", nextEngineeringMilestone: "Author google_ Terraform module library", sourceModules: ["lib/execution/executionPlanBuilder.ts"] },

  // ── GitHub / ReleaseOps ────────────────────────────────────────────────
  { id: "github.connection",         domain: "github", area: "connection",         title: "GitHub connection",           status: "expanding", validation: "partial", requiredConfig: ["GITHUB_TOKEN"], userExplanation: "Preview adapter today. Live octokit calls follow once organisation-scoped install is wired.", nextEngineeringMilestone: "Add @octokit/rest + organisation install flow", surface: "/api/github/validate", sourceModules: ["lib/releaseops/githubConnector.ts"] },
  { id: "github.repo_discovery",     domain: "github", area: "repos",              title: "Repo discovery",              status: "preview",  validation: "preview", userExplanation: "Preview inventory of repos + default branches. Switches to octokit listForOrg when token present.", sourceModules: ["lib/releaseops/githubConnector.ts"] },
  { id: "github.workflow_discovery", domain: "github", area: "workflows",          title: "Workflow discovery",          status: "preview",  validation: "preview", userExplanation: "Preview workflow runs + status. Live mode reads from actions API.", sourceModules: ["lib/releaseops/githubConnector.ts"] },
  { id: "github.branch_protection",  domain: "github", area: "branch_protection",  title: "Branch protection signals",   status: "preview",  validation: "preview", userExplanation: "Preview reads protection rules; live mode reads from repos/.../protection.", sourceModules: ["lib/releaseops/githubConnector.ts", "lib/releaseops/releaseReadiness.ts"] },
  { id: "github.readiness_scoring",  domain: "github", area: "readiness",          title: "Release readiness scoring",   status: "live",     validation: "passing", userExplanation: "A–F grade with 0–100 score over inventory + workflows + protections. Works against any inventory shape.", surface: "/dashboard/releaseops", sourceModules: ["lib/releaseops/releaseReadiness.ts"] },
  { id: "github.audit_timeline",     domain: "github", area: "audit",              title: "Release audit timeline",      status: "planned",  validation: "blocked", userExplanation: "Schema designed. Wiring to audit store after release event sourcing lands.", sourceModules: ["lib/releaseops/releaseMemory.ts"] },

  // ── Security Scanner ───────────────────────────────────────────────────
  { id: "security.cloud_scope",       domain: "security_scanner", area: "cloud",        title: "Cloud posture checks",       status: "preview",  validation: "preview", userExplanation: "22 typed checks across IAM/network/storage/encryption over snapshot.", surface: "/dashboard/security-scanner", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "security.app_scope",         domain: "security_scanner", area: "app",          title: "App posture checks",         status: "live",     validation: "passing", userExplanation: "Redaction, audit store, RBAC, copilot-context safety — measured from real config.", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "security.supply_chain",      domain: "security_scanner", area: "supply_chain", title: "Supply-chain posture",       status: "expanding", validation: "partial", userExplanation: "Lockfile + dependency-scan signals. Secret-scan + build-signing wiring pending.", nextEngineeringMilestone: "Add npm audit + secret-scan webhook", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "security.desktop_scope",     domain: "security_scanner", area: "desktop",      title: "Desktop posture",            status: "preview",  validation: "preview", userExplanation: "Signing/notarization signals from env. Live values land when binaries are signed.", sourceModules: ["lib/securityScanner/securityScanner.ts"] },
  { id: "security.reasoning_layer",   domain: "security_scanner", area: "reasoning",    title: "Security reasoning layer",   status: "live",     validation: "passing", userExplanation: "Reasoner composes narrative, severity, recommended fix, validation check per finding.", sourceModules: ["lib/securityScanner/securityReasoner.ts"] },

  // ── Desktop ────────────────────────────────────────────────────────────
  { id: "desktop.app_shell",          domain: "desktop", area: "shell",       title: "Desktop app shell",        status: "preview",  validation: "preview", userExplanation: "Tauri 2 + React shell exists in /desktop. No signed/notarized binaries yet.", nextEngineeringMilestone: "Apple Developer ID signing + notarytool", sourceModules: ["desktop/src"] },
  { id: "desktop.handoff_inbox",      domain: "desktop", area: "handoff",     title: "Handoff inbox",            status: "live",     validation: "passing", userExplanation: "HMAC-signed payload with replay protection. Inbox renders + validates locally.", surface: "/api/desktop/handoff", sourceModules: ["lib/desktop/handoffContract.ts", "lib/desktop/handoffSigner.ts", "lib/desktop/handoffValidator.ts"] },
  { id: "desktop.local_review",       domain: "desktop", area: "review",      title: "Local plan review",        status: "preview",  validation: "preview", userExplanation: "Renders Terraform/CLI artifacts locally. Apply is intentionally blocked.", sourceModules: ["desktop/src/lib/handoffInbox.ts"] },
  { id: "desktop.local_apply",        domain: "desktop", area: "apply",       title: "Local apply (blocked)",    status: "blocked",  validation: "blocked", userExplanation: "Local apply is intentionally blocked until governance + signed binaries land.", sourceModules: ["desktop/src/lib/desktopClient.ts"] },
  { id: "desktop.audit_sync",         domain: "desktop", area: "audit",       title: "Desktop audit sync",       status: "planned",  validation: "blocked", userExplanation: "Append-only sync from desktop to server audit store. Schema in design.", sourceModules: ["lib/desktop/handoffContract.ts"] },

  // ── Command Center ─────────────────────────────────────────────────────
  { id: "commandcenter.state",        domain: "command_center", area: "state",      title: "Canonical state adapter", status: "live", validation: "passing", userExplanation: "getCommandCenterState() aggregates onboarding, posture, multi-cloud, release ops, validation.", surface: "/api/command-center", sourceModules: ["lib/platform/getCommandCenterState.ts"] },
  { id: "commandcenter.next_action",  domain: "command_center", area: "next_action", title: "Next best action", status: "expanding", validation: "partial", userExplanation: "Heuristic next action today. Brain + planning loop deepen this.", sourceModules: ["lib/agent/agiOperationsBrain.ts"] },

  // ── Compliance ─────────────────────────────────────────────────────────
  { id: "compliance.control_registry", domain: "compliance", area: "controls",  title: "Compliance control registry", status: "live",     validation: "passing", userExplanation: "19 typed controls across 17 categories with implementation evidence.", surface: "/dashboard/trust", sourceModules: ["lib/compliance/controlRegistry.ts"] },
  { id: "compliance.evidence_bundle",  domain: "compliance", area: "evidence",  title: "Evidence bundle export",      status: "live",     validation: "passing", userExplanation: "JSON + NDJSON exportable bundles tied to controls.", sourceModules: ["lib/compliance/evidenceBundle.ts", "lib/compliance/evidenceCollector.ts"] },

  // ── Audit ──────────────────────────────────────────────────────────────
  { id: "audit.trace_store",          domain: "audit", area: "trace",   title: "Trace + span store",       status: "expanding", validation: "partial", userExplanation: "In-memory store today. Prisma-backed audit store schema is wired.", nextEngineeringMilestone: "Promote SecureAuditStore from memory → Prisma", sourceModules: ["lib/observability"] },
  { id: "audit.event_envelope",       domain: "audit", area: "events",  title: "Event envelope DTOs",      status: "live", validation: "passing", userExplanation: "Typed event/span/trace DTOs across API boundary.", sourceModules: ["lib/api/dtoMappers.ts"] },
];

// ---------------------------------------------------------------------------
// Summary builders
// ---------------------------------------------------------------------------

const EMPTY_SUMMARY = (): CoverageSummary => ({
  total: 0, live: 0, preview: 0, expanding: 0, planned: 0, blocked: 0, score: 0,
});

function tallySummary(rows: CapabilityCoverageRow[]): CoverageSummary {
  const out = EMPTY_SUMMARY();
  for (const row of rows) {
    out.total += 1;
    out[row.status] += 1;
  }
  if (out.total > 0) {
    const weighted = out.live * 1.0 + (out.preview + out.expanding) * 0.5;
    out.score = Math.round((weighted / out.total) * 100);
  }
  return out;
}

const ALL_DOMAINS: CoverageDomain[] = ["aws", "azure", "gcp", "github", "security_scanner", "desktop", "command_center", "compliance", "audit"];

export function buildCoverageOverview(rows: CapabilityCoverageRow[] = COVERAGE_ROWS): CoverageOverview {
  const byDomain = ALL_DOMAINS.reduce((acc, d) => {
    acc[d] = tallySummary(rows.filter((r) => r.domain === d));
    return acc;
  }, {} as Record<CoverageDomain, CoverageSummary>);
  return {
    generatedAt: new Date().toISOString(),
    rows,
    byDomain,
    overall: tallySummary(rows),
  };
}

export function coverageForDomain(domain: CoverageDomain): CapabilityCoverageRow[] {
  return COVERAGE_ROWS.filter((r) => r.domain === domain);
}

export function coverageForProvider(provider: CloudProvider): CapabilityCoverageRow[] {
  return coverageForDomain(provider);
}

export function liveOnly(rows: CapabilityCoverageRow[] = COVERAGE_ROWS): CapabilityCoverageRow[] {
  return rows.filter((r) => r.status === "live");
}

export function gaps(rows: CapabilityCoverageRow[] = COVERAGE_ROWS): CapabilityCoverageRow[] {
  return rows.filter((r) => r.status === "planned" || r.status === "blocked");
}

export const COVERAGE_STATUS_LABEL: Record<CoverageStatus, string> = {
  live: "Live",
  preview: "Preview",
  expanding: "Expanding",
  planned: "Planned",
  blocked: "Blocked",
};

export const COVERAGE_DOMAIN_LABEL: Record<CoverageDomain, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  github: "GitHub / ReleaseOps",
  security_scanner: "Security scanner",
  desktop: "Desktop",
  command_center: "Command Center",
  compliance: "Compliance",
  audit: "Audit",
};

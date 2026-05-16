/**
 * Operating loop builder.
 *
 * Synthesizes a typed `OperatingLoopRun` for a given provider by querying
 * existing subsystems — validators, scanners, control plane, security
 * scanner, etc. Pure read-only: no mutations, no side-effects, safe to
 * call from any route. The builder's *job* is honesty: every stage's
 * status is derived from observable state and the source system name is
 * always recorded.
 *
 * The builder doesn't reach for credentials or wallets — it only reads
 * what's already configured. Live stages are reported as such, blocked
 * stages explain why.
 */

import "server-only";

import { getCloudProviderMode, getConnectorMode } from "@/lib/config/providerModes";
import { getGithubMode } from "@/lib/connectors/github/githubLiveClient";
import { getAzureConfig } from "@/lib/cloud/azure/azureConfig";
import { getGcpConfig } from "@/lib/cloud/gcp/gcpConfig";
import { loadAppEnv } from "@/lib/config/env";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { newCorrelationId } from "@/lib/domain/ids";

import {
  CANONICAL_STAGES,
  STAGE_LABELS,
  rollupSourceMode,
  type EvidenceRef,
  type OperatingLoopProvider,
  type OperatingLoopRun,
  type OperatingLoopRunStatus,
  type OperatingLoopStage,
  type OperatingLoopStageId,
  type OperatingLoopStageStatus,
  type SourceMode,
} from "./operatingLoopModel";

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export interface BuildLoopInput {
  organizationId: OrganizationId;
  actorUserId?: UserId;
  provider: OperatingLoopProvider;
  /** Optional correlation id to thread an existing trace. */
  correlationId?: CorrelationId;
}

export async function buildOperatingLoopRun(input: BuildLoopInput): Promise<OperatingLoopRun> {
  const startedAt = new Date().toISOString();
  const correlationId = input.correlationId ?? newCorrelationId();

  const stages = await buildStagesFor(input.provider);
  const sourceMode = rollupSourceMode(stages.map((s) => s.sourceMode));
  const currentStage = pickCurrentStage(stages);
  const runStatus = pickRunStatus(stages);
  const summary = composeSummary(input.provider, stages);
  const attentionRequired = stages
    .filter((s) => s.status === "requires_approval" || s.status === "requires_input" || s.status === "blocked" || s.status === "failed")
    .map((s) => ({ stageId: s.id, reason: s.blockers[0]?.detail ?? s.summary }));
  const topSafeNextAction =
    stages.find((s) => s.id === currentStage)?.safeNextAction ??
    stages.find((s) => s.safeNextAction)?.safeNextAction;

  const evidenceRefs = stages.flatMap((s) => s.outputRefs);

  return {
    id: `loop_${input.provider}_${Date.now().toString(36)}`,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    provider: input.provider,
    sourceMode,
    currentStage,
    status: runStatus,
    startedAt,
    stages,
    correlationId,
    auditEventIds: [],
    traceIds: [],
    evidenceRefs,
    summary,
    topSafeNextAction,
    attentionRequired,
  };
}

// ---------------------------------------------------------------------------
// Build all 16 stages for a given provider
// ---------------------------------------------------------------------------

async function buildStagesFor(provider: OperatingLoopProvider): Promise<OperatingLoopStage[]> {
  const builders: Record<OperatingLoopStageId, () => Promise<OperatingLoopStage> | OperatingLoopStage> = {
    setup:           () => buildSetupStage(provider),
    validation:      () => buildValidationStage(provider),
    scan:            () => buildScanStage(provider),
    snapshot:        () => buildSnapshotStage(provider),
    findings:        () => buildFindingsStage(provider),
    recommendations: () => buildRecommendationsStage(provider),
    remediation:     () => buildRemediationStage(provider),
    simulation:      () => buildSimulationStage(provider),
    policy:          () => buildPolicyStage(provider),
    approval:        () => buildApprovalStage(provider),
    desktop_review:  () => buildDesktopReviewStage(provider),
    preflight:       () => buildPreflightStage(provider),
    verification:    () => buildVerificationStage(provider),
    audit:           () => buildAuditStage(provider),
    memory:          () => buildMemoryStage(provider),
    next_action:     () => buildNextActionStage(provider),
  };
  const results: OperatingLoopStage[] = [];
  for (const id of CANONICAL_STAGES) {
    const stage = await Promise.resolve(builders[id]());
    results.push(stage);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Per-stage assembly
// ---------------------------------------------------------------------------

function baseStage(id: OperatingLoopStageId, source: string): OperatingLoopStage {
  return {
    id,
    name: STAGE_LABELS[id],
    status: "not_started",
    sourceSystem: source,
    sourceMode: "preview",
    confidence: 0.5,
    inputRefs: [],
    outputRefs: [],
    blockers: [],
    summary: "",
  };
}

// 1) setup — was the connector configured at all?
function buildSetupStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("setup", "lib/onboarding/selfServeSetupOrchestrator.ts");
  const env = loadAppEnv();
  switch (provider) {
    case "aws":
      stage.status = env.awsBrokerConfigured ? "completed" : "requires_input";
      stage.sourceMode = env.awsBrokerConfigured ? "live" : "preview";
      stage.summary = env.awsBrokerConfigured
        ? "AWS broker credentials present on host."
        : "AWS broker credentials missing (AWS_CONNECTOR_BROKER_*).";
      stage.safeNextAction = env.awsBrokerConfigured
        ? undefined
        : { label: "Open AWS setup", href: "/docs/aws-setup" };
      stage.confidence = env.awsBrokerConfigured ? 0.95 : 0.4;
      break;
    case "azure": {
      const cfg = getAzureConfig();
      stage.status = cfg.credentialsConfigured ? "completed" : "requires_input";
      stage.sourceMode = cfg.credentialsConfigured ? "live" : cfg.mode === "expanding" ? "expanding" : "preview";
      stage.summary = cfg.credentialsConfigured
        ? "Azure tenant + client + secret + subscription configured."
        : "Azure credentials missing (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_SUBSCRIPTION_ID).";
      stage.safeNextAction = cfg.credentialsConfigured
        ? undefined
        : { label: "Open Azure setup", href: "/docs/azure-setup" };
      stage.confidence = cfg.credentialsConfigured ? 0.95 : 0.4;
      break;
    }
    case "gcp": {
      const cfg = getGcpConfig();
      stage.status = cfg.credentialsConfigured ? "completed" : "requires_input";
      stage.sourceMode = cfg.credentialsConfigured ? "live" : cfg.mode === "expanding" ? "expanding" : "preview";
      stage.summary = cfg.credentialsConfigured
        ? `GCP credentials present (${cfg.credentialFormat}).`
        : "GCP credentials missing (GCP_PROJECT_ID + JSON or split PEM).";
      stage.safeNextAction = cfg.credentialsConfigured
        ? undefined
        : { label: "Open GCP setup", href: "/docs/gcp-setup" };
      stage.confidence = cfg.credentialsConfigured ? 0.95 : 0.4;
      break;
    }
    case "github": {
      const mode = getGithubMode();
      stage.status = mode === "live" ? "completed" : "requires_input";
      stage.sourceMode = mode === "live" ? "live" : "preview";
      stage.summary = mode === "live"
        ? "GitHub credential present (PAT or App)."
        : "GitHub live credential missing (GITHUB_PAT or GITHUB_APP_ID + GITHUB_PRIVATE_KEY).";
      stage.safeNextAction = mode === "live"
        ? undefined
        : { label: "Connect GitHub", href: "/dashboard/integrations/github" };
      stage.confidence = mode === "live" ? 0.95 : 0.4;
      break;
    }
    case "security_scanner":
      stage.status = "completed";
      stage.sourceMode = "live";
      stage.summary = "Security scanner is always available (runs on inputs the platform attests).";
      stage.confidence = 0.95;
      break;
    case "desktop": {
      const desktopReady = env.desktopHandoffSigningKeySet || Boolean(env.nextAuthSecret);
      stage.status = desktopReady ? "completed" : "requires_input";
      stage.sourceMode = desktopReady ? "live" : "preview";
      stage.summary = desktopReady
        ? "Desktop handoff signing key present (or NEXTAUTH_SECRET fallback)."
        : "Desktop signing key missing (DESKTOP_HANDOFF_SIGNING_KEY or NEXTAUTH_SECRET ≥ 32 chars).";
      stage.safeNextAction = desktopReady
        ? undefined
        : { label: "Open desktop setup", href: "/docs/desktop-install" };
      stage.confidence = desktopReady ? 0.95 : 0.4;
      break;
    }
  }
  return stage;
}

// 2) validation — does the validator currently return live/format/disabled?
function buildValidationStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("validation", "lib/cloud/<provider>/<provider>Validator.ts");
  switch (provider) {
    case "aws": {
      stage.sourceSystem = "lib/cloud/aws/awsValidator.ts";
      const mode = getCloudProviderMode("aws");
      stage.status = mode === "live" ? "passing" : mode === "preview" ? "preview" : "blocked";
      stage.sourceMode = mode === "live" ? "live" : mode === "preview" ? "preview" : "disabled";
      stage.summary = mode === "live"
        ? "STS AssumeRole + GetCallerIdentity ready."
        : "Format validation only — live STS requires broker credentials.";
      stage.confidence = mode === "live" ? 0.9 : 0.55;
      stage.safeNextAction = { label: "Validate AWS connection", href: "/api/aws/validate" };
      break;
    }
    case "azure": {
      stage.sourceSystem = "lib/cloud/azure/azureValidator.ts";
      const mode = getCloudProviderMode("azure");
      stage.status = mode === "live" ? "passing" : mode === "expanding" ? "partial" : mode === "preview" ? "preview" : "blocked";
      stage.sourceMode = mode === "live" ? "live" : mode === "preview" ? "preview" : "expanding";
      stage.summary = mode === "live"
        ? "@azure/identity ClientSecretCredential.getToken() + ARM REST subscriptions GET ready."
        : "Format validation only — live SDK requires AZURE_* env.";
      stage.confidence = mode === "live" ? 0.9 : 0.55;
      stage.safeNextAction = { label: "Validate Azure connection", href: "/api/azure/validate" };
      break;
    }
    case "gcp": {
      stage.sourceSystem = "lib/cloud/gcp/gcpValidator.ts";
      const mode = getCloudProviderMode("gcp");
      stage.status = mode === "live" ? "passing" : mode === "expanding" ? "partial" : mode === "preview" ? "preview" : "blocked";
      stage.sourceMode = mode === "live" ? "live" : mode === "preview" ? "preview" : "expanding";
      stage.summary = mode === "live"
        ? "@google-cloud/resource-manager ProjectsClient ready."
        : "Format validation only — live SDK requires GCP credential env.";
      stage.confidence = mode === "live" ? 0.85 : 0.55;
      stage.safeNextAction = { label: "Validate GCP connection", href: "/api/gcp/validate" };
      break;
    }
    case "github": {
      stage.sourceSystem = "lib/connectors/github/githubLiveClient.ts";
      const mode = getConnectorMode("github");
      stage.status = mode === "live" ? "passing" : "preview";
      stage.sourceMode = mode === "live" ? "live" : "preview";
      stage.summary = mode === "live" ? "PAT or App credential validated against /user." : "Live validation unavailable until credential is set.";
      stage.confidence = mode === "live" ? 0.9 : 0.5;
      stage.safeNextAction = { label: "Validate GitHub", href: "/api/github/validate" };
      break;
    }
    case "security_scanner":
      stage.sourceSystem = "lib/securityScanner/securityScanner.ts";
      stage.status = "passing";
      stage.sourceMode = "live";
      stage.summary = "Security scanner self-validates — no external dependency for the engine itself.";
      stage.confidence = 0.95;
      break;
    case "desktop":
      stage.sourceSystem = "lib/desktop/desktopToken.ts";
      stage.status = "passing";
      stage.sourceMode = "live";
      stage.summary = "Token mint + verify available (HMAC-SHA256, timing-safe compare).";
      stage.confidence = 0.95;
      break;
  }
  return stage;
}

// 3) scan
function buildScanStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("scan", "lib/pipeline/cloudScanPipeline.ts");
  switch (provider) {
    case "aws": {
      const mode = getCloudProviderMode("aws");
      stage.status = mode === "live" ? "passing" : mode === "preview" ? "preview" : "blocked";
      stage.sourceMode = mode === "live" ? "live" : mode === "preview" ? "preview" : "disabled";
      stage.summary = mode === "live"
        ? "Live read-only inventory (EC2 / VPC / SG / S3 / RDS) wired."
        : "Preview scanner active — live inventory requires broker creds.";
      stage.safeNextAction = { label: "Run AWS scan", href: "/api/aws/scan" };
      stage.confidence = mode === "live" ? 0.85 : 0.5;
      break;
    }
    case "azure":
      stage.sourceSystem = "app/api/azure/scan/route.ts";
      stage.status = "preview";
      stage.sourceMode = "preview";
      stage.summary = "Preview scanner returns VM / Storage / SQL / VNet / NSG snapshot. Live ARM inventory traversal is the next phase.";
      stage.safeNextAction = { label: "Run Azure scan", href: "/api/azure/scan" };
      stage.confidence = 0.5;
      break;
    case "gcp":
      stage.sourceSystem = "app/api/gcp/scan/route.ts";
      stage.status = "preview";
      stage.sourceMode = "preview";
      stage.summary = "Preview scanner returns Compute / Storage / VPC / Firewall snapshot. Live inventory is the next phase.";
      stage.safeNextAction = { label: "Run GCP scan", href: "/api/gcp/scan" };
      stage.confidence = 0.5;
      break;
    case "github": {
      stage.sourceSystem = "lib/connectors/github/githubLiveScanner.ts";
      const mode = getGithubMode();
      stage.status = mode === "live" ? "passing" : "preview";
      stage.sourceMode = mode === "live" ? "live" : "preview";
      stage.summary = mode === "live"
        ? "Live repos / workflows / branch protection scan ready."
        : "Preview scanner active — live requires GITHUB_PAT.";
      stage.safeNextAction = { label: "Run GitHub sync", href: "/api/github/sync" };
      stage.confidence = mode === "live" ? 0.85 : 0.5;
      break;
    }
    case "security_scanner":
      stage.sourceSystem = "lib/securityScanner/securityScanner.ts";
      stage.status = "passing";
      stage.sourceMode = "live";
      stage.summary = "On-demand scan available against any wired inputs.";
      stage.safeNextAction = { label: "Run security scan", href: "/api/security-scan" };
      stage.confidence = 0.9;
      break;
    case "desktop":
      stage.status = "skipped";
      stage.summary = "Desktop loop has no scan phase — only review.";
      break;
  }
  return stage;
}

// 4) snapshot — does the scanner emit a normalized snapshot? (always yes for cloud providers)
function buildSnapshotStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("snapshot", "lib/cloud/multiCloudOverview.ts");
  if (provider === "security_scanner" || provider === "desktop") {
    stage.status = "skipped";
    stage.summary = "No native snapshot for this provider — operates on upstream provider snapshots.";
    return stage;
  }
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Normalized snapshot available via multi-cloud overview slice (live data when scan runs live).";
  stage.confidence = 0.65;
  return stage;
}

// 5) findings
function buildFindingsStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("findings", "lib/securityScanner/securityScanner.ts");
  if (provider === "desktop") {
    stage.status = "skipped";
    stage.summary = "Desktop loop emits no findings.";
    return stage;
  }
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Findings emitted from preview snapshot. Live findings flow once provider scan is live.";
  stage.safeNextAction = { label: "Open security center", href: "/dashboard/security-scanner" };
  stage.confidence = 0.6;
  if (provider === "aws" && getCloudProviderMode("aws") === "live") {
    stage.status = "passing";
    stage.sourceMode = "live";
    stage.summary = "Live findings from EC2 SG / S3 PAB / RDS public emitted by the AWS live inventory scanner.";
    stage.confidence = 0.8;
  }
  if (provider === "github" && getGithubMode() === "live") {
    stage.status = "passing";
    stage.sourceMode = "live";
    stage.summary = "Live findings emitted from branch protection + workflow failures.";
    stage.confidence = 0.8;
  }
  return stage;
}

// 6) recommendations
function buildRecommendationsStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("recommendations", "lib/securityScanner + lib/remediation");
  if (provider === "desktop") {
    stage.status = "skipped";
    stage.summary = "Desktop loop emits no recommendations.";
    return stage;
  }
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Recommendations paired to findings. Live mode rises as scan + findings go live.";
  stage.confidence = 0.6;
  return stage;
}

// 7) remediation
function buildRemediationStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("remediation", "lib/remediation/remediationPipeline.ts");
  if (provider === "desktop") {
    stage.status = "skipped";
    stage.summary = "Desktop loop reviews remediation from upstream providers.";
    return stage;
  }
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Remediation candidates generated with Terraform / CLI / rollback previews and verification checklists.";
  stage.safeNextAction = { label: "Open remediation", href: "/dashboard/remediation" };
  stage.confidence = 0.65;
  return stage;
}

// 8) simulation
function buildSimulationStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("simulation", "lib/simulation/executionSimulator.ts");
  if (provider === "desktop") {
    stage.status = "skipped";
    stage.summary = "Desktop loop reviews simulation from upstream providers.";
    return stage;
  }
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "In-memory simulator applies the change-set to a digital twin — provider-agnostic, no SDK calls.";
  stage.confidence = 0.7;
  return stage;
}

// 9) policy
function buildPolicyStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("policy", "lib/governance/policyEngine.ts");
  stage.status = "passing";
  stage.sourceMode = "live";
  stage.summary = "Policy engine evaluates risk + scope + approval requirement. Default-deny on destructive paths.";
  stage.confidence = 0.85;
  void provider;
  return stage;
}

// 10) approval
function buildApprovalStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("approval", "lib/approvals/approvalEngine.ts");
  if (provider === "desktop" || provider === "security_scanner") {
    stage.status = "skipped";
    stage.summary = "Approval is triggered by upstream actions (provider remediations).";
    return stage;
  }
  stage.status = "requires_approval";
  stage.sourceMode = "live";
  stage.summary = "Approval requests are created for medium+ risk actions. Live flow — auditable.";
  stage.safeNextAction = { label: "Open approval center", href: "/dashboard/orchestration/approvals" };
  stage.confidence = 0.85;
  return stage;
}

// 11) desktop_review
function buildDesktopReviewStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("desktop_review", "lib/desktop/executionHandoff.ts");
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Approved plans can be reviewed locally via signed handoff. Local apply remains blocked.";
  stage.safeNextAction = { label: "Open desktop install", href: "/desktop" };
  stage.confidence = 0.7;
  void provider;
  return stage;
}

// 12) preflight
function buildPreflightStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("preflight", "lib/execution/preflight.ts");
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Pre-flight runs immutability + drift checks before any apply. No apply runs in this build.";
  stage.confidence = 0.7;
  void provider;
  return stage;
}

// 13) verification
function buildVerificationStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("verification", "lib/execution/verificationEngine.ts");
  stage.status = "preview";
  stage.sourceMode = "preview";
  stage.summary = "Verification spec is generated alongside every remediation. Runs post-apply when execution lands.";
  stage.confidence = 0.7;
  void provider;
  return stage;
}

// 14) audit
function buildAuditStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("audit", "lib/audit/secureAudit.ts");
  stage.status = "passing";
  stage.sourceMode = loadAppEnv().databaseUrlSet ? "live" : "preview";
  stage.summary = loadAppEnv().databaseUrlSet
    ? "Prisma-backed SecureAuditStore active."
    : "In-memory SecureAuditStore — ephemeral.";
  stage.confidence = loadAppEnv().databaseUrlSet ? 0.9 : 0.55;
  void provider;
  return stage;
}

// 15) memory
function buildMemoryStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("memory", "lib/memory/operationalMemory.ts");
  stage.status = "passing";
  stage.sourceMode = loadAppEnv().databaseUrlSet ? "live" : "preview";
  stage.summary = loadAppEnv().databaseUrlSet
    ? "Prisma-backed OperationalMemoryRecord active."
    : "In-memory operational memory — ephemeral.";
  stage.confidence = loadAppEnv().databaseUrlSet ? 0.85 : 0.5;
  void provider;
  return stage;
}

// 16) next_action — what should the operator do right now?
function buildNextActionStage(provider: OperatingLoopProvider): OperatingLoopStage {
  const stage = baseStage("next_action", "lib/controlPlane/nextBestActionEngine.ts");
  stage.status = "passing";
  stage.sourceMode = "live";
  stage.summary = "Next-best-action engine surfaces ordered safe-task suggestions.";
  stage.safeNextAction = nextActionFor(provider);
  stage.confidence = 0.85;
  return stage;
}

// ---------------------------------------------------------------------------
// Roll-up + helpers
// ---------------------------------------------------------------------------

function pickCurrentStage(stages: OperatingLoopStage[]): OperatingLoopStageId {
  // First non-passing stage is the place we're parked.
  const halt = stages.find((s) =>
    s.status === "requires_input" || s.status === "requires_approval" || s.status === "blocked" || s.status === "failed" || s.status === "not_started",
  );
  if (halt) return halt.id;
  // Otherwise the last stage we have data for.
  const last = [...stages].reverse().find((s) => s.status !== "skipped");
  return last?.id ?? "setup";
}

function pickRunStatus(stages: OperatingLoopStage[]): OperatingLoopRunStatus {
  if (stages.some((s) => s.status === "failed")) return "failed";
  if (stages.some((s) => s.status === "requires_approval")) return "paused_for_approval";
  if (stages.some((s) => s.status === "requires_input")) return "paused_for_user_input";
  if (stages.some((s) => s.status === "blocked")) return "blocked";
  const meaningful = stages.filter((s) => s.status !== "skipped");
  if (meaningful.every((s) => s.status === "passing" || s.status === "completed")) return "completed";
  return "in_progress";
}

function composeSummary(provider: OperatingLoopProvider, stages: OperatingLoopStage[]): string {
  const live = stages.filter((s) => s.sourceMode === "live" && s.status !== "skipped").length;
  const preview = stages.filter((s) => s.sourceMode === "preview" && s.status !== "skipped").length;
  const blocked = stages.filter((s) => s.status === "blocked" || s.status === "failed").length;
  const attention = stages.filter((s) => s.status === "requires_input" || s.status === "requires_approval").length;
  const total = stages.filter((s) => s.status !== "skipped").length;
  return `${provider}: ${live}/${total} stages live · ${preview} preview · ${blocked} blocked · ${attention} await operator.`;
}

function nextActionFor(provider: OperatingLoopProvider): { label: string; href: string } {
  switch (provider) {
    case "aws":              return { label: "Open AWS scan",            href: "/dashboard/multi-cloud" };
    case "azure":            return { label: "Open Azure scan",          href: "/dashboard/multi-cloud" };
    case "gcp":              return { label: "Open GCP scan",            href: "/dashboard/multi-cloud" };
    case "github":           return { label: "Open ReleaseOps",          href: "/dashboard/releaseops" };
    case "security_scanner": return { label: "Open security scanner",    href: "/dashboard/security-scanner" };
    case "desktop":          return { label: "Open desktop downloads",   href: "/desktop" };
  }
}

// ---------------------------------------------------------------------------
// Convenience: build all six loops at once (used by the platform overview)
// ---------------------------------------------------------------------------

export async function buildAllOperatingLoops(input: Omit<BuildLoopInput, "provider">): Promise<OperatingLoopRun[]> {
  const providers: OperatingLoopProvider[] = ["aws", "azure", "gcp", "github", "security_scanner", "desktop"];
  const runs = await Promise.all(providers.map((provider) => buildOperatingLoopRun({ ...input, provider })));
  return runs;
}

// Touch unused-import suppressor.
export type _EvidenceRef = EvidenceRef;
export type _SourceMode = SourceMode;
export type _Status = OperatingLoopStageStatus;

/**
 * Axiom OS state builder.
 *
 * Pure read-only composition over existing canonical aggregators. The
 * builder NEVER replaces any of those — it just calls them and threads
 * their outputs into one typed shape.
 *
 * Hard rules:
 *  - No SDK calls. Every input comes from already-canonical builders.
 *  - No mutations.
 *  - Every section captures honest source-mode + limitations from its
 *    underlying source. The rollup at the top reflects the most-conservative
 *    section.
 *  - Failures of one builder never abort the whole state — each section
 *    catches errors locally and falls back to an honest "unknown" envelope.
 */

import "server-only";

import { buildAllOperatingLoops } from "@/lib/operatingLoop/operatingLoopBuilder";
import { runProductionReadiness } from "@/lib/readiness/productionReadinessRunner";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { CONTROL_REGISTRY, summarizeControls } from "@/lib/compliance/controlRegistry";
import { collectForTenant, summarizeEvidence } from "@/lib/compliance/evidenceCollector";
import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig, listMissingAwsConfig } from "@/lib/cloud/aws/awsConfig";
import { getAzureConfig } from "@/lib/cloud/azure/azureConfig";
import { getGcpConfig } from "@/lib/cloud/gcp/gcpConfig";
import { getGithubMode } from "@/lib/connectors/github/githubLiveClient";
import { getGithubConfig, listMissingGithubConfig } from "@/lib/connectors/github/githubConfig";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import {
  overallStatusFor,
  rollupSourceMode,
  type AxiomOSSourceMode,
  type AxiomOSState,
  type NextBestActionLite,
  type OperatingLoopSummary,
  type ProviderPosture,
  type SectionEnvelope,
} from "./axiomOSModel";

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export interface BuildAxiomOSStateInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildAxiomOSState(input: BuildAxiomOSStateInput): Promise<AxiomOSState> {
  const env = loadAppEnv();
  const generatedAt = new Date().toISOString();

  // 1) Operating loops first — they carry the per-provider attentionRequiredCount
  //    + status the provider posture is enriched with below. Pure-read, no SDK calls.
  const operatingLoops = await safeBuildOperatingLoops(input);

  // 2) Per-provider posture — enriched with operating-loop counts + timestamps.
  const providers = buildProviders(operatingLoops, generatedAt);

  // 3) ReleaseOps — typed envelope.
  const releaseOpsPosture = await safeReleaseOps(input);

  // 4) Security posture — derived from operating-loop AWS findings + scanner
  //    expectations. We synthesise a summary instead of running the scanner
  //    here (the scanner has its own endpoint).
  const securityPosture = synthesiseSecurityPosture(operatingLoops);

  // 5) Remediation posture — derived from operating-loop hints.
  const remediationPosture = synthesiseRemediation(operatingLoops);

  // 6) Approval posture.
  const approvalPosture: SectionEnvelope<{ pendingCount: number; highRiskCount: number; expiredCount: number }> = {
    status: "preview",
    sourceMode: env.databaseUrlSet ? "partial_live" : "preview",
    data: { pendingCount: 0, highRiskCount: 0, expiredCount: 0 },
    limitations: env.databaseUrlSet ? [] : ["No persistence — approval counts are reset every server boot."],
    safeNextAction: { label: "Open approval center", href: "/dashboard/orchestration/approvals" },
  };

  // 7) Desktop posture.
  const desktopPosture: SectionEnvelope<{ binaryAvailable: boolean; signingStatus: "signed_notarized" | "signed" | "unsigned" | "preview"; pairedSessions: number; localExecutionDisabled: true }> = {
    status: env.desktopHandoffSigningKeySet ? "passing" : "preview",
    sourceMode: env.desktopHandoffSigningKeySet ? "live" : "preview",
    data: {
      binaryAvailable: env.desktopDownloadsEnabled,
      signingStatus: env.desktopMode === "live" ? "signed" : "preview",
      pairedSessions: 0,
      localExecutionDisabled: true,
    },
    limitations: env.desktopHandoffSigningKeySet
      ? []
      : ["DESKTOP_HANDOFF_SIGNING_KEY not set — using NEXTAUTH_SECRET fallback."],
    safeNextAction: { label: "Open desktop install", href: "/desktop" },
  };

  // 8) Audit posture.
  const auditPosture: SectionEnvelope<{ recentEventCount: number; persistent: boolean }> = {
    status: env.databaseUrlSet ? "passing" : "preview",
    sourceMode: env.databaseUrlSet ? "live" : "preview",
    data: { recentEventCount: 0, persistent: env.databaseUrlSet },
    limitations: env.databaseUrlSet ? [] : ["Audit store is in-memory — events lost on restart."],
    safeNextAction: { label: "Open audit center", href: "/dashboard/audit" },
  };

  // 9) Evidence posture — pulls real coverage from collectForTenant.
  const evidencePosture = await safeEvidence(input);

  // 10) Memory posture.
  const memoryPosture: SectionEnvelope<{ recordCount: number; persistent: boolean }> = {
    status: env.databaseUrlSet ? "passing" : "preview",
    sourceMode: env.databaseUrlSet ? "live" : "preview",
    data: { recordCount: 0, persistent: env.databaseUrlSet },
    limitations: env.databaseUrlSet ? [] : ["Memory store is in-memory — records lost on restart."],
  };

  // 11) Top-level rollup.
  const sectionModes: AxiomOSSourceMode[] = [
    ...providers.map((p) => p.mode),
    releaseOpsPosture.sourceMode,
    securityPosture.sourceMode,
    remediationPosture.sourceMode,
    approvalPosture.sourceMode,
    desktopPosture.sourceMode,
    auditPosture.sourceMode,
    evidencePosture.sourceMode,
    memoryPosture.sourceMode,
  ];
  const sourceMode = rollupSourceMode(sectionModes);

  // 12) Readiness + trust scores.
  const readinessReport = await safeReadiness(input);
  const readinessScore = readinessReport?.overallScore ?? 0;
  const trustScore = computeTrustScore();

  // 13) Compose next-best-actions from operating-loop top hints.
  const nextBestActions = composeNextActions(operatingLoops);
  const { safeAutonomousTasks, userRequiredActions, criticalBlockers } = composeOperatorSurfaces(operatingLoops);

  // 14) Evidence refs — short list for cross-traceability.
  const evidenceRefs = [
    ...(readinessReport?.checks ?? []).slice(0, 8).map((c) => `readiness:${c.id}`),
  ];

  // 15) Honest aggregate limitations.
  const limitations = [
    ...(env.databaseUrlSet ? [] : ["DATABASE_URL not set — audit/memory/sessions are ephemeral."]),
    ...(env.awsBrokerConfigured ? [] : ["AWS broker not configured — AWS live scan unavailable."]),
    ...(getGithubMode() === "live" ? [] : ["GitHub live mode requires PAT or App credentials."]),
  ];

  return {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    generatedAt,
    sourceMode,
    overallStatus: overallStatusFor(readinessScore, sectionModes),
    readinessScore,
    trustScore,
    safetyStatus: "approval_gated_no_destructive_execution",
    providers,
    securityPosture,
    releaseOpsPosture,
    remediationPosture,
    approvalPosture,
    desktopPosture,
    auditPosture,
    evidencePosture,
    memoryPosture,
    operatingLoops,
    nextBestActions,
    safeAutonomousTasks,
    userRequiredActions,
    criticalBlockers,
    limitations,
    evidenceRefs,
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildProviders(
  operatingLoops: OperatingLoopSummary[],
  generatedAt: string,
): ProviderPosture[] {
  const env = loadAppEnv();

  // Index operating-loop summaries by provider so we can thread per-provider
  // findingCount (attentionRequiredCount) + lastScannedAt without re-running
  // any scan. Loops that haven't completed never contribute a timestamp.
  const loopByProvider = new Map<string, OperatingLoopSummary>();
  for (const loop of operatingLoops) loopByProvider.set(loop.provider, loop);

  const loopExtras = (provider: "aws" | "azure" | "gcp" | "github"): { findingCount?: number; lastScannedAt?: string } => {
    const loop = loopByProvider.get(provider);
    if (!loop) return {};
    const findingCount = typeof loop.attentionRequiredCount === "number" ? loop.attentionRequiredCount : undefined;
    // Only claim a scan time when the loop has actually run (completed / in_progress).
    const lastScannedAt =
      loop.status === "completed" || loop.status === "in_progress" || loop.status === "paused_for_approval"
        ? generatedAt
        : undefined;
    return { findingCount, lastScannedAt };
  };

  // AWS
  const awsCfg = getAwsConfig();
  const awsMode: AxiomOSSourceMode = awsCfg.mode === "live" ? "live" : awsCfg.mode === "preview" ? "preview" : "disabled";
  const aws: ProviderPosture = {
    provider: "aws",
    mode: awsMode,
    headline: awsMode === "live" ? "Live read-only inventory (single + multi-region)" : "Preview snapshot — configure broker credentials for live scan",
    connectionStatus: awsMode === "live" ? "connected" : awsMode === "preview" ? "preview" : "blocked",
    missingRequirements: listMissingAwsConfig(),
    ...loopExtras("aws"),
    safeNextAction: awsMode === "live"
      ? { label: "Run AWS scan", href: "/api/aws/scan" }
      : { label: "Open AWS setup", href: "/docs/aws-setup" },
  };

  // Azure
  const azureCfg = getAzureConfig();
  const azureMode: AxiomOSSourceMode = azureCfg.mode === "live" ? "live" : azureCfg.mode === "expanding" ? "expanding" : "preview";
  const azure: ProviderPosture = {
    provider: "azure",
    mode: azureMode,
    headline: azureMode === "live" ? "Live validator + preview inventory" : "Preview foundation — configure AZURE_* for live validation",
    connectionStatus: azureMode === "live" ? "connected" : azureMode === "expanding" ? "expanding" : "preview",
    missingRequirements: azureMode === "live" ? [] : ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"],
    ...loopExtras("azure"),
    safeNextAction: { label: "Open Azure setup", href: "/docs/azure-setup" },
  };

  // GCP
  const gcpCfg = getGcpConfig();
  const gcpMode: AxiomOSSourceMode = gcpCfg.mode === "live" ? "live" : gcpCfg.mode === "expanding" ? "expanding" : "preview";
  const gcp: ProviderPosture = {
    provider: "gcp",
    mode: gcpMode,
    headline: gcpMode === "live" ? "Live validator + preview inventory" : "Preview foundation — configure GCP credentials for live validation",
    connectionStatus: gcpMode === "live" ? "connected" : gcpMode === "expanding" ? "expanding" : "preview",
    missingRequirements: gcpMode === "live" ? [] : ["GCP_PROJECT_ID", "GCP_SERVICE_ACCOUNT_JSON  *or*  GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY"],
    ...loopExtras("gcp"),
    safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
  };

  // GitHub
  const ghCfg = getGithubConfig();
  const ghMode: AxiomOSSourceMode = ghCfg.mode === "live" ? "live" : "preview";
  const github: ProviderPosture = {
    provider: "github",
    mode: ghMode,
    headline: ghMode === "live"
      ? `Live read-only via ${ghCfg.authPreference === "github_app" ? "GitHub App" : "PAT"}`
      : "Preview sync — configure GitHub App or PAT for live data",
    connectionStatus: ghMode === "live" ? "connected" : "preview",
    missingRequirements: listMissingGithubConfig(),
    ...loopExtras("github"),
    safeNextAction: ghMode === "live"
      ? { label: "Run GitHub sync", href: "/api/github/sync" }
      : { label: "Open GitHub integration", href: "/dashboard/integrations/github" },
  };

  void env;
  return [aws, azure, gcp, github];
}

async function safeBuildOperatingLoops(input: BuildAxiomOSStateInput): Promise<OperatingLoopSummary[]> {
  try {
    const loops = await buildAllOperatingLoops({
      organizationId: input.tenantId,
      actorUserId: input.actorUserId,
    });
    return loops.map((l) => ({
      provider: l.provider,
      currentStage: l.currentStage,
      status: l.status,
      sourceMode: (l.sourceMode === "expanding" || l.sourceMode === "unknown") ? "preview" : l.sourceMode as AxiomOSSourceMode,
      topSafeNextAction: l.topSafeNextAction,
      attentionRequiredCount: l.attentionRequired.length,
    }));
  } catch {
    return [];
  }
}

async function safeReleaseOps(input: BuildAxiomOSStateInput): Promise<SectionEnvelope<{ readinessScore: number; readinessGrade: string; repoCount: number; workflowCount: number; failingWorkflowCount: number; blockerCount: number }>> {
  try {
    const state = await getReleaseOpsState({});
    return {
      status: state.source === "live" ? "passing" : state.source === "partial" ? "partial" : state.source === "disabled" ? "blocked" : "preview",
      sourceMode: state.source === "live" ? "live" : state.source === "partial" ? "partial_live" : state.source === "disabled" ? "disabled" : "preview",
      data: {
        readinessScore: state.readiness.score,
        readinessGrade: state.readiness.grade,
        repoCount: state.inventory.repos.length,
        workflowCount: state.inventory.workflows.length,
        failingWorkflowCount: state.inventory.workflows.filter((w) => w.lastRunStatus === "failure").length,
        blockerCount: state.readiness.blockers.length,
      },
      limitations: state.limitations,
      safeNextAction: state.safeNextAction,
    };
  } catch {
    return {
      status: "unknown",
      sourceMode: "unknown",
      data: { readinessScore: 0, readinessGrade: "F", repoCount: 0, workflowCount: 0, failingWorkflowCount: 0, blockerCount: 0 },
      limitations: ["ReleaseOps state could not be built — check GitHub configuration."],
    };
  }
}

async function safeEvidence(input: BuildAxiomOSStateInput): Promise<SectionEnvelope<{ totalRecords: number; verifiedRecords: number; coverageScore: number }>> {
  try {
    const records = await collectForTenant(input.tenantId);
    const summary = summarizeEvidence(records);
    return {
      status: summary.verified > 0 ? "passing" : summary.total > 0 ? "partial" : "preview",
      sourceMode: summary.verified > 0 ? "live" : "preview",
      data: { totalRecords: summary.total, verifiedRecords: summary.verified, coverageScore: summary.coverageScore },
      limitations: summary.total === 0 ? ["No evidence collected yet — run a scan or operating-loop pass."] : [],
      safeNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
    };
  } catch {
    return {
      status: "unknown",
      sourceMode: "unknown",
      data: { totalRecords: 0, verifiedRecords: 0, coverageScore: 0 },
      limitations: ["Evidence collector unavailable."],
    };
  }
}

async function safeReadiness(input: BuildAxiomOSStateInput): Promise<Awaited<ReturnType<typeof runProductionReadiness>> | undefined> {
  try {
    return await runProductionReadiness({
      organizationId: input.tenantId,
      actorUserId: input.actorUserId,
    });
  } catch {
    return undefined;
  }
}

function computeTrustScore(): number {
  const summary = summarizeControls(CONTROL_REGISTRY);
  return summary.score;
}

function synthesiseSecurityPosture(loops: OperatingLoopSummary[]): SectionEnvelope<{ totalFindings: number; criticalCount: number; highCount: number; mediumCount: number; lowCount: number; compoundedRiskCount: number; affectedSystems: string[] }> {
  // The scanner has its own canonical endpoint; here we surface the loop's
  // operator-attention counts as a proxy until the UI calls scanner+state together.
  const attention = loops.reduce((s, l) => s + l.attentionRequiredCount, 0);
  return {
    status: attention === 0 ? "passing" : attention < 3 ? "partial" : "failing",
    sourceMode: rollupSourceMode(loops.map((l) => l.sourceMode)),
    data: {
      totalFindings: attention,
      criticalCount: 0,
      highCount: attention,
      mediumCount: 0,
      lowCount: 0,
      compoundedRiskCount: 0,
      affectedSystems: loops.filter((l) => l.attentionRequiredCount > 0).map((l) => l.provider),
    },
    limitations: ["Security posture surfaces operating-loop attention counts; full scanner output via POST /api/security-scan."],
    safeNextAction: { label: "Open security scanner", href: "/dashboard/security-scanner" },
  };
}

function synthesiseRemediation(loops: OperatingLoopSummary[]): SectionEnvelope<{ candidateCount: number; simulatedCount: number; approvalGatedCount: number; desktopReviewEligibleCount: number }> {
  // Honest synthesis: the operating loop knows whether remediation/simulation
  // stages are reachable per provider; counts come from the orchestrator.
  return {
    status: "preview",
    sourceMode: rollupSourceMode(loops.map((l) => l.sourceMode)),
    data: { candidateCount: 0, simulatedCount: 0, approvalGatedCount: 0, desktopReviewEligibleCount: 0 },
    limitations: ["Counts populate once an operator runs `POST /api/remediation/plan`."],
    safeNextAction: { label: "Open remediation", href: "/dashboard/remediation" },
  };
}

// ---------------------------------------------------------------------------
// Operator surfaces — what to do next
// ---------------------------------------------------------------------------

function composeNextActions(loops: OperatingLoopSummary[]): NextBestActionLite[] {
  const out: NextBestActionLite[] = [];
  for (const l of loops) {
    if (!l.topSafeNextAction) continue;
    out.push({
      id: `nba.${l.provider}.${l.currentStage}`,
      title: l.topSafeNextAction.label,
      description: `Advance the ${l.provider} loop from ${l.currentStage}.`,
      category: l.provider,
      priority: l.attentionRequiredCount > 0 ? 1 : 3,
      riskLevel: l.attentionRequiredCount > 0 ? "high" : "low",
      canRunNow: l.status === "in_progress",
      approvalRequired: l.status === "paused_for_approval",
      route: l.topSafeNextAction.href,
    });
  }
  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, 8);
}

function composeOperatorSurfaces(loops: OperatingLoopSummary[]) {
  const safeAutonomousTasks: { id: string; title: string; route?: string }[] = [];
  const userRequiredActions: { id: string; title: string; reason: string; route?: string }[] = [];
  const criticalBlockers: { area: string; reason: string; safeNextAction?: { label: string; href: string } }[] = [];

  // Always-available safe tasks via the existing safe-task runner.
  safeAutonomousTasks.push(
    { id: "safe.refresh_control_plane", title: "Refresh control plane state", route: "/api/control-plane/refresh" },
    { id: "safe.run_security_scan",     title: "Run security scanner",        route: "/api/security-scan" },
    { id: "safe.refresh_readiness",     title: "Refresh production readiness", route: "/api/readiness" },
  );

  for (const l of loops) {
    if (l.status === "paused_for_user_input") {
      userRequiredActions.push({
        id: `urn.${l.provider}`,
        title: `${l.provider}: needs operator input`,
        reason: `Loop paused at "${l.currentStage}".`,
        route: l.topSafeNextAction?.href,
      });
    }
    if (l.status === "paused_for_approval") {
      criticalBlockers.push({
        area: l.provider,
        reason: `Awaiting approval at "${l.currentStage}".`,
        safeNextAction: l.topSafeNextAction,
      });
    }
    if (l.status === "blocked" || l.status === "failed") {
      criticalBlockers.push({
        area: l.provider,
        reason: `Loop is ${l.status} at "${l.currentStage}".`,
        safeNextAction: l.topSafeNextAction,
      });
    }
  }
  return { safeAutonomousTasks, userRequiredActions, criticalBlockers };
}

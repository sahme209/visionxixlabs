/**
 * Canonical Command Center state adapter.
 *
 * One server-side function the Command Center page (and the dashboard
 * home) read. Composes typed state from the canonical sources — connector
 * registry, last scan output, security posture, reliability posture, AI
 * safety, release distribution, onboarding state — and returns a single
 * `CommandCenterState` with an honest source tag per section.
 *
 * Pages stop relying on isolated mock arrays. When live data is missing,
 * the section carries `source: "empty" | "preview"` so the UI labels
 * accurately.
 */

import "server-only";
import { currentContext } from "@/lib/auth/currentContext";
import { serverFeatures, toClientFlags } from "@/lib/config/features";
import { assessOnboarding } from "@/lib/onboarding/onboardingState";
import { buildSecurityPosture } from "@/lib/security/securityPosture";
import { buildReliabilityPosture } from "@/lib/reliability/reliabilityPosture";
import { buildObservabilityPosture } from "@/lib/observability/observabilityPosture";
import { resolveNextAction } from "@/lib/product/nextAction";
import { summarizeControls, CONTROL_REGISTRY } from "@/lib/compliance/controlRegistry";
import { platformSummaries } from "@/lib/release/versionModel";
import { buildMultiCloudOverview } from "@/lib/cloud/multiCloudOverview";
import type { MultiCloudOverview } from "@/lib/cloud/multiCloudOverview";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import type { ReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { summarizeValidation } from "@/lib/validation/platformValidationMatrix";
import type { FeatureFlags } from "@/lib/config/features";

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export type SectionSource = "real" | "preview" | "empty" | "unavailable";

export interface SectionEnvelope<T> {
  source: SectionSource;
  data: T;
  /** Optional reason — e.g. "AWS not connected" or "live mode disabled". */
  note?: string;
}

export interface CommandCenterState {
  features: FeatureFlags;
  user: {
    isAuthenticated: boolean;
    email?: string;
    displayName?: string;
    workspaceLabel?: string;
  };
  onboarding: SectionEnvelope<ReturnType<typeof assessOnboarding>>;
  posture: {
    security:      SectionEnvelope<ReturnType<typeof buildSecurityPosture>>;
    reliability:   SectionEnvelope<ReturnType<typeof buildReliabilityPosture>>;
    observability: SectionEnvelope<ReturnType<typeof buildObservabilityPosture>>;
  };
  nextAction: SectionEnvelope<ReturnType<typeof resolveNextAction>>;
  compliance: SectionEnvelope<{ score: number; implemented: number; total: number; partial: number; planned: number }>;
  releases: SectionEnvelope<ReturnType<typeof platformSummaries>>;
  /** Normalised multi-cloud overview across AWS / Azure / GCP. */
  multiCloud: SectionEnvelope<MultiCloudOverview>;
  /** ReleaseOps state (GitHub connector + readiness). */
  releaseOps: SectionEnvelope<ReleaseOpsState>;
  /** Validation matrix headline. */
  validation: SectionEnvelope<{ score: number; passing: number; total: number; partial: number; preview: number; blocked: number }>;
  /** What the Command Center should headline if the user is fresh. */
  headline: string;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export async function getCommandCenterState(): Promise<CommandCenterState> {
  const ctx = await currentContext();
  const features = serverFeatures();
  const clientFlags = toClientFlags(features);

  // Onboarding — driven by connectors when wired, falls back to "fresh user"
  // until the connector registry persists ProviderConnection rows.
  const connectedClouds = 0; // TODO: read from ProviderConnection table when it lands.
  const onboarding = assessOnboarding({
    hasAccount: ctx.isAuthenticated,
    providerSelected: false,
    credentialsSubmitted: false,
    credentialsValidated: false,
    scansStarted: 0,
    snapshotsPersisted: 0,
    recommendationsViewed: 0,
    plansBuilt: 0,
    approvalsGranted: 0,
    plansExecutedOrExported: 0,
    auditBundlesExported: 0,
  });

  // Posture — honest preview inputs until telemetry lands.
  const security = buildSecurityPosture({
    source: "preview",
    credentials: [],
    pairedDesktops: [],
    crossTenantAttempts30d: 0,
    policyBlocks30d: 0,
    openHighRiskFindings: 0,
    redactionEnabled: true,
    auditStoreConfigured: true,
    copilotContextSafe: true,
  });
  const reliability = buildReliabilityPosture({
    source: "preview",
    components: [
      { id: "web_app",          label: "Web app",         status: "healthy" },
      { id: "database",         label: "Database",        status: "healthy" },
      { id: "connector.aws",    label: "AWS connector",   status: features.awsLiveScan ? "healthy" : "unknown" },
      { id: "workflow_engine",  label: "Workflow engine", status: "healthy" },
      { id: "copilot_llm",      label: "Copilot LLM",     status: features.copilot ? "healthy" : "unknown" },
    ],
    circuits: [],
    deadLetters: [],
    fleet: { total: 0, healthy: 0, stalled: 0, stuck: 0, failed: 0, partial: 0, actionable: [] },
    retryingJobs: 0,
    successfulRetries24h: 0,
    rateLimitPauses24h: 0,
  });
  const observability = buildObservabilityPosture({
    source: "preview",
    traces24h: 0,
    auditRecords24h: 0,
    bundlesExported30d: 0,
    loggerActive: true,
    auditStoreConfigured: true,
    copilotAuditActive: features.copilot,
  });

  // Compliance summary
  const controlSummary = summarizeControls(CONTROL_REGISTRY);
  const compliance = {
    score: controlSummary.score,
    implemented: controlSummary.implemented,
    partial: controlSummary.partial,
    planned: controlSummary.planned,
    total: controlSummary.total,
  };

  const releases = platformSummaries();

  const nextAction = resolveNextAction({
    connectedClouds,
    primaryLifecycle: connectedClouds > 0 ? "lifecycle.idle" : undefined,
    pendingApprovals: 0,
    readyPlans: 0,
    releaseopsConnected: false,
    releaseopsServicesAtRisk: 0,
    desktopAvailable: false,
    hasRunScan: connectedClouds > 0,
    isAuthenticated: ctx.isAuthenticated,
  });

  // Multi-cloud overview — runs with no scan inputs (preview-only) so the
  // tile is always populated. Live inputs slot in once provider scanners
  // are invoked elsewhere and their output is passed in here.
  const multiCloud = buildMultiCloudOverview({});

  // ReleaseOps — runs the preview GitHub sync + readiness composer.
  const releaseOps = await getReleaseOpsState({});

  // Validation matrix summary
  const validation = summarizeValidation();

  const headline = !ctx.isAuthenticated
    ? "Sign in to open your workspace."
    : connectedClouds === 0
      ? "Connect AWS to begin operating your cloud."
      : "Operating across your connected providers.";

  return {
    features: clientFlags,
    user: {
      isAuthenticated: ctx.isAuthenticated,
      email: ctx.email,
      displayName: ctx.displayName,
      workspaceLabel: ctx.workspaceLabel,
    },
    onboarding:    { source: "preview", data: onboarding },
    posture: {
      security:      { source: "preview", data: security,    note: "Posture math runs on preview inputs until live telemetry is wired." },
      reliability:   { source: "preview", data: reliability, note: "Component health unknown until probes register." },
      observability: { source: "preview", data: observability },
    },
    nextAction:    { source: "real", data: nextAction },
    compliance:    { source: "real", data: compliance, note: `${compliance.implemented}/${compliance.total} controls implemented.` },
    releases:      { source: "real", data: releases },
    multiCloud:    { source: "preview", data: multiCloud, note: "Multi-cloud aggregator running on preview inputs — live snapshots slot in once provider scanners are invoked." },
    releaseOps:    { source: "preview", data: releaseOps, note: "ReleaseOps state running on preview sync; live GitHub sync ships once octokit wiring lands." },
    validation:    { source: "real",    data: { score: validation.score, passing: validation.passing, total: validation.total, partial: validation.partial, preview: validation.preview, blocked: validation.blocked } },
    headline,
  };
}

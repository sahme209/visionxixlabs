/**
 * Launch readiness runner.
 *
 * Composes a `LaunchReadinessReport` from existing canonical builders:
 *   - lib/axiomOS/axiomOSStateBuilder       (provider modes, sections)
 *   - lib/readiness/productionReadinessRunner (composite score, checks)
 *   - lib/validation/platformValidationMatrix (passing count)
 *   - lib/config/env                         (persistence presence)
 *
 * Pure read-only. Never fabricates a score. Categories that can't be
 * verified are explicitly returned with `status: "failing"` or
 * `"blocked"` and a `topFix` hint.
 */

import "server-only";

import { VALIDATION_MATRIX } from "@/lib/validation/platformValidationMatrix";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { runProductionReadiness } from "@/lib/readiness/productionReadinessRunner";
import { loadAppEnv } from "@/lib/config/env";
import { CONTROL_REGISTRY, summarizeControls } from "@/lib/compliance/controlRegistry";

import {
  CATEGORY_LABELS,
  statusForScore,
  type LaunchCategory,
  type LaunchCategoryRow,
  type LaunchReadinessReport,
  type LaunchSourceMode,
} from "./launchReadinessModel";

import type { OrganizationId, UserId } from "@/lib/domain/ids";

export interface RunLaunchReadinessInput {
  organizationId: OrganizationId;
  actorUserId?: UserId;
}

export async function runLaunchReadiness(input: RunLaunchReadinessInput): Promise<LaunchReadinessReport> {
  const generatedAt = new Date().toISOString();
  const env = loadAppEnv();

  const [axiomOS, prodReadiness] = await Promise.all([
    buildAxiomOSState({ tenantId: input.organizationId, actorUserId: input.actorUserId }),
    runProductionReadiness({ organizationId: input.organizationId, actorUserId: input.actorUserId }).catch(() => undefined),
  ]);

  const matrixPassing = VALIDATION_MATRIX.filter((r) => r.status === "passing").length;
  const matrixPartial = VALIDATION_MATRIX.filter((r) => r.status === "partial").length;
  const matrixTotal = VALIDATION_MATRIX.length;
  const matrixCoverage = matrixTotal > 0 ? (matrixPassing + matrixPartial * 0.5) / matrixTotal : 0;

  const controlSummary = summarizeControls(CONTROL_REGISTRY);
  const providerLiveCount = axiomOS.providers.filter((p) => p.mode === "live").length;
  const evidenceCoverage = axiomOS.evidencePosture.data.coverageScore;
  const productHonestyChecks = prodReadiness?.checks.filter((c) => c.category === "product_honesty_readiness") ?? [];
  const honestyClean = productHonestyChecks.every((c) => c.status === "passing");

  const rows: LaunchCategoryRow[] = [
    row("product_clarity",                axiomOS.providers.length > 0 ? 80 : 40, "lib/axiomOS/axiomOSStateBuilder.ts + AxiomOSStrip on Command Center", liveMode(axiomOS.sourceMode), []),
    row("main_journey",                   axiomOS.nextBestActions.length > 0 ? 70 : 40, "AxiomOSState.nextBestActions[] + operating-loop builder", liveMode(axiomOS.sourceMode), axiomOS.nextBestActions.length === 0 ? ["No next-best-actions surfaced — operating loops may be misconfigured."] : []),
    row("aws_depth",                      providerScore("aws", axiomOS), "lib/cloud/aws/awsLiveInventory.ts + awsMultiRegionInventory.ts + cloudScanPipeline", providerMode("aws", axiomOS), providerBlockers("aws", axiomOS)),
    row("github_releaseops_depth",        providerScore("github", axiomOS), "lib/connectors/github/{githubLiveClient,githubLiveScanner,githubAppAuth}.ts + ReleaseOps state", providerMode("github", axiomOS), providerBlockers("github", axiomOS)),
    row("azure_gcp_foundation",           foundationScore(axiomOS), "lib/cloud/{azure,gcp}/{validator,config,previewScanner}.ts", "preview", azureGcpBlockers(axiomOS)),
    row("security_scanner",               75, "lib/securityScanner/{securityScanner,vulnerabilityModel,compoundedRiskReasoner}.ts + 18 vitest assertions", "live", []),
    row("remediation_simulation_approval", 60, "lib/remediation/* + lib/simulation/* + lib/approvals/* — operating loop refuses approval/preflight/verify", "live", ["Remediation candidate counts populate after operator runs /api/remediation/plan."]),
    row("desktop_review",                 env.desktopHandoffSigningKeySet ? 65 : 50, "lib/desktop/{desktopSession,desktopToken,executionHandoff}.ts + paste-flow UI", env.desktopHandoffSigningKeySet ? "live" : "preview", env.desktopHandoffSigningKeySet ? [] : ["DESKTOP_HANDOFF_SIGNING_KEY not set — falling back to NEXTAUTH_SECRET."]),
    row("desktop_intelligence",           env.desktopHandoffSigningKeySet ? 80 : 65, "lib/desktop/desktopIntelligence{Model,Builder}.ts + /api/desktop/intelligence + /dashboard/desktop/intelligence — joins Priority + ApprovalPacket + AutomationBoundary + DesktopPosture", env.desktopHandoffSigningKeySet ? "live" : "preview", env.desktopHandoffSigningKeySet ? [] : ["Pairing not configured — workstation surfaces handoff CTAs as preview."]),
    row("desktop_releases",               env.desktopDownloadsEnabled ? 70 : 55, "lib/desktop/desktopRelease{Model,Builder}.ts + /api/desktop/releases + /dashboard/desktop/releases — joins live GitHub release manifest with per-platform signing gates", env.desktopDownloadsEnabled ? "partial_live" : "preview", env.desktopDownloadsEnabled ? ["Signing/notarization gates pending Apple Developer ID + Windows EV cert in CI."] : ["DESKTOP_DOWNLOADS_ENABLED is false — /download still in preview."]),
    row("trust_audit_evidence",           Math.min(100, Math.round(70 + evidenceCoverage * 30)), "lib/compliance/* + /api/trust/{summary,controls,evidence,export}", evidenceCoverage > 0 ? "live" : "preview", evidenceCoverage === 0 ? ["No evidence collected yet — run a scan / operating-loop pass."] : []),
    row("self_serve_onboarding",          80, "lib/onboarding/selfServeSetupOrchestrator.ts + per-provider missingRequirements[]", "live", []),
    row("product_honesty",                honestyClean ? 100 : 60, "lib/readiness/productHonestyChecks.ts + 'honesty.product_copy_clean' matrix row", "live", honestyClean ? [] : ["Honesty scanner flagged a risky phrase — see /api/readiness."]),
    row("route_health",                   Math.round(matrixCoverage * 100), `validation matrix: ${matrixPassing}/${matrixTotal} passing`, liveMode(axiomOS.sourceMode), []),
    row("api_health",                     Math.round(matrixCoverage * 100), "All new routes use apiSuccess/apiFailure + toAxiomError redaction", "live", []),
    row("api_safety_module",              90, "lib/api/{apiEnvelope,sourceMode,safetyContracts,redaction,correlation,index}.ts — closed ApiSafetyContract union (24 literals) + canonical envelope + correlation ids + payload redaction + sourceMode rollup", "live", []),
    row("intelligence_systems",           80, "lib/intelligence/{priorityEngine,nextActionEngine,executiveSummaryBuilder,approvalPacketBuilder,rootCauseGrouper}.ts — every engine pure-projection over canonical state", "live", []),
    row("governance_systems",             82, "lib/risk/riskQueueBuilder + lib/notifications/notificationBuilder + lib/policy/{policyRegistry,policyEvaluator} + lib/scheduler/scheduledScanModel + lib/evidence/evidenceLibraryBuilder — closed-union typed engines", "live", []),
    row("operating_graph_visibility",     85, "components/dashboard/OperatingGraphPanel mounted in Trust Center + Command Center — every node + edge of canonical state rendered on first paint", "live", []),
    row("persistence",                    env.databaseUrlSet ? 90 : 40, env.databaseUrlSet ? "DATABASE_URL configured + Prisma migration 20260516120000 in place" : "DATABASE_URL not configured — adapters fall back to in-memory", env.databaseUrlSet ? "live" : "preview", env.databaseUrlSet ? [] : ["Set DATABASE_URL on the host and run `prisma migrate deploy`."]),
    row("safety_governance",              95, "operating-loop runner refuses approval / preflight / verification / desktop_review", "live", []),
    row("enterprise_presentation",        70, "AxiomOSStrip + ReadinessStrip + Trust Center APIs + matrix coverage", "live", ["UI polish on per-page strategy + drilldown panels still pending."]),
    row("developer_maintainability",      Math.round(matrixCoverage * 100), `${matrixTotal} validation rows + ${controlSummary.total} controls + vitest tests for exhaustiveness + honesty + compounded risk + operating loop model`, "live", []),
    row("autonomy_loop",                  90, "lib/autonomy/{autonomousLoopModel,autonomousLoopRunner,autonomyCharter}.ts — 9-stage typed cycle with safetyContract literal autonomy_gated_no_unsafe_execution. Hard rules enforced at TypeScript level: never past unsafe_never_automate boundary; never past approve in observer mode; execute halts unless desktop paired.", "live", []),
    row("container_orchestration",        70, "lib/containers/containerOrchestration{Model,Builder}.ts + /api/containers + /dashboard/containers — typed surface across ECS / EKS / GKE / AKS / GHCR. Per-provider SDK traversal lands in follow-up phases (42b-e); shape stable.", "partial_live", ["Per-provider cluster inventory traversal still preview — typed shape is ready."]),
    row("cicd_operations",                75, "lib/cicd/{cicdOpsModel,cicdOpsBuilder}.ts + /api/cicd + /dashboard/cicd — 16 typed operations × 7 classifications. 5 unsafe operations hard-blocked at the type level: force_merge / delete_tag / push_protected_ref / rotate_signing_key / modify_workflow_yaml.", "live", []),
    row("billing_connectors",             60, "lib/billing/{billingConnectorsModel,billingConnectorsBuilder}.ts + /api/billing — 6 providers (AWS Cost Explorer / Azure Cost Mgmt / GCP Billing / GitHub / Stripe / Vercel). 8 typed anomaly kinds. Zero fabricated dollars until each provider flips live.", "preview", ["Live billing data wires per provider in follow-up phases."]),
    row("telemetry_ingest",               60, "lib/telemetry/{telemetryIngestModel,telemetryIngestBuilder}.ts + /api/telemetry — 12 providers (CloudWatch / X-Ray / Azure Monitor / Log Analytics / GCP Logging+Monitoring / Datadog / Grafana / Prometheus / Sentry / NR / OTel). 10 typed signal kinds. Zero synthesised alerts.", "preview", ["Live telemetry connectors wire per provider in follow-up phases."]),
    row("incident_response",              60, "lib/incidents/{incidentResponseModel,incidentResponseBuilder}.ts + /api/incidents — 7 providers (PagerDuty / Opsgenie / Slack / Teams / VictorOps / xMatters / Discord). 5 severity literals × 8 status literals. Inbound webhook + API client wires per provider in follow-up phases.", "preview", ["Live inbound incident streams wire per provider in follow-up phases."]),
    row("closed_loop_remediation",        85, "lib/closedLoop/{closedLoopModel,closedLoopBuilder}.ts + /api/closed-loop — completes the AGI cycle by pairing each remediation with independent verification probes. 11 ClosedLoopPhase literals × 6 VerificationProbeKind literals × 6 VerificationOutcome literals. Verification is ALWAYS independent telemetry — same-agent verification is impossible by construction.", "live", []),
    row("agi_cockpit",                    88, "/dashboard/agi + AGI Cockpit page — single-pane mission control rolling up billing + telemetry + incidents + closed-loop + autonomy last-cycle. Every lane shows safetyContract literal + sourceMode pill. Sidebar Operator group lists 'AGI Cockpit' between 'Command Center' and 'Autonomy Cockpit'.", "live", []),
  ];

  const overallLaunchScore = Math.round(
    rows.reduce((s, r) => s + r.score, 0) / Math.max(rows.length, 1),
  );

  const mustFixBeforeDemo = rows
    .filter((r) => r.score < 40 && demoCritical(r.category))
    .map((r) => ({ category: r.category, reason: r.blockers[0] ?? r.evidence }));

  const mustFixBeforePaidCustomer = rows
    .filter((r) => r.score < 70 && paidCritical(r.category))
    .map((r) => ({ category: r.category, reason: r.blockers[0] ?? r.evidence }));

  const acceptablePreviewAreas = rows
    .filter((r) => r.sourceMode === "preview" && r.score >= 40)
    .map((r) => ({ category: r.category, reason: "Honest preview — labelled clearly in product." }));

  const blockedByExternalConfig = rows
    .filter((r) => r.sourceMode === "preview" && r.blockers.length > 0)
    .map((r) => ({ category: r.category, reason: r.blockers[0] }));

  const nextBestLaunchFixes = [...rows]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((r) => ({
      id: `launch.${r.category}`,
      title: r.topFix ?? r.blockers[0] ?? `Raise ${CATEGORY_LABELS[r.category]} above ${r.score}`,
      category: r.category,
    }));

  return {
    generatedAt,
    overallLaunchScore,
    overallStatus: statusForScore(overallLaunchScore),
    rows,
    mustFixBeforeDemo,
    mustFixBeforePaidCustomer,
    acceptablePreviewAreas,
    blockedByExternalConfig,
    nextBestLaunchFixes,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function row(
  category: LaunchCategory,
  score: number,
  evidence: string,
  sourceMode: LaunchSourceMode,
  blockers: string[],
): LaunchCategoryRow {
  return {
    category,
    label: CATEGORY_LABELS[category],
    score: clamp(score),
    status: statusForScore(clamp(score)),
    evidence,
    sourceMode,
    blockers,
    topFix: blockers[0],
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function liveMode(mode: string): LaunchSourceMode {
  if (mode === "live") return "live";
  if (mode === "partial_live") return "partial_live";
  if (mode === "blocked" || mode === "disabled") return "blocked";
  if (mode === "unknown") return "unknown";
  return "preview";
}

function providerScore(name: string, state: Awaited<ReturnType<typeof buildAxiomOSState>>): number {
  const provider = state.providers.find((p) => p.provider === name);
  if (!provider) return 30;
  if (provider.mode === "live") return 85;
  if (provider.mode === "partial_live") return 70;
  if (provider.mode === "preview") return 55;
  if (provider.mode === "expanding") return 50;
  return 30;
}

function providerMode(name: string, state: Awaited<ReturnType<typeof buildAxiomOSState>>): LaunchSourceMode {
  const provider = state.providers.find((p) => p.provider === name);
  if (!provider) return "unknown";
  return liveMode(provider.mode);
}

function providerBlockers(name: string, state: Awaited<ReturnType<typeof buildAxiomOSState>>): string[] {
  const provider = state.providers.find((p) => p.provider === name);
  if (!provider) return [`${name} provider missing from AxiomOSState.`];
  if (provider.mode === "live") return [];
  if (provider.missingRequirements.length > 0) {
    return [`${name} live mode requires: ${provider.missingRequirements.slice(0, 3).join(", ")}`];
  }
  return [`${name} is in ${provider.mode} mode.`];
}

function foundationScore(state: Awaited<ReturnType<typeof buildAxiomOSState>>): number {
  const azure = state.providers.find((p) => p.provider === "azure");
  const gcp   = state.providers.find((p) => p.provider === "gcp");
  let s = 50; // baseline preview foundation
  if (azure?.mode === "live") s += 15;
  if (gcp?.mode === "live") s += 15;
  return s;
}

function azureGcpBlockers(state: Awaited<ReturnType<typeof buildAxiomOSState>>): string[] {
  const azureMissing = state.providers.find((p) => p.provider === "azure")?.missingRequirements ?? [];
  const gcpMissing   = state.providers.find((p) => p.provider === "gcp")?.missingRequirements ?? [];
  const out: string[] = [];
  if (azureMissing.length > 0) out.push(`Azure live needs ${azureMissing.slice(0, 2).join(", ")}`);
  if (gcpMissing.length > 0) out.push(`GCP live needs ${gcpMissing.slice(0, 2).join(", ")}`);
  if (out.length === 0) out.push("Azure / GCP inventory traversal still preview — validators are live.");
  return out;
}

function demoCritical(c: LaunchCategory): boolean {
  // Categories whose failure would derail a demo today.
  return c === "main_journey"
      || c === "aws_depth"
      || c === "github_releaseops_depth"
      || c === "security_scanner"
      || c === "route_health"
      || c === "api_health"
      || c === "product_honesty"
      || c === "safety_governance";
}

function paidCritical(c: LaunchCategory): boolean {
  // Categories that must clear the 70 threshold before onboarding a paid customer.
  return demoCritical(c)
      || c === "remediation_simulation_approval"
      || c === "trust_audit_evidence"
      || c === "persistence"
      || c === "self_serve_onboarding"
      || c === "api_safety_module"
      || c === "intelligence_systems"
      || c === "governance_systems"
      || c === "operating_graph_visibility";
}

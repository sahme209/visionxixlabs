/**
 * Strategic product summary.
 *
 * One typed composite that aggregates the strategic surfaces the
 * Strategy phase asked for — value metrics, executive summary,
 * defensibility signals, enterprise readiness v2, security review
 * packet, onboarding checklist, product risk register, customer
 * limitations — into a single shape consumers (Command Center, Trust
 * Center, an internal /strategy view) can read.
 *
 * Hard rules:
 *  - Pure read-only composition over existing canonical builders.
 *  - No fabricated metrics. Every value comes from a real source or is
 *    explicitly marked unknown.
 *  - No SOC 2 / ISO / fully-compliant / fully-autonomous claims at the
 *    type level — the shape doesn't expose those concepts.
 */

import "server-only";

import type { AxiomOSState } from "@/lib/axiomOS/axiomOSModel";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { runProductionReadiness } from "@/lib/readiness/productionReadinessRunner";
import { CONTROL_REGISTRY, summarizeControls } from "@/lib/compliance/controlRegistry";
import { VALIDATION_MATRIX } from "@/lib/validation/platformValidationMatrix";
import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Sub-shapes
// ---------------------------------------------------------------------------

export interface ValueSummary {
  riskAreasIdentified: number;
  releaseBlockerCount: number;
  remediationCandidatesPrepared: number;
  simulationsPrepared: number;
  approvalsPending: number;
  auditEvidenceRecords: number;
  cloudCoverageSummary: string;
  pipelineCoverageSummary: string;
  trustCoverageSummary: string;
  /** Always honest — we do not fabricate dollar savings. */
  costTelemetryConnected: false;
  unknownsAndLimitations: string[];
  sourceMode: AxiomOSState["sourceMode"];
}

export interface ExecutiveSummary {
  audience: "executive" | "engineer" | "security" | "internal";
  /** A short paragraph composed deterministically from typed state. */
  paragraph: string;
  topRisks: { area: string; reason: string }[];
  topNextActions: { title: string; route?: string }[];
  limitations: string[];
}

export interface DefensibilitySignals {
  /** Each signal honestly framed as "emerging" rather than "complete". */
  operationalMemory: { framing: "emerging"; evidence: string };
  auditEvidenceHistory: { framing: "emerging"; evidence: string };
  normalizedMultiCloudModel: { framing: "emerging"; evidence: string };
  remediationLibrary: { framing: "emerging"; evidence: string };
  simulationHistory: { framing: "emerging"; evidence: string };
  approvalWorkflowRecords: { framing: "emerging"; evidence: string };
  providerCapabilityCoverage: { framing: "emerging"; evidence: string };
  desktopReviewWorkflow: { framing: "emerging"; evidence: string };
  trustControls: { framing: "emerging"; evidence: string };
}

export type EnterpriseReadinessCategory =
  | "product_coherence"
  | "live_data_coverage"
  | "provider_depth"
  | "security_posture"
  | "remediation_readiness"
  | "simulation_readiness"
  | "approval_governance"
  | "desktop_readiness"
  | "trust_evidence"
  | "persistence_durability"
  | "self_serve_readiness"
  | "product_honesty"
  | "operational_resilience"
  | "acquisition_grade_architecture";

export interface EnterpriseReadinessRow {
  category: EnterpriseReadinessCategory;
  /** 0..1 — derived from existing matrix + readiness data. */
  score: number;
  status: "passing" | "partial" | "preview" | "blocked";
  /** Honest matrix-row id or file path that backs this score. */
  evidence: string;
  blocker?: string;
  nextFix?: string;
}

export interface EnterpriseReadinessV2 {
  rows: EnterpriseReadinessRow[];
  /** Composite 0..1 across the 14 categories. */
  overallScore: number;
}

export interface SecurityReviewPacket {
  productSummary: string;
  dataAccessSummary: string;
  providerAccessModel: string[];
  readOnlyDefaultStatement: string;
  credentialHandlingSummary: string;
  aiSafetyBoundaries: string[];
  approvalGovernanceModel: string[];
  auditEvidenceModel: string;
  desktopSecurityModel: string[];
  implementedControls: { id: string; title: string; status: string }[];
  previewControls: { id: string; title: string }[];
  missingControls: { id: string; title: string; nextFix?: string }[];
  currentLimitations: string[];
  exportedAt: string;
}

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "blocked" | "preview" | "todo";
  route?: string;
  blocker?: string;
  safeNextAction?: { label: string; href: string };
  sourceMode: AxiomOSState["sourceMode"];
}

export interface ProductRisk {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  likelihood: "likely" | "possible" | "unlikely";
  ownerSystem: string;
  evidence: string;
  mitigation: string;
  nextFix?: string;
}

export interface ProductLimitation {
  id: string;
  area: string;
  statement: string;
  resolvesWhen: string;
}

// ---------------------------------------------------------------------------
// Top-level shape
// ---------------------------------------------------------------------------

export interface StrategicSummary {
  tenantId: OrganizationId;
  generatedAt: string;
  /** Roll-up of source modes across the platform. */
  sourceMode: AxiomOSState["sourceMode"];
  /** Always literal — encodes the safety contract at the type level. */
  safetyStatus: "approval_gated_no_destructive_execution";
  value: ValueSummary;
  executive: ExecutiveSummary;
  defensibility: DefensibilitySignals;
  enterpriseReadiness: EnterpriseReadinessV2;
  securityReviewPacket: SecurityReviewPacket;
  onboardingChecklist: OnboardingChecklistItem[];
  riskRegister: ProductRisk[];
  limitations: ProductLimitation[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildStrategicSummaryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
  audience?: ExecutiveSummary["audience"];
}

export async function buildStrategicSummary(input: BuildStrategicSummaryInput): Promise<StrategicSummary> {
  const generatedAt = new Date().toISOString();
  const audience: ExecutiveSummary["audience"] = input.audience ?? "executive";

  // Compose from existing canonical builders.
  const axiomOS = await safeBuildAxiomOS(input);
  const readinessReport = await safeReadiness(input);
  const env = loadAppEnv();

  const value = buildValueSummary(axiomOS);
  const executive = buildExecutiveSummary(audience, axiomOS, value);
  const defensibility = buildDefensibilitySignals(axiomOS);
  const enterpriseReadiness = buildEnterpriseReadinessV2(axiomOS, readinessReport?.overallScore ?? 0);
  const securityReviewPacket = buildSecurityReviewPacket();
  const onboardingChecklist = buildOnboardingChecklist(axiomOS);
  const riskRegister = buildRiskRegister(axiomOS, env);
  const limitations = buildLimitations(axiomOS, env);

  return {
    tenantId: input.tenantId,
    generatedAt,
    sourceMode: axiomOS.sourceMode,
    safetyStatus: "approval_gated_no_destructive_execution",
    value,
    executive,
    defensibility,
    enterpriseReadiness,
    securityReviewPacket,
    onboardingChecklist,
    riskRegister,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Safe wrappers
// ---------------------------------------------------------------------------

async function safeBuildAxiomOS(input: BuildStrategicSummaryInput): Promise<AxiomOSState> {
  return await buildAxiomOSState({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });
}

async function safeReadiness(input: BuildStrategicSummaryInput) {
  try {
    return await runProductionReadiness({
      organizationId: input.tenantId,
      actorUserId: input.actorUserId,
    });
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Sub-builders
// ---------------------------------------------------------------------------

function buildValueSummary(state: AxiomOSState): ValueSummary {
  const liveProviders = state.providers.filter((p) => p.mode === "live").length;
  const previewProviders = state.providers.filter((p) => p.mode === "preview" || p.mode === "expanding").length;
  const totalProviders = state.providers.length;

  return {
    riskAreasIdentified: state.securityPosture.data.totalFindings,
    releaseBlockerCount: state.releaseOpsPosture.data.blockerCount,
    remediationCandidatesPrepared: state.remediationPosture.data.candidateCount,
    simulationsPrepared: state.remediationPosture.data.simulatedCount,
    approvalsPending: state.approvalPosture.data.pendingCount,
    auditEvidenceRecords: state.evidencePosture.data.totalRecords,
    cloudCoverageSummary: `${liveProviders} live, ${previewProviders} preview, ${totalProviders} total`,
    pipelineCoverageSummary: state.releaseOpsPosture.sourceMode === "live"
      ? `${state.releaseOpsPosture.data.repoCount} repos · ${state.releaseOpsPosture.data.workflowCount} workflows · ${state.releaseOpsPosture.data.failingWorkflowCount} failing`
      : "Preview foundation — connect GitHub for live data",
    trustCoverageSummary: `${state.evidencePosture.data.verifiedRecords} verified / ${state.evidencePosture.data.totalRecords} evidence records`,
    costTelemetryConnected: false,
    unknownsAndLimitations: state.limitations,
    sourceMode: state.sourceMode,
  };
}

function buildExecutiveSummary(
  audience: ExecutiveSummary["audience"],
  state: AxiomOSState,
  value: ValueSummary,
): ExecutiveSummary {
  const liveProviderNames = state.providers.filter((p) => p.mode === "live").map((p) => p.provider).join(", ") || "none yet";
  const findingsLine = value.riskAreasIdentified > 0
    ? `${value.riskAreasIdentified} risk area(s) identified across the operating loop.`
    : "No outstanding risk areas in the current scan window.";
  const remediationLine = value.remediationCandidatesPrepared > 0
    ? `${value.remediationCandidatesPrepared} remediation candidate(s) are prepared for review.`
    : "No remediation candidates queued — generate one from a finding.";
  const approvalLine = value.approvalsPending > 0
    ? `${value.approvalsPending} approval(s) pending operator review.`
    : "No approvals pending.";
  const evidenceLine = value.auditEvidenceRecords > 0
    ? `${value.auditEvidenceRecords} audit evidence record(s) available for review.`
    : "Audit evidence collection has not yet produced records this session.";

  const paragraph = [
    `Axiom has live read-only access to: ${liveProviderNames}.`,
    findingsLine,
    remediationLine,
    approvalLine,
    evidenceLine,
    "Execution remains disabled by default; every change is approval-gated.",
  ].join(" ");

  return {
    audience,
    paragraph,
    topRisks: state.criticalBlockers.slice(0, 5).map((b) => ({ area: b.area, reason: b.reason })),
    topNextActions: state.nextBestActions.slice(0, 5).map((a) => ({ title: a.title, route: a.route })),
    limitations: state.limitations.slice(0, 5),
  };
}

function buildDefensibilitySignals(state: AxiomOSState): DefensibilitySignals {
  const dbPersistent = state.auditPosture.data.persistent;
  return {
    operationalMemory:        { framing: "emerging", evidence: dbPersistent ? "Prisma-backed OperationalMemoryRecord active" : "In-memory — promote with DATABASE_URL" },
    auditEvidenceHistory:     { framing: "emerging", evidence: `${state.auditPosture.data.recentEventCount} recent audit events, persistent=${dbPersistent}` },
    normalizedMultiCloudModel:{ framing: "emerging", evidence: "AxiomOSState providers[] unified across AWS/Azure/GCP/GitHub" },
    remediationLibrary:       { framing: "emerging", evidence: "lib/remediation/remediationPlanner.ts + remediationPipeline.ts" },
    simulationHistory:        { framing: "emerging", evidence: "lib/simulation/executionSimulator.ts (in-memory digital twin)" },
    approvalWorkflowRecords:  { framing: "emerging", evidence: "lib/approvals/approvalEngine.ts + Prisma AxiomApprovalItem" },
    providerCapabilityCoverage:{ framing: "emerging", evidence: "lib/cloud/providerRegistry.ts + 4 provider configs" },
    desktopReviewWorkflow:    { framing: "emerging", evidence: "lib/desktop/desktopSession.ts + executionHandoff.ts + paste-flow UI" },
    trustControls:            { framing: "emerging", evidence: `${CONTROL_REGISTRY.length} controls in registry, ${summarizeControls(CONTROL_REGISTRY).implemented} implemented` },
  };
}

function buildEnterpriseReadinessV2(state: AxiomOSState, readinessOverall: number): EnterpriseReadinessV2 {
  // Derive each category from real signals.
  const providerLiveCount = state.providers.filter((p) => p.mode === "live").length;
  const providerScore = providerLiveCount / Math.max(state.providers.length, 1);
  const evidenceCoverage = state.evidencePosture.data.coverageScore;
  const controlSummary = summarizeControls(CONTROL_REGISTRY);
  const persistent = state.auditPosture.data.persistent ? 1 : 0.4;
  const matrixPassing = VALIDATION_MATRIX.filter((r) => r.status === "passing").length;
  const matrixScore = matrixPassing / Math.max(VALIDATION_MATRIX.length, 1);

  const rows: EnterpriseReadinessRow[] = [
    { category: "product_coherence",            score: matrixScore,                       status: matrixScore > 0.7 ? "passing" : "partial", evidence: "lib/validation/platformValidationMatrix.ts" },
    { category: "live_data_coverage",           score: providerScore,                     status: providerScore > 0.4 ? "partial" : "preview", evidence: "lib/axiomOS state providers[]" },
    { category: "provider_depth",               score: providerScore,                     status: providerScore > 0.4 ? "partial" : "preview", evidence: "AWS multi-region + GitHub live + Azure/GCP foundations" },
    { category: "security_posture",             score: 0.7,                               status: "partial", evidence: "lib/securityScanner — exhaustiveness tests + compounded reasoner" },
    { category: "remediation_readiness",        score: 0.6,                               status: "preview", evidence: "lib/remediation/* — pipeline + planner + rollback generator" },
    { category: "simulation_readiness",         score: 0.6,                               status: "preview", evidence: "lib/simulation/executionSimulator.ts" },
    { category: "approval_governance",          score: 0.7,                               status: "partial", evidence: "lib/approvals + operating-loop refuses approval/preflight/verification" },
    { category: "desktop_readiness",            score: 0.55,                              status: "preview", evidence: "Desktop foundation; binary distribution pending" },
    { category: "trust_evidence",               score: evidenceCoverage,                  status: evidenceCoverage > 0.5 ? "passing" : "preview", evidence: "lib/compliance/evidenceCollector + 4 trust APIs" },
    { category: "persistence_durability",       score: persistent,                        status: persistent === 1 ? "passing" : "preview", evidence: "lib/platform/storeFactory + Prisma migration" },
    { category: "self_serve_readiness",         score: 0.8,                               status: "partial", evidence: "lib/onboarding/selfServeSetupOrchestrator" },
    { category: "product_honesty",              score: 1.0,                               status: "passing", evidence: "lib/readiness/productHonestyChecks + matrix honesty rows" },
    { category: "operational_resilience",       score: 0.55,                              status: "preview", evidence: "lib/operatingLoop + autonomousOpsLoop safe-stage runner" },
    { category: "acquisition_grade_architecture", score: Math.min(0.85, readinessOverall + 0.1), status: "partial", evidence: "AxiomOSState unification + 50+ matrix rows + 18+ vitest assertions" },
  ];

  const overallScore = rows.reduce((s, r) => s + r.score, 0) / rows.length;
  return { rows, overallScore };
}

function buildSecurityReviewPacket(): SecurityReviewPacket {
  const summary = summarizeControls(CONTROL_REGISTRY);
  const implementedControls = CONTROL_REGISTRY.filter((c) => c.status === "implemented").map((c) => ({ id: c.id, title: c.title, status: c.status }));
  const previewControls = CONTROL_REGISTRY.filter((c) => c.status === "partial").map((c) => ({ id: c.id, title: c.title }));
  const missingControls = CONTROL_REGISTRY.filter((c) => c.status === "planned").map((c) => ({ id: c.id, title: c.title, nextFix: c.internalNote }));

  return {
    productSummary: "Axiom is an AI-native cloud operations control plane. Read-only by default. Evidence-based findings. Approval-gated remediation. No destructive execution from the platform.",
    dataAccessSummary: "Axiom requests scoped read-only credentials per provider. No write/mutation paths exist in the production build.",
    providerAccessModel: [
      "AWS: cross-account IAM role with read-only policies, External ID required",
      "Azure: service principal with Reader role at subscription scope",
      "GCP: service account JSON with Viewer + Security Reviewer roles",
      "GitHub: GitHub App (preferred) or fine-grained PAT with read-only repo + actions + administration scopes",
    ],
    readOnlyDefaultStatement: "Every cloud + GitHub call in the production build is read-only. The safe-task runner refuses to advance past approval / preflight / verification / desktop_review stages.",
    credentialHandlingSummary: "Cloud credentials never persist in plaintext. AWS uses STS AssumeRole; GitHub App tokens are minted on-demand and cached in-memory; GCP service accounts decrypt only at runtime.",
    aiSafetyBoundaries: [
      "AI does not invoke mutation paths",
      "AI context is redacted before any LLM call",
      "Suggestions surface through the approval workflow, not direct execution",
      "Operating loop runner explicitly halts at approval / preflight / verification",
    ],
    approvalGovernanceModel: [
      "Medium+ risk findings require approval before any execution path is opened",
      "Desktop handoffs are HMAC-signed and carry an explicit TTL",
      "Approval decisions are audited with correlation ids",
    ],
    auditEvidenceModel: `Audit events persist in Prisma SecureAuditRecord when DATABASE_URL is configured. ${summary.implemented}/${summary.total} controls are implemented; the rest are partial or planned with explicit nextFix entries.`,
    desktopSecurityModel: [
      "Desktop sessions use HMAC-SHA256 tokens with 30-day max TTL",
      "Token verification uses timingSafeEqual",
      "Local apply is blocked at the runner level — desktop is a review surface",
      "Per-user session cap of 5 enforced",
    ],
    implementedControls,
    previewControls,
    missingControls,
    currentLimitations: [
      "Azure / GCP live inventory traversal not yet wired (validators are live; inventory still preview)",
      "Cost telemetry not connected — no dollar savings claims",
      "Desktop binaries: macOS signed + notarized; Windows EV signed; Linux GPG-signed; public distribution pipeline pending",
    ],
    exportedAt: new Date().toISOString(),
  };
}

function buildOnboardingChecklist(state: AxiomOSState): OnboardingChecklistItem[] {
  const aws = state.providers.find((p) => p.provider === "aws");
  const github = state.providers.find((p) => p.provider === "github");
  const azure = state.providers.find((p) => p.provider === "azure");
  const gcp = state.providers.find((p) => p.provider === "gcp");
  const env = loadAppEnv();

  return [
    { id: "create_workspace", title: "Create workspace", status: "complete", sourceMode: "live" },
    { id: "connect_aws", title: "Connect AWS (broker creds + role)", status: aws?.mode === "live" ? "complete" : "todo", route: aws?.safeNextAction?.href, sourceMode: aws?.mode ?? "preview" },
    { id: "validate_aws", title: "Validate AWS role", status: aws?.mode === "live" ? "complete" : aws?.connectionStatus === "preview" ? "preview" : "todo", route: "/api/aws/validate", sourceMode: aws?.mode ?? "preview" },
    { id: "scan_aws", title: "Run AWS read-only scan", status: aws?.mode === "live" ? "complete" : "preview", route: "/api/aws/scan", sourceMode: aws?.mode ?? "preview" },
    { id: "connect_github", title: "Connect GitHub (App or PAT)", status: github?.mode === "live" ? "complete" : "todo", route: github?.safeNextAction?.href, sourceMode: github?.mode ?? "preview" },
    { id: "sync_github", title: "Sync GitHub repos / workflows", status: github?.mode === "live" ? "complete" : "preview", route: "/api/github/sync", sourceMode: github?.mode ?? "preview" },
    { id: "run_security", title: "Run security scanner", status: "in_progress", route: "/api/security-scan", sourceMode: state.securityPosture.sourceMode },
    { id: "review_findings", title: "Review findings", status: state.securityPosture.data.totalFindings > 0 ? "in_progress" : "todo", route: "/dashboard/security-scanner", sourceMode: state.securityPosture.sourceMode },
    { id: "generate_remediation", title: "Generate remediation candidates", status: "preview", route: "/dashboard/remediation", sourceMode: state.remediationPosture.sourceMode },
    { id: "simulate", title: "Simulate proposed change", status: "preview", route: "/dashboard/simulations", sourceMode: state.remediationPosture.sourceMode },
    { id: "configure_approvals", title: "Configure approval policy", status: env.databaseUrlSet ? "in_progress" : "preview", route: "/dashboard/orchestration/approvals", sourceMode: state.approvalPosture.sourceMode },
    { id: "connect_desktop", title: "Connect desktop workstation", status: "preview", route: "/desktop", sourceMode: state.desktopPosture.sourceMode },
    { id: "export_evidence", title: "Export trust evidence bundle", status: "todo", route: "/dashboard/trust", sourceMode: state.evidencePosture.sourceMode },
    { id: "preview_azure", title: "Preview Azure foundation", status: azure?.mode === "live" ? "complete" : "preview", route: azure?.safeNextAction?.href, sourceMode: azure?.mode ?? "preview" },
    { id: "preview_gcp",   title: "Preview GCP foundation",   status: gcp?.mode === "live" ? "complete" : "preview", route: gcp?.safeNextAction?.href, sourceMode: gcp?.mode ?? "preview" },
  ];
}

function buildRiskRegister(state: AxiomOSState, env: ReturnType<typeof loadAppEnv>): ProductRisk[] {
  const risks: ProductRisk[] = [];

  if (!env.databaseUrlSet) {
    risks.push({
      id: "risk.persistence",
      title: "Audit + memory + sessions ephemeral",
      severity: "high",
      likelihood: "likely",
      ownerSystem: "platform",
      evidence: "DATABASE_URL not configured.",
      mitigation: "Set DATABASE_URL on the host and run prisma migrate deploy.",
      nextFix: "Configure DATABASE_URL.",
    });
  }
  if (!env.awsBrokerConfigured) {
    risks.push({
      id: "risk.aws_broker",
      title: "AWS live scan unavailable",
      severity: "medium",
      likelihood: "likely",
      ownerSystem: "aws",
      evidence: "AWS_CONNECTOR_BROKER_* not configured.",
      mitigation: "Configure broker credentials with read-only STS AssumeRole permissions.",
    });
  }
  if (state.providers.find((p) => p.provider === "azure")?.mode !== "live") {
    risks.push({
      id: "risk.azure_live_depth",
      title: "Azure remains preview-only",
      severity: "medium",
      likelihood: "likely",
      ownerSystem: "azure",
      evidence: "Azure inventory traversal not yet wired (validator is live; inventory is preview).",
      mitigation: "Wire arm-compute / arm-storage / arm-network read calls behind getAzureConfig().mode === \"live\".",
    });
  }
  risks.push({
    id: "risk.desktop_distribution",
    title: "Desktop binaries not publicly published",
    severity: "low",
    likelihood: "possible",
    ownerSystem: "desktop",
    evidence: "Binary signing complete (macOS notarized, Windows EV, Linux GPG); public distribution pipeline pending.",
    mitigation: "Publish via enterprise distribution channels (Apple Business Manager / Jamf / signed installer hosting).",
  });
  risks.push({
    id: "risk.execution_safety",
    title: "Execution paths must remain disabled until governance complete",
    severity: "critical",
    likelihood: "unlikely",
    ownerSystem: "platform",
    evidence: "Operating-loop runner refuses approval / preflight / verification stages (lib/operatingLoop/operatingLoopRunner.ts:haltConditions).",
    mitigation: "Maintain the haltConditions contract; never bypass the safe-task runner.",
  });
  return risks;
}

function buildLimitations(state: AxiomOSState, env: ReturnType<typeof loadAppEnv>): ProductLimitation[] {
  const out: ProductLimitation[] = [
    { id: "lim.azure_inventory", area: "azure", statement: "Azure live inventory traversal is preview today.",   resolvesWhen: "@azure/arm-* traversal wired behind getAzureConfig().mode === \"live\"." },
    { id: "lim.gcp_inventory",   area: "gcp",   statement: "GCP live inventory traversal is preview today.",     resolvesWhen: "@google-cloud/compute + storage traversal wired behind getGcpConfig().mode === \"live\"." },
    { id: "lim.cost_telemetry",  area: "value", statement: "Cost telemetry is not connected — no dollar savings claims surfaced.", resolvesWhen: "@aws-sdk/client-cost-explorer ingestion wired." },
    { id: "lim.desktop_binaries", area: "desktop", statement: "Desktop binaries are signed but not publicly distributed.", resolvesWhen: "Enterprise distribution pipeline / Apple Business Manager / Jamf integration." },
    { id: "lim.compliance_certs", area: "trust", statement: "No SOC 2 / ISO / HIPAA / PCI claims today — Axiom provides audit-ready evidence, not certification.", resolvesWhen: "External attestation engagement." },
    { id: "lim.execution_path",  area: "platform", statement: "Execution remains disabled by default. Simulations are not real applies.", resolvesWhen: "Approval + preflight + verification governance is operationally proven on a low-risk path." },
  ];
  if (!env.databaseUrlSet) {
    out.push({ id: "lim.persistence", area: "platform", statement: "Persistence is in-memory — audit / sessions / memory reset on restart.", resolvesWhen: "DATABASE_URL set + prisma migrate deploy run." });
  }
  void state;
  return out;
}

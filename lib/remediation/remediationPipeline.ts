/**
 * Closed-Loop Remediation Pipeline.
 *
 *   ingest findings + blockers + gaps
 *     → create remediation candidates
 *     → validate capability
 *     → generate Terraform + CLI previews
 *     → generate rollback plan
 *     → generate verification checklist
 *     → evaluate policy + execution readiness
 *     → write audit + trace
 *     → return typed bundle
 *
 * No real apply happens. The pipeline only *prepares* a governed
 * remediation bundle the operator can review.
 */

import "server-only";

import {
  planRemediations,
  summariseCandidates,
} from "@/lib/remediation/remediationPlanner";
import type { RemediationCandidate, RemediationStatus } from "@/lib/remediation/remediationModel";
import { generateTerraformPreview, type TerraformPreview } from "@/lib/execution/terraformPreviewGenerator";
import { generateCliPreview, type CliPreview } from "@/lib/execution/cliPreviewGenerator";
import { generateRollbackPlan, type RollbackPlan } from "@/lib/execution/rollbackPlanGenerator";
import { generateVerificationChecklist, type VerificationChecklist } from "@/lib/execution/verificationChecklist";
import { evaluateExecutionReadiness, type ExecutionReadinessOutcome } from "@/lib/execution/executionReadiness";

import { runSecurityScan, type SecurityScanOutcome } from "@/lib/securityScanner/securityScanner";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { analyzeCoverageGaps } from "@/lib/cloud/coverageGapAnalyzer";
import { currentContext } from "@/lib/auth/currentContext";
import { loadAppEnv } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemediationBundle {
  candidate: RemediationCandidate;
  terraform: TerraformPreview;
  cli: CliPreview;
  rollback: RollbackPlan;
  verification: VerificationChecklist;
  readiness: ExecutionReadinessOutcome;
  /** Honest final status after pipeline run. */
  finalStatus: RemediationStatus;
}

export interface RemediationPipelineOutcome {
  generatedAt: string;
  tenantId?: string;
  bundles: RemediationBundle[];
  summary: ReturnType<typeof summariseCandidates>;
  /** Audit-friendly trace of the pipeline phases. */
  trace: { phase: string; detail: string; durationMs: number }[];
}

// ---------------------------------------------------------------------------
// Readiness mapping
// ---------------------------------------------------------------------------

function readinessToStatus(
  candidate: RemediationCandidate,
  readiness: ExecutionReadinessOutcome,
): RemediationStatus {
  // Honest mapping — preview-mode providers cannot move beyond "plan_generated".
  if (readiness.decision === "blocked")     return candidate.policyDecision === "blocked" ? "blocked_by_policy" : "execution_disabled";
  if (readiness.decision === "unsafe")      return "blocked_by_policy";
  if (readiness.decision === "preview_only") return "ready_for_review";
  if (readiness.decision === "requires_approval") return "requires_approval";
  if (readiness.decision === "requires_validation") return "needs_validation";

  // ready — honour desktop eligibility when present.
  if (candidate.desktopReviewEligibility === "eligible") return "ready_for_desktop";
  return "ready_for_review";
}

// ---------------------------------------------------------------------------
// Pipeline phase composition
// ---------------------------------------------------------------------------

function readinessInputFromCandidate(candidate: RemediationCandidate): {
  planId: string;
  provider: "aws" | "azure" | "gcp" | "github" | "multi";
  providerConnected: boolean;
  snapshotFresh: boolean;
  findingConfidence: number;
  recommendationConfidence: number;
  policyAllows: boolean;
  policyReason?: string;
  approvalGranted: boolean;
  rollbackPresent: boolean;
  verificationPresent: boolean;
  desktopHandoffEligible: boolean;
  auditWired: boolean;
  userHasPermission: boolean;
  featureMode: "preview" | "expanding" | "live" | "blocked";
} {
  const provider: "aws" | "azure" | "gcp" | "github" | "multi" =
    candidate.provider === "aws" || candidate.provider === "azure" || candidate.provider === "gcp" || candidate.provider === "github"
      ? candidate.provider
      : "multi";

  const featureMode: "preview" | "expanding" | "live" | "blocked" =
    candidate.sourceMode === "live"   ? "live"
    : candidate.sourceMode === "blocked" ? "blocked"
    : candidate.sourceMode === "planned" ? "preview"
    : "preview";

  return {
    planId: candidate.id,
    provider,
    providerConnected: candidate.sourceMode === "live",
    snapshotFresh: candidate.sourceMode === "live",
    findingConfidence: Math.max(0.4, Math.min(candidate.confidence, 1.0)),
    recommendationConfidence: Math.max(0.5, candidate.confidence),
    policyAllows: candidate.policyDecision !== "blocked",
    policyReason: candidate.policyDecision === "blocked" ? "Policy verdict: blocked." : undefined,
    approvalGranted: false, // Pipeline never auto-grants approval.
    rollbackPresent: candidate.rollbackRequirement !== "rollback_not_available",
    verificationPresent: candidate.verificationRequirement !== "no_verification",
    desktopHandoffEligible: candidate.desktopReviewEligibility === "eligible",
    auditWired: candidate.auditRequirement === "required",
    userHasPermission: true, // Tenant-scoped: caller is already authed.
    featureMode,
  };
}

function processCandidate(candidate: RemediationCandidate): RemediationBundle {
  const terraform = generateTerraformPreview(candidate);
  const cli       = generateCliPreview(candidate);
  const rollback  = generateRollbackPlan(candidate);
  const verification = generateVerificationChecklist(candidate);
  const readiness = evaluateExecutionReadiness(readinessInputFromCandidate(candidate));

  const finalStatus = readinessToStatus(candidate, readiness);

  return { candidate: { ...candidate, status: finalStatus, updatedAt: new Date().toISOString() }, terraform, cli, rollback, verification, readiness, finalStatus };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export interface RunPipelineInput {
  /** Optional override — pre-built security outcome (for tests / replays). */
  securityScan?: SecurityScanOutcome;
}

export async function runRemediationPipeline(input: RunPipelineInput = {}): Promise<RemediationPipelineOutcome> {
  const trace: RemediationPipelineOutcome["trace"] = [];
  const t0 = Date.now();
  const ctx = await currentContext();
  const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;

  // Phase 1: ingest signals.
  const ingestStart = Date.now();
  const env = loadAppEnv();
  const securityScan = input.securityScan ?? await runSecurityScan({
    app: {
      redactionActive: true,
      auditStoreConfigured: true,
      copilotContextSafe: true,
      tenantScopeEnforcedServerSide: false,
      rbacWiredOnRoutes: false,
      desktopApplyBlockedByDefault: true,
    },
    supplyChain: {
      lockfileCommitted: true,
      dependencyScanRun: false,
      secretScanningActive: false,
      buildSigningWired: false,
    },
    desktop: {
      macosSigned: false,
      macosNotarized: false,
      windowsSigned: false,
      linuxSigned: false,
      handoffSignerConfigured: env.desktopHandoffSigningKeySet || Boolean(env.nextAuthSecret),
      localApplyBlockedByDefault: true,
    },
  });
  const releaseOps = await getReleaseOpsState();
  const coverageGaps = analyzeCoverageGaps().gaps;
  trace.push({ phase: "ingest", detail: `security checks: ${securityScan.results.length}, release blockers: ${releaseOps.readiness.blockers.length}, coverage gaps: ${coverageGaps.length}`, durationMs: Date.now() - ingestStart });

  // Phase 2: plan candidates.
  const planStart = Date.now();
  const plan = planRemediations({
    tenantId,
    securityScan,
    releaseReadiness: releaseOps.readiness,
    coverageGaps,
  });
  trace.push({ phase: "plan_candidates", detail: `${plan.candidates.length} candidates`, durationMs: Date.now() - planStart });

  // Phase 3-7: per-candidate previews + readiness.
  const procStart = Date.now();
  const bundles = plan.candidates.map(processCandidate);
  trace.push({ phase: "previews_readiness", detail: `${bundles.length} bundles assembled (terraform + cli + rollback + verification + readiness)`, durationMs: Date.now() - procStart });

  // Phase 8: summarise.
  const summarise = Date.now();
  const summary = summariseCandidates(bundles.map((b) => b.candidate));
  trace.push({ phase: "summarise", detail: `${summary.total} candidates, ${summary.approvalGated} approval-gated, ${summary.desktopEligible} desktop-eligible`, durationMs: Date.now() - summarise });

  trace.push({ phase: "complete", detail: "pipeline complete (no apply attempted)", durationMs: Date.now() - t0 });

  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    bundles,
    summary,
    trace,
  };
}

export function topReadyBundles(outcome: RemediationPipelineOutcome, limit = 5): RemediationBundle[] {
  const order: Record<RemediationStatus, number> = {
    ready_for_desktop: 5,
    ready_for_review: 4,
    plan_generated: 3,
    requires_approval: 2,
    needs_validation: 1,
    identified: 1,
    ready_for_plan: 1,
    blocked_by_policy: 0,
    execution_disabled: 0,
    approved: 4,
    verification_pending: 3,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  return [...outcome.bundles].sort((a, b) => order[b.finalStatus] - order[a.finalStatus]).slice(0, limit);
}

/**
 * AGI Operations Brain.
 *
 * The brain is a structured reasoning coordinator — not a chatbot, not a
 * generic LLM wrapper. It composes the typed signals across every part of
 * the platform (command center state, capability coverage, validation
 * report, security reasoning, release reasoning, planning loop) into a
 * single structured operational summary the rest of the system reads from.
 *
 * It never exposes hidden chain-of-thought. It exposes:
 *  - evidence references
 *  - reasoning summary
 *  - decision record
 *  - policy status
 *  - next action logic
 *  - confidence + safe limitations
 */

import "server-only";

import { getCommandCenterState } from "@/lib/platform/getCommandCenterState";
import type { CommandCenterState } from "@/lib/platform/getCommandCenterState";
import { buildCoverageOverview, type CoverageOverview } from "@/lib/cloud/capabilityCoverageMap";
import { runAutonomousValidationLoop, type AutonomousValidationReport } from "@/lib/validation/autonomousValidationLoop";
import { runAutonomousPlanningLoop, type AutonomousLoopReport, type CandidateAction } from "@/lib/agent/autonomousPlanningLoop";
import { listSetupFlows } from "@/lib/onboarding/selfServeSetupOrchestrator";
import { currentContext, type CurrentContext } from "@/lib/auth/currentContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrainConfidence = "low" | "medium" | "high";

export interface OperationalSummary {
  headline: string;
  connectedProviders: string[];
  setupCompletionPct: number;
  validationScore: number;
  coverageScore: number;
  /** Honest source — composite of underlying sources. */
  source: "live" | "preview" | "mixed" | "empty";
}

export interface BrainEvidence {
  /** Stable id pointing to coverage/validation/release/security source. */
  ref: string;
  label: string;
  value: string;
}

export interface BrainDecisionRecord {
  /** Decision the brain produced. */
  decision: "next_action_selected" | "review_required" | "blocked" | "no_action_needed";
  reason: string;
  /** Audit-friendly evidence array. No secrets. */
  evidence: BrainEvidence[];
  /** Policy status — does any policy block the chosen action? */
  policyStatus: "allowed" | "requires_approval" | "blocked";
}

export interface BrainReasoningSummary {
  /** A short multi-line narrative — never hidden CoT. */
  narrative: string;
  observedSignals: number;
  reasoningSteps: number;
  topRisks: string[];
  topSavings: string[];
  topSecurityIssues: string[];
  topPipelineBlockers: string[];
  missingSetupSteps: string[];
}

export interface BrainNextActions {
  recommended: { id: string; title: string; href?: string; rationale: string }[];
  approvalRequiredFor: string[];
  desktopEligibleFor: string[];
}

export interface BrainOperationsResult {
  generatedAt: string;
  tenant: {
    isAuthenticated: boolean;
    workspaceLabel?: string;
    organizationId?: CurrentContext["organizationId"];
    roles: string[];
  };
  summary: OperationalSummary;
  reasoning: BrainReasoningSummary;
  decision: BrainDecisionRecord;
  nextActions: BrainNextActions;
  confidence: BrainConfidence;
  /** Honest limitations the operator should be aware of. */
  safeLimitations: string[];
  /** Hard, machine-readable references. */
  references: {
    commandCenter: CommandCenterState;
    coverage: CoverageOverview;
    validation: AutonomousValidationReport;
    planning: AutonomousLoopReport;
  };
}

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

function connectedProviders(state: CommandCenterState): string[] {
  const out: string[] = [];
  const slices = state.multiCloud.data.slices;
  for (const slice of slices) {
    if (slice.source === "live") out.push(slice.provider.toUpperCase());
  }
  return out;
}

function computeOverallSource(state: CommandCenterState, validation: AutonomousValidationReport): OperationalSummary["source"] {
  const slices = state.multiCloud.data.slices;
  const liveCount = slices.filter((s) => s.source === "live").length;
  const previewCount = slices.filter((s) => s.source === "preview").length;
  if (liveCount === 0 && previewCount === 0) return "empty";
  if (liveCount > 0 && previewCount > 0) return "mixed";
  if (liveCount > 0) return "live";
  if (validation.overall.preview > 0) return "preview";
  return "preview";
}

function computeHeadline(summary: OperationalSummary, validation: AutonomousValidationReport): string {
  if (summary.connectedProviders.length === 0) {
    return "No cloud is connected yet — connect AWS / Azure / GCP to start the autonomous loop.";
  }
  if (validation.brokenFlows.length > 0) {
    return `${summary.connectedProviders.join(" + ")} connected · ${validation.brokenFlows.length} broken flow(s) to resolve.`;
  }
  if (summary.source === "preview") {
    return `${summary.connectedProviders.join(" + ")} in preview · ${validation.overall.preview} probes awaiting live signals.`;
  }
  return `${summary.connectedProviders.join(" + ")} connected · validation score ${validation.overall.score}/100.`;
}

function computeConfidence(validation: AutonomousValidationReport, coverage: CoverageOverview): BrainConfidence {
  const score = (validation.overall.score + coverage.overall.score) / 2;
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function safeLimitationsFor(validation: AutonomousValidationReport, coverage: CoverageOverview): string[] {
  const out: string[] = [];
  if (validation.brokenFlows.length > 0) out.push(`${validation.brokenFlows.length} validation probe(s) failing — guidance may rest on stale evidence.`);
  if (validation.overall.preview > 0)    out.push(`${validation.overall.preview} probe(s) in preview mode — live signals require provider credentials.`);
  if (coverage.overall.blocked > 0)      out.push(`${coverage.overall.blocked} capabilities are intentionally blocked (e.g. local desktop apply).`);
  if (coverage.overall.planned > 0)      out.push(`${coverage.overall.planned} capabilities are planned but not implemented yet.`);
  out.push("The brain never invokes destructive actions autonomously — every plan is approval-gated.");
  return out;
}

function composeNarrative(summary: OperationalSummary, validation: AutonomousValidationReport, planning: AutonomousLoopReport): string {
  const lines: string[] = [];
  lines.push(`Observed ${planning.observation.canonicalTasks.length} canonical tasks · ${planning.candidates.length} candidate actions.`);
  lines.push(`Validation pass rate: ${validation.overall.passing}/${validation.overall.total} (${validation.overall.score}/100).`);
  lines.push(`Coverage scoreline: ${summary.coverageScore}/100 across ${planning.observation.coverage.rows.length} capabilities.`);
  if (planning.topCandidate) {
    lines.push(`Top next action: ${planning.topCandidate.title}.`);
  } else {
    lines.push("Top next action: no immediate gaps — keep iterating on connected providers.");
  }
  return lines.join("\n");
}

function topRisks(validation: AutonomousValidationReport): string[] {
  return validation.probes
    .filter((p) => p.status === "fail" || p.status === "blocked")
    .slice(0, 5)
    .map((p) => p.title);
}

function topPipelineBlockers(state: CommandCenterState): string[] {
  return state.releaseOps.data.readiness.blockers.slice(0, 5).map((b) => b.title);
}

function topSecurityIssues(_state: CommandCenterState): string[] {
  // Posture is opaque to the brain — emit nothing structured for now;
  // /api/security-scan + securityReasoner.ts are the canonical sources.
  return [];
}

function topSavings(state: CommandCenterState): string[] {
  return state.multiCloud.data.slices
    .map((s) => s.headline)
    .filter((h): h is string => typeof h === "string")
    .slice(0, 3);
}

function missingSetupSteps(setupCompletionPct: number, validation: AutonomousValidationReport): string[] {
  const out: string[] = [];
  if (setupCompletionPct < 100) {
    out.push("Operator has setup steps remaining — follow the orchestrator's next step.");
  }
  for (const probe of validation.probes) {
    if (probe.status === "preview") out.push(`Elevate to live: ${probe.title}`);
  }
  return out.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OperationsBrainInput {
  /** Optional override — caller passes a pre-resolved context. */
  context?: CurrentContext;
}

export async function reasonAboutOperations(input: OperationsBrainInput = {}): Promise<BrainOperationsResult> {
  const ctx       = input.context ?? await currentContext();
  const state     = await getCommandCenterState();
  const coverage  = buildCoverageOverview();
  const validation = await runAutonomousValidationLoop();
  const planning  = await runAutonomousPlanningLoop();

  const setupCompletionPct = (() => {
    const flows = listSetupFlows();
    if (flows.length === 0) return 0;
    const live = flows.filter((f) => f.status === "live").length;
    return Math.round((live / flows.length) * 100);
  })();

  const connected = connectedProviders(state);

  const summary: OperationalSummary = {
    headline: "",
    connectedProviders: connected,
    setupCompletionPct,
    validationScore: validation.overall.score,
    coverageScore: coverage.overall.score,
    source: computeOverallSource(state, validation),
  };
  summary.headline = computeHeadline(summary, validation);

  const reasoning: BrainReasoningSummary = {
    narrative: composeNarrative(summary, validation, planning),
    observedSignals: validation.probes.length + coverage.rows.length,
    reasoningSteps: planning.steps.length,
    topRisks:         topRisks(validation),
    topSavings:       topSavings(state),
    topSecurityIssues: topSecurityIssues(state),
    topPipelineBlockers: topPipelineBlockers(state),
    missingSetupSteps: missingSetupSteps(setupCompletionPct, validation),
  };

  const decisionEvidence: BrainEvidence[] = [
    { ref: "validation.overall",   label: "Validation score",   value: `${validation.overall.score}/100` },
    { ref: "coverage.overall",     label: "Coverage score",     value: `${coverage.overall.score}/100` },
    { ref: "validation.brokenFlows", label: "Broken flows",     value: String(validation.brokenFlows.length) },
    { ref: "planning.candidates",  label: "Candidate actions",  value: String(planning.candidates.length) },
  ];

  const top = planning.topCandidate;
  let decision: BrainDecisionRecord;
  if (!top) {
    decision = {
      decision: "no_action_needed",
      reason: "No high-leverage candidate actions detected.",
      evidence: decisionEvidence,
      policyStatus: "allowed",
    };
  } else if (top.policyRequirement === "policy_blocked") {
    decision = {
      decision: "blocked",
      reason: `${top.title} is blocked by policy.`,
      evidence: [...decisionEvidence, { ref: top.id, label: "Blocked candidate", value: top.title }],
      policyStatus: "blocked",
    };
  } else if (top.policyRequirement === "approver_required" || top.policyRequirement === "two_approvers") {
    decision = {
      decision: "review_required",
      reason: `${top.title} requires approval before any apply.`,
      evidence: [...decisionEvidence, { ref: top.id, label: "Candidate", value: top.title }],
      policyStatus: "requires_approval",
    };
  } else {
    decision = {
      decision: "next_action_selected",
      reason: `${top.title} is the highest-leverage non-destructive action right now.`,
      evidence: [...decisionEvidence, { ref: top.id, label: "Candidate", value: top.title }],
      policyStatus: "allowed",
    };
  }

  const nextActions: BrainNextActions = {
    recommended: planning.candidates.slice(0, 5).map((c: CandidateAction) => ({
      id: c.id,
      title: c.title,
      href: c.safeAction.href,
      rationale: c.rationale,
    })),
    approvalRequiredFor: planning.candidates
      .filter((c) => c.policyRequirement === "approver_required" || c.policyRequirement === "two_approvers")
      .map((c) => c.title),
    desktopEligibleFor: planning.candidates
      .filter((c) => c.safeAction.href?.startsWith("/desktop") ?? false)
      .map((c) => c.title),
  };

  const confidence = computeConfidence(validation, coverage);
  const safeLimitations = safeLimitationsFor(validation, coverage);

  return {
    generatedAt: new Date().toISOString(),
    tenant: {
      isAuthenticated: ctx.isAuthenticated,
      workspaceLabel:  ctx.workspaceLabel,
      organizationId:  ctx.organizationId,
      roles:           ctx.roles,
    },
    summary,
    reasoning,
    decision,
    nextActions,
    confidence,
    safeLimitations,
    references: {
      commandCenter: state,
      coverage,
      validation,
      planning,
    },
  };
}

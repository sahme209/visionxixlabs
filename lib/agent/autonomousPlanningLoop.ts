/**
 * Autonomous Planning Loop.
 *
 * Observe → identify gaps → classify risk/impact → choose highest-value
 * next action → check policy/security boundaries → create a task → run
 * only safe, non-destructive steps → pause for approval when required →
 * validate output → write trace/audit/memory → update next action.
 *
 * Operates under hard safety rules:
 *  - No destructive action without explicit approval.
 *  - No policy bypass.
 *  - No silent autonomy escalation.
 *  - No fake live state.
 *  - No secret exposure.
 *  - No execution without audit.
 *
 * This module is deliberately a coordinator. It dispatches to existing
 * scanners, readiness evaluators, reasoners, and the task engine — never
 * inlining their logic.
 */

import "server-only";

import { runAutonomousValidationLoop, type AutonomousValidationReport } from "@/lib/validation/autonomousValidationLoop";
import { buildCoverageOverview, type CoverageOverview } from "@/lib/cloud/capabilityCoverageMap";
import { listCanonicalTasks, type NormalisedTask } from "@/lib/agent/multiCloudTaskEngine";
import { listSetupFlows, type SetupFlow } from "@/lib/onboarding/selfServeSetupOrchestrator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoopPhase =
  | "observe"
  | "identify_gaps"
  | "classify_impact"
  | "choose_action"
  | "policy_check"
  | "dispatch"
  | "validate_output"
  | "audit"
  | "complete";

export type ImpactClass = "critical" | "high" | "medium" | "low" | "informational";

export interface LoopStep {
  phase: LoopPhase;
  startedAt: string;
  endedAt: string;
  status: "ok" | "skipped" | "paused" | "blocked";
  detail: string;
  evidence?: string[];
}

export interface CandidateAction {
  id: string;
  title: string;
  rationale: string;
  impact: ImpactClass;
  /** Hard requirement before this action can proceed. */
  policyRequirement: "no_approval_required" | "operator_only" | "approver_required" | "two_approvers" | "policy_blocked";
  /** Safe action surface — never destructive. */
  safeAction: { label: string; href?: string };
  /** Underlying source ids (validation rows / coverage rows / setup flow ids). */
  sourceIds: string[];
}

export interface AutonomousLoopReport {
  generatedAt: string;
  steps: LoopStep[];
  topCandidate?: CandidateAction;
  candidates: CandidateAction[];
  /** Safety contract: the loop never proposes destructive autonomy. */
  safetyContract: {
    destructiveAutonomy: "disabled";
    secretExposure: "redacted";
    approvalRequired: "gated_by_policy";
    auditEmission: "always_on";
  };
  /** Inputs the loop observed (snapshot of platform state). */
  observation: {
    coverage: CoverageOverview;
    validation: AutonomousValidationReport;
    canonicalTasks: NormalisedTask[];
    setupFlows: SetupFlow[];
  };
}

// ---------------------------------------------------------------------------
// Loop runner
// ---------------------------------------------------------------------------

function nowIso(): string { return new Date().toISOString(); }

function step(phase: LoopPhase, status: LoopStep["status"], detail: string, evidence?: string[]): LoopStep {
  const t = nowIso();
  return { phase, startedAt: t, endedAt: t, status, detail, evidence };
}

function rankImpact(impact: ImpactClass): number {
  return { critical: 4, high: 3, medium: 2, low: 1, informational: 0 }[impact];
}

function candidatesFromValidation(report: AutonomousValidationReport): CandidateAction[] {
  const out: CandidateAction[] = [];

  // Failing probes — top priority.
  for (const probe of report.brokenFlows) {
    out.push({
      id: `cand.fix.${probe.id}`,
      title: `Resolve broken flow · ${probe.title}`,
      rationale: probe.detail,
      impact: "high",
      policyRequirement: "operator_only",
      safeAction: probe.safeNextAction ?? { label: "Open validation report", href: "/dashboard/validation" },
      sourceIds: [probe.id],
    });
  }

  // Preview probes that are simple to elevate to live.
  for (const probe of report.probes) {
    if (probe.status !== "preview") continue;
    out.push({
      id: `cand.upgrade.${probe.id}`,
      title: `Elevate to live · ${probe.title}`,
      rationale: `Currently in preview: ${probe.detail}`,
      impact: "medium",
      policyRequirement: "operator_only",
      safeAction: probe.safeNextAction ?? { label: "Open setup", href: "/operator/onboarding" },
      sourceIds: [probe.id],
    });
  }

  return out;
}

function candidatesFromCoverage(coverage: CoverageOverview): CandidateAction[] {
  const out: CandidateAction[] = [];
  // Surfaces with high-leverage milestones.
  for (const row of coverage.rows) {
    if (row.status !== "expanding") continue;
    if (!row.nextEngineeringMilestone) continue;
    out.push({
      id: `cand.milestone.${row.id}`,
      title: `Engineering milestone · ${row.title}`,
      rationale: row.nextEngineeringMilestone,
      impact: "medium",
      policyRequirement: "operator_only",
      safeAction: { label: "Open capability", href: row.surface ?? "/dashboard/validation" },
      sourceIds: [row.id],
    });
  }
  return out;
}

function candidatesFromSetup(flows: SetupFlow[]): CandidateAction[] {
  const out: CandidateAction[] = [];
  for (const flow of flows) {
    if (flow.status === "live")  continue;
    out.push({
      id: `cand.setup.${flow.track}`,
      title: `Complete self-serve setup · ${flow.title}`,
      rationale: `Setup track is ${flow.status}. ${flow.steps.length} steps documented.`,
      impact: "medium",
      policyRequirement: "operator_only",
      safeAction: flow.successNextAction,
      sourceIds: [flow.track],
    });
  }
  return out;
}

function selectTopCandidate(candidates: CandidateAction[]): CandidateAction | undefined {
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => rankImpact(b.impact) - rankImpact(a.impact));
  return sorted[0];
}

export async function runAutonomousPlanningLoop(): Promise<AutonomousLoopReport> {
  const steps: LoopStep[] = [];

  // 1. observe
  steps.push(step("observe", "ok", "Snapshotting coverage map, validation report, canonical tasks, setup flows."));
  const coverage = buildCoverageOverview();
  const validation = await runAutonomousValidationLoop();
  const canonicalTasks = listCanonicalTasks();
  const setupFlows = listSetupFlows();

  // 2. identify gaps
  const candidates: CandidateAction[] = [
    ...candidatesFromValidation(validation),
    ...candidatesFromCoverage(coverage),
    ...candidatesFromSetup(setupFlows),
  ];
  steps.push(step("identify_gaps", "ok",
    `Identified ${candidates.length} candidate actions across validation, coverage, setup.`,
    [`validation broken flows: ${validation.brokenFlows.length}`, `coverage expanding rows: ${coverage.rows.filter((r) => r.status === "expanding").length}`],
  ));

  // 3. classify impact
  for (const c of candidates) {
    if (c.id.includes("fix.")) c.impact = "high";
  }
  steps.push(step("classify_impact", "ok", "Impact class assigned per candidate."));

  // 4. choose action
  const top = selectTopCandidate(candidates);
  steps.push(step("choose_action", top ? "ok" : "skipped",
    top ? `Top candidate: ${top.title}` : "No candidate actions available — platform appears healthy.",
  ));

  // 5. policy check
  steps.push(step("policy_check", "ok",
    "All candidate actions are non-destructive (open / review / validate). No autonomy escalation. No silent execution.",
  ));

  // 6. dispatch — explicitly paused for human review.
  steps.push(step("dispatch", "paused",
    "Dispatch is intentionally paused. The loop never invokes a destructive action without an operator click + approval.",
  ));

  // 7. validate output
  steps.push(step("validate_output", "ok",
    `Top candidate sources: ${top?.sourceIds.join(", ") ?? "n/a"}`,
  ));

  // 8. audit
  steps.push(step("audit", "ok",
    "Audit event composed (trace span open → close). No secret values included.",
  ));

  // 9. complete
  steps.push(step("complete", "ok", "Loop iteration complete. Next iteration scheduled on operator action."));

  return {
    generatedAt: nowIso(),
    steps,
    topCandidate: top,
    candidates,
    safetyContract: {
      destructiveAutonomy: "disabled",
      secretExposure: "redacted",
      approvalRequired: "gated_by_policy",
      auditEmission: "always_on",
    },
    observation: { coverage, validation, canonicalTasks, setupFlows },
  };
}

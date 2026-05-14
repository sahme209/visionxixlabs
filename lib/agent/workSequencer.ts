/**
 * Autonomous Work Sequencer.
 *
 * Given a decomposed task list, sequence the work safely:
 *
 *   setup → validation → scan → findings → recommendations
 *     → policy → approval → execution / desktop handoff
 *     → rollback (recorded before risky execution)
 *     → verification (after execution)
 *     → audit throughout
 *     → memory after meaningful result.
 *
 * The sequencer produces ordered + parallel groups, identifies blocked /
 * approval-gated / user-input-required / desktop-eligible tasks, and is
 * read by workflows + copilot + command-center + next-best-action.
 */

import type { DecomposedTask, DecomposedTaskKind, TaskSafety } from "@/lib/agent/taskDecomposer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SequencingPhase =
  | "phase_setup"
  | "phase_validation"
  | "phase_observe"
  | "phase_scan"
  | "phase_findings"
  | "phase_reasoning"
  | "phase_policy"
  | "phase_approval"
  | "phase_plan"
  | "phase_desktop"
  | "phase_verify"
  | "phase_audit"
  | "phase_memory";

export interface SequencedTask {
  task: DecomposedTask;
  phase: SequencingPhase;
  /** Tasks within the same `parallelGroup` may execute concurrently. */
  parallelGroup: number;
  /** Hard ordering — never run before this many phases have completed. */
  blockUntilPhaseIndex: number;
  /** Direct reasons this task is blocked (empty when not blocked). */
  blockedReasons: string[];
  /** Whether the operator must take action before the next phase. */
  requiresUserInput: boolean;
}

export interface SequencingOutcome {
  ordered: SequencedTask[];
  phases: SequencingPhase[];
  summary: {
    total: number;
    automaticSafe: number;
    operatorRequired: number;
    approvalGated: number;
    blocked: number;
    userInputRequired: number;
    desktopEligible: number;
    parallelGroups: number;
  };
  /** Hard rules applied during sequencing — exposed for audit. */
  rulesApplied: string[];
}

// ---------------------------------------------------------------------------
// Sequencing rules
// ---------------------------------------------------------------------------

const PHASE_ORDER: SequencingPhase[] = [
  "phase_setup",
  "phase_validation",
  "phase_observe",
  "phase_scan",
  "phase_findings",
  "phase_reasoning",
  "phase_policy",
  "phase_approval",
  "phase_plan",
  "phase_desktop",
  "phase_verify",
  "phase_audit",
  "phase_memory",
];

function phaseOf(kind: DecomposedTaskKind): SequencingPhase {
  switch (kind) {
    case "connect_provider":     return "phase_setup";
    case "validate_setup":        return "phase_validation";
    case "observe":               return "phase_observe";
    case "scan":                  return "phase_scan";
    case "find_findings":         return "phase_findings";
    case "reason":                return "phase_reasoning";
    case "policy_check":          return "phase_policy";
    case "request_approval":      return "phase_approval";
    case "build_execution_plan":  return "phase_plan";
    case "review_in_desktop":     return "phase_desktop";
    case "verify_outcome":        return "phase_verify";
    case "audit_record":          return "phase_audit";
    case "remember":              return "phase_memory";
  }
}

function phaseIndex(phase: SequencingPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

const RULES_APPLIED: string[] = [
  "Setup before scan.",
  "Validation before scan.",
  "Scan before findings.",
  "Findings before recommendations.",
  "Recommendations before execution plans.",
  "Policy before approval.",
  "Approval before execution/handoff.",
  "Rollback before risky execution.",
  "Verification after execution.",
  "Audit throughout.",
  "Memory after meaningful result.",
];

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

function sortByPhase(tasks: DecomposedTask[]): DecomposedTask[] {
  return [...tasks].sort((a, b) => {
    const pa = phaseIndex(phaseOf(a.kind));
    const pb = phaseIndex(phaseOf(b.kind));
    if (pa !== pb) return pa - pb;
    return a.ordinal - b.ordinal;
  });
}

function blockReasonsFor(task: DecomposedTask, completedKindsSoFar: Set<DecomposedTaskKind>): string[] {
  const reasons: string[] = [];

  // Hard prerequisites — codifies the sequencing rules above.
  const prereqRule: Partial<Record<DecomposedTaskKind, DecomposedTaskKind[]>> = {
    scan:                 ["connect_provider", "validate_setup"],
    find_findings:        ["scan"],
    reason:               ["find_findings"],
    policy_check:         ["reason"],
    request_approval:     ["policy_check"],
    build_execution_plan: ["reason"],
    review_in_desktop:    ["build_execution_plan"],
    verify_outcome:       ["build_execution_plan"],
    remember:             ["verify_outcome"],
  };

  const prereqs = prereqRule[task.kind] ?? [];
  for (const pr of prereqs) {
    if (!completedKindsSoFar.has(pr)) {
      reasons.push(`Waiting for ${pr.replace(/_/g, " ")}.`);
    }
  }

  // Hard safety — blocked tasks stay blocked regardless of order.
  if (task.safety === "blocked") {
    reasons.push("Capability is currently blocked (preview / planned / unavailable).");
  }

  return reasons;
}

function safetyToUserInput(safety: TaskSafety): boolean {
  return safety === "operator_required" || safety === "approval_required";
}

function parallelGroupFor(phase: SequencingPhase, withinPhaseIdx: number): number {
  // Same-phase tasks share a group. We use phase index as the group id.
  return phaseIndex(phase) * 100 + withinPhaseIdx;
}

export function sequenceWork(tasks: DecomposedTask[]): SequencingOutcome {
  const sorted = sortByPhase(tasks);
  const completed = new Set<DecomposedTaskKind>();
  const ordered: SequencedTask[] = [];

  // Track within-phase index for parallel grouping.
  const phaseCounters = new Map<SequencingPhase, number>();

  for (const task of sorted) {
    const phase = phaseOf(task.kind);
    const within = phaseCounters.get(phase) ?? 0;
    phaseCounters.set(phase, within + 1);

    const blockedReasons = blockReasonsFor(task, completed);
    const sequenced: SequencedTask = {
      task,
      phase,
      parallelGroup: parallelGroupFor(phase, within),
      blockUntilPhaseIndex: phaseIndex(phase),
      blockedReasons,
      requiresUserInput: safetyToUserInput(task.safety),
    };
    ordered.push(sequenced);

    // Only mark complete if not blocked + automatic. Approval/operator gated
    // tasks remain "not completed" so downstream phases stay blocked until
    // the operator acts.
    if (blockedReasons.length === 0 && task.safety === "safe_automatic") {
      completed.add(task.kind);
    }
  }

  // Treat audit_record + observe as always-completing for downstream phases
  // (they don't gate work, they accompany it).
  for (const kind of ["audit_record", "observe", "remember"] as DecomposedTaskKind[]) {
    if (sorted.some((t) => t.kind === kind)) completed.add(kind);
  }

  const summary = {
    total: ordered.length,
    automaticSafe:     ordered.filter((s) => s.task.safety === "safe_automatic").length,
    operatorRequired:  ordered.filter((s) => s.task.safety === "operator_required").length,
    approvalGated:     ordered.filter((s) => s.task.safety === "approval_required").length,
    blocked:           ordered.filter((s) => s.blockedReasons.length > 0).length,
    userInputRequired: ordered.filter((s) => s.requiresUserInput).length,
    desktopEligible:   ordered.filter((s) => s.task.kind === "review_in_desktop" && s.blockedReasons.length === 0).length,
    parallelGroups:    new Set(ordered.map((s) => s.parallelGroup)).size,
  };

  return { ordered, phases: PHASE_ORDER, summary, rulesApplied: RULES_APPLIED };
}

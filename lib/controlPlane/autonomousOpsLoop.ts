/**
 * Autonomous Operations Loop (v2 — canonical execution loop).
 *
 * This is the canonical autonomous loop for the control plane. v1 at
 * `lib/agent/autonomousPlanningLoop.ts` is the legacy read-only planning
 * surface; v2 is the only loop that actually executes safe tasks.
 *
 * Practical AGI-oriented loop that *only ever runs safe tasks*. The loop
 * builds the control plane → picks the highest-leverage safe action →
 * checks policy/safety → runs the safe task runner → writes an audit
 * trace step → rebuilds → repeats. The loop stops the moment a step
 * requires approval, missing config, destructive operation, low
 * confidence, preview-only execution, unknown blast radius, or missing
 * rollback.
 */

import "server-only";

import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";
import type { ControlPlaneState } from "@/lib/controlPlane/controlPlaneModel";
import { runSafeTask, isSafeTaskKind, type SafeTaskKind, type SafeTaskRunResult } from "@/lib/controlPlane/safeTaskRunner";
import { recordFeedback } from "@/lib/memory/feedbackLoop";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutonomousIteration {
  index: number;
  selectedActionId?: string;
  selectedTitle?: string;
  taskKind?: SafeTaskKind;
  result?: SafeTaskRunResult;
  stoppedReason?: string;
  durationMs: number;
}

export interface AutonomousLoopV2Report {
  generatedAt: string;
  iterations: AutonomousIteration[];
  /** Final control plane snapshot for the UI. */
  controlPlane: ControlPlaneState;
  /** Hard counts. */
  summary: {
    iterationsRun: number;
    safeTasksCompleted: number;
    safeTasksBlocked: number;
    approvalsNeeded: number;
    userInputNeeded: number;
  };
  /** Plain-language stop reason. */
  stopReason: string;
  /** Concrete next recommended workflow. */
  nextRecommendedWorkflow: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 6;

// Map an action `actionType` + `category` to a safe-task kind. Only
// safe non-destructive tasks land here.
function safeTaskKindForAction(category: string): SafeTaskKind | undefined {
  switch (category) {
    case "scan":             return "run_security_scanner";
    case "validate":         return "run_validation_loop";
    case "simulate":         return "build_simulation";
    case "remediate":        return "build_remediation_candidates";
    case "troubleshoot":     return "diagnose_failure";
    case "review_finding":   return "run_security_scanner"; // surfacing findings is safe
    default:                  return undefined;
  }
}

export async function runAutonomousOpsLoopV2(): Promise<AutonomousLoopV2Report> {
  const generatedAt = new Date().toISOString();
  const iterations: AutonomousIteration[] = [];
  let approvalsNeeded = 0;
  let userInputNeeded = 0;
  let safeTasksCompleted = 0;
  let safeTasksBlocked = 0;
  let stopReason = "Loop completed normally.";
  let nextRecommended: AutonomousLoopV2Report["nextRecommendedWorkflow"] = { label: "Open Command Center", href: "/dashboard/command-center" };

  let controlPlane = await buildControlPlaneState();
  const tried = new Set<SafeTaskKind>();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const itStart = Date.now();
    const iteration: AutonomousIteration = { index: i, durationMs: 0 };

    // Pick the top action with `actionType === "run_safe_task"`.
    const candidate = controlPlane.nextBestActions.find(
      (a) => a.actionType === "run_safe_task" && a.canRunNow && !a.approvalRequired,
    );

    if (!candidate) {
      iteration.stoppedReason = "No safe task is currently runnable without approval / user input.";
      stopReason = iteration.stoppedReason;
      iteration.durationMs = Date.now() - itStart;
      iterations.push(iteration);

      // Reach for the highest-priority approval / user-input action.
      const needsApproval = controlPlane.nextBestActions.find((a) => a.approvalRequired);
      const needsUser = controlPlane.nextBestActions.find((a) => !a.canRunNow && !a.approvalRequired);
      if (needsApproval) {
        approvalsNeeded += 1;
        nextRecommended = { label: needsApproval.title, href: needsApproval.route };
      } else if (needsUser) {
        userInputNeeded += 1;
        nextRecommended = { label: needsUser.title, href: needsUser.route };
      } else if (controlPlane.nextBestActions[0]) {
        nextRecommended = { label: controlPlane.nextBestActions[0].title, href: controlPlane.nextBestActions[0].route };
      }
      break;
    }

    const kind = safeTaskKindForAction(candidate.category);
    if (!kind || !isSafeTaskKind(kind)) {
      iteration.stoppedReason = "Top safe action does not map to a known safe-task kind.";
      stopReason = iteration.stoppedReason;
      iteration.durationMs = Date.now() - itStart;
      iterations.push(iteration);
      break;
    }
    if (tried.has(kind)) {
      iteration.stoppedReason = `Already attempted ${kind} this loop — stop to avoid thrash.`;
      stopReason = iteration.stoppedReason;
      iteration.durationMs = Date.now() - itStart;
      iterations.push(iteration);
      break;
    }
    tried.add(kind);

    iteration.selectedActionId = candidate.id;
    iteration.selectedTitle    = candidate.title;
    iteration.taskKind         = kind;

    // Hard safety re-check — never call an unsafe path.
    const result = await runSafeTask({ kind });
    iteration.result = result;
    iteration.durationMs = Date.now() - itStart;

    if (result.status === "completed" || result.status === "completed_with_warnings") {
      safeTasksCompleted += 1;
      // Feedback into memory so re-runs deprioritise this task next time.
      recordFeedback({
        kind: "general",
        targetRef: candidate.id,
        label: `Loop completed ${kind}`,
        sourceMode: "preview",
      });
    } else if (result.status === "blocked" || result.status === "failed") {
      safeTasksBlocked += 1;
      stopReason = result.blockedReason ?? `Safe task ${kind} failed.`;
      iterations.push(iteration);
      break;
    }

    iterations.push(iteration);

    // Refresh control plane for the next iteration.
    controlPlane = await buildControlPlaneState();
  }

  return {
    generatedAt,
    iterations,
    controlPlane,
    summary: {
      iterationsRun: iterations.length,
      safeTasksCompleted,
      safeTasksBlocked,
      approvalsNeeded,
      userInputNeeded,
    },
    stopReason,
    nextRecommendedWorkflow: nextRecommended,
  };
}

/**
 * Pipeline state-machine reducer — Phase 377.
 *
 * Pure function. Given the current PipelineStageRun statuses for a
 * run, decide:
 *   - what the next actionable stage is (kind: "run" | "await_approval"),
 *   - whether the run as a whole is terminal (succeeded | failed | running),
 *   - whether the run is blocked by a failed stage upstream.
 *
 * The runtime calls this after every stage transition to decide what
 * to do next. Lives separate from Prisma so the matrix can be unit-
 * tested exhaustively.
 *
 * Invariants:
 *   - Stages run strictly in `ordering` sequence; no parallelism.
 *   - A "failed" stage stops the run (terminal status = "failed").
 *   - "skipped" stages are allowed (e.g., approval auto-skip after
 *     auto-approve policy); they advance the cursor.
 *   - awaiting_approval pauses the run but is not terminal — the
 *     caller resolves it when approval terminal status arrives.
 */

export type StageStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "awaiting_approval";

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface StageView {
  ordering: number;
  status: StageStatus;
  requiresApproval: boolean;
}

export type NextStagePlan =
  | { kind: "complete"; runStatus: "succeeded" }
  | { kind: "failed"; runStatus: "failed"; failedOrdering: number }
  | { kind: "await_approval"; ordering: number }
  | { kind: "run"; ordering: number }
  | { kind: "in_flight"; ordering: number }
  | { kind: "empty" };

export function planNextStage(stages: ReadonlyArray<StageView>): NextStagePlan {
  if (stages.length === 0) return { kind: "empty" };

  const sorted = [...stages].sort((a, b) => a.ordering - b.ordering);

  // Failure short-circuit — earliest failed stage decides the run is dead.
  const firstFailed = sorted.find((s) => s.status === "failed");
  if (firstFailed) {
    return { kind: "failed", runStatus: "failed", failedOrdering: firstFailed.ordering };
  }

  // In-flight short-circuit — at most one stage is running at a time.
  const running = sorted.find((s) => s.status === "running");
  if (running) {
    return { kind: "in_flight", ordering: running.ordering };
  }

  // Awaiting approval — first such stage pauses the run.
  const awaitingApproval = sorted.find((s) => s.status === "awaiting_approval");
  if (awaitingApproval) {
    return { kind: "await_approval", ordering: awaitingApproval.ordering };
  }

  // Find the first stage that isn't terminal-successful / skipped.
  const cursor = sorted.find((s) => s.status === "queued");
  if (!cursor) {
    // No queued stages and nothing in flight, nothing awaiting — done.
    return { kind: "complete", runStatus: "succeeded" };
  }

  // Stage requires approval but is still queued → mark it as the next
  // approval gate to open. The caller mints the approval snapshot and
  // moves the stage to "awaiting_approval".
  if (cursor.requiresApproval) {
    return { kind: "await_approval", ordering: cursor.ordering };
  }
  return { kind: "run", ordering: cursor.ordering };
}

/**
 * Convenience derivation — what should the parent PipelineRun.status
 * be, given the current stage statuses? Mirrors planNextStage but
 * boils down to the run-level status only.
 */
export function deriveRunStatus(stages: ReadonlyArray<StageView>): RunStatus {
  const plan = planNextStage(stages);
  switch (plan.kind) {
    case "empty":
    case "complete":   return plan.kind === "complete" ? "succeeded" : "queued";
    case "failed":     return "failed";
    case "in_flight":
    case "run":
    case "await_approval": return "running";
  }
}

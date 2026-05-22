/**
 * Pure execution gate — Phase 376.
 *
 * Given a snapshot's current state, decides whether the `/execute`
 * endpoint should run the executor for that engineer. Lives in
 * lib/workforce so the matrix can be unit-tested without Prisma.
 *
 * Invariants:
 *   - Only "approved" snapshots are executable.
 *   - Execution is one-shot: executionStatus must be "not_started".
 *     A successful or failed execution stays terminal — re-trying
 *     "failed" is intentionally not supported here (a follow-up phase
 *     can add an explicit reset/retry endpoint with audit).
 *   - The executor registry must have an entry for the engineer. The
 *     framework ships a dry-run default for every engineer, so this
 *     guard only fires if we somehow lose the registration.
 */

export type ExecutionRejectReason =
  | "not_approved"
  | "already_executed"
  | "previously_failed"
  | "execution_in_flight"
  | "no_executor_registered";

export interface PlanExecutionInput {
  snapshotStatus: string;
  executionStatus: string;
  hasExecutor: boolean;
}

export type ExecutionPlan =
  | { kind: "reject"; reason: ExecutionRejectReason; detail?: string }
  | { kind: "accept" };

export function planExecution(input: PlanExecutionInput): ExecutionPlan {
  if (input.snapshotStatus !== "approved") {
    return {
      kind: "reject",
      reason: "not_approved",
      detail: `Snapshot status is "${input.snapshotStatus}" — must be "approved" to execute.`,
    };
  }
  switch (input.executionStatus) {
    case "not_started":
      break;
    case "executed":
      return { kind: "reject", reason: "already_executed" };
    case "failed":
      return { kind: "reject", reason: "previously_failed", detail: "Execution previously failed; manual reset required." };
    case "running":
      return { kind: "reject", reason: "execution_in_flight" };
    default:
      return { kind: "reject", reason: "already_executed", detail: `Unknown execution status "${input.executionStatus}".` };
  }
  if (!input.hasExecutor) {
    return { kind: "reject", reason: "no_executor_registered" };
  }
  return { kind: "accept" };
}

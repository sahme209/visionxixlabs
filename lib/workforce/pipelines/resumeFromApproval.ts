/**
 * Pipeline resume mapping — Phase 378.
 *
 * Pure function. Given the terminal status of an EngineerApprovalSnapshot
 * minted from a pipeline approval gate, decide what the stage's next
 * status should be and whether the run is still alive.
 *
 *   snapshot "approved"          → stage "succeeded", continue run
 *   snapshot "rejected"          → stage "failed",     fail run
 *   snapshot "expired"           → stage "failed",     fail run with TTL note
 *   snapshot "pending" (no-op)   → no change
 *
 * The terminal logic lives separate from the route's I/O so the
 * mapping is unit-testable independent of Prisma.
 */

export type ApprovalTerminalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface ResumePlan {
  /** What the stage row should transition to. */
  stageStatus: "succeeded" | "failed" | "no_change";
  /** Whether to call advancePipelineRun() afterward. */
  shouldAdvanceRun: boolean;
  /** Operator-readable error when the stage transitions to failed. */
  errorMessage?: string;
}

export function resumePipelineStageFromApproval(snapshotStatus: ApprovalTerminalStatus): ResumePlan {
  switch (snapshotStatus) {
    case "approved":
      return { stageStatus: "succeeded", shouldAdvanceRun: true };
    case "rejected":
      return {
        stageStatus: "failed",
        shouldAdvanceRun: true,
        errorMessage: "Approval rejected by operator.",
      };
    case "expired":
      return {
        stageStatus: "failed",
        shouldAdvanceRun: true,
        errorMessage: "Approval auto-expired before terminal vote.",
      };
    case "pending":
      return { stageStatus: "no_change", shouldAdvanceRun: false };
  }
}

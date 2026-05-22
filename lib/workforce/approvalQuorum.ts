/**
 * Two-step approval quorum reducer — Phase 369.
 *
 * Pure function: given the list of approver decisions on an
 * EngineerApprovalSnapshot and the snapshot's requiredApprovers count,
 * derive the terminal status.
 *
 * Invariants:
 *   - A single "rejected" decision short-circuits to "rejected".
 *   - Approvals are counted by *distinct* approverUserId. The DB unique
 *     constraint already prevents double-voting, but the reducer dedupes
 *     defensively so a stray duplicate row cannot bypass quorum.
 *   - requiredApprovers <= 0 short-circuits to "approved" (defensive —
 *     no_approval_needed never mints a snapshot, so this should not occur
 *     in practice).
 */

export type QuorumStatus = "pending" | "approved" | "rejected";

export interface QuorumDecision {
  approverUserId: string;
  decision: "approved" | "rejected";
}

export interface ComputeQuorumInput {
  decisions: ReadonlyArray<QuorumDecision>;
  requiredApprovers: number;
}

export interface ComputeQuorumResult {
  status: QuorumStatus;
  approvedCount: number;
  rejectedCount: number;
  approvedBy: ReadonlyArray<string>;
  isTerminal: boolean;
}

export function computeQuorumStatus(input: ComputeQuorumInput): ComputeQuorumResult {
  const { decisions, requiredApprovers } = input;

  const rejectedCount = decisions.filter((d) => d.decision === "rejected").length;
  const approvedBy = Array.from(
    new Set(
      decisions
        .filter((d) => d.decision === "approved")
        .map((d) => d.approverUserId),
    ),
  ).sort();
  const approvedCount = approvedBy.length;

  if (requiredApprovers <= 0) {
    return { status: "approved", approvedCount, rejectedCount, approvedBy, isTerminal: true };
  }
  if (rejectedCount > 0) {
    return { status: "rejected", approvedCount, rejectedCount, approvedBy, isTerminal: true };
  }
  if (approvedCount >= requiredApprovers) {
    return { status: "approved", approvedCount, rejectedCount, approvedBy, isTerminal: true };
  }
  return { status: "pending", approvedCount, rejectedCount, approvedBy, isTerminal: false };
}

/**
 * Pure approval-quorum calculator.
 *
 * For a packet that needs N-of-M human approvers across required role
 * categories (e.g. "security", "platform_admin"), compute whether the
 * supplied approvals meet the quorum policy.
 *
 * Pure / deterministic. No DB.
 */

export type ApproverRole = "platform_admin" | "security" | "engineering_lead" | "finance" | "compliance";

export interface ApprovalRecord {
  approver: string;           // human-readable id (email or username)
  role: ApproverRole;
  /** "approve" or "reject" — abstain not allowed at the human layer. */
  decision: "approve" | "reject";
  decidedAt: string;          // ISO
}

export interface QuorumPolicy {
  /** Minimum total approvals across all roles. */
  totalApprovals: number;
  /** Per-role minimum approvals (e.g. {security: 1}). */
  perRole?: Partial<Record<ApproverRole, number>>;
  /** True = a single reject vetoes the packet (default false). */
  vetoOnReject?: boolean;
}

export interface QuorumDecision {
  passed: boolean;
  approvals: number;
  rejects: number;
  perRoleApprovals: Partial<Record<ApproverRole, number>>;
  /** First reason the quorum DID NOT pass (or null if it did). */
  reason: string | null;
}

export function calculateQuorum(records: readonly ApprovalRecord[], policy: QuorumPolicy): QuorumDecision {
  let approvals = 0;
  let rejects = 0;
  const perRole: Partial<Record<ApproverRole, number>> = {};

  for (const r of records) {
    if (r.decision === "approve") {
      approvals += 1;
      perRole[r.role] = (perRole[r.role] ?? 0) + 1;
    } else {
      rejects += 1;
    }
  }

  let reason: string | null = null;

  if (policy.vetoOnReject && rejects > 0) {
    reason = "at least one veto reject";
  } else if (approvals < policy.totalApprovals) {
    reason = `need ${policy.totalApprovals} total approvals (have ${approvals})`;
  } else if (policy.perRole) {
    for (const [role, min] of Object.entries(policy.perRole) as Array<[ApproverRole, number]>) {
      if ((perRole[role] ?? 0) < min) {
        reason = `need ${min} ${role} approval(s) (have ${perRole[role] ?? 0})`;
        break;
      }
    }
  }

  return {
    passed: reason === null,
    approvals,
    rejects,
    perRoleApprovals: perRole,
    reason,
  };
}

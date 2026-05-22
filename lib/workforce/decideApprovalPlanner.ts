/**
 * Pure decision planner — Phase 373.
 *
 * Fuses the /decide route's pre-insert guards with the post-insert
 * quorum projection into a single pure function. The route remains
 * the Prisma adapter; the integrity rules live here where they can
 * be exhaustively unit-tested.
 *
 * The planner does NOT mutate state. It treats `existingDecisions`
 * as the durable vote rows already in the DB and projects what would
 * happen after the new vote lands. The DB unique constraint is the
 * authoritative double-vote lock; the planner does not try to predict
 * that race — the route surfaces it as `already_voted` (HTTP 409).
 */

import { computeQuorumStatus, type ComputeQuorumResult, type QuorumDecision } from "./approvalQuorum";

export type DecideRejectReason =
  | "invalid_decision"
  | "approval_not_found"
  | "cross_tenant"
  | "already_decided"
  | "not_engineer_sourced";

export interface PlanDecideInput {
  /** Raw value from the JSON body — validated here. */
  rawDecision: unknown;
  viewerOrganizationId: string;
  /** From the DB — null when the snapshot lookup missed. */
  snapshot: {
    organizationId: string;
    status: string;
    requiredApprovers: number;
  } | null;
  /** From the approval engine — null when the in-memory row is gone (post-restart). */
  engineSourceId: string | null;
  /** Durable vote rows already recorded for this snapshot. */
  existingDecisions: ReadonlyArray<QuorumDecision>;
  /** The voter's user id (or fallback identifier). */
  newApproverUserId: string;
}

export type DecidePlan =
  | { kind: "reject"; reason: DecideRejectReason; detail?: string }
  | {
      kind: "accept";
      decision: "approved" | "rejected";
      /** Projected quorum *as if* the new decision had been inserted. */
      quorum: ComputeQuorumResult;
    };

/**
 * Decide what should happen for a vote attempt.
 *
 * Order of guards mirrors the route exactly so the planner stays
 * 1:1 with what the durable side effects depend on:
 *   1. invalid_decision  (400)
 *   2. approval_not_found (404)
 *   3. cross_tenant       (403)
 *   4. already_decided    (409)
 *   5. not_engineer_sourced (422) — only when the engine row exists
 *   6. accept → compute projected quorum
 */
export function planDecideApproval(input: PlanDecideInput): DecidePlan {
  // 1. invalid_decision.
  if (input.rawDecision !== "approved" && input.rawDecision !== "rejected") {
    return {
      kind: "reject",
      reason: "invalid_decision",
      detail: 'decision must be "approved" or "rejected"',
    };
  }
  const decision = input.rawDecision;

  // 2. snapshot missing.
  if (!input.snapshot) {
    return { kind: "reject", reason: "approval_not_found" };
  }

  // 3. cross-tenant.
  if (input.snapshot.organizationId !== input.viewerOrganizationId) {
    return { kind: "reject", reason: "cross_tenant" };
  }

  // 4. already decided (terminal). The expiry sweeper produces
  //    status="expired"; that also counts as terminal here — no new
  //    votes accepted on an expired snapshot.
  if (input.snapshot.status !== "pending") {
    return {
      kind: "reject",
      reason: "already_decided",
      detail: `Approval already ${input.snapshot.status}.`,
    };
  }

  // 5. engine row exists but isn't engineer-sourced. When the engine
  //    has dropped the row (post-restart) we trust the snapshot.
  if (input.engineSourceId !== null && !input.engineSourceId.startsWith("engineer:")) {
    return {
      kind: "reject",
      reason: "not_engineer_sourced",
      detail: "This endpoint only handles engineer-sourced approvals.",
    };
  }

  // 6. accept — project quorum with the new decision appended.
  // Annotate explicitly: spreading a ReadonlyArray<QuorumDecision> into a
  // fresh array widens the inferred element type, and the inline object
  // literal { approverUserId, decision } loses the "approved" | "rejected"
  // narrowing on `decision` if not annotated.
  const projected: QuorumDecision[] = [
    ...input.existingDecisions,
    { approverUserId: input.newApproverUserId, decision },
  ];
  const quorum = computeQuorumStatus({
    decisions: projected,
    requiredApprovers: input.snapshot.requiredApprovers,
  });
  return { kind: "accept", decision, quorum };
}

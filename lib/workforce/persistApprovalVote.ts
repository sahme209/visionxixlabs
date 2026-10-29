import "server-only";
import { codingApprovalDigest, isCodingApprovalAction, verifyCodingArtifact } from "./pipelines/codingArtifact";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { planDecideApproval } from "./decideApprovalPlanner";

// Only authenticated writers assign these database IDs. This format is a
// provenance marker, not a credential. Historical cuid IDs cannot prove that
// their actor was not a caller-supplied label. Never relabel those old rows.
const BOUND_VOTE_ID = /^boundvote_v1_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function hasBoundApprovalVoteIdentity(vote: { id: string }): boolean {
  return BOUND_VOTE_ID.test(vote.id);
}

/** Reviewed server writers only. This transaction-local version marker does
 * not grant authority; callers must authenticate and authorize before entry.
 * Database guards use it to refuse retired application writers. */
export async function withBoundApprovalWrite<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('axiom.approval_actor_binding', 'v1', true)`;
    return work(tx);
  });
}

export async function persistApprovalVote(input: {
  approvalRequestId: string;
  organizationId: string;
  principal: { kind: "api_key" | "user"; id: string };
  rawDecision: unknown;
  reason?: string;
  reviewDigest?: unknown;
  engineSourceId: string | null;
}) {
  if (!input.principal.id.trim()) throw new Error("authenticated_approval_principal_required");
  const approverUserId = input.principal.kind === "api_key" ? `api_key:${input.principal.id}` : input.principal.id;
  try {
    return await withBoundApprovalWrite(async tx => {
      // Both current writers serialize the read, vote and terminal update.
      // This is not a substitute for retiring pre-fix deployment writers.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`axiom:approval-vote:${input.approvalRequestId}`}, 0))`;
      const snapshot = await tx.engineerApprovalSnapshot.findUnique({
        where: { approvalRequestId: input.approvalRequestId },
        include: { decisions: { select: { id: true, approverUserId: true, decision: true } } },
      });
      const plan = planDecideApproval({
        rawDecision: input.rawDecision, viewerOrganizationId: input.organizationId,
        snapshot, engineSourceId: input.engineSourceId,
        existingDecisions: snapshot ? snapshot.decisions.map(v => ({ approverUserId: v.approverUserId, decision: v.decision as "approved" | "rejected" })) : [],
        newApproverUserId: approverUserId,
      });
      if (plan.kind === "reject") return plan;
      const snap = snapshot!;
      if (plan.decision === "approved" && isCodingApprovalAction(snap.action)) {
        const digest = codingApprovalDigest(snap.action);
        const gate = snap.sourceKind === "pipeline_stage" && snap.pipelineStageRunId ? await tx.pipelineStageRun.findFirst({where:{id:snap.pipelineStageRunId,run:{organizationId:input.organizationId},stageId:"code_gate",stageKind:"approval_gate",status:"awaiting_approval",approvalRequestId:snap.approvalRequestId}}) : null;
        const record = gate?.outputDetail as {codingArtifact?:unknown;codingArtifactDigest?:unknown}|null;
        if (!digest || input.reviewDigest !== digest || !gate || gate.approvalRequestId !== snap.approvalRequestId || record?.codingArtifactDigest !== digest || !verifyCodingArtifact(record.codingArtifact,digest,{organizationId:input.organizationId,runId:gate.runId})) {
          return {kind:"reject" as const,reason:"coding_review_required" as const,detail:"Review the exact coding artifact before approving. Changed or legacy unbound reviews cannot authorize repository writes."};
        }
      }
      if (snap.decisions.some(vote => !hasBoundApprovalVoteIdentity(vote))) {
        return { kind: "reject" as const, reason: "approval_actor_provenance_required" as const,
          detail: "This pending approval contains legacy votes whose actor identity cannot be verified. Replace it through the authorized approval flow; retrying cannot repair it." };
      }
      await tx.engineerApprovalDecision.create({ data: {
        id: `boundvote_v1_${randomUUID()}`, snapshotId: snap.id,
        organizationId: input.organizationId, approverUserId,
        decision: plan.decision, reason: input.reason,
      } });
      const decidedAt = new Date();
      if (plan.quorum.isTerminal) await tx.engineerApprovalSnapshot.update({
        where: { id: snap.id }, data: { status: plan.quorum.status, decidedAt,
          decidedByUserId: approverUserId, decisionReason: input.reason },
      });
      return { kind: "accepted" as const, snapshot: snap, decision: plan.decision,
        quorum: plan.quorum, decidedAt, approverUserId };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { kind: "reject" as const, reason: "already_voted" as const, detail: "This authenticated principal has already voted on this approval." };
    }
    throw error;
  }
}

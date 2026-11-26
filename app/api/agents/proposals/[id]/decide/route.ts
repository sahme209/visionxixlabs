/**
 * POST /api/agents/proposals/[id]/decide
 *
 * Body: { decision: "approved" | "rejected", reason?: string }
 *
 * Records the human verdict on an agent-authored MethodProposal.
 * NEVER applies the change — the IaC pipeline picks up `approved`
 * rows and ships them through real change control.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { decideProposalOnce } from "@/lib/agents/methodProposalStore";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
      throw AxiomErrors.policy("authz.role_required", "Your role cannot decide proposals.");
    }
    const { id } = await params;
    const body = (await req.json()) as { decision?: string; reason?: string } | null;
    if (body?.decision !== "approved" && body?.decision !== "rejected") {
      throw AxiomErrors.validation("decision.invalid", "decision must be 'approved' or 'rejected'.");
    }
    const result = await decideProposalOnce({
      organizationId: String(ctx.organizationId),
      proposalId: id,
      decision: body.decision,
      decidedBy: ctx.userId ? String(ctx.userId) : undefined,
      decisionReason: body.reason,
    });
    if (result.kind === "not_found") throw AxiomErrors.validation("proposal.not_found", "Proposal not found.");
    if (result.kind === "already_decided") {
      throw AxiomErrors.policy("proposal.already_decided", `This proposal was already ${result.record.status}. The first decision stands.`);
    }
    const row = result.record;
    try {
      await auditRecord({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId ?? undefined,
        action: body.decision === "approved" ? "approval.grant" : "approval.deny",
        outcome: "success",
        entityRef: `method_proposal:${id}`,
        correlationId: correlationId as CorrelationId,
        detail: { kind: "method_proposal", hasReason: Boolean(body.reason) },
      });
    } catch { /* Audit failure must not roll back or duplicate a committed decision. */ }
    return apiOk({ row }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

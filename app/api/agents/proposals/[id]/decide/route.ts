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
import { decideProposal } from "@/lib/agents/methodProposalStore";
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
    const { id } = await params;
    const body = (await req.json()) as { decision?: string; reason?: string } | null;
    if (body?.decision !== "approved" && body?.decision !== "rejected") {
      throw AxiomErrors.validation("decision.invalid", "decision must be 'approved' or 'rejected'.");
    }
    const row = await decideProposal({
      organizationId: String(ctx.organizationId),
      proposalId: id,
      decision: body.decision,
      decidedBy: ctx.userId ? String(ctx.userId) : undefined,
      decisionReason: body.reason,
    });
    if (!row) throw AxiomErrors.validation("proposal.not_found", "Proposal not found.");
    return apiOk({ row }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

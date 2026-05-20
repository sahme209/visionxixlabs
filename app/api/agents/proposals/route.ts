/**
 * /api/agents/proposals
 *
 * GET — list method proposals for the caller's tenant (paginated).
 * POST — submit a new proposal. Body: { authorAgent, target, label,
 *        rationale, proposedDiff, confidence }.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readProposals, submitProposal } from "@/lib/agents/methodProposalStore";
import { vetProposal } from "@/lib/agents/proposalVetter";
import { isProposalTarget, type ProposalStatus } from "@/lib/agents/methodProposalModel";
import { isAgentRole } from "@/lib/agents/agentBusModel";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const status = req.nextUrl.searchParams.get("status") as ProposalStatus | null;
    const rows = await readProposals({
      organizationId: String(ctx.organizationId),
      status: status ?? undefined,
    });
    return apiOk({ proposals: rows }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as {
      authorAgent?: string;
      target?: string;
      label?: string;
      rationale?: string;
      proposedDiff?: unknown;
      confidence?: number;
    } | null;

    if (!body?.authorAgent || !isAgentRole(body.authorAgent)) {
      throw AxiomErrors.validation("proposal.author.invalid", "authorAgent must be a valid AgentRole.");
    }
    if (!body.target || !isProposalTarget(body.target)) {
      throw AxiomErrors.validation("proposal.target.invalid", "target must be a valid ProposalTarget.");
    }
    if (!body.label || !body.rationale || typeof body.confidence !== "number") {
      throw AxiomErrors.validation("proposal.required", "label, rationale, confidence required.");
    }

    const proposal = await submitProposal({
      organizationId: String(ctx.organizationId),
      authorAgent: body.authorAgent,
      target: body.target,
      label: body.label,
      rationale: body.rationale,
      proposedDiff: body.proposedDiff ?? {},
      confidence: body.confidence,
    });

    // Run the vetter immediately so the operator sees stage results inline.
    const vetting = vetProposal({
      proposalId: proposal.id,
      target: proposal.target,
      proposedDiff: proposal.proposedDiff,
      label: proposal.label,
    });

    return apiOk({ proposal, vetting }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

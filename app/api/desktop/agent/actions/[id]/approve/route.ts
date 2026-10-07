/**
 * POST /api/desktop/agent/actions/[id]/approve
 *
 * The only route in the entire agent runtime that can turn a proposal
 * into a real GitHub/AWS write action. Admin/owner-only — a proposal
 * the agent raised for one user still requires an admin's explicit
 * approval, the same authority bar as every other write action in this
 * codebase (GitHub branch/PR/commit, AWS deploy trigger).
 */

import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { executeApprovedAction, type ActionExecutionRepo } from "@/lib/axiom/agentRuntime/actionApprovalResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/actions/[id]/approve",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const organizationId = String(session.organizationId);
  const proposal = await prisma.agentActionProposal.findFirst({ where: { id, organizationId } });
  if (!proposal) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (proposal.status !== "proposed") {
    return NextResponse.json({ ok: false, error: "already_decided", hint: `This proposal is already ${proposal.status}.` }, { status: 409 });
  }

  await prisma.agentActionProposal.update({
    where: { id },
    data: { status: "approved", decidedByUserId: String(session.userId), decidedAt: new Date() },
  });

  const result = await executeApprovedAction(
    prisma as unknown as ActionExecutionRepo,
    organizationId,
    proposal.toolName,
    proposal.argsJson as Record<string, unknown>,
    String(session.userId),
  );

  const final = await prisma.agentActionProposal.update({
    where: { id },
    data: {
      status: result.ok ? "executed" : "failed",
      resultJson: result.ok ? (result.result as Prisma.InputJsonValue) : undefined,
      errorMessage: result.ok ? null : result.error,
      executedAt: new Date(),
    },
  });

  await prisma.agentConversationTurn.create({
    data: {
      conversationId: proposal.conversationId,
      role: "tool_result",
      actionProposalId: proposal.id,
      content: result.ok
        ? `${proposal.toolName} approved and executed: ${JSON.stringify(result.result)}`
        : `${proposal.toolName} approved but failed: ${result.error}`,
    },
  });

  return NextResponse.json({ ok: true, data: { id: final.id, status: final.status, resultJson: final.resultJson, errorMessage: final.errorMessage } });
}

/**
 * POST /api/desktop/agent/actions/[id]/reject
 *
 * Admin/owner-only, same bar as approve — a non-admin shouldn't be able
 * to silently dismiss another user's pending action either, since that
 * decision is itself part of the audit trail.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/actions/[id]/reject",
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

  const claim = await prisma.agentActionProposal.updateMany({
    where: { id, organizationId, status: "proposed" },
    data: { status: "rejected", decidedByUserId: String(session.userId), decidedAt: new Date() },
  });
  if (claim.count !== 1) {
    return NextResponse.json({ ok: false, error: "already_decided", hint: "Another decision already claimed this proposal." }, { status: 409 });
  }

  await prisma.agentConversationTurn.create({
    data: { conversationId: proposal.conversationId, role: "tool_result", actionProposalId: proposal.id, content: `${proposal.toolName} was rejected.` },
  });

  return NextResponse.json({ ok: true, data: { id: proposal.id, status: "rejected" } });
}

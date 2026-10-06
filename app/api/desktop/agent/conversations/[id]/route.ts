/**
 * GET /api/desktop/agent/conversations/[id]
 *
 * Reopens a conversation: all turns plus every action proposal ever
 * raised in it (with current status), scoped to the caller's org.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/agent/conversations/[id]",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await prisma.agentConversation.findFirst({ where: { id, organizationId: String(session.organizationId) } });
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const [turns, actions] = await Promise.all([
    prisma.agentConversationTurn.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
    prisma.agentActionProposal.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      id: conversation.id,
      title: conversation.title,
      turns: turns.map((t) => ({ id: t.id, role: t.role, content: t.content, actionProposalId: t.actionProposalId, createdAt: t.createdAt.toISOString() })),
      actions: actions.map((a) => ({
        id: a.id, toolName: a.toolName, argsJson: a.argsJson, riskLevel: a.riskLevel, status: a.status,
        resultJson: a.resultJson, errorMessage: a.errorMessage, createdAt: a.createdAt.toISOString(),
      })),
    },
  });
}

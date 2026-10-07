/**
 * POST /api/desktop/agent/conversations
 *
 * Starts a new agent conversation. Any paired session may start one —
 * the governance gate is on write actions (approval requires an admin),
 * not on talking to the agent at all.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/agent/conversations",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const conversations = await prisma.agentConversation.findMany({
    where: {
      organizationId: String(session.organizationId),
      userId: String(session.userId),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { turns: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        turnCount: conversation._count.turns,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/conversations",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.slice(0, 200) : null;

  const conversation = await prisma.agentConversation.create({
    data: { organizationId: String(session.organizationId), userId: String(session.userId), title },
  });
  return NextResponse.json({ ok: true, data: { id: conversation.id, title: conversation.title, createdAt: conversation.createdAt.toISOString() } }, { status: 201 });
}

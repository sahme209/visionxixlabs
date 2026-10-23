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
import { consumeToken } from "@/lib/api/rateLimiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Seek pagination never resolves a supplied id outside the caller's scope. */
function readCursor(raw: string): { updatedAt: Date; id: string } | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(raw)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" || typeof value[1] !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value[1])) return null;
    const updatedAt = new Date(value[0]);
    if (!Number.isFinite(updatedAt.getTime()) || updatedAt.toISOString() !== value[0]) return null;
    return { updatedAt, id: value[1] };
  } catch { return null; }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await resolveRequestDesktopSession(request, {
      requiredScope: "pipeline:read", route: "GET /api/desktop/agent/conversations", allowApiKey: false,
    });
    if (!session) return reply({ ok: false, error: "desktop_session_required" }, 401);
    const params = request.nextUrl.searchParams;
    const query = params.get("q") ?? "", rawCursor = params.get("cursor");
    const cursor = rawCursor === null ? null : readCursor(rawCursor);
    if (query.length > 200 || /[\x00-\x1f\x7f]/.test(query) || rawCursor !== null && !cursor || params.getAll("q").length > 1 || params.getAll("cursor").length > 1) return reply({ ok: false, error: "invalid_history_query" }, 400);
    if (!consumeToken(`conversation-history:${session.organizationId}:${session.userId}`, { capacity: 30, tokensPerSecond: 2 }).allowed) return reply({ ok: false, error: "conversation_history_rate_limited" }, 429);
    const rows = await prisma.agentConversation.findMany({
      where: {
        organizationId: String(session.organizationId), userId: String(session.userId),
        ...(query.trim() ? { title: { contains: query.trim(), mode: "insensitive" as const } } : {}),
        ...(cursor ? { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 51,
      select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { turns: true } } },
    });
    const conversations = rows.slice(0, 50), last = conversations.at(-1);
    const nextCursor = rows.length > 50 && last ? Buffer.from(JSON.stringify([last.updatedAt.toISOString(), last.id])).toString("base64url") : null;
    return reply({ ok: true, data: {
      conversations: conversations.map(conversation => ({ id: conversation.id, title: conversation.title, turnCount: conversation._count.turns, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() })),
      nextCursor, historyQueryVersion: 1,
    } });
  } catch { return reply({ ok: false, error: "conversation_history_unavailable" }, 503); }
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

/**
 * POST /api/dashboard/agi-memory-chat-delete — Phase 529.
 * Body: { turnId }
 *
 * Operator removes a single turn from their chat archive (e.g.
 * accidentally typed PII into the question). Audit-trailed.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildChatTurnDeleteResponse,
  type ChatTurnRepo,
} from "@/lib/releaseops/aiMemoryChatResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { turnId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const turnId = typeof body.turnId === "string" ? body.turnId : null;
  if (!turnId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { turnId }." },
      { status: 400 },
    );
  }

  const r = await buildChatTurnDeleteResponse(
    prisma as unknown as ChatTurnRepo,
    { organizationId: ctx.organizationId, turnId },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "agi_memory.chat_delete",
      subjectKind: "agi_chat_turn",
      subjectId: turnId,
      summary: `Operator deleted chat turn ${turnId}`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

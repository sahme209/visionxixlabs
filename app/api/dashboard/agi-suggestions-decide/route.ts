/**
 * POST /api/dashboard/agi-suggestions-decide — Phase 525.
 * Body: { suggestionId, action: "act"|"dismiss", note? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildSuggestionDecideResponse,
  type ProactiveSuggestionRepo,
} from "@/lib/releaseops/proactiveAgiSuggestionResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { suggestionId?: unknown; action?: unknown; note?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const suggestionId = typeof body.suggestionId === "string" ? body.suggestionId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!suggestionId || !action) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { suggestionId, action }." },
      { status: 400 },
    );
  }

  const r = await buildSuggestionDecideResponse(
    prisma as unknown as ProactiveSuggestionRepo,
    {
      organizationId: ctx.organizationId,
      suggestionId,
      action,
      decidedByUserId: ctx.userId,
      ...(note ? { note } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "proactive_suggestion.decide",
      subjectKind: "agi_suggestion",
      subjectId: suggestionId,
      summary: `Suggestion ${r.body.data.suggestion.kind} ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

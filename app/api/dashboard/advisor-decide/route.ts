/**
 * POST /api/dashboard/advisor-decide — Phase 506.
 * Body: { recommendationId, action: "accept"|"reject"|"implement"|"dismiss", note? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAdvisorDecisionResponse,
  type AdvisorRepo,
  OPERATOR_TRANSITIONS,
  type OperatorTransition,
} from "@/lib/releaseops/advisorRecommendationResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { recommendationId?: unknown; action?: unknown; note?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const recommendationId = typeof body.recommendationId === "string" ? body.recommendationId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (OPERATOR_TRANSITIONS as readonly string[]).includes(action);
  if (!recommendationId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { recommendationId, action: 'accept'|'reject'|'implement'|'dismiss', note? }." },
      { status: 400 },
    );
  }

  const r = await buildAdvisorDecisionResponse(
    prisma as unknown as AdvisorRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      recommendationId,
      action: action as OperatorTransition,
      ...(typeof body.note === "string" ? { note: body.note } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `advisor.${action}`,
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: `Advisor recommendation ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

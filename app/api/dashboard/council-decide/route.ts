/**
 * POST /api/dashboard/council-decide — Phase 514.
 * Body: { decisionId, action: "accept"|"override"|"dismiss", note?, overrideKind? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildCouncilDecisionResponse,
  type AdvisorCouncilRepo,
  COUNCIL_TRANSITIONS,
  type CouncilTransition,
} from "@/lib/releaseops/advisorCouncilResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { decisionId?: unknown; action?: unknown; note?: unknown; overrideKind?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const decisionId = typeof body.decisionId === "string" ? body.decisionId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (COUNCIL_TRANSITIONS as readonly string[]).includes(action);
  if (!decisionId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { decisionId, action: 'accept'|'override'|'dismiss', note?, overrideKind? }." },
      { status: 400 },
    );
  }

  const r = await buildCouncilDecisionResponse(
    prisma as unknown as AdvisorCouncilRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      decisionId,
      action: action as CouncilTransition,
      ...(typeof body.note === "string" ? { note: body.note } : {}),
      ...(typeof body.overrideKind === "string" ? { overrideKind: body.overrideKind } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `advisor_council.${action}`,
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: r.body.data.overrideKind
        ? `Council ${r.body.data.previousDecision} → ${r.body.data.decision} · operator override → ${r.body.data.overrideKind}`
        : `Council ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

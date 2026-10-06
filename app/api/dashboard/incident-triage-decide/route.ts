/**
 * POST /api/dashboard/incident-triage-decide — Phase 509.
 * Body: { triageId, action: "accept"|"override"|"dismiss", note?, overridePriority? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildTriageDecisionResponse,
  type IncidentTriageRepo,
  TRIAGE_TRANSITIONS,
  type TriageTransition,
} from "@/lib/releaseops/incidentTriageResponder";
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
  let body: { triageId?: unknown; action?: unknown; note?: unknown; overridePriority?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const triageId = typeof body.triageId === "string" ? body.triageId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (TRIAGE_TRANSITIONS as readonly string[]).includes(action);
  if (!triageId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { triageId, action: 'accept'|'override'|'dismiss', note?, overridePriority? }." },
      { status: 400 },
    );
  }

  const r = await buildTriageDecisionResponse(
    prisma as unknown as IncidentTriageRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      triageId,
      action: action as TriageTransition,
      ...(typeof body.note === "string" ? { note: body.note } : {}),
      ...(typeof body.overridePriority === "string" ? { overridePriority: body.overridePriority } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `incident_triage.${action}`,
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: r.body.data.overridePriority
        ? `Triage ${r.body.data.previousDecision} → ${r.body.data.decision} · override → ${r.body.data.overridePriority}`
        : `Triage ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

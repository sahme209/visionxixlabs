/**
 * POST /api/dashboard/deployment-incident-transition — Phase 501.
 * Body: { incidentId, action: "mitigate" | "resolve" | "reopen" | "wont_fix" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildIncidentTransitionResponse,
  type DeploymentIncidentRepo,
  INCIDENT_TRANSITIONS,
  type IncidentTransition,
} from "@/lib/releaseops/deploymentIncidentResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { incidentId?: unknown; action?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const incidentId = typeof body.incidentId === "string" ? body.incidentId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (INCIDENT_TRANSITIONS as readonly string[]).includes(action);
  if (!incidentId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { incidentId, action: 'mitigate'|'resolve'|'reopen'|'wont_fix' }." },
      { status: 400 },
    );
  }

  const r = await buildIncidentTransitionResponse(
    prisma as unknown as DeploymentIncidentRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      incidentId,
      action: action as IncidentTransition,
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `deployment_incident.${action}`,
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: `Incident ${r.body.data.previousStatus} → ${r.body.data.status}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

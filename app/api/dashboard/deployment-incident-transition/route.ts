/**
 * POST /api/dashboard/deployment-incident-transition — Phase 501.
 * Body: { incidentId, action: "mitigate" | "resolve" | "reopen" | "wont_fix" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildIncidentTransitionResponse,
  INCIDENT_TRANSITIONS,
  type IncidentTransition,
} from "@/lib/releaseops/deploymentIncidentResponder";

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

  const { organizationId, userId } = ctx;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const transition = await buildIncidentTransitionResponse(tx, {
        organizationId,
        actorUserId: userId,
        incidentId,
        action: action as IncidentTransition,
      });
      if (!transition.body.ok) return transition;

      const { id, previousStatus, status } = transition.body.data;
      await tx.auditEvent.create({
        data: {
          organizationId,
          kind: `deployment_incident.${action}`,
          subjectKind: "release",
          subjectId: id,
          outcome: "ok",
          summary: `Incident ${previousStatus} → ${status}`,
          actorUserId: userId,
        },
      });
      return transition;
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ ok: false, error: "incident_transition_unavailable" }, { status: 503 });
  }
}

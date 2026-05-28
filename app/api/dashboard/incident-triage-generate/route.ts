/**
 * POST /api/dashboard/incident-triage-generate — Phase 509.
 * Body: { incidentId, businessImpactHint? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildTriageGenerateResponse,
  type IncidentTriageRepo,
} from "@/lib/releaseops/incidentTriageResponder";
import {
  aggregateIncidentTriageInputs,
  type IncidentTriageAggregateRepo,
} from "@/lib/releaseops/incidentTriageAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { incidentId?: unknown; businessImpactHint?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const incidentId = typeof body.incidentId === "string" ? body.incidentId : null;
  if (!incidentId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { incidentId }." },
      { status: 400 },
    );
  }
  const businessImpactHint = typeof body.businessImpactHint === "string" ? body.businessImpactHint : null;

  const aggregated = await aggregateIncidentTriageInputs(
    prisma as unknown as IncidentTriageAggregateRepo,
    { organizationId: ctx.organizationId, incidentId, businessImpactHint },
  );
  if (!aggregated.ok) {
    const status = aggregated.error === "incident_not_found" || aggregated.error === "release_not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: aggregated.error }, { status });
  }

  const r = await buildTriageGenerateResponse(
    prisma as unknown as IncidentTriageRepo,
    { organizationId: ctx.organizationId, incidentId, engineInputs: aggregated.inputs },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "incident_triage.generate",
      subjectKind: "release", // incident is owned by release in this domain
      subjectId: incidentId,
      summary: `Incident triage: ${r.body.data.triage.priority} · ${r.body.data.triage.suggestedOwnerTeam} · ETA ${r.body.data.triage.estimatedTimeToMitigateMinutes}min`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

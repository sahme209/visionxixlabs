/**
 * POST /api/dashboard/deployment-incident-report — Phase 501.
 * Body: { releaseId, severity, title, summary?, externalUrl? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildIncidentReportResponse,
  type DeploymentIncidentRepo,
} from "@/lib/releaseops/deploymentIncidentResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import {
  buildTriageGenerateResponse,
  type IncidentTriageRepo,
} from "@/lib/releaseops/incidentTriageResponder";
import {
  aggregateIncidentTriageInputs,
  type IncidentTriageAggregateRepo,
} from "@/lib/releaseops/incidentTriageAggregator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { releaseId?: unknown; severity?: unknown; title?: unknown; summary?: unknown; externalUrl?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const severity = typeof body.severity === "string" ? body.severity : null;
  const title = typeof body.title === "string" ? body.title : null;
  if (!releaseId || !severity || !title) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, severity, title }." },
      { status: 400 },
    );
  }

  const r = await buildIncidentReportResponse(
    prisma as unknown as DeploymentIncidentRepo,
    {
      organizationId: ctx.organizationId,
      reportedByUserId: ctx.userId,
      releaseId, severity, title,
      ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
      ...(typeof body.externalUrl === "string" ? { externalUrl: body.externalUrl } : {}),
    },
  );

  if (r.body.ok) {
    const incidentId = r.body.data.incident.id;
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "deployment_incident.report",
      subjectKind: "release",
      subjectId: releaseId,
      summary: `[${r.body.data.incident.severity}] ${r.body.data.incident.title}`,
      actorUserId: ctx.userId,
    });

    // Phase 510 — auto-trigger triage immediately on incident report.
    // Best-effort: failures don't block the report response.
    try {
      const aggregated = await aggregateIncidentTriageInputs(
        prisma as unknown as IncidentTriageAggregateRepo,
        {
          organizationId: ctx.organizationId,
          incidentId,
          businessImpactHint: typeof body.summary === "string" ? body.summary : null,
        },
      );
      if (aggregated.ok) {
        await buildTriageGenerateResponse(
          prisma as unknown as IncidentTriageRepo,
          { organizationId: ctx.organizationId, incidentId, engineInputs: aggregated.inputs },
        );
      }
    } catch {
      // Triage is observability — never block the incident report.
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}

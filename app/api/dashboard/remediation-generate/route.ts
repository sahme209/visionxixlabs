/**
 * POST /api/dashboard/remediation-generate — Phase 512.
 * Body: { incidentId }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildRemediationGenerateResponse,
  type RemediationRepo,
} from "@/lib/releaseops/remediationProposalResponder";
import {
  aggregateRemediationInputs,
  type RemediationAggregateRepo,
} from "@/lib/releaseops/remediationProposalAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { incidentId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const incidentId = typeof body.incidentId === "string" ? body.incidentId : null;
  if (!incidentId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { incidentId }." },
      { status: 400 },
    );
  }

  const aggregated = await aggregateRemediationInputs(
    prisma as unknown as RemediationAggregateRepo,
    { organizationId: ctx.organizationId, incidentId },
  );
  if (!aggregated.ok) {
    const status =
      aggregated.error === "incident_not_found" ? 404 :
      aggregated.error === "release_not_found" ? 404 :
      aggregated.error === "triage_not_found" ? 409 :
      403;
    return NextResponse.json({ ok: false, error: aggregated.error, hint: aggregated.hint }, { status });
  }

  const r = await buildRemediationGenerateResponse(
    prisma as unknown as RemediationRepo,
    {
      organizationId: ctx.organizationId,
      incidentId,
      triageId: aggregated.triageId,
      engineInputs: aggregated.inputs,
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "remediation.generate",
      subjectKind: "release",
      subjectId: incidentId,
      summary: r.body.data.primary
        ? `Remediation primary: ${r.body.data.primary.title}`
        : `Remediation: ${r.body.data.proposalCount} proposal(s) — engine recommends no action`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

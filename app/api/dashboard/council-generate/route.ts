/**
 * POST /api/dashboard/council-generate — Phase 514.
 * Body: { releaseId }
 *
 * Runs the multi-voter advisor council on the given release. Reuses
 * the existing advisor input aggregator.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildCouncilGenerateResponse,
  type AdvisorCouncilRepo,
} from "@/lib/releaseops/advisorCouncilResponder";
import {
  aggregateAdvisorInputs,
  type AdvisorInputsRepo,
} from "@/lib/releaseops/advisorInputsAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { releaseId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  if (!releaseId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId }." },
      { status: 400 },
    );
  }

  const agg = await aggregateAdvisorInputs(
    prisma as unknown as AdvisorInputsRepo,
    { organizationId: ctx.organizationId, releaseId },
  );
  if (!agg.ok) {
    const status = agg.error === "release_not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: agg.error }, { status });
  }

  const r = await buildCouncilGenerateResponse(
    prisma as unknown as AdvisorCouncilRepo,
    { organizationId: ctx.organizationId, releaseId, engineInputs: agg.inputs },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "advisor_council.generate",
      subjectKind: "release",
      subjectId: releaseId,
      summary: `Council ${r.body.data.decision.consensusKind} · ${r.body.data.decision.agreementScore}% agreement`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

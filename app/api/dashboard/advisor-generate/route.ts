/**
 * POST /api/dashboard/advisor-generate — Phase 506.
 *
 * Body: { releaseId }
 *
 * Aggregates the release's full state, runs the autonomous advisor
 * engine, supersedes prior pending recs for the release, and
 * persists the new batch.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAdvisorGenerateResponse,
  type AdvisorRepo,
} from "@/lib/releaseops/advisorRecommendationResponder";
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

  const aggregated = await aggregateAdvisorInputs(
    prisma as unknown as AdvisorInputsRepo,
    { organizationId: ctx.organizationId, releaseId },
  );
  if (!aggregated.ok) {
    if (aggregated.error === "release_not_found") {
      return NextResponse.json({ ok: false, error: aggregated.error }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: aggregated.error }, { status: 403 });
  }

  const r = await buildAdvisorGenerateResponse(
    prisma as unknown as AdvisorRepo,
    {
      organizationId: ctx.organizationId,
      releaseId,
      engineInputs: aggregated.inputs,
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "advisor.generate",
      subjectKind: "release",
      subjectId: releaseId,
      summary: r.body.data.primary
        ? `Advisor primary: ${r.body.data.primary.title}`
        : `Advisor: ${r.body.data.recommendationCount} recommendation(s) — clear to proceed`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

/**
 * POST /api/dashboard/release-create — Phase 498.
 * Body: { applicationId, releaseTag, commitSha?, plannedWindowStartIso?, plannedWindowEndIso?, summary? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseCreateResponse,
  type ReleaseCreateRepo,
} from "@/lib/releaseops/releaseCreateResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: {
    applicationId?: unknown;
    releaseTag?: unknown;
    commitSha?: unknown;
    plannedWindowStartIso?: unknown;
    plannedWindowEndIso?: unknown;
    summary?: unknown;
  } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const applicationId = typeof body.applicationId === "string" ? body.applicationId : null;
  const releaseTag = typeof body.releaseTag === "string" ? body.releaseTag : null;
  if (!applicationId || !releaseTag) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { applicationId, releaseTag, ... }." },
      { status: 400 },
    );
  }

  const r = await buildReleaseCreateResponse(
    prisma as unknown as ReleaseCreateRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      applicationId, releaseTag,
      ...(typeof body.commitSha === "string" ? { commitSha: body.commitSha } : {}),
      ...(typeof body.plannedWindowStartIso === "string" ? { plannedWindowStartIso: body.plannedWindowStartIso } : {}),
      ...(typeof body.plannedWindowEndIso === "string" ? { plannedWindowEndIso: body.plannedWindowEndIso } : {}),
      ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
    },
  );

  if (r.body.ok && r.body.data.created) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "release.create",
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: `Created release ${r.body.data.releaseTag} (draft)`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

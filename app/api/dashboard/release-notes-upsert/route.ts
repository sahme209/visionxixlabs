/**
 * POST /api/dashboard/release-notes-upsert — Phase 500.
 * Body: { releaseId, bullets: string[], headline?, source? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseNotesUpsertResponse,
  type ReleaseNotesRepo,
  type ReleaseNotesSource,
} from "@/lib/releaseops/releaseNotesResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { releaseId?: unknown; bullets?: unknown; headline?: unknown; source?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  if (!releaseId || !Array.isArray(body.bullets)) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, bullets: string[] }." },
      { status: 400 },
    );
  }
  const bullets = body.bullets.filter((b): b is string => typeof b === "string");
  const source = (body.source === "manual" || body.source === "ai" || body.source === "imported")
    ? body.source as ReleaseNotesSource
    : undefined;

  const r = await buildReleaseNotesUpsertResponse(
    prisma as unknown as ReleaseNotesRepo,
    {
      organizationId: ctx.organizationId,
      releaseId, bullets,
      ...(typeof body.headline === "string" ? { headline: body.headline } : {}),
      ...(source ? { source } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "release_notes.upsert",
      subjectKind: "release",
      subjectId: releaseId,
      summary: `Saved release notes draft (${r.body.data.draft.bullets.length} bullets)`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

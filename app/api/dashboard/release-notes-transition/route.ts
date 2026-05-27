/**
 * POST /api/dashboard/release-notes-transition — Phase 500.
 * Body: { releaseId, action: "review" | "publish" | "revoke", publishedUrl? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseNotesTransitionResponse,
  type ReleaseNotesRepo,
  RELEASE_NOTES_TRANSITIONS,
  type ReleaseNotesTransition,
} from "@/lib/releaseops/releaseNotesResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { releaseId?: unknown; action?: unknown; publishedUrl?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const actionStr = typeof body.action === "string" ? body.action : null;
  const isValidAction = actionStr && (RELEASE_NOTES_TRANSITIONS as readonly string[]).includes(actionStr);
  if (!releaseId || !isValidAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, action: 'review'|'publish'|'revoke' }." },
      { status: 400 },
    );
  }

  const r = await buildReleaseNotesTransitionResponse(
    prisma as unknown as ReleaseNotesRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      releaseId,
      action: actionStr as ReleaseNotesTransition,
      ...(typeof body.publishedUrl === "string" ? { publishedUrl: body.publishedUrl } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `release_notes.${actionStr}`,
      subjectKind: "release",
      subjectId: releaseId,
      summary: `Release notes ${r.body.data.previousStatus} → ${r.body.data.status}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

/**
 * POST /api/dashboard/release-create — Phase 498.
 * Body: { applicationId, releaseTag, commitSha?, plannedWindowStartIso?, plannedWindowEndIso?, summary?, repositoryId? }
 *
 * repositoryId (optional) binds this release's GitHub evidence source
 * once, at creation time — see releaseRepositoryBinding design notes in
 * lib/releaseops/releaseCreateResponder.ts and
 * lib/releaseops/githubInstallationCoverage.ts. There is no later
 * "rebind" endpoint; a release's evidence provenance is immutable once
 * set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseCreateResponse,
  type ReleaseCreateRepo,
} from "@/lib/releaseops/releaseCreateResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { verifyRepositoryCoveredByInstallation, type InstallationRepo } from "@/lib/releaseops/githubInstallationCoverage";

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
    repositoryId?: unknown;
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

  const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : null;
  if (repositoryId) {
    const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repository || repository.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: "repository_not_found" }, { status: 404 });
    }
    if (repository.provider !== "github") {
      return NextResponse.json(
        { ok: false, error: "repository_not_github", hint: "Evidence binding supports GitHub repositories only today." },
        { status: 422 },
      );
    }
    // Live check — self-reported Repository rows (repositoryCreateResponder.ts)
    // are never otherwise validated against GitHub. This is the actual
    // "validated against the installed GitHub selection" gate: fails
    // closed (no release created) rather than silently dropping the
    // binding, so the operator isn't left thinking evidence is wired up
    // when it isn't.
    const coverage = await verifyRepositoryCoveredByInstallation(
      prisma as unknown as InstallationRepo,
      ctx.organizationId,
      repository.remoteName,
    );
    if (!coverage.ok) {
      return NextResponse.json({ ok: false, error: coverage.reason }, { status: 409 });
    }
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
      ...(repositoryId ? { repositoryId } : {}),
    },
  );

  if (r.body.ok && r.body.data.created) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "release.create",
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: r.body.data.evidenceRepositoryId
        ? `Created release ${r.body.data.releaseTag} (draft) · evidence repository bound`
        : `Created release ${r.body.data.releaseTag} (draft)`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

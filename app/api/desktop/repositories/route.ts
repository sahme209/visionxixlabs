/**
 * GET  /api/desktop/repositories
 * POST /api/desktop/repositories
 * Body (POST): { provider, remoteOwner, remoteName, remoteUrl?, defaultBranch?, repoFlavor? }
 *
 * Desktop-session equivalent of /api/dashboard/repository-list and
 * repository-create — see docs on why the web dashboard can't be the
 * real surface for this (proxy.ts redirects it away in every browser).
 * Create is admin-gated; list is open to any paired session.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildRepositoryListResponse, type RepositoryListRepo } from "@/lib/releaseops/repositoryListResponder";
import { buildRepositoryCreateResponse, type RepositoryCreateRepo } from "@/lib/releaseops/repositoryCreateResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/repositories",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const r = await buildRepositoryListResponse(prisma as unknown as RepositoryListRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/repositories",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    provider?: unknown; remoteOwner?: unknown; remoteName?: unknown; remoteUrl?: unknown; defaultBranch?: unknown; repoFlavor?: unknown;
  } | null;
  const provider = typeof body?.provider === "string" ? body.provider : null;
  const remoteOwner = typeof body?.remoteOwner === "string" ? body.remoteOwner : null;
  const remoteName = typeof body?.remoteName === "string" ? body.remoteName : null;
  if (!provider || !remoteOwner || !remoteName) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await buildRepositoryCreateResponse(prisma as unknown as RepositoryCreateRepo, {
    organizationId: String(session.organizationId),
    provider, remoteOwner, remoteName,
    ...(typeof body?.remoteUrl === "string" ? { remoteUrl: body.remoteUrl } : {}),
    ...(typeof body?.defaultBranch === "string" ? { defaultBranch: body.defaultBranch } : {}),
    ...(typeof body?.repoFlavor === "string" ? { repoFlavor: body.repoFlavor } : {}),
  });

  if (r.body.ok && r.body.data.created) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "repository.create",
        subjectKind: "repository",
        subjectId: r.body.data.id,
        summary: `Registered ${provider} repo ${r.body.data.displayName} from desktop`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}

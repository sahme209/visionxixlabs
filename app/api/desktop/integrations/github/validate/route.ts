/**
 * POST /api/desktop/integrations/github/validate
 *
 * Confirms a tenant's active GitHub App installation can mint a scoped token
 * and perform one harmless read. No token, repository name, or provider body
 * is returned to the desktop. This is the only transition from
 * "installation recorded" to "validated read-only".
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InstallationRow {
  id: string;
  githubInstallationId: string;
}

interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: "active" };
      orderBy: { installedAt: "desc" };
      select: { id: true; githubInstallationId: true };
    }): Promise<InstallationRow | null>;
    update(args: { where: { id: string }; data: { lastSeenAt: Date } }): Promise<unknown>;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/integrations/github/validate",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const repo = prisma as unknown as InstallationRepo & AuditEventRepo;
  let installation: InstallationRow | null;
  try {
    installation = await repo.gitHubInstallation.findFirst({
      where: { organizationId: session.organizationId, status: "active" },
      orderBy: { installedAt: "desc" },
      select: { id: true, githubInstallationId: true },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "github_installation_unavailable" }, { status: 503 });
  }
  if (!installation) return NextResponse.json({ ok: false, error: "github_not_connected" }, { status: 409 });

  const token = await resolveGithubInstallationToken({ installationId: Number(installation.githubInstallationId) });
  if (!token.ok) {
    await recordValidationAudit(repo, session, installation.id, request, "error", "GitHub App read-only validation could not mint an installation token.");
    return NextResponse.json({ ok: false, error: "github_read_validation_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.github.com/installation/repositories?per_page=1", {
      headers: {
        Authorization: `Bearer ${token.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "axiom-agent/1.0",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("github_read_validation_failed");

    await repo.gitHubInstallation.update({ where: { id: installation.id }, data: { lastSeenAt: new Date() } });
    await recordValidationAudit(repo, session, installation.id, request, "ok", "GitHub App installation completed a scoped, read-only validation.");
    return NextResponse.json({ ok: true, data: { status: "validated_read_only" } });
  } catch {
    await recordValidationAudit(repo, session, installation.id, request, "error", "GitHub App read-only validation failed.");
    return NextResponse.json({ ok: false, error: "github_read_validation_failed" }, { status: 503 });
  }
}

async function recordValidationAudit(
  repo: AuditEventRepo,
  session: { organizationId: string; userId: string },
  installationId: string,
  request: NextRequest,
  outcome: "ok" | "error",
  summary: string,
): Promise<void> {
  await appendAuditEvent(repo, {
    organizationId: session.organizationId,
    kind: "github_installation.read_validation",
    subjectKind: "repository",
    subjectId: installationId,
    outcome,
    summary,
    actorUserId: session.userId,
    correlationId: request.headers.get("x-correlation-id"),
  });
}

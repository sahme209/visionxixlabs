/**
 * POST /api/desktop/github/commit
 *
 * Creates or updates a single file on a branch of a tenant-connected
 * GitHub repository. Same gate as the branch-create route: a real
 * paired desktop session held by a workspace owner/admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { commitFile } from "@/lib/connectors/github/githubWriteClient";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/github/commit",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryFullName?: unknown;
    branch?: unknown;
    path?: unknown;
    content?: unknown;
    message?: unknown;
  } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
  const path = typeof body?.path === "string" ? body.path.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!repositoryFullName || !branch || !path || !message) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });

  const result = await commitFile({
    owner: repo.owner,
    repo: repo.repo,
    branch,
    path,
    content,
    message,
    installationToken: tokenResult.token,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  try {
    // Never audit file content — only identifiers.
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: idFactory.user(String(session.userId)),
      actorKind: "user",
      action: "github.file_committed",
      outcome: "success",
      entityRef: `github_repo:${repositoryFullName}`,
      correlationId: idFactory.correlation(`github_commit_${Date.now().toString(36)}`),
      source: "live",
      detail: { repositoryFullName, branch, path },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: result.data });
}

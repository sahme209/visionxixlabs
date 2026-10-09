/**
 * POST /api/desktop/github/pull-request
 *
 * Opens a real pull request on a tenant-connected GitHub repository.
 * Same gate as the branch-create and commit routes: a real paired
 * desktop session held by a workspace owner/admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createPullRequest } from "@/lib/connectors/github/githubWriteClient";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/github/pull-request",
    allowApiKey: false,
    requiredCapability: "github:write",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryFullName?: unknown;
    head?: unknown;
    base?: unknown;
    title?: unknown;
    body?: unknown;
  } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const head = typeof body?.head === "string" ? body.head.trim() : "";
  const base = typeof body?.base === "string" ? body.base.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const prBody = typeof body?.body === "string" ? body.body : "";
  if (!repositoryFullName || !head || !base || !title) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });

  const result = await createPullRequest({
    owner: repo.owner,
    repo: repo.repo,
    head,
    base,
    title,
    body: prBody,
    installationToken: tokenResult.token,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  try {
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: idFactory.user(String(session.userId)),
      actorKind: "user",
      action: "github.pull_request_opened",
      outcome: "success",
      entityRef: `github_repo:${repositoryFullName}`,
      correlationId: idFactory.correlation(`github_pr_${Date.now().toString(36)}`),
      source: "live",
      detail: { repositoryFullName, head, base, pullRequestNumber: result.data.number },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: result.data });
}

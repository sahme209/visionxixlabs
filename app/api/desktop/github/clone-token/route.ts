/**
 * POST /api/desktop/github/clone-token
 *
 * Mints a short-lived, repo-scoped GitHub App installation token embedded
 * in an HTTPS clone URL, for the desktop app's local `git clone` to use
 * once and discard. The token is never stored by the desktop app — it's
 * a GitHub App installation token, which already expires in ~1 hour on
 * GitHub's own side regardless of what the client does with it.
 *
 * Read-only in effect (cloning doesn't write to GitHub), but still
 * admin-gated and tenant-scoped like the write routes, since it mints a
 * real credential capable of reading the repository's full contents.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/github/clone-token",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { repositoryFullName?: unknown } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  if (!repositoryFullName) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });

  const cloneUrl = `https://x-access-token:${tokenResult.token}@github.com/${repo.owner}/${repo.repo}.git`;

  try {
    // Never audit the token itself — only that a clone URL was minted.
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: idFactory.user(String(session.userId)),
      actorKind: "user",
      action: "github.clone_token_minted",
      outcome: "success",
      entityRef: `github_repo:${repositoryFullName}`,
      correlationId: idFactory.correlation(`github_clone_${Date.now().toString(36)}`),
      source: "live",
      detail: { repositoryFullName },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: { cloneUrl } });
}

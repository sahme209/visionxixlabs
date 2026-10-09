/**
 * POST /api/desktop/github/clone-token
 *
 * Mints a short-lived, repo-scoped GitHub App installation token embedded
 * in an HTTPS clone URL, for the desktop app's local `git clone` to use
 * for one clone, pull, or push process and then discard. The token is never
 * stored by the desktop app — it's a GitHub App installation token, which
 * already expires in ~1 hour on GitHub's own side regardless of what the
 * client does with it.
 *
 * Capability-gated and tenant-scoped because it mints a real credential. The
 * server resolves a GitHub App installation token scoped to exactly the
 * requested repository; the desktop never receives a tenant-wide token.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { getRepositoryDefaultBranch } from "@/lib/connectors/github/githubWriteClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/github/clone-token",
    allowApiKey: false,
    requiredCapability: "github:write",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { repositoryFullName?: unknown; purpose?: unknown; branch?: unknown } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const purpose = body?.purpose === "pull" || body?.purpose === "push" ? body.purpose : "clone";
  const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
  if (!repositoryFullName) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });
  if (purpose === "push") {
    if (!branch) return NextResponse.json({ ok: false, error: "push_branch_required" }, { status: 400 });
    const defaultBranch = await getRepositoryDefaultBranch({ owner: repo.owner, repo: repo.repo, installationToken: tokenResult.token });
    if (!defaultBranch.ok) return NextResponse.json({ ok: false, error: defaultBranch.error }, { status: 502 });
    if (branch === defaultBranch.data) {
      return NextResponse.json({ ok: false, error: "github_pull_request_cycle_required" }, { status: 409 });
    }
  }

  const cloneUrl = `https://x-access-token:${tokenResult.token}@github.com/${repo.owner}/${repo.repo}.git`;

  try {
    // Never audit the token itself — only that an operation URL was minted.
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: idFactory.user(String(session.userId)),
      actorKind: "user",
      action: `github.${purpose}_token_minted`,
      outcome: "success",
      entityRef: `github_repo:${repositoryFullName}`,
      correlationId: idFactory.correlation(`github_clone_${Date.now().toString(36)}`),
      source: "live",
      detail: { repositoryFullName, purpose, ...(branch ? { branch } : {}) },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: { cloneUrl } });
}

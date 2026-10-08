/**
 * GET /api/desktop/github/branches?repositoryFullName=owner/repository
 *
 * Returns read-only branch metadata using a token minted for exactly the
 * selected tenant repository. Installation credentials never reach desktop.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { listBranches } from "@/lib/connectors/github/githubWriteClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/github/branches",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const repositoryFullName = request.nextUrl.searchParams.get("repositoryFullName")?.trim() ?? "";
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });

  const result = await listBranches({
    owner: repo.owner,
    repo: repo.repo,
    installationToken: tokenResult.token,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: "github_branches_unavailable" }, { status: 502 });

  return NextResponse.json({ ok: true, data: { branches: result.data, truncated: result.data.length === 1_000 } });
}

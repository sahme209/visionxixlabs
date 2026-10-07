/**
 * GET /api/desktop/github/repositories
 *
 * Lists repositories visible to this tenant's active GitHub App installation.
 * The installation token remains server-side. Only clone-safe repository
 * metadata is returned to an authenticated workspace administrator.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: "active" };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true };
    }): Promise<{ githubInstallationId: string } | null>;
  };
}

interface GitHubRepository {
  id?: unknown;
  name?: unknown;
  full_name?: unknown;
  private?: unknown;
  default_branch?: unknown;
  owner?: { login?: unknown };
}

interface GitHubRepositoryResponse {
  total_count?: unknown;
  repositories?: unknown;
}

const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function isSafeBranchName(value: string): boolean {
  return value.length > 0 && value.length <= 240 && !value.startsWith("-") && !/[\0\r\n]/.test(value);
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/github/repositories",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const repository = prisma as unknown as InstallationRepo;
  const installation = await repository.gitHubInstallation.findFirst({
    where: { organizationId: String(session.organizationId), status: "active" },
    orderBy: { installedAt: "desc" },
    select: { githubInstallationId: true },
  }).catch(() => null);
  if (!installation) return NextResponse.json({ ok: false, error: "github_not_connected" }, { status: 409 });

  const token = await resolveGithubInstallationToken({ installationId: Number(installation.githubInstallationId) });
  if (!token.ok) return NextResponse.json({ ok: false, error: "github_token_unavailable" }, { status: 503 });

  let response: Response;
  try {
    response = await fetch("https://api.github.com/installation/repositories?per_page=100&page=1", {
      headers: {
        Authorization: `Bearer ${token.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "axiom-agent/1.0",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 502 });

  const body = await response.json().catch(() => null) as GitHubRepositoryResponse | null;
  const rawRepositories = Array.isArray(body?.repositories) ? body.repositories as GitHubRepository[] : [];
  const repositories = rawRepositories.flatMap((item) => {
    if (typeof item.id !== "number" || typeof item.name !== "string" || typeof item.full_name !== "string") return [];
    if (typeof item.default_branch !== "string" || typeof item.private !== "boolean" || typeof item.owner?.login !== "string") return [];
    if (!GITHUB_NAME.test(item.name) || !GITHUB_NAME.test(item.owner.login) || !isSafeBranchName(item.default_branch)) return [];
    const fullName = `${item.owner.login}/${item.name}`;
    if (item.full_name.toLowerCase() !== fullName.toLowerCase()) return [];
    return [{
      id: String(item.id),
      name: item.name,
      fullName,
      owner: item.owner.login,
      defaultBranch: item.default_branch,
      visibility: item.private ? "private" as const : "public" as const,
    }];
  }).sort((left, right) => left.fullName.localeCompare(right.fullName));
  const totalCount = typeof body?.total_count === "number" && Number.isSafeInteger(body.total_count)
    ? Math.max(body.total_count, repositories.length)
    : repositories.length;

  return NextResponse.json({
    ok: true,
    data: { repositories, totalCount, truncated: totalCount > repositories.length },
  });
}

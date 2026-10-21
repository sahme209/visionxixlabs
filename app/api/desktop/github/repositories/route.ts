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
import { readBoundedGithubBody, withGithubAbort } from "@/lib/connectors/github/boundedGithubRead";
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
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_PAGE_BYTES = 2_000_000;

async function readRepositoryPage(response: Response, signal: AbortSignal): Promise<GitHubRepositoryResponse> {
  const bytes = await readBoundedGithubBody(response, signal, MAX_PAGE_BYTES);
  const value: unknown = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_repository_page");
  const page = value as GitHubRepositoryResponse;
  if (!Array.isArray(page.repositories) || page.repositories.length > PAGE_SIZE || (page.total_count !== undefined
    && (typeof page.total_count !== "number" || !Number.isSafeInteger(page.total_count) || page.total_count < 0))) {
    throw new Error("invalid_repository_page");
  }
  return page;
}

function isSafeBranchName(value: string): boolean {
  return value.length > 0 && value.length <= 240 && !value.startsWith("-") && !/[\0\r\n]/.test(value);
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/github/repositories",
    allowApiKey: false,
    requiredCapability: "github:read",
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

  const pageAbort = new AbortController();
  const receivedResponses = new Set<Response>();
  const abortPages = () => pageAbort.abort();
  request.signal.addEventListener("abort", abortPages, {once: true});
  if (request.signal.aborted) pageAbort.abort();
  try {
    const fetchPage = (page: number) => {
      pageAbort.signal.throwIfAborted();
      const response = fetch(`https://api.github.com/installation/repositories?per_page=${PAGE_SIZE}&page=${page}`, {
        headers: {
          Authorization: `Bearer ${token.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "axiom-agent/1.0",
        },
        cache: "no-store",
        redirect: "error",
        signal: pageAbort.signal,
      }).then(response => {
        if (pageAbort.signal.aborted) {
          void response.body?.cancel().catch(() => {});
          throw new Error("repository_read_aborted");
        }
        receivedResponses.add(response);
        return response;
      });
      return withGithubAbort(response, pageAbort.signal);
    };

    let firstResponse: Response;
    try {
      firstResponse = await fetchPage(1);
    } catch {
      return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 503 });
    }

    let firstBody: GitHubRepositoryResponse;
    try { firstBody = await readRepositoryPage(firstResponse, pageAbort.signal); }
    catch { return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 502 }); }
    const reportedTotal = typeof firstBody?.total_count === "number" && Number.isSafeInteger(firstBody.total_count)
      ? Math.max(0, firstBody.total_count)
      : Array.isArray(firstBody?.repositories) ? firstBody.repositories.length : 0;
    const pageCount = Math.min(MAX_PAGES, Math.max(1, Math.ceil(reportedTotal / PAGE_SIZE)));
    const remainingBodies: GitHubRepositoryResponse[] = [];
    if (pageCount > 1) {
      let responses: Response[];
      try {
        responses = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(index + 2)));
      } catch {
        return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 503 });
      }
      try {
        // Fetch headers in parallel, but consume bodies one at a time so a bad
        // page cannot leave sibling readers running after returning an error.
        for (const response of responses) remainingBodies.push(await readRepositoryPage(response, pageAbort.signal));
      } catch {
        for (const response of responses) void response.body?.cancel().catch(() => {});
        return NextResponse.json({ ok: false, error: "github_repositories_unavailable" }, { status: 502 });
      }
    }
    const rawRepositories = [firstBody, ...remainingBodies].flatMap((body) => Array.isArray(body?.repositories) ? body.repositories as GitHubRepository[] : []);
    const repositories = rawRepositories.flatMap((item) => {
      if (!item || typeof item !== "object" || typeof item.id !== "number" || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name !== "string" || typeof item.full_name !== "string") return [];
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
    const totalCount = Math.max(reportedTotal, repositories.length);

    return NextResponse.json({
      ok: true,
      data: { repositories, totalCount, truncated: totalCount > repositories.length },
    });
  } finally {
    pageAbort.abort();
    request.signal.removeEventListener("abort", abortPages);
    for (const response of receivedResponses) void response.body?.cancel().catch(() => {});
  }

}

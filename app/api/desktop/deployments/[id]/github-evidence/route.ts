/**
 * POST /api/desktop/deployments/:id/github-evidence
 *
 * Captures a narrow, read-only snapshot from GitHub for repositories and pull
 * requests already recorded on a governed deployment request. This endpoint
 * never dispatches a workflow, changes a pull request, creates a deployment,
 * or returns an installation token.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { getDeploymentRequest, type DeploymentRequestRepo } from "@/lib/tauri/deploymentRequestRepo";
import { parseDeploymentIntake } from "@/lib/tauri/deploymentIntakeSchema";
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
import {
  parseGithubPullRequestUrl,
  sameGithubRepository,
  uniqueGithubRepositories,
  type GithubPullRequestRef,
  type GithubRepositoryRef,
} from "@/lib/connectors/github/releaseEvidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InstallationRow { githubInstallationId: string }

interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: "active" };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true };
    }): Promise<InstallationRow | null>;
  };
}

interface GithubRepositoryBody {
  archived?: boolean;
  disabled?: boolean;
  default_branch?: string;
}

interface GithubBranchBody { protected?: boolean }

interface GithubPullBody {
  state?: string;
  draft?: boolean;
  merged?: boolean;
  head?: { sha?: string };
  base?: { ref?: string };
}

interface GithubChecksBody {
  total_count?: number;
  check_runs?: Array<{ status?: string; conclusion?: string | null }>;
}

interface GithubWorkflowRunsBody {
  workflow_runs?: Array<{ status?: string; conclusion?: string | null }>;
}

type EvidenceState = "observed" | "unavailable";

interface RepositoryEvidence {
  repository: string;
  state: EvidenceState;
  branchProtection: "protected" | "not_protected" | "unavailable";
  repositoryEnabled: boolean | null;
  latestWorkflow: "passed" | "failed" | "in_progress" | "not_reported" | "unavailable";
}

interface PullRequestEvidence {
  repository: string;
  number: number;
  state: EvidenceState;
  pullRequestState: "open" | "closed" | "merged" | "draft" | "unknown";
  targetBranchMatches: boolean | null;
  checks: "passed" | "failed" | "in_progress" | "not_reported" | "unavailable";
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "axiom-agent/1.0",
  };
}

function githubPath(ref: GithubRepositoryRef): string {
  return `${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repository)}`;
}

async function getJson<T>(path: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: githubHeaders(token),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function toChecks(body: GithubChecksBody | null): PullRequestEvidence["checks"] {
  if (!body) return "unavailable";
  if (!body.total_count || !body.check_runs?.length) return "not_reported";
  const runs = body.check_runs;
  if (runs.some((run) => run.status !== "completed")) return "in_progress";
  return runs.every((run) => ["success", "neutral", "skipped"].includes(run.conclusion ?? ""))
    ? "passed"
    : "failed";
}

function toWorkflowState(body: GithubWorkflowRunsBody | null): RepositoryEvidence["latestWorkflow"] {
  const run = body?.workflow_runs?.[0];
  if (!body) return "unavailable";
  if (!run) return "not_reported";
  if (run.status !== "completed") return "in_progress";
  return ["success", "neutral", "skipped"].includes(run.conclusion ?? "") ? "passed" : "failed";
}

function toPullRequestState(body: GithubPullBody): PullRequestEvidence["pullRequestState"] {
  if (body.merged) return "merged";
  if (body.draft) return "draft";
  if (body.state === "open") return "open";
  if (body.state === "closed") return "closed";
  return "unknown";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/deployments/:id/github-evidence",
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const { id } = await params;
  const repo = prisma as unknown as DeploymentRequestRepo & InstallationRepo & AuditEventRepo;
  const deployment = await getDeploymentRequest(repo, String(session.organizationId), id);
  if (!deployment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const parsed = parseDeploymentIntake(deployment.intakeJson);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "deployment_request_context_unavailable" }, { status: 422 });

  const installation = await repo.gitHubInstallation.findFirst({
    where: { organizationId: String(session.organizationId), status: "active" },
    orderBy: { installedAt: "desc" },
    select: { githubInstallationId: true },
  }).catch(() => null);
  if (!installation) return NextResponse.json({ ok: false, error: "github_not_connected" }, { status: 409 });

  const intake = parsed.intake;
  const repositories = uniqueGithubRepositories(intake.repositoryUrls);
  if (!repositories.length) return NextResponse.json({ ok: false, error: "github_repository_urls_required" }, { status: 422 });

  const installationId = Number(installation.githubInstallationId);
  const token = await resolveGithubInstallationToken({
    installationId,
    repositories: repositories.map((repository) => repository.repository),
  });
  if (!token.ok) return NextResponse.json({ ok: false, error: "github_read_validation_unavailable" }, { status: 503 });

  const repositoryEvidence = await Promise.all(repositories.map(async (ref): Promise<RepositoryEvidence> => {
    const path = githubPath(ref);
    const source = await getJson<GithubRepositoryBody>(`/repos/${path}`, token.token);
    if (!source) {
      return {
        repository: `${ref.owner}/${ref.repository}`,
        state: "unavailable",
        branchProtection: "unavailable",
        repositoryEnabled: null,
        latestWorkflow: "unavailable",
      };
    }
    const branchName = intake.targetBranch.trim() || source.default_branch;
    const workflowBranch = intake.sourceBranch.trim() || source.default_branch;
    const [branch, workflows] = await Promise.all([
      branchName
        ? getJson<GithubBranchBody>(`/repos/${path}/branches/${encodeURIComponent(branchName)}`, token.token)
        : null,
      workflowBranch
        ? getJson<GithubWorkflowRunsBody>(`/repos/${path}/actions/runs?branch=${encodeURIComponent(workflowBranch)}&per_page=1`, token.token)
        : null,
    ]);
    return {
      repository: `${ref.owner}/${ref.repository}`,
      state: "observed",
      branchProtection: branch ? (branch.protected ? "protected" : "not_protected") : "unavailable",
      repositoryEnabled: !source.archived && !source.disabled,
      latestWorkflow: toWorkflowState(workflows),
    };
  }));

  const pullRequestRefs = intake.productionPrUrls
    .map(parseGithubPullRequestUrl)
    .filter((ref): ref is GithubPullRequestRef => ref !== null)
    .filter((ref) => repositories.some((repository) => sameGithubRepository(repository, ref)))
    .slice(0, 10);
  const pullRequestEvidence = await Promise.all(pullRequestRefs.map(async (ref): Promise<PullRequestEvidence> => {
    const path = githubPath(ref);
    const pull = await getJson<GithubPullBody>(`/repos/${path}/pulls/${ref.number}`, token.token);
    if (!pull) {
      return {
        repository: `${ref.owner}/${ref.repository}`, number: ref.number, state: "unavailable",
        pullRequestState: "unknown", targetBranchMatches: null, checks: "unavailable",
      };
    }
    const sha = pull.head?.sha;
    const checks = sha
      ? await getJson<GithubChecksBody>(`/repos/${path}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`, token.token)
      : null;
    return {
      repository: `${ref.owner}/${ref.repository}`,
      number: ref.number,
      state: "observed",
      pullRequestState: toPullRequestState(pull),
      targetBranchMatches: intake.targetBranch.trim() ? pull.base?.ref === intake.targetBranch.trim() : null,
      checks: toChecks(checks),
    };
  }));

  const availableRepositories = repositoryEvidence.filter((entry) => entry.state === "observed").length;
  const availablePullRequests = pullRequestEvidence.filter((entry) => entry.state === "observed").length;
  await appendAuditEvent(repo, {
    organizationId: String(session.organizationId),
    kind: "github_release_evidence.collected",
    subjectKind: "release",
    subjectId: deployment.id,
    outcome: availableRepositories ? "ok" : "error",
    summary: availableRepositories
      ? "GitHub release evidence was collected with read-only installation access."
      : "GitHub release evidence could not read the repositories recorded on this request.",
    actorUserId: String(session.userId),
    correlationId: request.headers.get("x-correlation-id"),
    detailJson: {
      repositoryCount: repositories.length,
      repositoriesObserved: availableRepositories,
      pullRequestsObserved: availablePullRequests,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      mode: "read_only_evidence",
      repositories: repositoryEvidence,
      pullRequests: pullRequestEvidence,
    },
  });
}

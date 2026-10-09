/**
 * Executes the "low" risk, read-only tools. It never touches a write path.
 * These tools are safe to run without human approval, which is exactly why
 * they're classified "low"; every call is still persisted in the audit trail.
 */

import "server-only";

import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getFile, getLatestWorkflowRun, listRepositoryFiles } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { buildScimLifecyclePreviewResponse } from "@/lib/iam/scimLifecyclePreviewResponder";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";

const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;
const REPOSITORY_EVIDENCE_FILE_LIMIT = 5;
const REPOSITORY_EVIDENCE_TOTAL_CHARS = 32_000;

interface RepositoryFileSummary {
  path: string;
  size: number;
}

function repositoryEvidenceScore(path: string): number {
  const normalized = path.toLowerCase();
  if (normalized.startsWith(".env") || normalized.includes("/.env") || normalized.includes("node_modules/") || normalized.includes("vendor/")) return -1;
  if (/^(readme|architecture)(\.[a-z0-9]+)?$/.test(normalized)) return 1_000;
  if (/^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|gemfile)$/.test(normalized)) return 950;
  if (/^(dockerfile|compose\.ya?ml|docker-compose\.ya?ml)$/.test(normalized)) return 900;
  if (normalized.startsWith(".github/workflows/") && /\.ya?ml$/.test(normalized)) return 850;
  if (/(^|\/)(index|main|app|server|page)\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift)$/.test(normalized)) return 800;
  if (/^(next\.config|vite\.config|tsconfig|vercel)\./.test(normalized)) return 650;
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|md|ya?ml|json|toml)$/.test(normalized)) return 200;
  return -1;
}

export function selectRepositoryEvidenceFiles(files: RepositoryFileSummary[]): RepositoryFileSummary[] {
  return files
    .filter((file) => file.size <= 100_000 && repositoryEvidenceScore(file.path) >= 0)
    .sort((left, right) => repositoryEvidenceScore(right.path) - repositoryEvidenceScore(left.path) || left.path.localeCompare(right.path))
    .slice(0, REPOSITORY_EVIDENCE_FILE_LIMIT);
}

interface ConnectorSessionRow {
  provider: string;
  status: string;
  lastTransitionAt: Date;
}

interface GitHubInstallationRow {
  status: string;
  repositorySelection: string;
  lastSeenAt: Date | null;
}

interface TenantIntegrationConnectionRow {
  provider: string;
  status: string;
  lastValidatedAt: Date | null;
}

export interface ToolExecutionRepo {
  environment: {
    findMany(args: { where: { organizationId: string } }): Promise<Array<{ id: string; slug: string; name: string; tier: string }>>;
  };
  deploymentExecution: {
    findMany(args: {
      where: { organizationId: string; environmentId?: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<Array<{
      id: string;
      environmentId: string;
      repositoryFullName: string;
      sourceRef: string | null;
      sourceCommitSha: string | null;
      status: string;
      conclusion: string | null;
      createdAt: Date;
    }>>;
  };
  connectorSetupSession: {
    findMany(args: {
      where: { organizationId: string; provider: { in: string[] } };
      select: { provider: true; status: true; lastTransitionAt: true };
    }): Promise<ConnectorSessionRow[]>;
  };
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: { in: string[] } };
      orderBy: { installedAt: "desc" };
      select: { status: true; repositorySelection: true; lastSeenAt: true };
    }): Promise<GitHubInstallationRow | null>;
  };
  tenantIntegrationConnection: {
    findMany(args: {
      where: { organizationId: string; provider: { in: string[] } };
      select: { provider: true; status: true; lastValidatedAt: true };
    }): Promise<TenantIntegrationConnectionRow[]>;
  };
}

export type ToolExecutionResult = { ok: true; result: unknown } | { ok: false; error: string };

export async function executeReadOnlyTool(
  repo: ToolExecutionRepo,
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  if (toolName === "list_environments") {
    const environments = await repo.environment.findMany({ where: { organizationId } });
    return { ok: true, result: environments.map((e) => ({ id: e.id, slug: e.slug, name: e.name, tier: e.tier })) };
  }

  if (toolName === "list_deployment_executions") {
    const environmentId = typeof args.environmentId === "string" ? args.environmentId : undefined;
    const executions = await repo.deploymentExecution.findMany({
      where: { organizationId, ...(environmentId ? { environmentId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return {
      ok: true,
      result: executions.map((e) => ({
        id: e.id,
        environmentId: e.environmentId,
        repositoryFullName: e.repositoryFullName,
        sourceRef: e.sourceRef,
        sourceCommitSha: e.sourceCommitSha,
        status: e.status,
        conclusion: e.conclusion,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  if (toolName === "list_integrations") {
    let cloudRows: ConnectorSessionRow[];
    let githubInstallation: GitHubInstallationRow | null;
    let collaborationRows: TenantIntegrationConnectionRow[];
    try {
      [cloudRows, githubInstallation, collaborationRows] = await Promise.all([
        repo.connectorSetupSession.findMany({
          where: { organizationId, provider: { in: ["aws", "azure", "gcp"] } },
          select: { provider: true, status: true, lastTransitionAt: true },
        }),
        repo.gitHubInstallation.findFirst({
          where: { organizationId, status: { in: ["active", "suspended", "revoked"] } },
          orderBy: { installedAt: "desc" },
          select: { status: true, repositorySelection: true, lastSeenAt: true },
        }),
        repo.tenantIntegrationConnection.findMany({
        where: { organizationId, provider: { in: ["slack", "teams", "linear"] } },
          select: { provider: true, status: true, lastValidatedAt: true },
        }),
      ]);
    } catch {
      return { ok: false, error: "integration_status_unavailable" };
    }

    const cloudByProvider = new Map(cloudRows.map((row) => [row.provider, row]));
    const collaborationByProvider = new Map(collaborationRows.map((row) => [row.provider, row]));
    const githubStatus = !githubInstallation
      ? "not_connected"
      : githubInstallation.status !== "active"
        ? githubInstallation.status
        : !githubInstallation.lastSeenAt
          ? "installation_recorded"
          : Date.now() - githubInstallation.lastSeenAt.getTime() <= GITHUB_VALIDATION_FRESH_FOR_MS
            ? "validated_read_only"
            : "validation_overdue";

    return {
      ok: true,
      result: {
        github: {
          status: githubStatus,
          repositorySelection: githubInstallation?.repositorySelection ?? "unknown",
        },
        cloud: (["aws", "azure", "gcp"] as const).map((provider) => {
          const row = cloudByProvider.get(provider);
          return {
            provider,
            status: row?.status ?? "not_connected",
            lastTransitionAt: row?.lastTransitionAt.toISOString() ?? null,
          };
        }),
        collaboration: (["slack", "teams", "linear"] as const).map((provider) => {
          const row = collaborationByProvider.get(provider);
          return {
            provider,
            status: visibleTenantConnectionStatus({
              status: row?.status,
              lastValidatedAt: row?.lastValidatedAt,
            }),
            lastValidatedAt: row?.lastValidatedAt?.toISOString() ?? null,
          };
        }),
      },
    };
  }

  if (toolName === "check_deploy_status") {
    const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
    const parsed = parseRepositoryFullName(repositoryFullName);
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    const tokenResult = await resolveTenantScopedToken(organizationId, parsed);
    if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
    const runResult = await getLatestWorkflowRun({
      owner: parsed.owner, repo: parsed.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, installationToken: tokenResult.token,
    });
    if (!runResult.ok) return { ok: false, error: runResult.error };
    return { ok: true, result: runResult.data ?? { status: "no_runs_yet" } };
  }

  if (toolName === "read_github_file") {
    const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
    const branch = typeof args.branch === "string" ? args.branch : "";
    const path = typeof args.path === "string" ? args.path : "";
    const parsed = parseRepositoryFullName(repositoryFullName);
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    if (!branch || !path) return { ok: false, error: "invalid_payload" };
    const tokenResult = await resolveTenantScopedToken(organizationId, parsed);
    if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
    const fileResult = await getFile({ owner: parsed.owner, repo: parsed.repo, branch, path, installationToken: tokenResult.token });
    return fileResult.ok ? { ok: true, result: fileResult.data } : { ok: false, error: fileResult.error };
  }

  if (toolName === "list_github_files") {
    const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
    const branch = typeof args.branch === "string" ? args.branch : "";
    const pathPrefix = typeof args.pathPrefix === "string" ? args.pathPrefix.trim().replace(/^\/+/, "") : "";
    const parsed = parseRepositoryFullName(repositoryFullName);
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    if (!branch || (pathPrefix && !pathPrefix.split("/").every((segment) => segment && segment !== "." && segment !== ".."))) {
      return { ok: false, error: "invalid_payload" };
    }
    const tokenResult = await resolveTenantScopedToken(organizationId, parsed);
    if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
    const fileResult = await listRepositoryFiles({
      owner: parsed.owner, repo: parsed.repo, branch, installationToken: tokenResult.token,
    });
    if (!fileResult.ok) return { ok: false, error: fileResult.error };
    const matching = pathPrefix
      ? fileResult.data.files.filter((file) => file.path.startsWith(pathPrefix))
      : fileResult.data.files;
    const limited = matching.slice(0, 200);
    return {
      ok: true,
      result: {
        files: limited,
        totalMatching: matching.length,
        truncated: fileResult.data.truncated || matching.length > limited.length,
      },
    };
  }

  if (toolName === "inspect_github_repository") {
    const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
    const branch = typeof args.branch === "string" ? args.branch : "";
    const parsed = parseRepositoryFullName(repositoryFullName);
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    if (!branch) return { ok: false, error: "invalid_payload" };
    const tokenResult = await resolveTenantScopedToken(organizationId, parsed);
    if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
    const catalog = await listRepositoryFiles({
      owner: parsed.owner, repo: parsed.repo, branch, installationToken: tokenResult.token,
    });
    if (!catalog.ok) return { ok: false, error: catalog.error };

    const selected = selectRepositoryEvidenceFiles(catalog.data.files);
    const reads = await Promise.all(selected.map(async (file) => ({
      file,
      result: await getFile({
        owner: parsed.owner, repo: parsed.repo, branch, path: file.path, installationToken: tokenResult.token,
      }),
    })));
    let remainingChars = REPOSITORY_EVIDENCE_TOTAL_CHARS;
    const inspectedFiles: Array<{ path: string; sha: string; content: string; truncated: boolean }> = [];
    const readErrors: Array<{ path: string; error: string }> = [];
    for (const read of reads) {
      if (!read.result.ok) {
        readErrors.push({ path: read.file.path, error: read.result.error });
        continue;
      }
      const content = read.result.data.content.slice(0, Math.max(0, remainingChars));
      inspectedFiles.push({
        path: read.result.data.path,
        sha: read.result.data.sha,
        content,
        truncated: content.length < read.result.data.content.length,
      });
      remainingChars -= content.length;
      if (remainingChars <= 0) break;
    }
    return {
      ok: true,
      result: {
        repositoryFullName,
        branch,
        totalFiles: catalog.data.files.length,
        catalogTruncated: catalog.data.truncated,
        inspectedFiles,
        readErrors,
      },
    };
  }

  if (toolName === "preview_scim_lifecycle") {
    const preview = buildScimLifecyclePreviewResponse({ employees: args.employees, currentGrants: args.currentGrants });
    return preview.body.ok ? { ok: true, result: preview.body.data } : { ok: false, error: preview.body.error };
  }

  return { ok: false, error: `unknown_low_risk_tool: ${toolName}` };
}

export interface ProdEnvironmentCheckRepo {
  environment: { findUnique(args: { where: { id: string } }): Promise<{ organizationId: string; tier: string } | null> };
}

/**
 * Risk can only ever be bumped by context, never lowered (see
 * tools.ts's classifyRisk). This checks whether a tool's args target a
 * prod-tier environment, so a medium-risk GitHub write aimed at a repo
 * tied to prod gets escalated the same way trigger_aws_deploy already
 * always is.
 */
export async function isProdEnvironmentTarget(
  repo: ProdEnvironmentCheckRepo,
  organizationId: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const environmentId = typeof args.environmentId === "string" ? args.environmentId : null;
  if (!environmentId) return false;
  const environment = await repo.environment.findUnique({ where: { id: environmentId } });
  return environment?.organizationId === organizationId && environment.tier === "prod";
}

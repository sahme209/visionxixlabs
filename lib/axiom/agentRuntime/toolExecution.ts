/**
 * Executes the "low" risk, read-only tools. It never touches a write path.
 * These tools are safe to run without human approval, which is exactly why
 * they're classified "low"; every call is still persisted in the audit trail.
 */

import "server-only";

import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getFile, getLatestWorkflowRun } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { buildScimLifecyclePreviewResponse } from "@/lib/iam/scimLifecyclePreviewResponder";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";

const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;

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

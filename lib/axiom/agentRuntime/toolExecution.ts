/**
 * Executes the two "low" risk, read-only tools. Never touches a write
 * path — list_environments reads Environment rows, check_deploy_status
 * reads GitHub's own workflow-run history. Both are safe to run without
 * human approval, which is exactly why they're classified "low".
 */

import "server-only";

import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getLatestWorkflowRun } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";

export interface ToolExecutionRepo {
  environment: {
    findMany(args: { where: { organizationId: string } }): Promise<Array<{ id: string; slug: string; name: string; tier: string }>>;
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

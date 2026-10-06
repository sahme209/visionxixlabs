/**
 * Executes an approved AgentActionProposal. This is the only place the
 * agent runtime ever calls a write function — and only after a human
 * has explicitly approved, via POST /api/desktop/agent/actions/[id]/approve.
 * Reuses the exact same githubWriteClient / dispatchWorkflow functions
 * the dedicated desktop routes (app/api/desktop/github/**,
 * app/api/desktop/environments/deploy) already call — no new execution
 * logic, just a second, agent-originated caller of the same audited path.
 */

import "server-only";

import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createBranch, commitFile, createPullRequest, dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";

export interface ActionExecutionRepo {
  environment: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; organizationId: string } | null>;
  };
  deploymentTarget: {
    findUnique(args: { where: { environmentId: string } }): Promise<{ organizationId: string; roleArn: string; region: string; ecsCluster: string; ecsService: string } | null>;
  };
}

export type ActionExecutionResult = { ok: true; result: unknown } | { ok: false; error: string };

export async function executeApprovedAction(
  repo: ActionExecutionRepo,
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ActionExecutionResult> {
  const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
  const parsed = parseRepositoryFullName(repositoryFullName);

  if (toolName === "create_github_branch") {
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    const baseBranch = typeof args.baseBranch === "string" ? args.baseBranch : "";
    const newBranchName = typeof args.newBranchName === "string" ? args.newBranchName : "";
    if (!baseBranch || !newBranchName) return { ok: false, error: "invalid_payload" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const result = await createBranch({ owner: parsed.owner, repo: parsed.repo, baseBranch, newBranchName, installationToken: token.token });
    return result.ok ? { ok: true, result: result.data } : { ok: false, error: result.error };
  }

  if (toolName === "commit_github_file") {
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    const branch = typeof args.branch === "string" ? args.branch : "";
    const path = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : "";
    const message = typeof args.message === "string" ? args.message : "";
    if (!branch || !path || !content || !message) return { ok: false, error: "invalid_payload" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const result = await commitFile({ owner: parsed.owner, repo: parsed.repo, branch, path, content, message, installationToken: token.token });
    return result.ok ? { ok: true, result: result.data } : { ok: false, error: result.error };
  }

  if (toolName === "open_github_pull_request") {
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    const head = typeof args.head === "string" ? args.head : "";
    const base = typeof args.base === "string" ? args.base : "";
    const title = typeof args.title === "string" ? args.title : "";
    const body = typeof args.body === "string" ? args.body : undefined;
    if (!head || !base || !title) return { ok: false, error: "invalid_payload" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const result = await createPullRequest({ owner: parsed.owner, repo: parsed.repo, head, base, title, body, installationToken: token.token });
    return result.ok ? { ok: true, result: result.data } : { ok: false, error: result.error };
  }

  if (toolName === "trigger_aws_deploy") {
    if (!parsed) return { ok: false, error: "invalid_repository_full_name" };
    const environmentId = typeof args.environmentId === "string" ? args.environmentId : "";
    if (!environmentId) return { ok: false, error: "invalid_payload" };
    const environment = await repo.environment.findUnique({ where: { id: environmentId } });
    if (!environment || environment.organizationId !== organizationId) return { ok: false, error: "environment_not_found" };
    const target = await repo.deploymentTarget.findUnique({ where: { environmentId } });
    if (!target || target.organizationId !== organizationId) return { ok: false, error: "deployment_target_not_configured" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const result = await dispatchWorkflow({
      owner: parsed.owner, repo: parsed.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: "main",
      inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService },
      installationToken: token.token,
    });
    return result.ok ? { ok: true, result: { dispatched: true } } : { ok: false, error: result.error };
  }

  return { ok: false, error: `unknown_write_tool: ${toolName}` };
}

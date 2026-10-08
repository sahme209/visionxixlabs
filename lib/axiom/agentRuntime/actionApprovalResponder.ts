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
import { buildEnvironmentCreateResponse, type EnvironmentCreateRepo } from "@/lib/releaseops/environmentCreateResponder";
import { buildDeploymentTargetUpsertResponse, type DeploymentTargetRepo } from "@/lib/releaseops/deploymentTargetResponder";
import { buildIdentityProviderCreateResponse, type IdentityProviderRepo } from "@/lib/identity/identityProviderResponder";
import { githubFileReviewFromArgs } from "@/lib/axiom/agentRuntime/proposalReview";
import { serializeDeploymentExecution, type DeploymentExecutionRepo } from "@/lib/releaseops/deploymentExecutionResponder";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";

export interface ActionExecutionRepo {
  deploymentExecution?: DeploymentExecutionRepo["deploymentExecution"];
  environment: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; organizationId: string } | null>;
  };
  deploymentTarget: {
    findUnique(args: { where: { environmentId: string } }): Promise<{ organizationId: string; roleArn: string; region: string; ecsCluster: string; ecsService: string } | null>;
  };
  repository: DeploymentPolicyRepo["repository"];
  branchEnvironmentPolicy: DeploymentPolicyRepo["branchEnvironmentPolicy"];
}

export type ActionExecutionResult = { ok: true; result: unknown } | { ok: false; error: string };

export async function executeApprovedAction(
  repo: ActionExecutionRepo,
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
  actorUserId = "agent-approver",
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
    const review = githubFileReviewFromArgs(args);
    if (!branch || !path || !content || !message) return { ok: false, error: "invalid_payload" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const result = await commitFile({
      owner: parsed.owner, repo: parsed.repo, branch, path, content, message,
      installationToken: token.token,
      expectedSha: review?.baseSha,
    });
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
    const sourceRef = typeof args.sourceRef === "string" ? args.sourceRef.trim() : "main";
    const sourceKind = args.sourceKind === undefined || args.sourceKind === "branch"
      ? "branch"
      : args.sourceKind === "tag" ? "tag" : null;
    const pullRequestNumber = typeof args.pullRequestNumber === "number" ? args.pullRequestNumber : undefined;
    if (!environmentId || !sourceKind
      || (args.pullRequestNumber !== undefined && (!Number.isInteger(pullRequestNumber) || (pullRequestNumber ?? 0) <= 0))) {
      return { ok: false, error: "invalid_payload" };
    }
    const environment = await repo.environment.findUnique({ where: { id: environmentId } });
    if (!environment || environment.organizationId !== organizationId) return { ok: false, error: "environment_not_found" };
    const target = await repo.deploymentTarget.findUnique({ where: { environmentId } });
    if (!target || target.organizationId !== organizationId) return { ok: false, error: "deployment_target_not_configured" };
    const token = await resolveTenantScopedToken(organizationId, parsed);
    if (!token.ok) return { ok: false, error: token.error };
    const policy = await evaluateDeploymentPolicy(repo, {
      organizationId,
      environmentId,
      owner: parsed.owner,
      repo: parsed.repo,
      sourceRef,
      sourceKind,
      ...(pullRequestNumber !== undefined ? { pullRequestNumber } : {}),
      installationToken: token.token,
    });
    if (!policy.ok) return { ok: false, error: policy.error };
    const result = await dispatchWorkflow({
      owner: parsed.owner, repo: parsed.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: sourceRef,
      inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService },
      installationToken: token.token,
    });
    if (!result.ok) return { ok: false, error: result.error };
    let execution = null;
    try {
      if (!repo.deploymentExecution) throw new Error("deployment_execution_storage_unavailable");
      const created = await repo.deploymentExecution.create({
        data: {
          organizationId,
          environmentId,
          repositoryFullName,
          sourceRef,
          sourceKind,
          sourceCommitSha: policy.sourceCommitSha,
          branchPolicyId: policy.policyId,
          pullRequestUrl: policy.pullRequestUrl,
          workflowRunId: result.data.workflowRunId,
          workflowUrl: result.data.htmlUrl,
          source: "agent",
          triggeredByUserId: actorUserId,
          status: result.data.workflowRunId ? "queued" : "tracking_unavailable",
        },
      });
      execution = serializeDeploymentExecution(created);
    } catch { /* dispatch already happened; preserve the truthful outcome */ }
    return {
      ok: true,
      result: {
        dispatched: true,
        execution,
        trackingAvailable: Boolean(execution && result.data.workflowRunId),
        policyId: policy.policyId,
        sourceRef,
        sourceKind,
      },
    };
  }

  if (toolName === "create_environment") {
    const result = await buildEnvironmentCreateResponse(repo as unknown as EnvironmentCreateRepo, {
      organizationId,
      slug: typeof args.slug === "string" ? args.slug : "",
      name: typeof args.name === "string" ? args.name : "",
      tier: typeof args.tier === "string" ? args.tier : "",
    });
    return result.body.ok ? { ok: true, result: result.body.data } : { ok: false, error: result.body.error };
  }

  if (toolName === "configure_deployment_target") {
    const result = await buildDeploymentTargetUpsertResponse(repo as unknown as DeploymentTargetRepo, {
      organizationId,
      environmentId: typeof args.environmentId === "string" ? args.environmentId : "",
      roleArn: typeof args.roleArn === "string" ? args.roleArn : "",
      region: typeof args.region === "string" ? args.region : "",
      ecsCluster: typeof args.ecsCluster === "string" ? args.ecsCluster : "",
      ecsService: typeof args.ecsService === "string" ? args.ecsService : "",
    });
    return result.body.ok ? { ok: true, result: result.body.data } : { ok: false, error: result.body.error };
  }

  if (toolName === "connect_identity_provider") {
    const result = await buildIdentityProviderCreateResponse(repo as unknown as IdentityProviderRepo, {
      organizationId,
      actorUserId,
      protocol: typeof args.protocol === "string" ? args.protocol : "",
      issuerOrEntityId: typeof args.issuerOrEntityId === "string" ? args.issuerOrEntityId : "",
      metadataDocument: typeof args.metadataDocument === "string" ? args.metadataDocument : "",
      managedDomains: Array.isArray(args.managedDomains) ? args.managedDomains.filter((value): value is string => typeof value === "string") : [],
      roleMapping: Array.isArray(args.roleMapping) ? args.roleMapping as Array<{ claimKey: string; claimValue: string; role: "owner" | "admin" | "operator" | "security_reviewer" | "finance_viewer" | "read_only" }> : [],
      requireMfaClaim: args.requireMfaClaim === true,
    });
    return result.body.ok ? { ok: true, result: result.body.data } : { ok: false, error: result.body.error };
  }

  return { ok: false, error: `unknown_write_tool: ${toolName}` };
}

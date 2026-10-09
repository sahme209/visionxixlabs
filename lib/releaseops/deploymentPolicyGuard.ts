import "server-only";

import { matchesPattern } from "./branchValidationEvaluator";
import {
  getCommitCiStatus,
  getPullRequestGovernanceEvidence,
  resolveGitReference,
  type GitReferenceKind,
} from "@/lib/connectors/github/githubWriteClient";

interface RepositoryRow {
  id: string;
  organizationId: string;
  provider: string;
  remoteOwner: string;
  remoteName: string;
}

interface PolicyRow {
  id: string;
  branchPattern: string;
  requireReleaseTag: boolean;
  requireCodeowners: boolean;
  requirePrLink: boolean;
  requireChangeTicket: boolean;
  /// Soft reference to another Environment. When set, a deploy matching
  /// this policy must promote forward from a completed, successful
  /// DeploymentExecution against exactly that prior environment, carrying
  /// the identical resolved commit — see the promotion check below.
  requirePromotionFromEnvironmentId: string | null;
  /// When set, the resolved commit must have a successful GitHub combined
  /// status or check-run result (the repo's own CI/tests) before deploy.
  requireTestsPassing: boolean;
  priority: number;
}

interface PriorExecutionRow {
  id: string;
  environmentId: string;
  sourceCommitSha: string | null;
  status: string;
  conclusion: string | null;
}

export interface DeploymentPolicyRepo {
  repository: {
    findMany(args: { where: { organizationId: string; provider: "github" } }): Promise<RepositoryRow[]>;
  };
  branchEnvironmentPolicy: {
    findMany(args: {
      where: { organizationId: string; repositoryId: string; environmentId: string; enabled: true };
      orderBy: [{ priority: "asc" }];
    }): Promise<PolicyRow[]>;
  };
  deploymentExecution: {
    findFirst(args: { where: { id: string; organizationId: string } }): Promise<PriorExecutionRow | null>;
  };
}

export interface DeploymentPolicyInput {
  organizationId: string;
  environmentId: string;
  owner: string;
  repo: string;
  sourceRef: string;
  sourceKind: GitReferenceKind;
  pullRequestNumber?: number;
  /// Prior DeploymentExecution this deploy promotes, required whenever the
  /// matched policy sets requirePromotionFromEnvironmentId.
  promotedFromExecutionId?: string;
  /** Production is intentionally fail-closed. A production deploy must match
   * a policy that proves PR review, passing tests, and promotion of the exact
   * commit from a prior environment. */
  requiredControlSet?: "production";
  installationToken: string;
}

export type DeploymentPolicyDecision =
  | { ok: true; policyId: string | null; sourceCommitSha: string; pullRequestUrl: string | null }
  | { ok: false; error: string; policyId?: string };

function validSourceRef(value: string): boolean {
  return value.length > 0
    && value.length <= 255
    && !value.startsWith("/")
    && !value.endsWith("/")
    && !value.includes("..")
    && !value.includes("@{")
    && !/[\s~^:?*\[\]\\]/.test(value);
}

/**
 * Enforces the first matching configured policy. No configured policy keeps
 * backwards-compatible deployment behavior; once policies exist for the
 * repo/environment pair, missing matches or evidence deny the deployment.
 */
export async function evaluateDeploymentPolicy(
  policyRepo: DeploymentPolicyRepo,
  input: DeploymentPolicyInput,
): Promise<DeploymentPolicyDecision> {
  if (!validSourceRef(input.sourceRef)) return { ok: false, error: "invalid_source_ref" };
  if (input.sourceKind !== "branch" && input.sourceKind !== "tag") return { ok: false, error: "invalid_source_kind" };

  let repositories: RepositoryRow[];
  try {
    repositories = await policyRepo.repository.findMany({ where: { organizationId: input.organizationId, provider: "github" } });
  } catch {
    return { ok: false, error: "branch_policy_lookup_failed" };
  }
  const registered = repositories.find((row) =>
    row.remoteOwner.toLowerCase() === input.owner.toLowerCase()
    && row.remoteName.toLowerCase() === input.repo.toLowerCase(),
  );
  if (!registered) {
    return input.requiredControlSet === "production"
      ? { ok: false, error: "branch_policy_production_policy_required" }
      : resolveUnconfiguredReference(input);
  }

  let policies: PolicyRow[];
  try {
    policies = await policyRepo.branchEnvironmentPolicy.findMany({
      where: {
        organizationId: input.organizationId,
        repositoryId: registered.id,
        environmentId: input.environmentId,
        enabled: true,
      },
      orderBy: [{ priority: "asc" }],
    });
  } catch {
    return { ok: false, error: "branch_policy_lookup_failed" };
  }
  if (policies.length === 0) {
    return input.requiredControlSet === "production"
      ? { ok: false, error: "branch_policy_production_policy_required" }
      : resolveUnconfiguredReference(input);
  }

  const policy = policies.find((candidate) => matchesPattern(input.sourceRef, candidate.branchPattern));
  if (!policy) return { ok: false, error: "branch_policy_no_matching_ref" };
  if (input.requiredControlSet === "production"
    && (!policy.requirePrLink || !policy.requireTestsPassing || !policy.requirePromotionFromEnvironmentId)) {
    return { ok: false, error: "branch_policy_production_controls_required", policyId: policy.id };
  }
  if (policy.requireReleaseTag && input.sourceKind !== "tag") {
    return { ok: false, error: "branch_policy_release_tag_required", policyId: policy.id };
  }

  const reference = await resolveGitReference({
    owner: input.owner,
    repo: input.repo,
    ref: input.sourceRef,
    kind: input.sourceKind,
    installationToken: input.installationToken,
  });
  if (!reference.ok) return { ok: false, error: reference.error, policyId: policy.id };

  if (policy.requireTestsPassing) {
    const ci = await getCommitCiStatus({
      owner: input.owner,
      repo: input.repo,
      commitSha: reference.data.commitSha,
      installationToken: input.installationToken,
    });
    if (!ci.ok) return { ok: false, error: ci.error, policyId: policy.id };
    if (ci.data.state === "no_checks") return { ok: false, error: "branch_policy_tests_required_no_checks", policyId: policy.id };
    if (ci.data.state === "pending") return { ok: false, error: "branch_policy_tests_pending", policyId: policy.id };
    if (ci.data.state === "failure") return { ok: false, error: "branch_policy_tests_failed", policyId: policy.id };
  }

  if (policy.requirePromotionFromEnvironmentId) {
    if (!input.promotedFromExecutionId) {
      return { ok: false, error: "branch_policy_promotion_required", policyId: policy.id };
    }
    const priorExecution = await policyRepo.deploymentExecution.findFirst({
      where: { id: input.promotedFromExecutionId, organizationId: input.organizationId },
    });
    if (!priorExecution) return { ok: false, error: "branch_policy_promotion_execution_not_found", policyId: policy.id };
    if (priorExecution.environmentId !== policy.requirePromotionFromEnvironmentId) {
      return { ok: false, error: "branch_policy_promotion_wrong_environment", policyId: policy.id };
    }
    if (priorExecution.status !== "completed" || priorExecution.conclusion !== "success") {
      return { ok: false, error: "branch_policy_promotion_not_successful", policyId: policy.id };
    }
    if (!priorExecution.sourceCommitSha || priorExecution.sourceCommitSha !== reference.data.commitSha) {
      return { ok: false, error: "branch_policy_promotion_commit_mismatch", policyId: policy.id };
    }
  }

  const needsPullRequest = policy.requirePrLink || policy.requireCodeowners || policy.requireChangeTicket;
  if (!needsPullRequest) {
    return { ok: true, policyId: policy.id, sourceCommitSha: reference.data.commitSha, pullRequestUrl: null };
  }
  if (!Number.isInteger(input.pullRequestNumber) || (input.pullRequestNumber ?? 0) <= 0) {
    return { ok: false, error: "branch_policy_pull_request_required", policyId: policy.id };
  }

  const evidence = await getPullRequestGovernanceEvidence({
    owner: input.owner,
    repo: input.repo,
    pullRequestNumber: input.pullRequestNumber!,
    requireCodeowners: policy.requireCodeowners,
    installationToken: input.installationToken,
  });
  if (!evidence.ok) return { ok: false, error: evidence.error, policyId: policy.id };
  if (!evidence.data.mergedAt) return { ok: false, error: "branch_policy_pull_request_not_merged", policyId: policy.id };

  const linkedCommit = evidence.data.headSha === reference.data.commitSha
    || evidence.data.mergeCommitSha === reference.data.commitSha;
  if (!linkedCommit) return { ok: false, error: "branch_policy_pull_request_ref_mismatch", policyId: policy.id };
  if (policy.requireCodeowners && (!evidence.data.codeOwnerReviewsRequired || evidence.data.approvedReviewCount < 1)) {
    return { ok: false, error: "branch_policy_codeowners_approval_required", policyId: policy.id };
  }
  if (policy.requireChangeTicket && evidence.data.linkedChangeTickets.length === 0) {
    return { ok: false, error: "branch_policy_change_ticket_required", policyId: policy.id };
  }

  return {
    ok: true,
    policyId: policy.id,
    sourceCommitSha: reference.data.commitSha,
    pullRequestUrl: evidence.data.htmlUrl,
  };
}

async function resolveUnconfiguredReference(input: DeploymentPolicyInput): Promise<DeploymentPolicyDecision> {
  const reference = await resolveGitReference({
    owner: input.owner,
    repo: input.repo,
    ref: input.sourceRef,
    kind: input.sourceKind,
    installationToken: input.installationToken,
  });
  if (!reference.ok) return { ok: false, error: reference.error };
  return { ok: true, policyId: null, sourceCommitSha: reference.data.commitSha, pullRequestUrl: null };
}

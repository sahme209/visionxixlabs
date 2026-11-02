import "server-only";
import {pullRequestProposalReview} from "@/lib/cockpit/pullRequestProposalReview";
import { isAgentGithubBranchReference } from "@/lib/tauri/agentGithubBranchReview";
import { captureRestartTarget, type RestartTargetRepo } from "./restartTargetReview";
import { agentRestartTagSchema, restartWorkflowSourceFromArgs } from "@/lib/tauri/agentRestartWorkflowSource";
import { observeAgentRestartWorkflowSource, AGENT_RESTART_WORKFLOW_CONTENT_SHA256 } from "./agentRestartWorkflowSource";
import type { InstallationRepo } from "@/lib/connectors/github/resolveTenantScopedToken";
import { isSensitiveRepositoryEvidencePath } from "./repositoryEvidencePolicy";

import { getFile, resolveGitReference } from "@/lib/connectors/github/githubWriteClient";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";

export interface GithubFileReviewSnapshot {
  kind: "github_file";
  baseSha: string | null;
  baseContent: string;
  htmlUrl: string | null;
}

export interface GithubFilesReviewSnapshot {
  kind: "github_files";
  files: Array<{ path: string; baseSha: string | null; baseContent: string; htmlUrl: string | null }>;
}

export type ProposalReviewResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Adds server-trusted review data to file-write proposals. Any review data
 * supplied by the model is discarded; only GitHub's current tenant-scoped
 * response can establish the base content and blob SHA used at approval time.
 */
export async function prepareProposalArgsForReview(
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
  targetRepo?: RestartTargetRepo & Partial<InstallationRepo>,
  signal?: AbortSignal,
): Promise<ProposalReviewResult> {
  const { _review: _untrustedReview, _restartSource: _untrustedSource, ...sanitizedArgs } = args;
  void _untrustedSource;
  void _untrustedReview;
  if (toolName === "trigger_aws_deploy") {
    if (!targetRepo || typeof args.environmentId !== "string") return { ok: false, error: "deployment_target_review_unavailable" };
    try {
      const review = await captureRestartTarget(targetRepo, organizationId, args.environmentId);
      if (!review) return { ok: false, error: "deployment_target_review_unavailable" };
      const unavailable = { ok: false as const, error: "deployment_source_review_unavailable" };
      const parsed = typeof args.repositoryFullName === "string" ? parseRepositoryFullName(args.repositoryFullName) : null;
      if (!parsed || args.sourceKind !== "tag" || !agentRestartTagSchema.safeParse(args.sourceRef).success || !targetRepo.gitHubInstallation || signal?.aborted) return unavailable;
      const installationRepo = { gitHubInstallation: targetRepo.gitHubInstallation };
      const readInstallation = () => installationRepo.gitHubInstallation.findFirst({ where: { organizationId, status: "active" }, orderBy: { installedAt: "desc" }, select: { id: true, githubInstallationId: true, updatedAt: true, revokedAt: true, suspendedAt: true } });
      const installation = await readInstallation();
      if (!installation?.id || !(installation.updatedAt instanceof Date) || !Number.isFinite(installation.updatedAt.getTime()) || installation.revokedAt || installation.suspendedAt) return unavailable;
      const revision = installation.updatedAt.getTime();
      const token = await resolveTenantScopedToken(organizationId, parsed, { id: installation.id, githubInstallationId: installation.githubInstallationId, updatedAt: installation.updatedAt, signal, permissionProfile: "contents_read" }, installationRepo);
      if (!token.ok) return unavailable;
      const observed = await observeAgentRestartWorkflowSource({ repositoryFullName: args.repositoryFullName as string, sourceKind: "tag", sourceRef: args.sourceRef as string, installationToken: token.token, signal: signal ?? new AbortController().signal });
      if (!observed || signal?.aborted || observed.expiresAt <= Date.now()) return unavailable;
      const source = restartWorkflowSourceFromArgs({ ...sanitizedArgs, _restartSource: observed.source });
      if (!source || source.workflowContentSha256 !== AGENT_RESTART_WORKFLOW_CONTENT_SHA256) return unavailable;
      const current = await readInstallation();
      const currentTarget = await captureRestartTarget(targetRepo, organizationId, args.environmentId);
      if (!current || current.id !== installation.id || current.githubInstallationId !== installation.githubInstallationId || current.updatedAt?.getTime() !== revision || current.revokedAt || current.suspendedAt || JSON.stringify(currentTarget) !== JSON.stringify(review) || signal?.aborted || observed.expiresAt <= Date.now()) return unavailable;
      return { ok: true, args: { ...sanitizedArgs, _review: review, _restartSource: source } };
    } catch { return { ok: false, error: "deployment_target_review_unavailable" }; }
  }
  if (toolName === "create_github_branch") {
    const parsed = typeof args.repositoryFullName === "string" ? parseRepositoryFullName(args.repositoryFullName) : null;
    if (!parsed || !isAgentGithubBranchReference(args.baseBranch) || !isAgentGithubBranchReference(args.newBranchName) || args.baseBranch === args.newBranchName) return { ok: false, error: "invalid_branch_proposal" };
    try {
      const token = await resolveTenantScopedToken(organizationId, parsed);
      if (!token.ok) return { ok: false, error: "branch_review_unavailable" };
      const base = await resolveGitReference({ ...parsed, ref: args.baseBranch, kind: "branch", installationToken: token.token });
      if (!base.ok || base.data.kind !== "branch" || base.data.ref !== args.baseBranch || !/^[a-f0-9]{40}$/.test(base.data.commitSha)) return { ok: false, error: "branch_review_unavailable" };
      return { ok: true, args: { ...sanitizedArgs, _review: { kind: "github_branch", baseBranch: args.baseBranch, newBranchName: args.newBranchName, baseSha: base.data.commitSha } } };
    } catch { return { ok: false, error: "branch_review_unavailable" }; }
  }
  if (toolName === "open_github_pull_request") {
    const parsed = typeof args.repositoryFullName === "string" ? parseRepositoryFullName(args.repositoryFullName) : null;
    if (!parsed || !pullRequestProposalReview(sanitizedArgs) || !isAgentGithubBranchReference(args.head) || !isAgentGithubBranchReference(args.base) || args.head === args.base) return { ok: false, error: "invalid_pull_request_proposal" };
    try {
      const token = await resolveTenantScopedToken(organizationId, parsed);
      if (!token.ok) return { ok: false, error: "pull_request_review_unavailable" };
      const head = await resolveGitReference({ ...parsed, ref: args.head, kind: "branch", installationToken: token.token });
      const base = await resolveGitReference({ ...parsed, ref: args.base, kind: "branch", installationToken: token.token });
      if (!head.ok || !base.ok || head.data.kind !== "branch" || base.data.kind !== "branch" || head.data.ref !== args.head || base.data.ref !== args.base || !/^[a-f0-9]{40}$/.test(head.data.commitSha) || !/^[a-f0-9]{40}$/.test(base.data.commitSha)) return { ok: false, error: "pull_request_review_unavailable" };
      return { ok: true, args: { ...sanitizedArgs, _review: { kind: "github_pull_request", head: args.head, base: args.base, headSha: head.data.commitSha, baseSha: base.data.commitSha } } };
    } catch { return { ok: false, error: "pull_request_review_unavailable" }; }
  }
  if (toolName !== "commit_github_file" && toolName !== "commit_github_files") return { ok: true, args: sanitizedArgs };

  const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
  const branch = typeof args.branch === "string" ? args.branch : "";
  const parsed = parseRepositoryFullName(repositoryFullName);
  if (!parsed || !branch) return { ok: false, error: "invalid_file_proposal" };
  const proposedPaths = toolName === "commit_github_file" ? [args.path] : Array.isArray(args.files)
    ? args.files.map((file) => typeof file === "object" && file !== null ? (file as Record<string, unknown>).path : undefined) : [];
  if (proposedPaths.some((path) => typeof path === "string" && isSensitiveRepositoryEvidencePath(path))) return { ok: false, error: "sensitive_repository_file" };

  const token = await resolveTenantScopedToken(organizationId, parsed);
  if (!token.ok) return { ok: false, error: token.error };
  const snapshot = async (path: string) => {
    const current = await getFile({
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    path,
    installationToken: token.token,
    });
    if (current.ok) return { ok: true as const, review: { path, baseSha: current.data.sha, baseContent: current.data.content, htmlUrl: current.data.htmlUrl } };
    if (current.error.startsWith("github_404:")) return { ok: true as const, review: { path, baseSha: null, baseContent: "", htmlUrl: null } };
    return { ok: false as const, error: `file_review_unavailable: ${current.error}` };
  };

  if (toolName === "commit_github_files") {
    const files = Array.isArray(args.files) ? args.files : [];
    if (files.length < 2 || files.length > 20) return { ok: false, error: "invalid_multi_file_proposal" };
    const paths = files.map((file) => typeof file === "object" && file !== null && typeof (file as Record<string, unknown>).path === "string" ? (file as Record<string, unknown>).path as string : "");
    if (paths.some((path) => !path) || new Set(paths).size !== paths.length) return { ok: false, error: "invalid_multi_file_proposal" };
    const reviews = [];
    for (const path of paths) {
      const result = await snapshot(path);
      if (!result.ok) return result;
      reviews.push(result.review);
    }
    return { ok: true, args: { ...sanitizedArgs, _review: { kind: "github_files", files: reviews } satisfies GithubFilesReviewSnapshot } };
  }

  const path = typeof args.path === "string" ? args.path : "";
  if (!path) return { ok: false, error: "invalid_file_proposal" };
  const captured = await snapshot(path);
  if (!captured.ok) return captured;

  const review: GithubFileReviewSnapshot = {
      kind: "github_file",
      baseSha: captured.review.baseSha,
      baseContent: captured.review.baseContent,
      htmlUrl: captured.review.htmlUrl,
  };

  return { ok: true, args: { ...sanitizedArgs, _review: review } };
}

export function githubFilesReviewFromArgs(args: Record<string, unknown>): GithubFilesReviewSnapshot | null {
  const review = args._review;
  if (typeof review !== "object" || review === null) return null;
  const candidate = review as Record<string, unknown>;
  if (candidate.kind !== "github_files" || !Array.isArray(candidate.files)) return null;
  const files = candidate.files.flatMap((value) => {
    if (typeof value !== "object" || value === null) return [];
    const file = value as Record<string, unknown>;
    if (typeof file.path !== "string" || (file.baseSha !== null && typeof file.baseSha !== "string") || typeof file.baseContent !== "string") return [];
    return [{ path: file.path, baseSha: file.baseSha as string | null, baseContent: file.baseContent, htmlUrl: typeof file.htmlUrl === "string" ? file.htmlUrl : null }];
  });
  return files.length === candidate.files.length ? { kind: "github_files", files } : null;
}

export function githubFileReviewFromArgs(args: Record<string, unknown>): GithubFileReviewSnapshot | null {
  const review = args._review;
  if (typeof review !== "object" || review === null) return null;
  const candidate = review as Record<string, unknown>;
  if (candidate.kind !== "github_file") return null;
  if (candidate.baseSha !== null && typeof candidate.baseSha !== "string") return null;
  if (typeof candidate.baseContent !== "string") return null;
  return {
    kind: "github_file",
    baseSha: candidate.baseSha as string | null,
    baseContent: candidate.baseContent,
    htmlUrl: typeof candidate.htmlUrl === "string" ? candidate.htmlUrl : null,
  };
}

export { githubBranchReviewFromArgs } from "@/lib/tauri/agentGithubBranchReview";

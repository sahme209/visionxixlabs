import "server-only";
import { captureRestartTarget, type RestartTargetRepo } from "./restartTargetReview";
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
  targetRepo?: RestartTargetRepo,
): Promise<ProposalReviewResult> {
  const { _review: _untrustedReview, ...sanitizedArgs } = args;
  void _untrustedReview;
  if (toolName === "trigger_aws_deploy") {
    if (!targetRepo || typeof args.environmentId !== "string") return { ok: false, error: "deployment_target_review_unavailable" };
    try {
      const review = await captureRestartTarget(targetRepo, organizationId, args.environmentId);
      return review ? { ok: true, args: { ...sanitizedArgs, _review: review } } : { ok: false, error: "deployment_target_review_unavailable" };
    } catch { return { ok: false, error: "deployment_target_review_unavailable" }; }
  }
  if (toolName === "create_github_branch") {
    const parsed = typeof args.repositoryFullName === "string" ? parseRepositoryFullName(args.repositoryFullName) : null;
    const validRef = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 240 && !value.startsWith("-") && !value.includes("..") && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.endsWith("/") && !value.endsWith(".lock");
    if (!parsed || !validRef(args.baseBranch) || !validRef(args.newBranchName) || args.baseBranch === args.newBranchName) return { ok: false, error: "invalid_branch_proposal" };
    try {
      const token = await resolveTenantScopedToken(organizationId, parsed);
      if (!token.ok) return { ok: false, error: "branch_review_unavailable" };
      const base = await resolveGitReference({ ...parsed, ref: args.baseBranch, kind: "branch", installationToken: token.token });
      if (!base.ok || base.data.kind !== "branch" || base.data.ref !== args.baseBranch || !/^[a-f0-9]{40}$/.test(base.data.commitSha)) return { ok: false, error: "branch_review_unavailable" };
      return { ok: true, args: { ...sanitizedArgs, _review: { kind: "github_branch", baseBranch: args.baseBranch, newBranchName: args.newBranchName, baseSha: base.data.commitSha } } };
    } catch { return { ok: false, error: "branch_review_unavailable" }; }
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

/** Source evidence is part of the server-created proposal digest, never supplied
 * as authority by an execution request. Old symbolic proposals are ineligible. */
export function githubBranchReviewFromArgs(args: Record<string, unknown>): { kind: "github_branch"; baseBranch: string; newBranchName: string; baseSha: string } | null {
  const value = args._review;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const review = value as Record<string, unknown>;
  if (review.kind !== "github_branch" || review.baseBranch !== args.baseBranch || review.newBranchName !== args.newBranchName || typeof review.baseBranch !== "string" || typeof review.newBranchName !== "string" || typeof review.baseSha !== "string" || !/^[a-f0-9]{40}$/.test(review.baseSha)) return null;
  return { kind: "github_branch", baseBranch: review.baseBranch, newBranchName: review.newBranchName, baseSha: review.baseSha };
}

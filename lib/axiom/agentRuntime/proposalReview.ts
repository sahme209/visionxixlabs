import "server-only";

import { getFile } from "@/lib/connectors/github/githubWriteClient";
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
): Promise<ProposalReviewResult> {
  const { _review: _untrustedReview, ...sanitizedArgs } = args;
  void _untrustedReview;
  if (toolName !== "commit_github_file" && toolName !== "commit_github_files") return { ok: true, args: sanitizedArgs };

  const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
  const branch = typeof args.branch === "string" ? args.branch : "";
  const parsed = parseRepositoryFullName(repositoryFullName);
  if (!parsed || !branch) return { ok: false, error: "invalid_file_proposal" };

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

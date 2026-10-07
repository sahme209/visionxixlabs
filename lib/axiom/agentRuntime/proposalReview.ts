import "server-only";

import { getFile } from "@/lib/connectors/github/githubWriteClient";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";

export interface GithubFileReviewSnapshot {
  kind: "github_file";
  baseSha: string | null;
  baseContent: string;
  htmlUrl: string | null;
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
  if (toolName !== "commit_github_file") return { ok: true, args: sanitizedArgs };

  const repositoryFullName = typeof args.repositoryFullName === "string" ? args.repositoryFullName : "";
  const branch = typeof args.branch === "string" ? args.branch : "";
  const path = typeof args.path === "string" ? args.path : "";
  const parsed = parseRepositoryFullName(repositoryFullName);
  if (!parsed || !branch || !path) return { ok: false, error: "invalid_file_proposal" };

  const token = await resolveTenantScopedToken(organizationId, parsed);
  if (!token.ok) return { ok: false, error: token.error };
  const current = await getFile({
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    path,
    installationToken: token.token,
  });

  let review: GithubFileReviewSnapshot;
  if (current.ok) {
    review = {
      kind: "github_file",
      baseSha: current.data.sha,
      baseContent: current.data.content,
      htmlUrl: current.data.htmlUrl,
    };
  } else if (current.error.startsWith("github_404:")) {
    review = { kind: "github_file", baseSha: null, baseContent: "", htmlUrl: null };
  } else {
    return { ok: false, error: `file_review_unavailable: ${current.error}` };
  }

  return { ok: true, args: { ...sanitizedArgs, _review: review } };
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

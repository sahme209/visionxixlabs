/** Shared source-evidence parser for review display and fixed server execution.
 * This data describes a stored proposal; it never grants execution authority. */
export function isAgentGithubBranchReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240 && !value.startsWith("-") && !value.includes("..") && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.endsWith("/") && !value.endsWith(".lock");
}
export function githubBranchReviewFromArgs(args: Record<string, unknown>): { kind: "github_branch"; baseBranch: string; newBranchName: string; baseSha: string } | null {
  const value = args._review;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const review = value as Record<string, unknown>;
  if (review.kind !== "github_branch" || review.baseBranch !== args.baseBranch || review.newBranchName !== args.newBranchName || !isAgentGithubBranchReference(review.baseBranch) || !isAgentGithubBranchReference(review.newBranchName) || review.baseBranch === review.newBranchName || typeof review.baseSha !== "string" || !/^[a-f0-9]{40}$/.test(review.baseSha)) return null;
  return { kind: "github_branch", baseBranch: review.baseBranch, newBranchName: review.newBranchName, baseSha: review.baseSha };
}

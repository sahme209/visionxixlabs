/**
 * Pure repo-ref parser — Phase 387.
 *
 * Accepts the operator's repoRef in any of these shapes:
 *   - "owner/repo"
 *   - "github.com/owner/repo"
 *   - "https://github.com/owner/repo"
 *   - "https://github.com/owner/repo.git"
 *   - "git@github.com:owner/repo.git"
 *
 * Returns the canonical { owner, repo } pair or null when the input
 * doesn't look like a GitHub repo we can reach.
 *
 * Pure — no I/O. Tested independently of the GitHub fetcher.
 */

export interface RepoCoordinates {
  owner: string;
  repo: string;
}

const OWNER_REPO = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/;

export function parseRepoRef(repoRef: string): RepoCoordinates | null {
  if (typeof repoRef !== "string") return null;
  let raw = repoRef.trim();
  if (raw.length === 0) return null;

  // git@github.com:owner/repo(.git)
  if (raw.startsWith("git@")) {
    const colon = raw.indexOf(":");
    if (colon < 0) return null;
    raw = raw.slice(colon + 1);
  } else {
    // strip protocol + host prefix variants
    raw = raw.replace(/^https?:\/\//, "");
    raw = raw.replace(/^github\.com\//, "");
    raw = raw.replace(/^www\.github\.com\//, "");
  }

  // collapse trailing slashes
  raw = raw.replace(/\/+$/, "");

  const m = raw.match(OWNER_REPO);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  // Owner cannot start with a dot (defends against ".." traversal).
  if (owner.startsWith(".") || repo.startsWith(".")) return null;
  return { owner, repo };
}

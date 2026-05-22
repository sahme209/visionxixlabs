/**
 * Pure repo-context summarizer — Phase 387.
 *
 * Turns a structured RepoSnapshot (from repoContextFetcher) into a
 * cacheable text block that goes into the propose prompt's user
 * message. The structure is stable across runs against the same
 * branch+commit so prompt caching pays off for follow-up requests.
 *
 * Section order (matters for caching):
 *   1. Repo metadata header   — name + default branch + commit sha
 *   2. File tree              — bounded, deterministic order
 *   3. Recent commits         — last N
 *   4. Key file contents      — README, package.json, top-level configs
 *
 * The fetcher caps every field so a giant monorepo can't blow past
 * the model's context window. Truncation markers are explicit so
 * the model knows it's seeing a sample.
 *
 * Pure — no I/O.
 */

export interface RepoTreeEntry {
  path: string;
  /** "blob" (file) or "tree" (dir). */
  type: "blob" | "tree";
  /** File size in bytes; only meaningful for blobs. */
  size?: number;
}

export interface RepoCommit {
  sha: string;
  message: string;
  authorName: string;
  authoredAt: string;  // ISO 8601
}

export interface RepoFileContent {
  path: string;
  /** Decoded text content (may be truncated). */
  content: string;
  truncated: boolean;
}

export interface RepoSnapshot {
  owner: string;
  repo: string;
  defaultBranch: string;
  branch: string;
  headSha: string | null;
  /** Up to ~200 entries, breadth-first. */
  tree: ReadonlyArray<RepoTreeEntry>;
  /** Whether the tree was clipped. */
  treeTruncated: boolean;
  /** Up to ~10 most recent commits on the branch. */
  recentCommits: ReadonlyArray<RepoCommit>;
  /** Key files (README, package.json, etc.) with content. */
  keyFiles: ReadonlyArray<RepoFileContent>;
}

const MAX_TREE_ENTRIES_RENDERED = 150;

export function summarizeRepoContext(snapshot: RepoSnapshot): string {
  const lines: string[] = [];

  lines.push(`# Repository: ${snapshot.owner}/${snapshot.repo}`);
  lines.push(`# Default branch: ${snapshot.defaultBranch}`);
  lines.push(`# Working branch: ${snapshot.branch}`);
  if (snapshot.headSha) {
    lines.push(`# HEAD commit: ${snapshot.headSha}`);
  }
  lines.push("");

  // File tree — bounded.
  lines.push("## File tree");
  const sortedTree = [...snapshot.tree].sort((a, b) => a.path.localeCompare(b.path));
  const treeToRender = sortedTree.slice(0, MAX_TREE_ENTRIES_RENDERED);
  for (const entry of treeToRender) {
    const marker = entry.type === "tree" ? "/" : "";
    const size = entry.type === "blob" && typeof entry.size === "number" ? ` (${entry.size}b)` : "";
    lines.push(`- ${entry.path}${marker}${size}`);
  }
  if (snapshot.treeTruncated || sortedTree.length > MAX_TREE_ENTRIES_RENDERED) {
    const shown = Math.min(sortedTree.length, MAX_TREE_ENTRIES_RENDERED);
    const total = snapshot.treeTruncated ? `${sortedTree.length}+` : String(sortedTree.length);
    lines.push(`- … (showing ${shown} of ${total} entries — tree truncated)`);
  }
  lines.push("");

  // Recent commits.
  if (snapshot.recentCommits.length > 0) {
    lines.push("## Recent commits");
    for (const c of snapshot.recentCommits) {
      const shortSha = c.sha.slice(0, 7);
      const firstLine = c.message.split("\n")[0];
      lines.push(`- ${shortSha} · ${c.authorName} · ${c.authoredAt} · ${firstLine}`);
    }
    lines.push("");
  }

  // Key files.
  if (snapshot.keyFiles.length > 0) {
    lines.push("## Key files");
    for (const f of snapshot.keyFiles) {
      lines.push(`### ${f.path}${f.truncated ? " (truncated)" : ""}`);
      lines.push("```");
      lines.push(f.content);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

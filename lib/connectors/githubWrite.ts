/**
 * Cloud Automation: GitHub write capability.
 * Creates pull requests for remediation (IaC patches, workflow updates, etc.).
 * Used by autonomous remediation engine — Observe → Plan → Act → Verify → Report.
 */

export interface CreatePROptions {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string; // branch name
  base?: string; // default: main
  files?: Array<{ path: string; content: string }>;
}

export interface CreatePRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Create a pull request with file changes.
 * If files are provided, creates a new branch, commits files, then opens PR.
 * Requires repo write access (contents, pull_requests).
 */
export async function createPullRequest(opts: CreatePROptions): Promise<CreatePRResult> {
  const { token, owner, repo, title, body, head, base = "main", files = [] } = opts;

  if (!token?.trim()) {
    return { success: false, error: "GitHub token required" };
  }
  if (!owner || !repo) {
    return { success: false, error: "owner and repo required" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  try {
    if (files.length > 0) {
      // 1. Get base branch ref SHA
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${base}`, {
        headers,
      });
      if (!refRes.ok) {
        const err = await refRes.json().catch(() => ({}));
        return {
          success: false,
          error: (err as { message?: string }).message || `Failed to get base ref: ${refRes.status}`,
        };
      }
      const refData = (await refRes.json()) as { object?: { sha?: string } };
      const baseSha = refData?.object?.sha;
      if (!baseSha) {
        return { success: false, error: "Could not get base branch SHA" };
      }

      // 2. Create blobs for each file
      const treeItems: Array<{ path: string; sha: string; mode: string; type: string }> = [];
      for (const f of files) {
        const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            content: Buffer.from(f.content, "utf8").toString("base64"),
            encoding: "base64",
          }),
        });
        if (!blobRes.ok) {
          const err = await blobRes.json().catch(() => ({}));
          return { success: false, error: (err as { message?: string }).message || `Failed to create blob for ${f.path}` };
        }
        const blobData = (await blobRes.json()) as { sha: string };
        treeItems.push({ path: f.path, sha: blobData.sha, mode: "100644", type: "blob" });
      }

      // 3. Create tree
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseSha,
          tree: treeItems.map((b) => ({ path: b.path, sha: b.sha, mode: b.mode, type: b.type })),
        }),
      });
      if (!treeRes.ok) {
        const err = await treeRes.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message || "Failed to create tree" };
      }
      const treeData = (await treeRes.json()) as { sha: string };

      // 4. Create commit
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: `[Vision XIX] ${title}`,
          tree: treeData.sha,
          parents: [baseSha],
          author: {
            name: "Vision XIX Automation",
            email: "automation@visionxixlabs.com",
          },
        }),
      });
      if (!commitRes.ok) {
        const err = await commitRes.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message || "Failed to create commit" };
      }
      const commitData = (await commitRes.json()) as { sha: string };

      // 5. Create branch ref pointing to our commit (use unique branch name)
      const branchRef = `refs/heads/${head}`;
      const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: branchRef, sha: commitData.sha }),
      });
      if (!createRefRes.ok) {
        if (createRefRes.status === 422) {
          // Branch exists — PATCH to update
          const patchRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${head}`,
            { method: "PATCH", headers, body: JSON.stringify({ sha: commitData.sha }) }
          );
          if (!patchRes.ok) {
            const err = await patchRes.json().catch(() => ({}));
            return { success: false, error: (err as { message?: string }).message || "Failed to update branch" };
          }
        } else {
          const err = await createRefRes.json().catch(() => ({}));
          return { success: false, error: (err as { message?: string }).message || "Failed to create branch" };
        }
      }
    }

    // 6. Create PR
    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `[Vision XIX] ${title}`,
        body,
        head,
        base,
      }),
    });

    if (!prRes.ok) {
      const err = await prRes.json().catch(() => ({}));
      return {
        success: false,
        error: err.message || `Failed to create PR: ${prRes.status}`,
      };
    }

    const prData = (await prRes.json()) as { html_url?: string; number?: number };
    return {
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

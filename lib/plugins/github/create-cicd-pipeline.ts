/**
 * GitHub Create CI/CD Pipeline — generates and commits GitHub Actions workflow.
 * Detects repo stack from indicator files (package.json, go.mod, requirements.txt, pyproject.toml).
 * Dry run returns preview YAML without writing to GitHub.
 * Apply creates a branch, commits .github/workflows/ci.yml, and opens a PR.
 * Requires GitHub connector and CONFIRM APPLY before writing.
 */

import { registerExecutionPlugin } from "../executionRegistry";
import { getGitHubToken } from "../credentials";
import { createPullRequest } from "@/lib/connectors/githubWrite";
import type { ExecutionPluginContext, PluginResult } from "../types";

type DetectedStack = "Node.js" | "Python" | "Go" | "Unknown";

type StackDetection = {
  stack: DetectedStack;
  notes: string[];
};

/** Check indicator files to determine the repo stack. Falls back to GitHub languages API. */
async function detectStack(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<StackDetection> {
  const notes: string[] = [];

  const fileChecks: Array<{ path: string; stack: DetectedStack }> = [
    { path: "package.json", stack: "Node.js" },
    { path: "go.mod", stack: "Go" },
    { path: "requirements.txt", stack: "Python" },
    { path: "pyproject.toml", stack: "Python" },
  ];

  for (const { path, stack } of fileChecks) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers }
    );
    if (res.ok) {
      notes.push(`Found ${path} — detected stack: ${stack}.`);
      return { stack, notes };
    }
  }

  // Fallback: GitHub languages API (byte counts per language)
  const langRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
    { headers }
  );
  if (langRes.ok) {
    const languages = (await langRes.json()) as Record<string, number>;
    const js = (languages["JavaScript"] ?? 0) + (languages["TypeScript"] ?? 0);
    const py = languages["Python"] ?? 0;
    const go = languages["Go"] ?? 0;
    if (go > 0 && go >= py && go >= js) {
      notes.push("No go.mod found. Detected Go via GitHub languages API.");
      return { stack: "Go", notes };
    }
    if (py > 0 && py >= js) {
      notes.push("No requirements.txt/pyproject.toml found. Detected Python via GitHub languages API.");
      return { stack: "Python", notes };
    }
    if (js > 0) {
      notes.push("No package.json found. Detected JavaScript/TypeScript via GitHub languages API.");
      return { stack: "Node.js", notes };
    }
  }

  notes.push("Could not detect stack from files or GitHub API. Defaulting to Node.js workflow.");
  return { stack: "Unknown", notes };
}

function generateWorkflow(stack: DetectedStack): string {
  if (stack === "Go") {
    return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache: true

      - name: Build
        run: go build -v ./...

      - name: Test
        run: go test -v ./...
`;
  }

  if (stack === "Python") {
    return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt || pip install -e .

      - name: Lint
        run: |
          pip install ruff --quiet
          ruff check . --output-format=concise || true

      - name: Test
        run: pytest -v || python -m pytest -v || true
`;
  }

  // Default: Node.js (also covers Unknown stack)
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build --if-present

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm test --if-present
`;
}

async function run(
  input: Record<string, unknown>,
  ctx: ExecutionPluginContext
): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("create-cicd-pipeline started", { dryRun: ctx.dryRun });

  if (!ctx.credentialsKey) {
    return {
      ok: false,
      error: "GitHub connector required. Link GitHub in Connectors first.",
      summary: "Connector required.",
    };
  }

  const token = await getGitHubToken(ctx.credentialsKey);
  if (!token) {
    return {
      ok: false,
      error: "GitHub connector not linked or validated. Connect GitHub in Connectors first.",
      summary: "Connector required.",
    };
  }

  let owner = String(input?.owner ?? "").trim();
  let repo = String(input?.repo ?? "").trim();
  const repoUrl = String(input?.repoUrl ?? "").trim();

  if ((!owner || !repo) && repoUrl) {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      owner = match[1];
      repo = match[2].replace(/\.git$/, "");
    }
  }
  if (!owner || !repo) {
    return {
      ok: false,
      error: "owner and repo required (or repoUrl: https://github.com/owner/repo).",
      summary: "Invalid input.",
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Generate branch name up-front so dry run and apply share the same preview.
  const branch = `visionxix-cicd-${Date.now()}`;
  const workflowPath = ".github/workflows/ci.yml";
  const repoFullName = `${owner}/${repo}`;

  const recommendations: string[] = [
    "Enable branch protection on main/master with required CI status checks before merging.",
    "Add dependency caching to speed up subsequent CI runs.",
    "Consider extending this workflow with a CD stage once deployment targets are confirmed.",
    "Pin action versions (e.g. actions/checkout@v4) to a specific SHA for supply-chain security.",
  ];

  try {
    // Detect stack from indicator files (with languages API fallback).
    const { stack, notes } = await detectStack(owner, repo, headers);
    const workflowYaml = generateWorkflow(stack);

    if (ctx.dryRun) {
      logger.info("create-cicd-pipeline dry run", { owner, repo, stack });
      return {
        ok: true,
        data: {
          repo: repoFullName,
          detectedStack: stack,
          workflowPath,
          branch,
          workflowPreview: workflowYaml,
          notes,
          recommendations,
        },
        summary: `Dry run: would create ${workflowPath} for ${repoFullName} (${stack}). Type CONFIRM APPLY to commit.`,
      };
    }

    // Apply mode: resolve default branch, create branch + commit + PR.
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const baseBranch = repoRes.ok
      ? ((await repoRes.json()) as { default_branch?: string })?.default_branch ?? "main"
      : "main";

    const prResult = await createPullRequest({
      token,
      owner,
      repo,
      title: "Add GitHub Actions CI workflow",
      body: `Adds CI workflow for **${stack}** (auto-detected from repository files).\n\nMerge to enable automated tests on every push and pull request.`,
      head: branch,
      base: baseBranch,
      files: [{ path: workflowPath, content: workflowYaml }],
    });

    if (!prResult.success) {
      return {
        ok: false,
        error: prResult.error ?? "Failed to create PR",
        summary: "PR creation failed.",
      };
    }

    notes.push(`Branch ${branch} created targeting ${baseBranch}.`);
    logger.info("create-cicd-pipeline applied", {
      owner, repo, stack, branch, prUrl: prResult.prUrl,
    });

    return {
      ok: true,
      data: {
        repo: repoFullName,
        detectedStack: stack,
        workflowPath,
        branch,
        pullRequestUrl: prResult.prUrl,
        notes,
        recommendations,
      },
      summary: `PR created for ${repoFullName} — merge to activate ${stack} CI workflow.`,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("create-cicd-pipeline failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "CI/CD pipeline creation failed.",
    };
  }
}

registerExecutionPlugin({
  id: "github:create-cicd-pipeline",
  name: "GitHub Create CI/CD Pipeline",
  description:
    "Detect repo stack from indicator files (package.json, go.mod, requirements.txt, pyproject.toml), generate GitHub Actions CI workflow, create PR with .github/workflows/ci.yml. Dry run returns preview; apply requires CONFIRM APPLY.",
  scopesRequired: ["cloud:read"],
  readOnly: false,
  modifiesInfrastructure: true,
  run,
});

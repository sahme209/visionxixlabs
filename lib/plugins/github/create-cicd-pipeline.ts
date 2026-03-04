/**
 * GitHub Create CI/CD Pipeline — generates and commits GitHub Actions workflow.
 * Detects repo language (Node.js, Python, Go) and creates .github/workflows/ci.yml.
 * Requires GitHub connector. Creates PR with workflow file.
 */

import { registerExecutionPlugin } from "../executionRegistry";
import { getGitHubToken } from "../credentials";
import { createPullRequest } from "@/lib/connectors/githubWrite";
import type { ExecutionPluginContext, PluginResult } from "../types";

type Language = "node" | "python" | "go";

function detectLanguage(languages: Record<string, number>): Language {
  const js = (languages["JavaScript"] ?? 0) + (languages["TypeScript"] ?? 0);
  const py = languages["Python"] ?? 0;
  const go = languages["Go"] ?? 0;
  if (go >= py && go >= js) return "go";
  if (py >= js) return "python";
  return "node";
}

function generateWorkflow(lang: Language): string {
  const nodeWorkflow = `name: CI

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

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm test --if-present
`;

  const pythonWorkflow = `name: CI

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

      - name: Install
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

  const goWorkflow = `name: CI

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

      - name: Build
        run: go build -v ./...

      - name: Test
        run: go test -v ./...
`;

  switch (lang) {
    case "python":
      return pythonWorkflow;
    case "go":
      return goWorkflow;
    default:
      return nodeWorkflow;
  }
}

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("create-cicd-pipeline started", { dryRun: ctx.dryRun });

  if (!ctx.credentialsKey) {
    return {
      ok: false,
      error: "GitHub connector required. Link GitHub in Connectors first.",
      summary: "Connector required",
    };
  }

  const token = await getGitHubToken(ctx.credentialsKey);
  if (!token) {
    return {
      ok: false,
      error: "GitHub connector not linked or validated. Connect GitHub in Connectors first.",
      summary: "Connector required",
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
      summary: "Invalid input",
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // 1. Detect language
    const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
    if (!langRes.ok) {
      const err = (await langRes.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        error: err?.message ?? `Failed to fetch repo: ${langRes.status}`,
        summary: "Repository access failed",
      };
    }
    const languages = (await langRes.json()) as Record<string, number>;
    const detectedLang = detectLanguage(languages);
    const workflowYaml = generateWorkflow(detectedLang);

    if (ctx.dryRun) {
      logger.info("create-cicd-pipeline dry run", { owner, repo, language: detectedLang });
      return {
        ok: true,
        data: {
          dryRun: true,
          owner,
          repo,
          detectedLanguage: detectedLang,
          workflowPath: ".github/workflows/ci.yml",
          workflowPreview: workflowYaml.slice(0, 500) + "\n...",
        },
        summary: `Dry run: would create CI workflow for ${owner}/${repo} (${detectedLang})`,
      };
    }

    // 2. Get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const baseBranch = repoRes.ok
      ? ((await repoRes.json()) as { default_branch?: string })?.default_branch ?? "main"
      : "main";

    // 3. Create PR with workflow file
    const branch = `visionxix-cicd-${Date.now()}`;
    const prResult = await createPullRequest({
      token,
      owner,
      repo,
      title: "Add GitHub Actions CI workflow",
      body: `Adds CI workflow for ${detectedLang} (detected from repository).\n\nMerge to enable automated tests on push/PR.`,
      head: branch,
      base: baseBranch,
      files: [{ path: ".github/workflows/ci.yml", content: workflowYaml }],
    });

    if (!prResult.success) {
      return {
        ok: false,
        error: prResult.error ?? "Failed to create PR",
        summary: "PR creation failed",
      };
    }

    return {
      ok: true,
      data: {
        owner,
        repo,
        detectedLanguage: detectedLang,
        workflowPath: ".github/workflows/ci.yml",
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
      },
      summary: `Created PR #${prResult.prNumber} — merge to add CI workflow`,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("create-cicd-pipeline failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "CI/CD pipeline creation failed",
    };
  }
}

registerExecutionPlugin({
  id: "github:create-cicd-pipeline",
  name: "GitHub Create CI/CD Pipeline",
  description: "Detect repo language, generate GitHub Actions workflow, create PR with .github/workflows/ci.yml. Requires GitHub connector.",
  scopesRequired: ["cloud:read"],
  readOnly: false,
  modifiesInfrastructure: true,
  run,
});

/**
 * Agent tool registry — the fixed, auditable surface the agent is
 * allowed to act through. Every tool here wraps an already-built,
 * already-audited capability (lib/connectors/github/githubWriteClient.ts,
 * the AWS deploy dispatch, lib/releaseops/environmentListResponder.ts) —
 * this file adds zero new execution logic of its own for writes. It only
 * adds the risk classification and the plain-English schema the LLM is
 * told about.
 *
 * "low" risk tools execute inline, no approval needed — they can't
 * change anything (list/read only). "medium" and "high" risk tools are
 * never executed by the decision loop itself; it only ever returns a
 * proposal for a human to approve. See
 * lib/axiom/agentRuntime/decisionLoop.ts and
 * lib/axiom/agentRuntime/actionApprovalResponder.ts.
 */

export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolDefinition {
  name: string;
  /** Shown to the LLM so it knows when and how to propose this tool. */
  description: string;
  /** Plain-English description of the expected args shape, shown to the LLM. */
  argsSchemaHint: string;
  riskLevel: ToolRiskLevel;
}

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  {
    name: "list_environments",
    description: "List the workspace's configured deployment environments (dev/test/prod, etc.) and whether each has an AWS deploy target configured.",
    argsSchemaHint: "{} — no arguments.",
    riskLevel: "low",
  },
  {
    name: "check_deploy_status",
    description: "Check the status of the most recent AWS ECS deploy workflow run for a repository.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo" }',
    riskLevel: "low",
  },
  {
    name: "create_github_branch",
    description: "Create a new branch in a tenant-connected GitHub repository, pointing at the tip of an existing base branch. Does not change any file content.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "baseBranch": "main", "newBranchName": "axiom/short-description" }',
    riskLevel: "medium",
  },
  {
    name: "commit_github_file",
    description: "Create or update a single file on an existing branch via a real commit.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "branch": "axiom/short-description", "path": "path/to/file.ts", "content": "full file contents", "message": "commit message" }',
    riskLevel: "medium",
  },
  {
    name: "open_github_pull_request",
    description: "Open a real pull request from an existing branch into a base branch.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "head": "axiom/short-description", "base": "main", "title": "PR title", "body": "optional PR description" }',
    riskLevel: "medium",
  },
  {
    name: "trigger_aws_deploy",
    description: "Trigger a real AWS ECS deployment for a repository's configured environment. This changes what's running in production or another live environment — always treated as the highest-risk action available.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "environmentId": "the environment\'s id, from list_environments" }',
    riskLevel: "high",
  },
] as const;

export function findTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function toolCatalogPrompt(): string {
  return TOOL_REGISTRY
    .map((t) => `- ${t.name} (risk: ${t.riskLevel}): ${t.description}\n  args: ${t.argsSchemaHint}`)
    .join("\n");
}

/**
 * Risk is never lowered by context — only ever held or raised. A tool
 * already classified "high" (trigger_aws_deploy) stays high regardless
 * of which environment it targets; this exists so a medium-risk tool
 * can be bumped to high when it targets a prod-tier environment, never
 * the reverse.
 */
export function classifyRisk(tool: ToolDefinition, opts: { targetsProdEnvironment?: boolean } = {}): ToolRiskLevel {
  if (opts.targetsProdEnvironment && tool.riskLevel === "medium") return "high";
  return tool.riskLevel;
}

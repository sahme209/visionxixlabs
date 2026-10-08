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
    description: "List the workspace's configured deployment environments (dev/test/prod, etc.).",
    argsSchemaHint: "{} — no arguments.",
    riskLevel: "low",
  },
  {
    name: "list_integrations",
    description: "List the workspace's service-verified GitHub, AWS, Azure, Google Cloud, Slack, Microsoft Teams, and Linear connection states. This never returns credentials or provider account identifiers.",
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
    name: "list_deployment_executions",
    description: "List recent recorded deploy executions for this workspace, optionally filtered to one environment. Use this to find the id of a prior successful deploy before proposing trigger_aws_deploy as a promotion (e.g. promoting a build that already succeeded in dev to test).",
    argsSchemaHint: '{ "environmentId": "optional, from list_environments" }',
    riskLevel: "low",
  },
  {
    name: "list_github_files",
    description: "List repository file paths on a selected branch. Use this before asking the user for a path when they request a broad repository review or do not know the exact file name.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "branch": "main", "pathPrefix": "optional directory prefix such as src/" }',
    riskLevel: "low",
  },
  {
    name: "read_github_file",
    description: "Read one UTF-8 text file from a tenant-connected GitHub repository so you can inspect it before proposing an edit.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "branch": "main", "path": "path/to/file.ts" }',
    riskLevel: "low",
  },
  {
    name: "preview_scim_lifecycle",
    description: "Preview joiner, mover, and leaver access changes from a directory snapshot. This is a pure preview and never changes access.",
    argsSchemaHint: '{ "employees": [{ "id": "u1", "email": "person@example.com", "status": "active|on_leave|terminated", "desiredRoles": ["operator"] }], "currentGrants": [{ "userId": "u1", "role": "operator", "grantedAtIso": "2026-01-01T00:00:00Z" }] }',
    riskLevel: "low",
  },
  {
    name: "create_environment",
    description: "Create a governed workspace deployment environment such as dev, stage, or prod. Existing matching slugs are returned idempotently.",
    argsSchemaHint: '{ "slug": "stage", "name": "Staging", "tier": "dev|test|qa|uat|stage|preprod|prod" }',
    riskLevel: "medium",
  },
  {
    name: "configure_deployment_target",
    description: "Configure the AWS OIDC role, region, ECS cluster, and ECS service used for real deployments to an environment.",
    argsSchemaHint: '{ "environmentId": "env id", "roleArn": "arn:aws:iam::123456789012:role/name", "region": "us-east-1", "ecsCluster": "cluster", "ecsService": "service" }',
    riskLevel: "high",
  },
  {
    name: "connect_identity_provider",
    description: "Store a pending OIDC or SAML identity-provider configuration. This does not activate enterprise sign-in; a real metadata exchange and test assertion are still required.",
    argsSchemaHint: '{ "protocol": "oidc|saml", "issuerOrEntityId": "issuer", "metadataDocument": "metadata", "managedDomains": ["example.com"], "roleMapping": [{ "claimKey": "groups", "claimValue": "platform", "role": "operator" }], "requireMfaClaim": true }',
    riskLevel: "high",
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
    description: "Trigger a real AWS ECS deployment for a repository's configured environment from an explicit branch or tag. Configured branch policies are checked against live GitHub evidence before dispatch. Some environments require promotion: their policy only allows a deploy that carries promotedFromExecutionId pointing at a completed, successful deploy execution against the specific prior environment (e.g. test requires promoting from a dev execution), with the exact same resolved commit — use list_deployment_executions to find that id. This changes what's running in production or another live environment — always treated as the highest-risk action available.",
    argsSchemaHint: '{ "repositoryFullName": "owner/repo", "environmentId": "the environment\'s id, from list_environments", "sourceRef": "main or v1.2.3", "sourceKind": "branch|tag", "pullRequestNumber": 123, "promotedFromExecutionId": "optional, required by some environments\' policy, from list_deployment_executions" }',
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

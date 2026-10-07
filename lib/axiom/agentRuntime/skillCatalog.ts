/**
 * Curated workspace skills. A skill adds workflow guidance only; it never
 * grants a credential, enables a connector, or changes a tool's risk level.
 * Every referenced tool is part of the fixed audited Agent registry.
 */

export interface AgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  category: "GitHub" | "Deployments" | "Governance" | "Identity";
  toolNames: readonly string[];
  instructions: string;
}

export const AGENT_SKILL_CATALOG: readonly AgentSkillDefinition[] = [
  {
    id: "safe-repository-change",
    name: "Safe repository change",
    description: "Inspect a GitHub file, preserve unrelated content, commit on a dedicated branch, and open a reviewable pull request.",
    category: "GitHub",
    toolNames: ["list_integrations", "read_github_file", "create_github_branch", "commit_github_file", "open_github_pull_request"],
    instructions: "For repository edits, verify GitHub first, read the target file before changing it, use a dedicated axiom/* branch, keep the change narrowly scoped, and finish with a pull request. Never commit directly to the base branch.",
  },
  {
    id: "aws-ecs-release",
    name: "AWS ECS release",
    description: "Prepare and trigger the existing OIDC-backed ECS deployment workflow with environment and status checks.",
    category: "Deployments",
    toolNames: ["list_integrations", "list_environments", "check_deploy_status", "trigger_aws_deploy"],
    instructions: "Before proposing an ECS release, verify AWS and GitHub connection state, list environments, confirm the exact repository and environment, and check the latest deployment status. Production dispatch always requires explicit approval.",
  },
  {
    id: "environment-bootstrap",
    name: "Environment bootstrap",
    description: "Create a governed environment and prepare its AWS deployment target without inventing infrastructure values.",
    category: "Deployments",
    toolNames: ["list_environments", "create_environment", "configure_deployment_target"],
    instructions: "List environments before creating one. Ask for missing role ARN, region, ECS cluster, and service values; never guess them. Treat deployment-target configuration as high risk and explain every value in the approval proposal.",
  },
  {
    id: "integration-audit",
    name: "Integration audit",
    description: "Review service-verified provider health and clearly separate consent, validation, suspension, and active access.",
    category: "Governance",
    toolNames: ["list_integrations"],
    instructions: "Use list_integrations as the source of truth. Never describe consent-recorded or awaiting-validation providers as connected. Summarize attention items without exposing account identifiers or credentials.",
  },
  {
    id: "release-readiness",
    name: "Release readiness check",
    description: "Collect environment, integration, and current deployment evidence before recommending a release action.",
    category: "Governance",
    toolNames: ["list_integrations", "list_environments", "check_deploy_status"],
    instructions: "Build readiness from live tool evidence. Identify missing integrations, ambiguous environments, and failed or in-progress deployments. Do not propose a deploy until targets are explicit and blockers are resolved.",
  },
  {
    id: "identity-lifecycle-preview",
    name: "Identity lifecycle preview",
    description: "Preview joiner, mover, and leaver changes without modifying workspace access.",
    category: "Identity",
    toolNames: ["preview_scim_lifecycle"],
    instructions: "Use the SCIM lifecycle preview only with explicit employee and current-grant inputs. Clearly label the result as a preview; never claim that access was changed.",
  },
] as const;

export function findAgentSkill(id: string): AgentSkillDefinition | undefined {
  return AGENT_SKILL_CATALOG.find((skill) => skill.id === id);
}

export interface AgentSkillInstallationRow { skillId: string; status: string }
export interface AgentSkillRepo {
  agentSkillInstallation: {
    findMany(args: { where: { organizationId: string; status?: string } }): Promise<AgentSkillInstallationRow[]>;
  };
}

export async function installedSkillPrompt(repo: AgentSkillRepo, organizationId: string): Promise<string> {
  const rows = await repo.agentSkillInstallation.findMany({ where: { organizationId, status: "enabled" } });
  const installed = rows
    .filter((row) => row.status === "enabled")
    .map((row) => findAgentSkill(row.skillId))
    .filter((skill): skill is AgentSkillDefinition => Boolean(skill));
  if (installed.length === 0) return "No optional workspace skills are enabled.";
  return installed.map((skill) => `Skill: ${skill.name} (${skill.id})\n${skill.instructions}\nPermitted workflow tools: ${skill.toolNames.join(", ")}`).join("\n\n");
}

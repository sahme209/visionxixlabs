import { describe, expect, it, vi } from "vitest";
import { AGENT_SKILL_CATALOG, installedSkillPrompt, parseSkillInvocation, resolveInstalledSkillContext } from "../skillCatalog";

describe("workspace skill catalog", () => {
  it("references only tools from the fixed governed registry", async () => {
    const { TOOL_REGISTRY } = await import("../tools");
    const known = new Set(TOOL_REGISTRY.map((tool) => tool.name));
    for (const skill of AGENT_SKILL_CATALOG) {
      expect(skill.toolNames.length).toBeGreaterThan(0);
      for (const toolName of skill.toolNames) expect(known.has(toolName)).toBe(true);
    }
  });

  it("loads guidance only for enabled installations", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { skillId: "integration-audit", status: "enabled" },
      { skillId: "aws-ecs-release", status: "disabled" },
    ]);
    const prompt = await installedSkillPrompt({ agentSkillInstallation: { findMany } }, "org-1");
    expect(findMany).toHaveBeenCalledWith({ where: { organizationId: "org-1", status: "enabled" } });
    expect(prompt).toContain("Integration audit");
    expect(prompt).not.toContain("AWS ECS release");
  });

  it("parses slash invocations without treating ordinary chat as a skill", () => {
    expect(parseSkillInvocation("/aws-ecs-release deploy widgets")).toBe("aws-ecs-release");
    expect(parseSkillInvocation("please /aws-ecs-release deploy widgets")).toBeNull();
  });

  it("fails closed when an invoked skill is not enabled", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const result = await resolveInstalledSkillContext({ agentSkillInstallation: { findMany } }, "org-1", "aws-ecs-release");
    expect(result).toEqual({ ok: false, error: "skill_not_installed", skillId: "aws-ecs-release" });
  });
});

it.each(['repository-code-review','debugging-investigation','terraform-review'])('requires an enabled installation before loading %s guidance',async(skillId)=>{
 const findMany=vi.fn().mockResolvedValue([]);
 expect(await resolveInstalledSkillContext({agentSkillInstallation:{findMany}},'org-1',skillId)).toMatchObject({ok:false,error:'skill_not_installed'});
 findMany.mockResolvedValue([{skillId,status:'enabled'}]);
 const result=await resolveInstalledSkillContext({agentSkillInstallation:{findMany}},'org-1',skillId);
 expect(result.ok).toBe(true);
 if(result.ok){expect(result.invokedSkill?.id).toBe(skillId);expect(result.prompt).toContain('Explicitly invoked skill');expect(result.invokedSkill?.toolNames.some(name=>/commit|deploy|create|configure/.test(name))).toBe(false);}
});

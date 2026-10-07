import { describe, expect, it, vi } from "vitest";
import { AGENT_SKILL_CATALOG, installedSkillPrompt } from "../skillCatalog";

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
});

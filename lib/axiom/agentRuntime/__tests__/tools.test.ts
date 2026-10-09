import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY, findTool, classifyRisk, toolCatalogPrompt } from "../tools";

describe("TOOL_REGISTRY", () => {
  it("has exactly the governed tools the agent runtime wires up", () => {
    const names = TOOL_REGISTRY.map((t) => t.name).sort();
    expect(names).toEqual([
      "check_deploy_status", "commit_github_file", "configure_deployment_target",
      "connect_identity_provider", "create_environment", "create_github_branch",
      "inspect_github_repository", "list_deployment_executions", "list_environments", "list_github_files", "list_integrations", "open_github_pull_request",
      "preview_scim_lifecycle", "read_github_file", "trigger_aws_deploy",
    ]);
  });

  it("classifies every read-only tool as low risk", () => {
    expect(findTool("list_environments")?.riskLevel).toBe("low");
    expect(findTool("list_integrations")?.riskLevel).toBe("low");
    expect(findTool("check_deploy_status")?.riskLevel).toBe("low");
    expect(findTool("list_deployment_executions")?.riskLevel).toBe("low");
    expect(findTool("read_github_file")?.riskLevel).toBe("low");
    expect(findTool("list_github_files")?.riskLevel).toBe("low");
    expect(findTool("inspect_github_repository")?.riskLevel).toBe("low");
    expect(findTool("preview_scim_lifecycle")?.riskLevel).toBe("low");
  });

  it("classifies every GitHub write tool as medium risk by default", () => {
    expect(findTool("create_github_branch")?.riskLevel).toBe("medium");
    expect(findTool("commit_github_file")?.riskLevel).toBe("medium");
    expect(findTool("open_github_pull_request")?.riskLevel).toBe("medium");
  });

  it("classifies trigger_aws_deploy as high risk unconditionally", () => {
    expect(findTool("trigger_aws_deploy")?.riskLevel).toBe("high");
  });

  it("keeps sensitive tenant configuration approval-gated", () => {
    expect(findTool("create_environment")?.riskLevel).toBe("medium");
    expect(findTool("configure_deployment_target")?.riskLevel).toBe("high");
    expect(findTool("connect_identity_provider")?.riskLevel).toBe("high");
  });
});

describe("classifyRisk", () => {
  it("never lowers risk — a high-risk tool stays high even without a prod target", () => {
    const tool = findTool("trigger_aws_deploy")!;
    expect(classifyRisk(tool, { targetsProdEnvironment: false })).toBe("high");
  });

  it("bumps a medium-risk tool to high when it targets a prod environment", () => {
    const tool = findTool("open_github_pull_request")!;
    expect(classifyRisk(tool, { targetsProdEnvironment: true })).toBe("high");
  });

  it("leaves a medium-risk tool at medium when there is no prod target", () => {
    const tool = findTool("open_github_pull_request")!;
    expect(classifyRisk(tool, { targetsProdEnvironment: false })).toBe("medium");
  });

  it("never bumps a low-risk tool — read-only stays safe regardless of target", () => {
    const tool = findTool("list_environments")!;
    expect(classifyRisk(tool, { targetsProdEnvironment: true })).toBe("low");
  });
});

describe("toolCatalogPrompt", () => {
  it("includes every tool's name and risk level, for the LLM to read", () => {
    const prompt = toolCatalogPrompt();
    for (const tool of TOOL_REGISTRY) {
      expect(prompt).toContain(tool.name);
      expect(prompt).toContain(`risk: ${tool.riskLevel}`);
    }
  });
});

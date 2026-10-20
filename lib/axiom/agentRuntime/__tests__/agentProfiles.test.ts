import { expect, it } from "vitest";
import { AGENT_PROFILES, profileToolNames, resolveAgentProfile } from "../agentProfiles";
import { TOOL_REGISTRY } from "../tools";
it("uses registered tools only and preserves general/omitted behavior", () => {
  const registered = TOOL_REGISTRY.map(tool => tool.name);
  expect(resolveAgentProfile()).toEqual(resolveAgentProfile("general"));
  expect(profileToolNames(resolveAgentProfile()!, registered)).toEqual(registered);
  for (const profile of AGENT_PROFILES) {
    for (const tool of profile.allowedTools ?? []) expect(registered).toContain(tool);
    expect(profileToolNames(profile, [])).toEqual([]);
  }
});
it("keeps every review profile capability read-only", () => {
  for (const name of resolveAgentProfile("code_review")!.allowedTools!) expect(TOOL_REGISTRY.find(tool => tool.name === name)?.riskLevel).toBe("low");
});
it.each([null, 1, {}, "constructor", "__proto__", "unknown"])("refuses non-catalog profile %j", value => {
  expect(resolveAgentProfile(value)).toBeNull();
});

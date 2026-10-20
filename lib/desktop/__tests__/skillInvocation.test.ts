import {expect, it} from "vitest";
import {selectSkillInvocation} from "../../../desktop/src/lib/skillInvocation";
import {parseSkillInvocation} from "../../axiom/agentRuntime/skillCatalog";
it("selects one explicit skill while preserving prompt text", () => {
  expect(selectSkillInvocation("Debug this file", "safe-repository-change")).toBe("/safe-repository-change Debug this file");
  expect(selectSkillInvocation("/old-skill Debug this file", "release-readiness")).toBe("/release-readiness Debug this file");
  expect(selectSkillInvocation("/old-skill\n  indented text", "release-readiness")).toBe("/release-readiness   indented text");
  expect(parseSkillInvocation(selectSkillInvocation("Keep this", "release-readiness"))).toBe("release-readiness");
  expect(selectSkillInvocation("Keep this", "bad/skill")).toBe("Keep this");
});

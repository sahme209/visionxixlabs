import { describe, expect, it } from "vitest";
import { RUNBOOK_TEMPLATES, runbookTemplate } from "../runbookTemplates";

describe("runbook templates", () => {
  it("are unique, fit saved-task limits and never instruct direct execution", () => {
    expect(new Set(RUNBOOK_TEMPLATES.map((t) => t.id)).size).toBe(RUNBOOK_TEMPLATES.length);
    for (const t of RUNBOOK_TEMPLATES) {
      expect(t.title.length).toBeLessThanOrEqual(200);
      expect(t.instruction).toMatch(/Do not change anything until the action has been reviewed and approved/);
      expect(t.context).not.toMatch(/password|secret value|token:/i);
    }
    expect(runbookTemplate("roll-back-release")?.title).toBe("Roll back the last release");
    expect(runbookTemplate("nope")).toBeUndefined();
  });
});

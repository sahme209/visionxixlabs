import { describe, expect, it } from "vitest";
import { applySuggestion, suggestBlueprintChanges } from "../blueprintSuggestions";
import { DEFAULT_BLUEPRINT } from "../defaultBlueprint";

describe("blueprint suggestions", () => {
  it("proposes attention, live status, owners and costs from the map and live records", () => {
    const s = suggestBlueprintChanges(DEFAULT_BLUEPRINT, { incidents_open: 2, workspaces_total: 5, leads_30d: 3, deployments_failed_7d: 0 }, 50);
    const ids = s.map((x) => x.id);
    expect(ids).toContain("attention:inc-detect");
    expect(ids).not.toContain("attention:rel-verify");
    expect(ids).toContain("live:in-active");
    expect(ids).toContain("live:out-list");
    expect(ids).toContain("owner:rel-deploy");
    expect(ids).toContain("cost:release");
    expect(ids).not.toContain("cost:finance");
    expect(s[0].kind).toBe("needs_attention");
  });
  it("marks a step live only when applied", () => {
    const [mark] = suggestBlueprintChanges(DEFAULT_BLUEPRINT, { leads_30d: 3 }).filter((x) => x.kind === "mark_live");
    const next = applySuggestion(DEFAULT_BLUEPRINT, mark);
    expect(next.steps.find((x) => x.id === "out-list")?.status).toBe("live");
    expect(DEFAULT_BLUEPRINT.steps.find((x) => x.id === "out-list")?.status).toBe("draft");
  });
});

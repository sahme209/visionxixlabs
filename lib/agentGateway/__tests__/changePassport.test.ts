import { describe, expect, it } from "vitest";
import { buildChangePassport, normalizePassportTools, passportLine, readChangePassport } from "../changePassport";

const at = new Date("2026-11-26T12:00:00Z");
describe("change passport", () => {
  it("builds a deterministic passport with a verifiable digest", () => {
    const p = buildChangePassport({ origin: "external_agent", agent: " claude-code ", model: "claude-opus", tools: ["git", "edit", "git"], ownerUserId: "u1", createdAt: at });
    expect(p).toMatchObject({ v: 1, origin: "external_agent", agent: "claude-code", model: "claude-opus", tools: ["git", "edit"], ownerUserId: "u1", createdAt: "2026-11-26T12:00:00.000Z" });
    expect(p.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(readChangePassport(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(readChangePassport({ ...p, model: "other" })).toBeNull();
    expect(readChangePassport(null)).toBeNull();
  });
  it("never guesses a model and drops invalid tool names", () => {
    const p = buildChangePassport({ origin: "v19_agent", agent: "V19 Agent", model: "", tools: ["list_environments", "bad tool!"], ownerUserId: null, createdAt: at });
    expect(p.model).toBeNull();
    expect(p.tools).toEqual(["list_environments"]);
    expect(passportLine(p)).toBe("V19 Agent (V19 Agent) · model not reported · tools list_environments · owner no recorded owner");
  });
  it("validates reported tool lists", () => {
    expect(normalizePassportTools(undefined)).toEqual([]);
    expect(normalizePassportTools(["a", "a"])).toEqual(["a"]);
    expect(normalizePassportTools("a")).toBeNull();
    expect(normalizePassportTools(Array.from({ length: 21 }, (_, i) => `t${i}`))).toBeNull();
  });
  it("names the owner when a name is known", () => {
    const p = buildChangePassport({ origin: "external_agent", agent: "cursor", tools: [], ownerUserId: "u1", createdAt: at });
    expect(passportLine(p, (id) => (id === "u1" ? "Dana" : null))).toBe("cursor · model not reported · no tools reported · owner Dana");
    expect(passportLine({ ...p, ownerUserId: "dana@example.test" })).toBe("cursor · model not reported · no tools reported · owner dana@example.test");
  });
});

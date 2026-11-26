import { describe, expect, it } from "vitest";
import { normalizeTags, parseSelector, planFanOut } from "../environmentTags";

describe("environment tags", () => {
  it("normalizes, de-duplicates and validates key:value tags", () => {
    expect(normalizeTags([" Tenant:Acme ", "tenant:acme", "ring:1"])).toEqual({ ok: true, tags: ["ring:1", "tenant:acme"] });
    expect(normalizeTags(["no-colon", "x:"])).toEqual({ ok: false, invalid: ["no-colon", "x:"] });
  });
  it("parses selectors with AND terms and wildcards", () => {
    expect(parseSelector("tenant:* region:eu")).toEqual({ ok: true, terms: [{ key: "tenant", value: "*" }, { key: "region", value: "eu" }] });
    expect(parseSelector("bad")).toEqual({ ok: false });
    expect(parseSelector("")).toEqual({ ok: false });
  });
  it("plans fan-out in ring order, with unringed environments last", () => {
    const envs = [
      { id: "1", name: "Acme EU", tier: "prod", tags: ["tenant:acme", "region:eu", "ring:1"] },
      { id: "2", name: "Beta EU", tier: "prod", tags: ["tenant:beta", "region:eu", "ring:0"] },
      { id: "3", name: "Gamma EU", tier: "prod", tags: ["tenant:gamma", "region:eu"] },
      { id: "4", name: "Acme US", tier: "prod", tags: ["tenant:acme", "region:us", "ring:0"] },
    ];
    const out = planFanOut(envs, "tenant:* region:eu");
    expect(out.ok && out.plan.rings.map((r) => [r.ring, r.environments.map((e) => e.id)])).toEqual([[0, ["2"]], [1, ["1"]], [null, ["3"]]]);
    expect(planFanOut(envs, "nonsense")).toEqual({ ok: false, error: "selector_invalid" });
  });
});

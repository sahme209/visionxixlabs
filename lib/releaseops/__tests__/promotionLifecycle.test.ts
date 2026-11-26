import { describe, expect, it } from "vitest";
import { buildLifecycles, describeFinding } from "../promotionLifecycle";

const envs = [{ id: "d", name: "Dev", tier: "dev" }, { id: "s", name: "Staging", tier: "stage" }, { id: "p", name: "Prod", tier: "prod" }];
const pol = (environmentId: string, from: string | null, extra: Partial<{ repositoryId: string; enabled: boolean; branchPattern: string }> = {}) =>
  ({ repositoryId: "r1", repositoryName: "acme/app", environmentId, branchPattern: "main", requirePromotionFromEnvironmentId: from, enabled: true, ...extra });

describe("buildLifecycles", () => {
  it("orders environments into phases from promotion requirements", () => {
    const [l] = buildLifecycles(envs, [pol("d", null), pol("s", "d"), pol("p", "s")]);
    expect(l.phases).toEqual([["d"], ["s"], ["p"]]);
    expect(l.findings).toEqual([]);
  });
  it("flags production reachable without promotion, backwards promotion, unknown sources and cycles", () => {
    const [l] = buildLifecycles(envs, [pol("p", null), pol("s", "p"), pol("d", "gone")]);
    expect(l.findings).toEqual(expect.arrayContaining([
      { kind: "production_without_promotion", environmentId: "p" },
      { kind: "promotes_from_higher_tier", fromEnvironmentId: "p", toEnvironmentId: "s" },
      { kind: "promotes_from_unknown_environment", toEnvironmentId: "d" },
    ]));
    const [c] = buildLifecycles(envs, [pol("s", "p"), pol("p", "s")]);
    expect(c.findings).toContainEqual({ kind: "cycle", environmentIds: ["p", "s"] });
  });
  it("ignores disabled policies and groups by repository", () => {
    const out = buildLifecycles(envs, [pol("p", null, { enabled: false }), pol("d", null, { repositoryId: "r2" })]);
    expect(out.map((l) => l.repositoryId)).toEqual(["r2"]);
    expect(describeFinding({ kind: "production_without_promotion", environmentId: "p" }, (id) => id.toUpperCase())).toMatch(/^P can receive/);
  });
});

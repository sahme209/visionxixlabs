import { describe, expect, it } from "vitest";
import {
  buildPolicySeedBootstrapResponse,
  type PolicySeedBootstrapRepo,
  type SeedExistingRule,
} from "../policySeedBootstrapResponder";
import type { PolicyRuleSeed } from "../policies/seed";

type RepoStub = PolicySeedBootstrapRepo & {
  _existing: Map<string, SeedExistingRule>;
  _creates: Array<{ key: string }>;
  _updates: Array<{ id: string; label: string }>;
};

function makeRepo(): RepoStub {
  let nextId = 1;
  const stub: RepoStub = {
    _existing: new Map(),
    _creates: [],
    _updates: [],
    policyRule: {
      async findMany() { return Array.from(stub._existing.values()); },
      async create({ data }) {
        const id = `r_${nextId++}`;
        stub._existing.set(data.key, { id, key: data.key, source: "seed", enabled: true });
        stub._creates.push({ key: data.key });
        return { id };
      },
      async update({ where, data }) {
        stub._updates.push({ id: where.id, label: data.label });
        return { id: where.id };
      },
    },
  };
  return stub;
}

function seed(over: Partial<PolicyRuleSeed> = {}): PolicyRuleSeed {
  return {
    key: "test_rule", label: "Test rule",
    severity: "medium", blocking: false, exceptionAllowed: true,
    approverRole: null, evidenceRequired: false,
    autoRemediationKey: null, description: "Test description.",
    evaluate: () => ({ violation: false }),
    ...over,
  };
}

describe("buildPolicySeedBootstrapResponse", () => {
  it("empty org → all seeds created", async () => {
    const repo = makeRepo();
    const catalog = [seed({ key: "a" }), seed({ key: "b" }), seed({ key: "c" })];
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o", catalog });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toEqual({ seeded: 3, refreshed: 0, skippedOperatorEdited: 0, totalCatalog: 3 });
    expect(repo._creates).toHaveLength(3);
  });

  it("re-bootstrap of seed-source rules → refreshed, no creates", async () => {
    const repo = makeRepo();
    repo._existing.set("a", { id: "r_1", key: "a", source: "seed", enabled: true });
    repo._existing.set("b", { id: "r_2", key: "b", source: "seed", enabled: true });
    const catalog = [seed({ key: "a", label: "New label A" }), seed({ key: "b", label: "New label B" })];
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o", catalog });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toEqual({ seeded: 0, refreshed: 2, skippedOperatorEdited: 0, totalCatalog: 2 });
    expect(repo._updates.map((u) => u.label).sort()).toEqual(["New label A", "New label B"]);
  });

  it("operator-edited rules → skipped, not overwritten", async () => {
    const repo = makeRepo();
    repo._existing.set("a", { id: "r_1", key: "a", source: "operator", enabled: true });
    const catalog = [seed({ key: "a", label: "Seed-version" })];
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o", catalog });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toEqual({ seeded: 0, refreshed: 0, skippedOperatorEdited: 1, totalCatalog: 1 });
    expect(repo._updates).toEqual([]);
  });

  it("mixed: existing-seed + new + operator-edited", async () => {
    const repo = makeRepo();
    repo._existing.set("seed_a", { id: "r_1", key: "seed_a", source: "seed", enabled: true });
    repo._existing.set("op_b", { id: "r_2", key: "op_b", source: "operator", enabled: true });
    const catalog = [
      seed({ key: "seed_a" }),    // refreshed
      seed({ key: "op_b" }),      // skipped (operator-edited)
      seed({ key: "new_c" }),     // created
    ];
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o", catalog });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toEqual({ seeded: 1, refreshed: 1, skippedOperatorEdited: 1, totalCatalog: 3 });
  });

  it("default catalog uses the real SEED_POLICIES (17 entries)", async () => {
    const repo = makeRepo();
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.totalCatalog).toBeGreaterThanOrEqual(10);
    expect(r.body.data.seeded).toBe(r.body.data.totalCatalog);
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.policyRule.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildPolicySeedBootstrapResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

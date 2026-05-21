import { describe, it, expect } from "vitest";
import {
  assessChangeRisk,
  ChangeRiskAssessorError,
  type ServiceTopology,
  type ProposedChange,
} from "../changeRiskAssessor";

const TOPOLOGY: ServiceTopology = {
  services: [
    { id: "db-orders",      tier: "tier_0", dependsOn: [],                regulated: true  },
    { id: "api-orders",     tier: "tier_0", dependsOn: ["db-orders"],     regulated: true  },
    { id: "api-checkout",   tier: "tier_0", dependsOn: ["api-orders"],    regulated: true  },
    { id: "web-storefront", tier: "tier_1", dependsOn: ["api-checkout"],  regulated: false },
    { id: "internal-tool",  tier: "tier_3", dependsOn: ["api-orders"],    regulated: false },
    { id: "loner",          tier: "tier_2", dependsOn: [],                regulated: false },
  ],
};

function ch(overrides: Partial<ProposedChange> & { targetServiceId: string }): ProposedChange {
  return {
    id: "c-1",
    actionKind: "config_update",
    scope: "single_service",
    reversible: true,
    touchesProd: true,
    ...overrides,
  };
}

describe("assessChangeRisk", () => {
  it("rejects unknown target service", () => {
    expect(() =>
      assessChangeRisk(ch({ targetServiceId: "ghost" }), TOPOLOGY),
    ).toThrow(ChangeRiskAssessorError);
  });

  it("config_update on a leaf tier-3 service → low", () => {
    const r = assessChangeRisk(
      ch({ targetServiceId: "loner", actionKind: "config_update", scope: "single_resource", touchesProd: false }),
      TOPOLOGY,
    );
    expect(r.severity).toBe("low");
    expect(r.affectedServiceIds).toEqual([]);
  });

  it("delete on a tier-0 db with regulated downstream → critical", () => {
    const r = assessChangeRisk(
      ch({ targetServiceId: "db-orders", actionKind: "delete_resource", scope: "infrastructure_wide", reversible: false }),
      TOPOLOGY,
    );
    expect(r.severity).toBe("critical");
    expect(r.regulatedReach).toBe(true);
    expect(r.recommendedGate).toBe("council_3_of_5");
  });

  it("downstream reach is computed transitively", () => {
    const r = assessChangeRisk(ch({ targetServiceId: "db-orders" }), TOPOLOGY);
    // api-orders, api-checkout, web-storefront, internal-tool all transitively depend on db-orders
    expect(r.affectedServiceIds).toEqual(expect.arrayContaining([
      "api-orders", "api-checkout", "web-storefront", "internal-tool",
    ]));
    expect(r.affectedServiceIds).not.toContain("loner");
    expect(r.affectedServiceIds).not.toContain("db-orders"); // self excluded
  });

  it("criticalServiceIds picks up tier_0 + tier_1 reach only", () => {
    const r = assessChangeRisk(ch({ targetServiceId: "db-orders" }), TOPOLOGY);
    expect(r.criticalServiceIds).toEqual(expect.arrayContaining([
      "api-orders", "api-checkout", "web-storefront",
    ]));
    expect(r.criticalServiceIds).not.toContain("internal-tool"); // tier-3
  });

  it("reversible action gets a discount", () => {
    const reversible   = assessChangeRisk(ch({ targetServiceId: "api-orders", actionKind: "deploy", reversible: true }),  TOPOLOGY);
    const irreversible = assessChangeRisk(ch({ targetServiceId: "api-orders", actionKind: "deploy", reversible: false }), TOPOLOGY);
    expect(reversible.score).toBeLessThan(irreversible.score);
  });

  it("prod touch raises the score", () => {
    const prod    = assessChangeRisk(ch({ targetServiceId: "internal-tool", touchesProd: true }),  TOPOLOGY);
    const nonProd = assessChangeRisk(ch({ targetServiceId: "internal-tool", touchesProd: false }), TOPOLOGY);
    expect(prod.score).toBeGreaterThan(nonProd.score);
  });

  it("regulated reach lifts the score floor to 40", () => {
    // Feature flag on api-orders (tier-0, regulated) — base score is low,
    // but regulated reach should lift the score to at least 40.
    const r = assessChangeRisk(
      ch({ targetServiceId: "api-orders", actionKind: "feature_flag", scope: "single_resource", touchesProd: false, reversible: true }),
      TOPOLOGY,
    );
    expect(r.regulatedReach).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it("gate escalates with severity", () => {
    const critical = assessChangeRisk(
      ch({ targetServiceId: "db-orders", actionKind: "delete_resource", scope: "infrastructure_wide", reversible: false }),
      TOPOLOGY,
    );
    expect(critical.recommendedGate).toBe("council_3_of_5");

    const low = assessChangeRisk(
      ch({ targetServiceId: "loner", actionKind: "feature_flag", scope: "single_resource", touchesProd: false }),
      TOPOLOGY,
    );
    expect(low.recommendedGate).toBe("no_gate");
  });

  it("schema_migration scope=multi_service hits high tier", () => {
    const r = assessChangeRisk(
      ch({ targetServiceId: "db-orders", actionKind: "schema_migration", scope: "multi_service", reversible: false }),
      TOPOLOGY,
    );
    expect(["high", "critical"]).toContain(r.severity);
  });

  it("rationale text describes the inputs", () => {
    const r = assessChangeRisk(ch({ targetServiceId: "db-orders" }), TOPOLOGY);
    expect(r.rationale).toMatch(/downstream/);
    expect(r.rationale).toMatch(/tier_0/);
    expect(r.rationale).toMatch(/regulated/);
  });

  it("disconnected service has empty affectedServiceIds", () => {
    const r = assessChangeRisk(ch({ targetServiceId: "loner" }), TOPOLOGY);
    expect(r.affectedServiceIds).toEqual([]);
  });
});

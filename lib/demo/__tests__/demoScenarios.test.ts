import { describe, it, expect } from "vitest";
import {
  DEMO_SCENARIOS,
  isDemoScenarioId,
  listScenarios,
  getScenario,
} from "../demoScenarios";

describe("DEMO_SCENARIOS — Phase 405 contract", () => {
  it("has exactly 13 scenarios (matches the spec)", () => {
    expect(Object.keys(DEMO_SCENARIOS).length).toBe(13);
  });

  it("each id matches its key", () => {
    for (const [key, scenario] of Object.entries(DEMO_SCENARIOS)) {
      expect(scenario.id).toBe(key);
    }
  });

  it("every scenario has at least 3 steps", () => {
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      expect(scenario.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every step inside a scenario has a unique id", () => {
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      const ids = scenario.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every scenario carries a lastReviewed date (living-docs rule)", () => {
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      expect(scenario.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every step's approval field is in the closed-union", () => {
    const validApprovals = new Set(["none", "self_approve", "two_person"]);
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      for (const step of scenario.steps) {
        expect(validApprovals.has(step.approval)).toBe(true);
      }
    }
  });

  it("internal_growth_automation is internal-only (never client-facing)", () => {
    expect(DEMO_SCENARIOS.internal_growth_automation.audience).toBe("internal_only");
  });

  it("first_time_workspace_setup is public (marketing-safe)", () => {
    expect(DEMO_SCENARIOS.first_time_workspace_setup.audience).toBe("public");
  });
});

describe("listScenarios — audience filtering", () => {
  it("public sees only public scenarios", () => {
    const result = listScenarios("public");
    for (const s of result) expect(s.audience).toBe("public");
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it("client sees public + client", () => {
    const result = listScenarios("client");
    for (const s of result) expect(["public", "client"]).toContain(s.audience);
    expect(result.length).toBeGreaterThan(listScenarios("public").length);
  });

  it("internal sees everything (incl. internal_growth_automation)", () => {
    const result = listScenarios("internal_only");
    expect(result.length).toBe(13);
    expect(result.some((s) => s.id === "internal_growth_automation")).toBe(true);
  });

  it("client does NOT see the internal-only growth scenario", () => {
    const result = listScenarios("client");
    expect(result.every((s) => s.id !== "internal_growth_automation")).toBe(true);
  });

  it("public does NOT see client-only scenarios (incident_response etc.)", () => {
    const result = listScenarios("public");
    expect(result.every((s) => s.id !== "incident_response")).toBe(true);
  });
});

describe("isDemoScenarioId / getScenario", () => {
  it("isDemoScenarioId is a typed predicate", () => {
    expect(isDemoScenarioId("cloud_operations")).toBe(true);
    expect(isDemoScenarioId("nonsense_id")).toBe(false);
  });

  it("getScenario returns the scenario by id", () => {
    expect(getScenario("monitoring_alert").title).toContain("Monitoring");
  });
});

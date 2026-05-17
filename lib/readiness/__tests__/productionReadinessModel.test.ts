/**
 * Vitest unit tests for the production readiness model helpers.
 *
 * Pure data-transform tests — no IO, no env reads.
 */

import { describe, it, expect } from "vitest";
import {
  computeOverallScore,
  scoreOf,
  summariseByCategory,
  type ReadinessCheck,
} from "../productionReadinessModel";

function mkCheck(overrides: Partial<ReadinessCheck>): ReadinessCheck {
  return {
    id: "test.check",
    category: "operating_loop_readiness",
    title: "Test check",
    status: "passing",
    severity: "medium",
    evidence: "test",
    sourceMode: "live",
    lastCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("production readiness model", () => {
  it("scoreOf weights statuses correctly", () => {
    expect(scoreOf("passing")).toBe(1.0);
    expect(scoreOf("partial")).toBeCloseTo(0.6);
    expect(scoreOf("preview")).toBeCloseTo(0.4);
    expect(scoreOf("blocked")).toBeCloseTo(0.2);
    expect(scoreOf("failing")).toBe(0);
  });

  it("summariseByCategory groups + counts correctly", () => {
    const checks = [
      mkCheck({ id: "a", category: "provider_readiness", status: "passing" }),
      mkCheck({ id: "b", category: "provider_readiness", status: "partial" }),
      mkCheck({ id: "c", category: "provider_readiness", status: "preview" }),
      mkCheck({ id: "d", category: "security_readiness", status: "failing" }),
    ];
    const scores = summariseByCategory(checks);
    const provider = scores.find((s) => s.category === "provider_readiness");
    const security = scores.find((s) => s.category === "security_readiness");

    expect(provider).toBeDefined();
    expect(provider!.total).toBe(3);
    expect(provider!.passing).toBe(1);
    expect(provider!.partial).toBe(1);
    expect(provider!.preview).toBe(1);

    expect(security).toBeDefined();
    expect(security!.total).toBe(1);
    expect(security!.failing).toBe(1);
  });

  it("computeOverallScore averages category scores", () => {
    const scores = summariseByCategory([
      mkCheck({ id: "1", category: "provider_readiness", status: "passing" }),
      mkCheck({ id: "2", category: "security_readiness", status: "failing" }),
    ]);
    const overall = computeOverallScore(scores);
    // Two categories, scores 1.0 and 0.0 → average 0.5
    expect(overall).toBeCloseTo(0.5);
  });

  it("computeOverallScore handles empty input", () => {
    expect(computeOverallScore([])).toBe(0);
  });
});

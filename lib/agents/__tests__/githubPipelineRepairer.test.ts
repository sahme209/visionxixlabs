import { describe, it, expect, beforeEach } from "vitest";
import {
  repairPipeline,
  __resetRepairCounter,
  type FailedRunSummary,
} from "../githubPipelineRepairer";

function summary(overrides: Partial<FailedRunSummary> = {}): FailedRunSummary {
  return {
    runId: "run-1",
    repo: "owner/repo",
    branch: "main",
    jobName: "test",
    stepName: "Run tests",
    logExcerpt: "",
    flakeRate30d: 0,
    lastGreenSha: null,
    ...overrides,
  };
}

beforeEach(() => __resetRepairCounter());

describe("repairPipeline", () => {
  it("classifies transient network → retry (auto when flake low)", () => {
    const r = repairPipeline(summary({
      logExcerpt: "Error: ECONNRESET reading https://registry.npmjs.org",
      flakeRate30d: 0.02,
    }));
    expect(r.category).toBe("transient_network");
    expect(r.proposalKind).toBe("retry");
    expect(r.recommendedGate).toBe("auto_retry");
  });

  it("transient + high flake → escalates to single_approval", () => {
    const r = repairPipeline(summary({
      logExcerpt: "ETIMEDOUT contacting registry",
      flakeRate30d: 0.2,
    }));
    expect(r.recommendedGate).toBe("single_approval");
  });

  it("classifies npm dependency install", () => {
    const r = repairPipeline(summary({
      logExcerpt: "npm ERR! 404 Not Found - GET https://registry.npmjs.org/some-pkg",
      flakeRate30d: 0,
    }));
    expect(r.category).toBe("dependency_install");
    expect(r.proposalKind).toBe("pin_dependency");
  });

  it("classifies TypeScript compile error", () => {
    const r = repairPipeline(summary({
      logExcerpt: "src/foo.ts(12,5): error TS2304: Cannot find name 'bar'.",
      flakeRate30d: 0,
    }));
    expect(r.category).toBe("compilation");
  });

  it("classifies test assertion failure on stable test → dual approval", () => {
    const r = repairPipeline(summary({
      logExcerpt: "AssertionError: expected 5 to equal 4",
      flakeRate30d: 0.01,
    }));
    expect(r.category).toBe("test_failure");
    expect(r.recommendedGate).toBe("dual_approval");
  });

  it("classifies test failure on flaky test → single approval + quarantine", () => {
    const r = repairPipeline(summary({
      logExcerpt: "Expected response.status to equal 200",
      flakeRate30d: 0.4,
    }));
    expect(r.proposalKind).toBe("quarantine_test");
    expect(r.recommendedGate).toBe("single_approval");
  });

  it("classifies eslint", () => {
    const r = repairPipeline(summary({ logExcerpt: "eslint error: no-unused-vars" }));
    expect(r.category).toBe("lint");
  });

  it("classifies auth failure → dual approval (touches credentials)", () => {
    const r = repairPipeline(summary({ logExcerpt: "401 Unauthorized: invalid token GITHUB_TOKEN" }));
    expect(r.category).toBe("auth");
    expect(r.recommendedGate).toBe("dual_approval");
  });

  it("classifies permission scope → patch workflow yaml", () => {
    const r = repairPipeline(summary({ logExcerpt: "403 Forbidden: Resource not accessible by integration" }));
    expect(r.category).toBe("permission");
    expect(r.patch).toMatch(/permissions:/);
  });

  it("classifies infra OOM", () => {
    const r = repairPipeline(summary({ logExcerpt: "process killed: out of memory" }));
    expect(r.category).toBe("infra");
    expect(r.proposalKind).toBe("raise_runner_size");
  });

  it("classifies config drift", () => {
    const r = repairPipeline(summary({ logExcerpt: "Invalid workflow file: uses: org/missing-action not found" }));
    expect(r.category).toBe("config_drift");
  });

  it("unknown signature → opens investigation", () => {
    const r = repairPipeline(summary({ logExcerpt: "Something we have never seen before." }));
    expect(r.category).toBe("unknown");
    expect(r.proposalKind).toBe("open_investigation_ticket");
  });

  it("rejects out-of-range flakeRate30d", () => {
    expect(() => repairPipeline(summary({ flakeRate30d: -0.1 }))).toThrow();
    expect(() => repairPipeline(summary({ flakeRate30d: 1.5 }))).toThrow();
  });

  it("issues sequential ids", () => {
    const a = repairPipeline(summary({ logExcerpt: "eslint" }));
    const b = repairPipeline(summary({ logExcerpt: "eslint" }));
    expect(a.id).toBe("repair-1");
    expect(b.id).toBe("repair-2");
  });
});

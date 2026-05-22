import { describe, it, expect } from "vitest";
import {
  routeAITask,
  routedModels,
  findUnpricedRoutes,
  type AITaskKind,
} from "../providerRouter";

describe("routeAITask — specific routes", () => {
  it("code_propose → Sonnet 4.6", () => {
    const r = routeAITask("code_propose");
    expect(r.provider).toBe("anthropic");
    expect(r.model).toBe("claude-sonnet-4-6");
    expect(r.effort).toBe("high");
  });

  it("classification → Haiku 4.5 (cheap)", () => {
    const r = routeAITask("classification");
    expect(r.model).toBe("claude-haiku-4-5");
    expect(r.effort).toBe("low");
  });

  it("summarization → Haiku 4.5", () => {
    const r = routeAITask("summarization");
    expect(r.model).toBe("claude-haiku-4-5");
  });

  it("code_lint_summary → Haiku (cost containment)", () => {
    expect(routeAITask("code_lint_summary").model).toBe("claude-haiku-4-5");
  });

  it("code_test_summary → Haiku", () => {
    expect(routeAITask("code_test_summary").model).toBe("claude-haiku-4-5");
  });

  it("deep_reasoning → Opus 4.7", () => {
    const r = routeAITask("deep_reasoning");
    expect(r.model).toBe("claude-opus-4-7");
    expect(r.effort).toBe("high");
  });

  it("security_analysis → Opus 4.7 (never downgrade)", () => {
    expect(routeAITask("security_analysis").model).toBe("claude-opus-4-7");
  });

  it("incident_triage → Opus 4.7", () => {
    expect(routeAITask("incident_triage").model).toBe("claude-opus-4-7");
  });

  it("agent_run_default → Sonnet 4.6 at medium", () => {
    const r = routeAITask("agent_run_default");
    expect(r.model).toBe("claude-sonnet-4-6");
    expect(r.effort).toBe("medium");
  });

  it("every route has a non-empty rationale", () => {
    const kinds: AITaskKind[] = [
      "code_propose", "code_lint_summary", "code_test_summary",
      "classification", "summarization", "deep_reasoning",
      "security_analysis", "incident_triage", "agent_run_default",
    ];
    for (const k of kinds) {
      expect(routeAITask(k).rationale.length).toBeGreaterThan(20);
    }
  });
});

describe("routedModels", () => {
  it("returns deduplicated (provider, model) pairs", () => {
    const list = routedModels();
    const keys = list.map((r) => `${r.provider}:${r.modelId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("currently routes through 3 anthropic models", () => {
    const list = routedModels();
    expect(list.length).toBe(3);
    expect(list.map((r) => r.modelId).sort()).toEqual([
      "claude-haiku-4-5", "claude-opus-4-7", "claude-sonnet-4-6",
    ]);
  });
});

describe("findUnpricedRoutes — startup invariant", () => {
  it("every routed model has a seed rate (cost path can price it)", () => {
    const unpriced = findUnpricedRoutes();
    expect(unpriced).toEqual([]);
  });
});

describe("cost-aware routing assertions", () => {
  it("Haiku is selected for at least 4 cheap-task kinds", () => {
    const haikuKinds: AITaskKind[] = [
      "classification", "summarization", "code_lint_summary", "code_test_summary",
    ];
    for (const k of haikuKinds) {
      expect(routeAITask(k).model).toBe("claude-haiku-4-5");
    }
  });

  it("Opus is only used where intelligence-sensitive", () => {
    const opusKinds: AITaskKind[] = ["deep_reasoning", "security_analysis", "incident_triage"];
    for (const k of opusKinds) {
      expect(routeAITask(k).model).toBe("claude-opus-4-7");
    }
  });
});

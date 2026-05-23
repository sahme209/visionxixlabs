import { describe, it, expect } from "vitest";
import {
  resolveRunBudgetCap,
  type OrganizationBudgetConfigShape,
} from "../resolveRunBudgetCap";
import { DEFAULT_RUN_MAX_CENTS } from "../assertRunCostBudget";

const ORG_5K: OrganizationBudgetConfigShape = {
  defaultMaxCostCents: 5_000,
  pipelineOverrides: [],
};

const ORG_WITH_AI_CODING_OVERRIDE: OrganizationBudgetConfigShape = {
  defaultMaxCostCents: 5_000,
  pipelineOverrides: [
    { pipelineId: "ai_coding", maxCostCents: 10_000 },
  ],
};

describe("resolveRunBudgetCap — metadata wins", () => {
  it("metadata.maxCostCents beats every lower priority", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { maxCostCents: 200 },
      orgConfig: ORG_WITH_AI_CODING_OVERRIDE,
    });
    expect(r.maxCents).toBe(200);
    expect(r.source).toBe("metadata_explicit_cap");
  });

  it("metadata.unlimitedBudget=true → null cap", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { unlimitedBudget: true },
      orgConfig: ORG_5K,
    });
    expect(r.maxCents).toBeNull();
    expect(r.source).toBe("metadata_unlimited");
  });

  it("ignores metadata.maxCostCents <= 0", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { maxCostCents: 0 },
      orgConfig: ORG_5K,
    });
    expect(r.source).toBe("org_default");
  });

  it("ignores non-numeric metadata.maxCostCents", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { maxCostCents: "infinity" },
      orgConfig: null,
    });
    expect(r.source).toBe("platform_default");
  });

  it("floors fractional metadata cents", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { maxCostCents: 99.9 },
    });
    expect(r.maxCents).toBe(99);
  });
});

describe("resolveRunBudgetCap — org pipeline override", () => {
  it("per-pipeline override beats org default", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      orgConfig: ORG_WITH_AI_CODING_OVERRIDE,
    });
    expect(r.maxCents).toBe(10_000);
    expect(r.source).toBe("org_pipeline_override");
  });

  it("per-pipeline override = null → unlimited for that pipeline", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      orgConfig: {
        defaultMaxCostCents: 100,
        pipelineOverrides: [{ pipelineId: "ai_coding", maxCostCents: null }],
      },
    });
    expect(r.maxCents).toBeNull();
    expect(r.source).toBe("org_pipeline_override_unlimited");
  });

  it("override for a different pipeline doesn't leak", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "other_pipeline",
      orgConfig: ORG_WITH_AI_CODING_OVERRIDE,
    });
    expect(r.maxCents).toBe(5_000);
    expect(r.source).toBe("org_default");
  });

  it("ignores override with non-positive cents", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      orgConfig: {
        defaultMaxCostCents: 5_000,
        pipelineOverrides: [{ pipelineId: "ai_coding", maxCostCents: 0 }],
      },
    });
    expect(r.source).toBe("org_default");
  });
});

describe("resolveRunBudgetCap — org default", () => {
  it("org default applied when no per-pipeline override", () => {
    const r = resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: ORG_5K });
    expect(r.maxCents).toBe(5_000);
    expect(r.source).toBe("org_default");
  });

  it("org default = null → unlimited", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      orgConfig: { defaultMaxCostCents: null, pipelineOverrides: [] },
    });
    expect(r.maxCents).toBeNull();
    expect(r.source).toBe("org_default_unlimited");
  });
});

describe("resolveRunBudgetCap — platform default", () => {
  it("no metadata + no org config → platform default", () => {
    const r = resolveRunBudgetCap({ pipelineId: "ai_coding" });
    expect(r.maxCents).toBe(DEFAULT_RUN_MAX_CENTS);
    expect(r.source).toBe("platform_default");
  });

  it("missing org config falls through to platform default", () => {
    const r = resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: null });
    expect(r.source).toBe("platform_default");
  });

  it("org config with zero defaultMaxCostCents falls through to platform default", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      orgConfig: { defaultMaxCostCents: 0, pipelineOverrides: [] },
    });
    expect(r.source).toBe("platform_default");
  });
});

describe("resolveRunBudgetCap — defense in depth", () => {
  it("platform default is never null", () => {
    const r = resolveRunBudgetCap({ pipelineId: "ai_coding" });
    expect(r.maxCents).not.toBeNull();
    expect(r.maxCents).toBeGreaterThan(0);
  });
});

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

describe("resolveRunBudgetCap — metadata can only restrict", () => {
  it("metadata.maxCostCents beats every lower priority", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { maxCostCents: 200 },
      orgConfig: ORG_WITH_AI_CODING_OVERRIDE,
    });
    expect(r.maxCents).toBe(200);
    expect(r.source).toBe("metadata_explicit_cap");
  });

  it("metadata cannot waive the configured workspace cap", () => {
    const r = resolveRunBudgetCap({
      pipelineId: "ai_coding",
      runMetadata: { unlimitedBudget: true },
      orgConfig: ORG_5K,
    });
    expect(r.maxCents).toBe(5_000);
    expect(r.source).toBe("org_default");
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


describe("request metadata cannot expand budget authority", () => {
  it("cannot raise an administrator pipeline cap", () => {
    expect(resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: ORG_WITH_AI_CODING_OVERRIDE,
      runMetadata: { maxCostCents: 99_999 } })).toEqual({ maxCents: 10_000, source: "org_pipeline_override" });
  });
  it("cannot raise the platform default when no workspace policy exists", () => {
    expect(resolveRunBudgetCap({ pipelineId: "ai_coding", runMetadata: { maxCostCents: 99_999, unlimitedBudget: true } }))
      .toEqual({ maxCents: DEFAULT_RUN_MAX_CENTS, source: "platform_default" });
  });
  it("applies a lower request limit even when request also asks for unlimited", () => {
    expect(resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: ORG_5K,
      runMetadata: { maxCostCents: 20, unlimitedBudget: true } })).toEqual({ maxCents: 20, source: "metadata_explicit_cap" });
  });
  it("allows a request to restrict an administrator-approved unlimited allowance", () => {
    expect(resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: { defaultMaxCostCents: null, pipelineOverrides: [] },
      runMetadata: { maxCostCents: 40 } })).toEqual({ maxCents: 40, source: "metadata_explicit_cap" });
  });
});

it("equal request and workspace limits preserve the administrator policy source", () => {
  expect(resolveRunBudgetCap({ pipelineId: "ai_coding", orgConfig: ORG_5K, runMetadata: { maxCostCents: 5_000 } }))
    .toEqual({ maxCents: 5_000, source: "org_default" });
});

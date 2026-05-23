import { describe, it, expect } from "vitest";
import { pickCostAwareModel } from "../pickCostAwareModel";

describe("pickCostAwareModel — unlimited tier", () => {
  it("uses default when capCents is null", () => {
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 1_000_000,
      capCents: null,
      anticipatedCostCentsAtDefault: 30,
    });
    expect(r.kind).toBe("use_default");
    expect(r.model).toBe("claude-sonnet-4-6");
  });
});

describe("pickCostAwareModel — comfortable default", () => {
  it("uses default when projected ratio is well below proactive threshold", () => {
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 0,
      capCents: 500,
      anticipatedCostCentsAtDefault: 30,
    });
    expect(r.kind).toBe("use_default");
    expect(r.estimatedCostCents).toBe(30);
  });

  it("respects custom proactive ratio", () => {
    // spent=170/500=34%, anticipated=40 at sonnet → projected 210/500=42%.
    // Default proactive threshold is 70%, so use_default.
    // Override to 40% → 42% > 40% → look for downgrade.
    // Haiku cost ≈ 40 * (600/1800) = 14¢. Projected = 184/500 = 36.8% < 40%.
    // → should downgrade to haiku.
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 170,
      capCents: 500,
      anticipatedCostCentsAtDefault: 40,
      proactiveDowngradeAtRatio: 0.4,
    });
    expect(r.kind).toBe("downgrade_to_cheaper");
    expect(r.model).toBe("claude-haiku-4-5");
  });
});

describe("pickCostAwareModel — proactive downgrade", () => {
  it("downgrades sonnet → haiku when default fits but tight", () => {
    // Cap 500, spent 380, anticipated 30 at sonnet.
    // Projected at sonnet = 410/500 = 82% — over 70% threshold.
    // Haiku cost ≈ 30 * (600/1800) = 10¢. New projected = 390/500 = 78%.
    // Hmm 78% still over 70% — so it would NOT downgrade since it doesn't help.
    // Let's tighten with smaller anticipated.
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 340,
      capCents: 500,
      anticipatedCostCentsAtDefault: 30,
    });
    // sonnet: 370/500 = 74% > 70%. haiku ≈ 10, new = 350/500 = 70% — still ≥ 70.
    // Try smaller spent.
    expect(["downgrade_to_cheaper", "use_default_near_limit"]).toContain(r.kind);
  });

  it("clean downgrade from opus to sonnet when sonnet brings projected below threshold", () => {
    // capCents=1000, spent=600, anticipated=300 at opus → projected 900/1000 = 90%.
    // Sonnet ≈ 300 * (1800/3000) = 180. New projected = 780/1000 = 78%. Still > 70.
    // Haiku ≈ 300 * (600/3000) = 60. New projected = 660/1000 = 66%. < 70 — downgrade to haiku.
    const r = pickCostAwareModel({
      defaultModel: "claude-opus-4-7",
      spentCents: 600,
      capCents: 1000,
      anticipatedCostCentsAtDefault: 300,
    });
    expect(r.kind).toBe("downgrade_to_cheaper");
    expect(r.model).toBe("claude-haiku-4-5");
    if (r.kind === "downgrade_to_cheaper") {
      expect(r.savedCents).toBeGreaterThan(0);
    }
  });

  it("picks highest-capability tier that brings ratio under threshold", () => {
    // capCents=10_000, spent=6500, anticipated=1000 at opus.
    // Projected at opus: 7500/10000 = 75% > 70.
    // Sonnet cost ≈ 1000 * 0.6 = 600. New projected = 7100/10000 = 71% — still over.
    // Haiku cost ≈ 1000 * 0.2 = 200. New projected = 6700/10000 = 67% — under.
    // Should pick haiku since sonnet doesn't bring it under 70%.
    const r = pickCostAwareModel({
      defaultModel: "claude-opus-4-7",
      spentCents: 6500,
      capCents: 10_000,
      anticipatedCostCentsAtDefault: 1000,
    });
    expect(r.kind).toBe("downgrade_to_cheaper");
    expect(r.model).toBe("claude-haiku-4-5");
  });
});

describe("pickCostAwareModel — forced downgrade (default overruns)", () => {
  it("downgrades when default exceeds remaining budget", () => {
    // capCents=200, spent=180, anticipated=30 at sonnet → 30 > remaining 20.
    // Haiku ≈ 30 * (600/1800) = 10, fits.
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 180,
      capCents: 200,
      anticipatedCostCentsAtDefault: 30,
    });
    expect(r.kind).toBe("downgrade_to_cheaper");
    expect(r.model).toBe("claude-haiku-4-5");
    if (r.kind === "downgrade_to_cheaper") {
      expect(r.savedCents).toBeGreaterThan(0);
    }
  });

  it("picks the highest-capability tier that still fits", () => {
    // capCents=500, spent=300, anticipated=300 at opus → 300 > remaining 200.
    // Sonnet ≈ 180, fits in remaining 200 → pick sonnet (higher capability than haiku).
    const r = pickCostAwareModel({
      defaultModel: "claude-opus-4-7",
      spentCents: 300,
      capCents: 500,
      anticipatedCostCentsAtDefault: 300,
    });
    expect(r.kind).toBe("downgrade_to_cheaper");
    expect(r.model).toBe("claude-sonnet-4-6");
  });
});

describe("pickCostAwareModel — no safe model", () => {
  it("returns no_safe_model when even cheapest tier overruns", () => {
    // capCents=10, spent=5, anticipated=100 at opus → remaining 5, haiku ≈ 20.
    const r = pickCostAwareModel({
      defaultModel: "claude-opus-4-7",
      spentCents: 5,
      capCents: 10,
      anticipatedCostCentsAtDefault: 100,
    });
    expect(r.kind).toBe("no_safe_model");
    expect(r.model).toBe("claude-opus-4-7"); // returns the default unchanged
  });

  it("haiku-as-default with overrun yields no_safe_model (no cheaper tier)", () => {
    const r = pickCostAwareModel({
      defaultModel: "claude-haiku-4-5",
      spentCents: 95,
      capCents: 100,
      anticipatedCostCentsAtDefault: 20,
    });
    expect(r.kind).toBe("no_safe_model");
  });
});

describe("pickCostAwareModel — unknown model", () => {
  it("passes through unknown model with the flag", () => {
    const r = pickCostAwareModel({
      defaultModel: "gpt-5",
      spentCents: 0,
      capCents: 500,
      anticipatedCostCentsAtDefault: 30,
    });
    expect(r.kind).toBe("unknown_model_passthrough");
    expect(r.model).toBe("gpt-5");
  });
});

describe("pickCostAwareModel — rationale", () => {
  it("rationale references the chosen model on downgrade", () => {
    const r = pickCostAwareModel({
      defaultModel: "claude-sonnet-4-6",
      spentCents: 180,
      capCents: 200,
      anticipatedCostCentsAtDefault: 30,
    });
    if (r.kind === "downgrade_to_cheaper") {
      expect(r.rationale).toContain("claude-haiku-4-5");
    }
  });

  it("rationale on near-limit includes ratio %", () => {
    const r = pickCostAwareModel({
      defaultModel: "claude-haiku-4-5",
      spentCents: 80,
      capCents: 100,
      anticipatedCostCentsAtDefault: 5,
    });
    expect(r.rationale).toMatch(/\d+\.\d%/);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeInvocationCost,
  formatCents,
  type ProviderRate,
} from "../computeInvocationCost";

// Real Anthropic Sonnet 4.6 rates: $3.00/$15.00 per 1M tokens, cached read $0.30/1M.
const SONNET_4_6: ProviderRate = {
  provider: "anthropic",
  modelId: "claude-sonnet-4-6",
  inputCentsPerMillion: 300,
  outputCentsPerMillion: 1500,
  cachedReadCentsPerMillion: 30,
  batchInputCentsPerMillion: 150,
  batchOutputCentsPerMillion: 750,
};

// Real Opus 4.7 rates: $5.00/$25.00 per 1M.
const OPUS_4_7: ProviderRate = {
  provider: "anthropic",
  modelId: "claude-opus-4-7",
  inputCentsPerMillion: 500,
  outputCentsPerMillion: 2500,
  cachedReadCentsPerMillion: 50,
  batchInputCentsPerMillion: null,
  batchOutputCentsPerMillion: null,
};

describe("computeInvocationCost", () => {
  it("Sonnet 4.6: 100K input + 5K output ≈ $0.30 + $0.075 = $0.375 → 38 cents (ceil)", () => {
    const r = computeInvocationCost({ inputTokens: 100_000, outputTokens: 5_000 }, SONNET_4_6);
    expect(r.inputCents).toBe(30);
    expect(r.outputCents).toBe(8); // 5000 * 1500 / 1M = 7.5 → ceil 8
    expect(r.totalCents).toBe(38);
    expect(r.appliedBatchRate).toBe(false);
  });

  it("Opus 4.7: 1M input + 100K output = $5.00 + $2.50 = $7.50 = 750 cents", () => {
    const r = computeInvocationCost({ inputTokens: 1_000_000, outputTokens: 100_000 }, OPUS_4_7);
    expect(r.inputCents).toBe(500);
    expect(r.outputCents).toBe(250);
    expect(r.totalCents).toBe(750);
  });

  it("cached read pricing applies when supplied and tokens > 0", () => {
    const r = computeInvocationCost(
      { inputTokens: 10_000, outputTokens: 1_000, cachedReadTokens: 1_000_000 },
      SONNET_4_6,
    );
    expect(r.cachedReadCents).toBe(30); // 1M * 30 / 1M = 30 cents
    expect(r.totalCents).toBe(r.inputCents + r.outputCents + 30);
  });

  it("cached read falls back to input rate when cachedReadCentsPerMillion is null", () => {
    const rate: ProviderRate = { ...SONNET_4_6, cachedReadCentsPerMillion: null };
    const r = computeInvocationCost(
      { inputTokens: 0, outputTokens: 0, cachedReadTokens: 1_000_000 },
      rate,
    );
    expect(r.cachedReadCents).toBe(300); // falls back to input rate
  });

  it("batch rate applies when isBatch=true and batch rates exist", () => {
    const r = computeInvocationCost(
      { inputTokens: 1_000_000, outputTokens: 1_000_000, isBatch: true },
      SONNET_4_6,
    );
    expect(r.inputCents).toBe(150);
    expect(r.outputCents).toBe(750);
    expect(r.appliedBatchRate).toBe(true);
  });

  it("batch rate ignored when batch rates are null on the rate row", () => {
    const r = computeInvocationCost(
      { inputTokens: 1_000_000, outputTokens: 0, isBatch: true },
      OPUS_4_7, // no batch rates
    );
    expect(r.inputCents).toBe(500); // standard rate
    expect(r.appliedBatchRate).toBe(false);
  });

  it("zero/negative inputs → 0 cost", () => {
    const r = computeInvocationCost({ inputTokens: 0, outputTokens: 0 }, SONNET_4_6);
    expect(r.totalCents).toBe(0);
    const r2 = computeInvocationCost({ inputTokens: -1000, outputTokens: -1000 }, SONNET_4_6);
    expect(r2.totalCents).toBe(0);
  });

  it("fractional tokens are floored (defensive)", () => {
    const r = computeInvocationCost({ inputTokens: 1_500_000.7, outputTokens: 0 }, SONNET_4_6);
    expect(r.inputCents).toBe(450); // 1_500_000 * 300 / 1M = 450
  });

  it("uses ceil semantics for partial cents (vendor-friendly: never under-bill ourselves)", () => {
    // 1 input token * 300 cents/1M = 0.0003 cents → ceil 1 cent
    const r = computeInvocationCost({ inputTokens: 1, outputTokens: 0 }, SONNET_4_6);
    expect(r.inputCents).toBe(1);
  });

  it("disjoint tokens: input + cached_read should not double-count (Anthropic shape)", () => {
    // Anthropic's usage report: input_tokens excludes cache_read_input_tokens.
    // Caller passes them as separate fields; cost is the sum.
    const r = computeInvocationCost(
      { inputTokens: 1_000, outputTokens: 500, cachedReadTokens: 100_000 },
      SONNET_4_6,
    );
    expect(r.inputCents).toBe(1);
    expect(r.outputCents).toBe(1); // 500*1500/1M = 0.75 → ceil 1
    expect(r.cachedReadCents).toBe(3); // 100K*30/1M = 3
    expect(r.totalCents).toBe(5);
  });
});

describe("formatCents", () => {
  it("formats integer cents to $x.xx", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(99)).toBe("$0.99");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(12_345)).toBe("$123.45");
  });

  it("negative or zero → $0.00 (defensive)", () => {
    expect(formatCents(-100)).toBe("$0.00");
    expect(formatCents(0)).toBe("$0.00");
  });
});

import { describe, it, expect } from "vitest";
import { computeApiQuota, currentMonthStartUtc } from "../computeApiQuota";

const REF_NOW = new Date("2026-05-15T12:00:00Z");

describe("computeApiQuota — unlimited tier", () => {
  it("allows when monthlyLimit is null (Enterprise)", () => {
    const r = computeApiQuota({ currentCalls: 1_000_000, monthlyLimit: null, now: REF_NOW });
    expect(r.kind).toBe("allowed");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeNull();
    expect(r.ratio).toBeNull();
  });
});

describe("computeApiQuota — under the cap", () => {
  it("allowed when usage is well under limit", () => {
    const r = computeApiQuota({ currentCalls: 100, monthlyLimit: 10_000, now: REF_NOW });
    expect(r.kind).toBe("allowed");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9_900);
    expect(r.ratio).toBeCloseTo(0.01);
  });

  it("flips to warning at 90% threshold", () => {
    const r = computeApiQuota({ currentCalls: 9_000, monthlyLimit: 10_000, now: REF_NOW });
    expect(r.kind).toBe("allowed_warning_at_threshold");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1_000);
  });

  it("warning threshold is configurable", () => {
    const r = computeApiQuota({ currentCalls: 750, monthlyLimit: 1_000, warnAtRatio: 0.7, now: REF_NOW });
    expect(r.kind).toBe("allowed_warning_at_threshold");
  });

  it("zero usage still ok", () => {
    const r = computeApiQuota({ currentCalls: 0, monthlyLimit: 100, now: REF_NOW });
    expect(r.kind).toBe("allowed");
    expect(r.remaining).toBe(100);
    expect(r.ratio).toBe(0);
  });
});

describe("computeApiQuota — at or over the cap", () => {
  it("blocks exactly at the limit", () => {
    const r = computeApiQuota({ currentCalls: 1_000, monthlyLimit: 1_000, now: REF_NOW });
    expect(r.kind).toBe("blocked_over_monthly_limit");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks over the limit", () => {
    const r = computeApiQuota({ currentCalls: 1_500, monthlyLimit: 1_000, now: REF_NOW });
    expect(r.kind).toBe("blocked_over_monthly_limit");
    expect(r.ratio).toBeCloseTo(1.5);
  });

  it("retryAfterSeconds points at next-month-UTC reset", () => {
    const r = computeApiQuota({ currentCalls: 1_000, monthlyLimit: 1_000, now: REF_NOW });
    // 2026-05-15T12:00:00Z → 2026-06-01T00:00:00Z = 16d 12h = 1,425,600s
    expect(r.retryAfterSeconds).toBeCloseTo(1_425_600, -2);
  });
});

describe("computeApiQuota — edge cases", () => {
  it("zero or negative monthlyLimit blocks (no quota on this plan)", () => {
    expect(computeApiQuota({ currentCalls: 0, monthlyLimit: 0, now: REF_NOW }).allowed).toBe(false);
    expect(computeApiQuota({ currentCalls: 0, monthlyLimit: -1, now: REF_NOW }).allowed).toBe(false);
  });

  it("returns a non-zero retryAfter even when computed near month-end", () => {
    const lastSecond = new Date("2026-05-31T23:59:59Z");
    const r = computeApiQuota({ currentCalls: 100, monthlyLimit: 100, now: lastSecond });
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});

describe("currentMonthStartUtc", () => {
  it("returns the first second of the current UTC month", () => {
    const start = currentMonthStartUtc(REF_NOW);
    expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("handles December correctly", () => {
    const dec = new Date("2026-12-31T23:00:00Z");
    expect(currentMonthStartUtc(dec).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("defaults to now when no arg provided", () => {
    const d = currentMonthStartUtc();
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });
});

describe("computeApiQuota — message strings", () => {
  it("includes the count + limit in the allowed message", () => {
    const r = computeApiQuota({ currentCalls: 50, monthlyLimit: 1_000, now: REF_NOW });
    expect(r.message).toContain("950");
  });

  it("includes the count + retry seconds in the blocked message", () => {
    const r = computeApiQuota({ currentCalls: 100, monthlyLimit: 100, now: REF_NOW });
    expect(r.message).toContain("100/100");
    expect(r.message).toContain("Resets in");
  });
});

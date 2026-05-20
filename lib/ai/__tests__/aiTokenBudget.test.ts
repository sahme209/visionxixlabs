/**
 * Vitest unit tests for the AI token-budget tracker.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _backdateForTests, _clearAllBudgetsForTests,
  assertWithinBudget, readBudget, recordTokenUsage, DEFAULT_FREE_CAP,
} from "../aiTokenBudget";

describe("aiTokenBudget", () => {
  beforeEach(() => { _clearAllBudgetsForTests(); });

  it("starts at zero for a fresh tenant", () => {
    const snap = readBudget("tenant-1");
    expect(snap.totalTokens).toBe(0);
    expect(snap.calls).toBe(0);
    expect(snap.capped).toBe(false);
  });

  it("accumulates prompt + completion tokens across calls", () => {
    recordTokenUsage({ tenantId: "tenant-1", promptTokens: 100, completionTokens: 200 });
    recordTokenUsage({ tenantId: "tenant-1", promptTokens: 50, completionTokens: 75 });
    const snap = readBudget("tenant-1");
    expect(snap.promptTokens).toBe(150);
    expect(snap.completionTokens).toBe(275);
    expect(snap.totalTokens).toBe(425);
    expect(snap.calls).toBe(2);
  });

  it("treats undefined or zero token counts as no-op", () => {
    recordTokenUsage({ tenantId: "tenant-1" });
    recordTokenUsage({ tenantId: "tenant-1", promptTokens: 0, completionTokens: 0 });
    const snap = readBudget("tenant-1");
    expect(snap.totalTokens).toBe(0);
    expect(snap.calls).toBe(2);
  });

  it("scopes buckets per tenant", () => {
    recordTokenUsage({ tenantId: "a", promptTokens: 10, completionTokens: 10 });
    recordTokenUsage({ tenantId: "b", promptTokens: 5, completionTokens: 5 });
    expect(readBudget("a").totalTokens).toBe(20);
    expect(readBudget("b").totalTokens).toBe(10);
  });

  it("marks capped=true once total >= cap", () => {
    recordTokenUsage({ tenantId: "a", promptTokens: 100, completionTokens: 0 });
    expect(assertWithinBudget("a", { totalTokens: 100 }).ok).toBe(false);
    expect(assertWithinBudget("a", { totalTokens: 200 }).ok).toBe(true);
  });

  it("DEFAULT_FREE_CAP is well above small per-call traffic", () => {
    recordTokenUsage({ tenantId: "a", promptTokens: 1_000, completionTokens: 1_000 });
    expect(assertWithinBudget("a", DEFAULT_FREE_CAP).ok).toBe(true);
  });

  it("rolls the bucket when the date key changes (UTC midnight)", () => {
    recordTokenUsage({ tenantId: "a", promptTokens: 100, completionTokens: 100 });
    _backdateForTests("a", 1); // shift the bucket's dateKey to yesterday
    const snap = readBudget("a");
    // The roll happens on read because dateKey != today → bucket recreated.
    expect(snap.totalTokens).toBe(0);
    expect(snap.calls).toBe(0);
  });
});

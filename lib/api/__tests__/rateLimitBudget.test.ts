/**
 * Vitest unit tests for the pure rate-limit budget.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _clearRateLimitStoreForTests, _resetNowForTests, _setNowForTests,
  consumeRateLimit, peekRateLimit,
} from "../rateLimitBudget";

describe("rateLimitBudget", () => {
  beforeEach(() => {
    _clearRateLimitStoreForTests();
    _resetNowForTests();
  });

  it("first call within budget → allowed with remaining=budget-1", () => {
    _setNowForTests(() => 0);
    const r = consumeRateLimit("k", { budget: 3, windowMs: 60_000 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("consumes until budget hits 0, then denies with retryAfterMs", () => {
    _setNowForTests(() => 0);
    consumeRateLimit("k", { budget: 2, windowMs: 60_000 });
    consumeRateLimit("k", { budget: 2, windowMs: 60_000 });
    const denied = consumeRateLimit("k", { budget: 2, windowMs: 60_000 });
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("old timestamps fall off the window", () => {
    _setNowForTests(() => 0);
    consumeRateLimit("k", { budget: 1, windowMs: 60_000 });
    _setNowForTests(() => 70_000);
    const r = consumeRateLimit("k", { budget: 1, windowMs: 60_000 });
    expect(r.allowed).toBe(true);
  });

  it("peek doesn't consume", () => {
    _setNowForTests(() => 0);
    const p = peekRateLimit("k", { budget: 3, windowMs: 60_000 });
    const c = consumeRateLimit("k", { budget: 3, windowMs: 60_000 });
    expect(p.remaining).toBe(3);
    expect(c.remaining).toBe(2);
  });

  it("keys scoped independently", () => {
    _setNowForTests(() => 0);
    consumeRateLimit("a", { budget: 1, windowMs: 60_000 });
    const r = consumeRateLimit("b", { budget: 1, windowMs: 60_000 });
    expect(r.allowed).toBe(true);
  });

  it("budget clamped to >= 1", () => {
    _setNowForTests(() => 0);
    const r = consumeRateLimit("k", { budget: 0, windowMs: 60_000 });
    expect(r.allowed).toBe(true); // 0 was clamped to 1
  });

  it("windowMs clamped to >= 1000", () => {
    _setNowForTests(() => 0);
    consumeRateLimit("k", { budget: 1, windowMs: 1 });
    const r = consumeRateLimit("k", { budget: 1, windowMs: 1 });
    expect(r.allowed).toBe(false); // window was clamped to 1s
  });
});

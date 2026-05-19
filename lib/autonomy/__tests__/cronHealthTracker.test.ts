/**
 * Vitest unit tests for the cron self-heal health tracker.
 *
 * Locks in: per-cron + per-tenant key isolation, last-N-tick
 * threshold detection, bounded buffer at MAX_PER_KEY, success-rate
 * math.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  clearCronHealth,
  readCronHealth,
  recordTickOutcome,
  shouldSkipDueToConsecutiveFailures,
} from "../cronHealthTracker";

describe("cron health tracker", () => {
  beforeEach(() => {
    clearCronHealth();
  });

  it("doesn't skip on a fresh history", () => {
    const decision = shouldSkipDueToConsecutiveFailures({ cronName: "fresh" });
    expect(decision.skip).toBe(false);
    expect(decision.consecutiveFailures).toBe(0);
  });

  it("skips after 3 consecutive errored ticks (default threshold)", () => {
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    const decision = shouldSkipDueToConsecutiveFailures({ cronName: "weekly" });
    expect(decision.skip).toBe(true);
    expect(decision.consecutiveFailures).toBe(3);
    expect(decision.reason).toMatch(/Skipping/);
  });

  it("does NOT skip when an 'ok' breaks the streak", () => {
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    recordTickOutcome({ cronName: "weekly", outcome: "ok" });
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    const decision = shouldSkipDueToConsecutiveFailures({ cronName: "weekly" });
    expect(decision.skip).toBe(false);
    expect(decision.consecutiveFailures).toBe(1);
  });

  it("respects a custom threshold", () => {
    recordTickOutcome({ cronName: "telemetry", outcome: "errored" });
    recordTickOutcome({ cronName: "telemetry", outcome: "errored" });
    const decision = shouldSkipDueToConsecutiveFailures({
      cronName: "telemetry",
      threshold: 2,
    });
    expect(decision.skip).toBe(true);
  });

  it("keeps per-tenant histories isolated", () => {
    recordTickOutcome({ cronName: "telemetry", tenantId: "org-a", outcome: "errored" });
    recordTickOutcome({ cronName: "telemetry", tenantId: "org-a", outcome: "errored" });
    recordTickOutcome({ cronName: "telemetry", tenantId: "org-a", outcome: "errored" });
    // org-b should be unaffected.
    const a = shouldSkipDueToConsecutiveFailures({ cronName: "telemetry", tenantId: "org-a" });
    const b = shouldSkipDueToConsecutiveFailures({ cronName: "telemetry", tenantId: "org-b" });
    expect(a.skip).toBe(true);
    expect(b.skip).toBe(false);
  });

  it("readCronHealth returns success rate in [0, 1]", () => {
    recordTickOutcome({ cronName: "weekly", outcome: "ok" });
    recordTickOutcome({ cronName: "weekly", outcome: "errored" });
    recordTickOutcome({ cronName: "weekly", outcome: "ok" });
    const health = readCronHealth({ cronName: "weekly" });
    expect(health.total).toBe(3);
    expect(health.failureCount).toBe(1);
    expect(health.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("caps the per-key buffer at 16 entries", () => {
    for (let i = 0; i < 30; i++) {
      recordTickOutcome({ cronName: "bounded", outcome: i % 2 === 0 ? "ok" : "errored" });
    }
    const health = readCronHealth({ cronName: "bounded" });
    expect(health.total).toBe(16);
  });
});

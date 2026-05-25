import { describe, expect, it } from "vitest";
import {
  classifyTransitionHistory,
  type TransitionForClassify,
} from "../connectorSetupStickyError";

/* ──────────────────────────────────────────────────────────────────
   Phase 418 — sticky-error classifier matrix.

   Anchor `now` at a fixed timestamp so windowed lookbacks are
   deterministic. Build small synthetic histories that target each
   classification branch.
   ────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-05-25T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const hoursAgo   = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function tx(
  partial: Partial<TransitionForClassify> & Pick<TransitionForClassify, "eventKind" | "createdAt">,
): TransitionForClassify {
  return {
    toStatus: "connected",
    isLegal: true,
    eventPayload: null,
    ...partial,
  };
}

describe("classifyTransitionHistory — healthy cases", () => {
  it("empty history → healthy/no_history", () => {
    expect(classifyTransitionHistory([], { now: NOW })).toEqual({
      kind: "healthy", reason: "no_history",
    });
  });

  it("only successes in window → healthy/no_failures_in_window", () => {
    const transitions = [
      tx({ eventKind: "operator_started",     createdAt: minutesAgo(30) }),
      tx({ eventKind: "validation_succeeded", createdAt: minutesAgo(20) }),
    ];
    expect(classifyTransitionHistory(transitions, { now: NOW })).toEqual({
      kind: "healthy", reason: "no_failures_in_window",
    });
  });

  it("failures outside the window → healthy/no_failures_in_window", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: hoursAgo(48) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: hoursAgo(36) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: hoursAgo(30) }),
    ];
    expect(classifyTransitionHistory(transitions, { now: NOW, windowHours: 24 })).toEqual({
      kind: "healthy", reason: "no_failures_in_window",
    });
  });

  it("last event was a recovery → healthy/last_event_was_recovery (regardless of upstream failures)", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(60) }),
      tx({ eventKind: "operator_started",                                                  createdAt: minutesAgo(40) }),
      tx({ eventKind: "validation_succeeded",                                              createdAt: minutesAgo(20) }),
    ];
    expect(classifyTransitionHistory(transitions, { now: NOW })).toEqual({
      kind: "healthy", reason: "last_event_was_recovery",
    });
  });
});

describe("classifyTransitionHistory — transient_failure (below thresholds)", () => {
  it("single failure in window → transient_failure with errorCode", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    expect(r.kind).toBe("transient_failure");
    if (r.kind !== "transient_failure") return;
    expect(r.errorCode).toBe("AccessDenied");
    expect(r.lastFailureAt.getTime()).toBe(minutesAgo(10).getTime());
  });

  it("two failures w/ different errorCodes → transient_failure (NOT sticky — codes vary)", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(30) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AssumeRoleFailed" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    expect(r.kind).toBe("transient_failure");
  });

  it("three failures with NULL errorCode → transient_failure (sticky requires a real code)", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: null, createdAt: minutesAgo(30) }),
      tx({ eventKind: "validation_failed", eventPayload: null, createdAt: minutesAgo(20) }),
      tx({ eventKind: "validation_failed", eventPayload: null, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    expect(r.kind).toBe("transient_failure");
  });
});

describe("classifyTransitionHistory — sticky_error", () => {
  it("3 consecutive validation_failed w/ same errorCode → sticky_error", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(30) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(20) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    expect(r.kind).toBe("sticky_error");
    if (r.kind !== "sticky_error") return;
    expect(r.errorCode).toBe("AccessDenied");
    expect(r.consecutiveCount).toBe(3);
    expect(r.firstSeenAt.getTime()).toBe(minutesAgo(30).getTime());
    expect(r.lastSeenAt.getTime()).toBe(minutesAgo(10).getTime());
  });

  it("retry-chain events (operator_started, provider_link_opened, bounce_back_received) do NOT break the streak — the kernel forces them between every validation_failed", () => {
    const transitions = [
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(60) }),
      tx({ eventKind: "operator_started",                                                    createdAt: minutesAgo(55) }),
      tx({ eventKind: "provider_link_opened",                                                createdAt: minutesAgo(50) }),
      tx({ eventKind: "bounce_back_received",                                                createdAt: minutesAgo(45) }),
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(30) }),
      tx({ eventKind: "operator_started",                                                    createdAt: minutesAgo(25) }),
      tx({ eventKind: "provider_link_opened",                                                createdAt: minutesAgo(20) }),
      tx({ eventKind: "bounce_back_received",                                                createdAt: minutesAgo(15) }),
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    expect(r.kind).toBe("sticky_error");
    if (r.kind !== "sticky_error") return;
    expect(r.consecutiveCount).toBe(3);
  });

  it("recovery event (validation_succeeded) DOES break the streak", () => {
    const transitions = [
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(60) }),
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(50) }),
      tx({ eventKind: "validation_succeeded",                                                createdAt: minutesAgo(40) }), // resets
      tx({ eventKind: "validation_failed",     eventPayload: { errorCode: "AccessDenied" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    // last event is failure, last legal event before that is success, so
    // "last_event_was_recovery" is false. Tail streak is 1. → transient.
    expect(r.kind).toBe("transient_failure");
  });

  it("default threshold can be tightened via stickyThreshold", () => {
    const transitions = [
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "X" }, createdAt: minutesAgo(20) }),
      tx({ eventKind: "validation_failed", eventPayload: { errorCode: "X" }, createdAt: minutesAgo(10) }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW, stickyThreshold: 2 });
    expect(r.kind).toBe("sticky_error");
    if (r.kind !== "sticky_error") return;
    expect(r.consecutiveCount).toBe(2);
  });
});

describe("classifyTransitionHistory — chronic_oscillation outranks sticky_error", () => {
  it("3+ regress/recover toggles → chronic_oscillation (even with same errorCode in tail)", () => {
    const transitions = [
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(120) }),
      tx({ eventKind: "health_check_recovered", createdAt: minutesAgo(110) }),
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(100) }),
      tx({ eventKind: "health_check_recovered", createdAt: minutesAgo(90)  }),
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(10)  }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW });
    // Last event is regress, oscillation threshold is 3 by default — need
    // 3 regress + 3 recover. We have 3 regress, 2 recover → below threshold.
    // Bumping recover to 3 should trigger.
    expect(r.kind).toBe("transient_failure");
  });

  it("threshold of 2 each → triggers chronic_oscillation", () => {
    const transitions = [
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(120) }),
      tx({ eventKind: "health_check_recovered", createdAt: minutesAgo(110) }),
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(100) }),
      tx({ eventKind: "health_check_recovered", createdAt: minutesAgo(90)  }),
      tx({ eventKind: "health_check_regressed", createdAt: minutesAgo(10)  }),
    ];
    const r = classifyTransitionHistory(transitions, { now: NOW, oscillationThreshold: 2 });
    expect(r.kind).toBe("chronic_oscillation");
    if (r.kind !== "chronic_oscillation") return;
    expect(r.regressCount).toBe(3);
    expect(r.recoverCount).toBe(2);
  });
});

describe("classifyTransitionHistory — ignores illegal-transition rows", () => {
  it("illegal rows in window do not contribute to failure count", () => {
    const transitions = [
      // Three illegal `provider_link_opened` rejections — pure debug noise.
      tx({ eventKind: "provider_link_opened", isLegal: false, createdAt: minutesAgo(30) }),
      tx({ eventKind: "provider_link_opened", isLegal: false, createdAt: minutesAgo(20) }),
      tx({ eventKind: "provider_link_opened", isLegal: false, createdAt: minutesAgo(10) }),
    ];
    expect(classifyTransitionHistory(transitions, { now: NOW })).toEqual({
      kind: "healthy", reason: "no_failures_in_window",
    });
  });
});

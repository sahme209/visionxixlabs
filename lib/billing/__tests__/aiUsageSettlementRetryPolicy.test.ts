import { describe, expect, it } from "vitest";
import { evaluateAIUsageSettlementRetry } from "../aiUsageSettlementRetryPolicy";

const now = new Date("2026-10-15T12:00:00Z");
const windowMs = 23 * 60 * 60 * 1000;

describe("AI usage automatic settlement retry window", () => {
  it.each([0, windowMs - 1])("allows a reserved row aged %i milliseconds", (age) => {
    expect(evaluateAIUsageSettlementRetry({ status: "reserved", createdAt: new Date(now.getTime() - age) }, now)).toBe("submit");
  });
  it.each([windowMs, windowMs + 1, 48 * 60 * 60 * 1000, -1])("holds a reserved row aged %i milliseconds", (age) => {
    expect(evaluateAIUsageSettlementRetry({ status: "reserved", createdAt: new Date(now.getTime() - age) }, now)).toBe("needs_reconciliation");
  });
  it("holds invalid timestamps", () => {
    expect(evaluateAIUsageSettlementRetry({ status: "reserved", createdAt: new Date(NaN) }, now)).toBe("needs_reconciliation");
    expect(evaluateAIUsageSettlementRetry({ status: "reserved", createdAt: now }, new Date(NaN))).toBe("needs_reconciliation");
  });
  it.each(["failed", "blocked", "unknown"])("does not treat %s as an automatic retry", (status) => {
    expect(evaluateAIUsageSettlementRetry({ status, createdAt: now }, now)).toBe("needs_reconciliation");
  });
  it("never retries a submitted row even when its timestamp is old or invalid", () => {
    expect(evaluateAIUsageSettlementRetry({ status: "submitted", createdAt: new Date(NaN) }, now)).toBe("already_submitted");
  });
});

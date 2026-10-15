import { describe, expect, it, vi } from "vitest";

import { AI_CUSTOMER_USAGE_MARGIN_MULT, applyMargin, loadAiBillingMargin } from "../aiBillingMargin";

describe("AI customer usage margin", () => {
  it("uses the approved deterministic 1.5x multiplier regardless of deployment environment", () => {
    vi.stubEnv("AI_BILLING_MARGIN_MULT", "1.25");

    expect(AI_CUSTOMER_USAGE_MARGIN_MULT).toBe(1.5);
    expect(loadAiBillingMargin()).toBe(1.5);
    expect(applyMargin(4)).toBe(6);
  });

  it("rounds customer ledger cents while preserving integer accounting", () => {
    expect(applyMargin(1)).toBe(2);
    expect(applyMargin(101)).toBe(152);
  });

  it("rejects invalid provider cost inputs instead of producing a charge amount", () => {
    expect(() => applyMargin(-1)).toThrow("provider_cost_cents_invalid");
    expect(() => applyMargin(1.5)).toThrow("provider_cost_cents_invalid");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AI_RATE_CARD,
  customerPriceCents,
  customerUsdPerMTok,
  deliveredCreditCentsForPrice,
  providerCostBudgetCentsForPrice,
  isAllowedTopUpCents,
} from "../aiRateCard";
import { AI_CUSTOMER_USAGE_MARGIN_MULT, applyMargin, loadAiBillingMargin } from "../aiBillingMargin";
import { ADD_ON_CATALOG } from "../addOnCatalog";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("AI rate card (ai_rate_card_v1)", () => {
  it("is versioned and sets one 1.5x multiplier", () => {
    expect(AI_RATE_CARD.version).toBe("ai_rate_card_v1");
    expect(AI_RATE_CARD.marginMultiplier).toBe(1.5);
    expect(AI_RATE_CARD.currency).toBe("usd");
  });

  it("is the single source for the usage margin, independent of environment", () => {
    vi.stubEnv("AI_BILLING_MARGIN_MULT", "2");
    expect(AI_CUSTOMER_USAGE_MARGIN_MULT).toBe(AI_RATE_CARD.marginMultiplier);
    expect(loadAiBillingMargin()).toBe(AI_RATE_CARD.marginMultiplier);
    for (const cents of [0, 1, 9, 101, 12_345]) expect(applyMargin(cents)).toBe(customerPriceCents(cents));
    vi.unstubAllEnvs();
  });

  it("is the single source for every credit pack's delivered budget", () => {
    const packs = ADD_ON_CATALOG.filter((a) => a.category === "ai_credits");
    expect(packs.length).toBeGreaterThan(0);
    for (const pack of packs) {
      // Balance is credited in customer-price cents and debited at 1.5x
      // provider cost, so the margin is applied exactly once.
      expect(pack.deliveredAICreditsCents).toBe(deliveredCreditCentsForPrice(pack.priceCents));
      expect(pack.deliveredAICreditsCents).toBe(pack.priceCents);
      expect(providerCostBudgetCentsForPrice(pack.priceCents) * AI_RATE_CARD.marginMultiplier).toBeLessThanOrEqual(pack.priceCents);
    }
  });

  it("leaves no second hard-coded multiplier in the margin or add-on sources", () => {
    expect(source("lib/billing/aiBillingMargin.ts")).not.toMatch(/=\s*1\.5\s*;/);
    expect(source("lib/billing/addOnCatalog.ts")).not.toMatch(/twice|\b2x\b|deliveredAICreditsCents:\s*[1-9]/);
  });

  it("prices the paid-lane model at 1.5x the provider card", () => {
    const sonnet = AI_RATE_CARD.perModelRates.find((r) => r.model === "anthropic/claude-sonnet-5.5");
    expect(sonnet).toBeDefined();
    expect(customerUsdPerMTok(sonnet!, "input")).toBe(3);
    expect(customerUsdPerMTok(sonnet!, "cachedInput")).toBe(0.15);
    expect(customerUsdPerMTok(sonnet!, "output")).toBe(15);
  });

  it("enforces the $10 minimum prepaid top-up", () => {
    expect(AI_RATE_CARD.minimumTopUpCents).toBe(1_000);
    expect(isAllowedTopUpCents(999)).toBe(false);
    expect(isAllowedTopUpCents(1_000)).toBe(true);
    expect(isAllowedTopUpCents(1_000.5)).toBe(false);
    expect(() => deliveredCreditCentsForPrice(500)).toThrow("top_up_below_minimum");
    expect(() => providerCostBudgetCentsForPrice(999)).toThrow("top_up_below_minimum");
    expect(deliveredCreditCentsForPrice(1_000)).toBe(1_000);
    expect(providerCostBudgetCentsForPrice(1_000)).toBe(666);
    const smallest = Math.min(...ADD_ON_CATALOG.filter((a) => a.category === "ai_credits").map((a) => a.priceCents));
    expect(smallest).toBe(AI_RATE_CARD.minimumTopUpCents);
  });

  it("states non-expiring credits, the 30-day refund rule, auto-release and never-beyond-prepaid", () => {
    expect(AI_RATE_CARD.creditsExpire).toBe(false);
    expect(AI_RATE_CARD.refundWindowDays).toBe(30);
    const text = [...AI_RATE_CARD.refundRules, ...AI_RATE_CARD.disclosures].join(" ");
    expect(text).toMatch(/refundable on request within 30 days/);
    expect(text).toMatch(/failed action is released automatically/i);
    expect(text).toMatch(/never charged more than you prepaid/i);
    expect(text).toMatch(/never expire/i);
    expect(text).toMatch(/minimum top-up is \$10/);
    expect(text).toMatch(/1\.5×/);
    expect(text).toMatch(/available in enterprise evaluations/);
  });

  it("does not change the conservative coding-quote hold math", () => {
    expect(source("lib/ai/codingRequestQuote.ts")).toContain("coding_quote_margin150_buffer150_v1");
  });
});

import { describe, expect, it } from "vitest";
import { DISCLAIMER, computeEstimate, matchCloudPrice } from "../computeEstimate";
import type {
  CloudProviderPriceRow,
  DiscoveredCloudUsageItem,
  DiscoveredVxlUsageItem,
  VxlPricingRule,
} from "../types";

/* ──────────────────────────────────────────────────────────────────
   Phase 439 — pricing engine kernel tests.

   No I/O, no Prisma, no time-dependent flakiness. Every test pins
   numbers explicitly so a regression in rounding or summation is
   obvious in the diff.
   ────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-05-25T12:00:00Z");

const PRICE_EC2_T3_MICRO_USE1: CloudProviderPriceRow = {
  id: "aws:EC2:t3.micro:us-east-1",
  provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1",
  unit: "hour", pricePerUnit: 0.0104, currency: "USD",
  effectiveAt: new Date("2026-01-01"), lastUpdatedAt: new Date("2026-05-20"),
  source: "cached", confidence: "high",
};

const PRICE_S3_STANDARD_USE1: CloudProviderPriceRow = {
  id: "aws:S3:Standard:us-east-1",
  provider: "aws", service: "S3", sku: "Standard", region: "us-east-1",
  unit: "GB-month", pricePerUnit: 0.023, currency: "USD",
  effectiveAt: new Date("2026-01-01"), lastUpdatedAt: new Date("2026-05-20"),
  source: "live", confidence: "high",
};

const PRICE_SANDBOX: CloudProviderPriceRow = {
  id: "aws:Lambda:invocation:us-east-1",
  provider: "aws", service: "Lambda", sku: "invocation", region: "us-east-1",
  unit: "1M_requests", pricePerUnit: 0.20, currency: "USD",
  effectiveAt: new Date("2026-01-01"), lastUpdatedAt: new Date("2026-05-20"),
  source: "sandbox", confidence: "low",
};

const RULE_PLATFORM_BASE: VxlPricingRule = {
  id: "platform_base:standard",
  category: "platform_base",
  label: "VisionXIXLabs platform (standard tier)",
  pricePerUnit: 299, unit: "month", currency: "USD",
  effectiveAt: new Date("2026-01-01"),
};

const RULE_AUTOMATION_RUN: VxlPricingRule = {
  id: "automation_run:metered",
  category: "automation_run",
  label: "Automation runs",
  pricePerUnit: 0.05, unit: "run", currency: "USD",
  includedQuantity: 1000,
  effectiveAt: new Date("2026-01-01"),
};

/* ──────────────────────────────────────────────────────────────────
   matchCloudPrice — exact-match guard.
   ────────────────────────────────────────────────────────────── */

describe("matchCloudPrice — exact (provider, service, sku, region) match", () => {
  const prices = [PRICE_EC2_T3_MICRO_USE1, PRICE_S3_STANDARD_USE1];

  it("returns the matching row", () => {
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1",
      forecastUnits: 720, forecastBasis: "1 t3.micro on 24/7",
    };
    expect(matchCloudPrice(prices, usage)).toBe(PRICE_EC2_T3_MICRO_USE1);
  });

  it("returns undefined when sku differs", () => {
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "EC2", sku: "t3.small", region: "us-east-1",
      forecastUnits: 720, forecastBasis: "n/a",
    };
    expect(matchCloudPrice(prices, usage)).toBeUndefined();
  });

  it("returns undefined when region differs (no cross-region fallback)", () => {
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "EC2", sku: "t3.micro", region: "eu-west-1",
      forecastUnits: 720, forecastBasis: "n/a",
    };
    expect(matchCloudPrice(prices, usage)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────────────────────
   computeEstimate — empty case + disclaimer invariant.
   ────────────────────────────────────────────────────────────── */

describe("computeEstimate — empty inputs", () => {
  it("empty cloud + vxl → zero subtotals, disclaimer populated, selfServe false (no medium+ line items)", () => {
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [],
      cloudUsage: [], vxlUsage: [], now: NOW,
    });
    expect(r.lineItems).toEqual([]);
    expect(r.summary.cloudProviderSubtotal).toBe(0);
    expect(r.summary.vxlPlatformSubtotal).toBe(0);
    expect(r.summary.total).toBe(0);
    expect(r.summary.containsSandbox).toBe(false);
    expect(r.summary.hasNonLowConfidence).toBe(false);
    expect(r.selfServeEligible).toBe(false);
    expect(r.disclaimer).toBe(DISCLAIMER);
    expect(r.warnings).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Cloud line items.
   ────────────────────────────────────────────────────────────── */

describe("computeEstimate — cloud provider line items", () => {
  it("EC2 + S3 usage produces two cloud_provider line items with correct amounts", () => {
    const cloudUsage: DiscoveredCloudUsageItem[] = [
      { provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1", forecastUnits: 720, forecastBasis: "24/7 single instance" },
      { provider: "aws", service: "S3",  sku: "Standard", region: "us-east-1", forecastUnits: 500, forecastBasis: "estimated bucket growth" },
    ];
    const r = computeEstimate({
      organizationId: "o",
      cloudPrices: [PRICE_EC2_T3_MICRO_USE1, PRICE_S3_STANDARD_USE1],
      vxlRules: [], cloudUsage, vxlUsage: [],
      now: NOW,
    });

    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0].bucket).toBe("cloud_provider");
    expect(r.lineItems[0].amount).toBe(round2(720 * 0.0104));   // 7.49
    expect(r.lineItems[1].amount).toBe(round2(500 * 0.023));    // 11.50
    expect(r.summary.cloudProviderSubtotal).toBe(round2(720 * 0.0104 + 500 * 0.023));
    expect(r.summary.vxlPlatformSubtotal).toBe(0);
  });

  it("unmatched cloud usage emits a high-severity warning + zero-amount line item", () => {
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "EC2", sku: "m5.large", region: "us-east-1",
      forecastUnits: 720, forecastBasis: "n/a",
    };
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [],
      cloudUsage: [usage], vxlUsage: [], now: NOW,
    });
    expect(r.warnings.some((w) => w.severity === "high" && w.id.startsWith("unmatched:"))).toBe(true);
    expect(r.lineItems[0].amount).toBe(0);
    expect(r.lineItems[0].unitLabel).toBe("unmatched");
    expect(r.selfServeEligible).toBe(false);
  });

  it("sandbox source flags the estimate as sandbox + emits critical warning", () => {
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "Lambda", sku: "invocation", region: "us-east-1",
      forecastUnits: 10, forecastBasis: "10M invocations",
    };
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [PRICE_SANDBOX], vxlRules: [],
      cloudUsage: [usage], vxlUsage: [], now: NOW,
    });
    expect(r.summary.containsSandbox).toBe(true);
    expect(r.warnings.some((w) => w.id === "sandbox_present" && w.severity === "critical")).toBe(true);
    expect(r.selfServeEligible).toBe(false);
  });

  it("currency mismatch is rejected (no silent FX conversion)", () => {
    const eurPrice: CloudProviderPriceRow = { ...PRICE_EC2_T3_MICRO_USE1, currency: "EUR" };
    const usage: DiscoveredCloudUsageItem = {
      provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1",
      forecastUnits: 100, forecastBasis: "n/a",
    };
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [eurPrice], vxlRules: [],
      cloudUsage: [usage], vxlUsage: [], now: NOW,
    });
    expect(r.warnings.some((w) => w.id.startsWith("currency_mismatch:"))).toBe(true);
    expect(r.lineItems).toEqual([]); // currency-mismatched rows are dropped from line items
    expect(r.summary.cloudProviderSubtotal).toBe(0);
  });
});

/* ──────────────────────────────────────────────────────────────────
   VxL line items + included quota.
   ────────────────────────────────────────────────────────────── */

describe("computeEstimate — VxL platform line items", () => {
  it("platform base rule produces a single vxl_platform line item", () => {
    const vxlUsage: DiscoveredVxlUsageItem[] = [{
      category: "platform_base", ruleId: "platform_base:standard",
      forecastUnits: 1, forecastBasis: "1 monthly fee",
    }];
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [RULE_PLATFORM_BASE],
      cloudUsage: [], vxlUsage, now: NOW,
    });
    expect(r.summary.vxlPlatformSubtotal).toBe(299);
    expect(r.summary.total).toBe(299);
    expect(r.lineItems[0].bucket).toBe("vxl_platform");
    expect(r.lineItems[0].source).toBe("live");
    expect(r.lineItems[0].confidence).toBe("high");
  });

  it("included quota suppresses the first N units; overage is billed", () => {
    const vxlUsage: DiscoveredVxlUsageItem[] = [{
      category: "automation_run", ruleId: "automation_run:metered",
      forecastUnits: 1500, forecastBasis: "estimated 1500 runs/mo",
    }];
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [RULE_AUTOMATION_RUN],
      cloudUsage: [], vxlUsage, now: NOW,
    });
    // 1500 - 1000 included = 500 billable × $0.05 = $25.00
    expect(r.summary.vxlPlatformSubtotal).toBe(25);
  });

  it("usage under the included quota produces a zero-amount line item but still surfaces it", () => {
    const vxlUsage: DiscoveredVxlUsageItem[] = [{
      category: "automation_run", ruleId: "automation_run:metered",
      forecastUnits: 500, forecastBasis: "estimated 500 runs/mo (well under quota)",
    }];
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [RULE_AUTOMATION_RUN],
      cloudUsage: [], vxlUsage, now: NOW,
    });
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].amount).toBe(0);
    expect(r.lineItems[0].forecastUnits).toBe(500); // still shown on the UI
  });

  it("unknown VxL ruleId emits a high-severity warning and skips the line", () => {
    const vxlUsage: DiscoveredVxlUsageItem[] = [{
      category: "ai_usage", ruleId: "ai_usage:does_not_exist",
      forecastUnits: 100, forecastBasis: "n/a",
    }];
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [],
      cloudUsage: [], vxlUsage, now: NOW,
    });
    expect(r.warnings.some((w) => w.id === "unknown_vxl_rule:ai_usage:does_not_exist")).toBe(true);
    expect(r.lineItems).toEqual([]);
  });

  it("sunset rule emits a medium-severity warning but still charges", () => {
    const sunsetRule: VxlPricingRule = {
      ...RULE_PLATFORM_BASE,
      sunsetAt: new Date("2026-04-01"),
    };
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [sunsetRule],
      cloudUsage: [],
      vxlUsage: [{ category: "platform_base", ruleId: sunsetRule.id, forecastUnits: 1, forecastBasis: "1mo" }],
      now: NOW,
    });
    expect(r.warnings.some((w) => w.id.startsWith("sunset:") && w.severity === "medium")).toBe(true);
    expect(r.summary.vxlPlatformSubtotal).toBe(299);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Self-serve eligibility.
   ────────────────────────────────────────────────────────────── */

describe("computeEstimate — selfServeEligible gating", () => {
  it("clean high-confidence estimate → selfServeEligible:true", () => {
    const r = computeEstimate({
      organizationId: "o",
      cloudPrices: [PRICE_EC2_T3_MICRO_USE1],
      vxlRules: [RULE_PLATFORM_BASE],
      cloudUsage: [{ provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1", forecastUnits: 720, forecastBasis: "1 instance" }],
      vxlUsage: [{ category: "platform_base", ruleId: "platform_base:standard", forecastUnits: 1, forecastBasis: "1mo" }],
      now: NOW,
    });
    expect(r.selfServeEligible).toBe(true);
    expect(r.summary.hasNonLowConfidence).toBe(true);
    expect(r.summary.containsSandbox).toBe(false);
  });

  it("any sandbox source flips selfServeEligible to false", () => {
    const r = computeEstimate({
      organizationId: "o",
      cloudPrices: [PRICE_EC2_T3_MICRO_USE1, PRICE_SANDBOX],
      vxlRules: [],
      cloudUsage: [
        { provider: "aws", service: "EC2",    sku: "t3.micro",    region: "us-east-1", forecastUnits: 720, forecastBasis: "1 instance" },
        { provider: "aws", service: "Lambda", sku: "invocation",  region: "us-east-1", forecastUnits: 10,  forecastBasis: "10M reqs" },
      ],
      vxlUsage: [], now: NOW,
    });
    expect(r.selfServeEligible).toBe(false);
  });

  it("an unmatched cloud row makes the estimate non-self-serve", () => {
    const r = computeEstimate({
      organizationId: "o",
      cloudPrices: [],
      vxlRules: [],
      cloudUsage: [{ provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1", forecastUnits: 720, forecastBasis: "n/a" }],
      vxlUsage: [], now: NOW,
    });
    expect(r.selfServeEligible).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Determinism + disclaimer invariants.
   ────────────────────────────────────────────────────────────── */

describe("computeEstimate — determinism + disclaimer", () => {
  it("same inputs → same outputs (no Date.now leaks, no Math.random)", () => {
    const args: Parameters<typeof computeEstimate>[0] = {
      organizationId: "o",
      cloudPrices: [PRICE_EC2_T3_MICRO_USE1],
      vxlRules: [RULE_PLATFORM_BASE],
      cloudUsage: [{ provider: "aws", service: "EC2", sku: "t3.micro", region: "us-east-1", forecastUnits: 720, forecastBasis: "1 instance" }],
      vxlUsage: [{ category: "platform_base", ruleId: "platform_base:standard", forecastUnits: 1, forecastBasis: "1mo" }],
      now: NOW,
    };
    const a = computeEstimate(args);
    const b = computeEstimate(args);
    expect(a.summary).toEqual(b.summary);
    expect(a.lineItems).toEqual(b.lineItems);
  });

  it("disclaimer is always populated and references the cloud provider directly", () => {
    const r = computeEstimate({
      organizationId: "o", cloudPrices: [], vxlRules: [],
      cloudUsage: [], vxlUsage: [], now: NOW,
    });
    expect(r.disclaimer.length).toBeGreaterThan(40);
    expect(r.disclaimer).toMatch(/cloud provider/i);
    expect(r.disclaimer).toMatch(/never marked up/i);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

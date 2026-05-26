/**
 * Phase 439 — pricing engine kernel.
 *
 * Pure function: given (provider price catalog, VxL pricing rules,
 * discovered usage), produce a deterministic estimate that the
 * dashboard can render directly and the Pricing Analyst Agent can
 * read as ground truth.
 *
 * Hard rules:
 *   - never invents a price; an unmatched usage row produces a
 *     `unmatched_provider_price` risk warning + a zero line item
 *   - sandbox sources flag the entire estimate via summary.containsSandbox
 *   - rules with includedQuantity quota are honored first, then the
 *     overage is priced — no silent overruns
 *   - the disclaimer is always populated and always says the cloud
 *     bill is charged by the cloud provider directly
 *   - currency mixing is rejected upstream — every line in a single
 *     estimate must share one currency, or `currency_mismatch` fires
 */

import type {
  CloudProviderPriceRow,
  DiscoveredCloudUsageItem,
  DiscoveredVxlUsageItem,
  EstimateSummary,
  PriceLineItem,
  PriceSourceMode,
  PricingAssumption,
  PricingEstimate,
  PricingRiskWarning,
  VxlPricingRule,
} from "./types";

/* ──────────────────────────────────────────────────────────────────
   Input.
   ────────────────────────────────────────────────────────────── */

export interface ComputeEstimateInput {
  organizationId: string;
  cloudPrices: ReadonlyArray<CloudProviderPriceRow>;
  vxlRules: ReadonlyArray<VxlPricingRule>;
  cloudUsage: ReadonlyArray<DiscoveredCloudUsageItem>;
  vxlUsage: ReadonlyArray<DiscoveredVxlUsageItem>;
  /** Operator-readable assumptions that drove the discovered usage. */
  assumptions?: ReadonlyArray<PricingAssumption>;
  /** Now anchor — tests inject a fixed Date for determinism. */
  now?: Date;
  /** Override the default currency. Defaults to "USD". */
  baseCurrency?: string;
}

export const DISCLAIMER =
  "Estimated based on current provider pricing and discovered usage. " +
  "Final provider bill is charged by the cloud provider directly and never marked up by VisionXIXLabs.";

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function computeEstimate(input: ComputeEstimateInput): PricingEstimate {
  const now = input.now ?? new Date();
  const baseCurrency = input.baseCurrency ?? "USD";

  const lineItems: PriceLineItem[] = [];
  const warnings: PricingRiskWarning[] = [];

  // Cloud provider line items.
  for (const usage of input.cloudUsage) {
    const price = matchCloudPrice(input.cloudPrices, usage);
    if (!price) {
      warnings.push({
        id: `unmatched:${usage.provider}:${usage.service}:${usage.sku}:${usage.region}`,
        severity: "high",
        text: `No price row matched ${usage.provider} ${usage.service} ${usage.sku} in ${usage.region}.`,
        remediation: "Sync the provider price catalog or add an estimate row to lib/pricing/engine/seed.",
      });
      lineItems.push({
        id: `cloud:${usage.provider}:${usage.service}:${usage.sku}:${usage.region}`,
        label: `${labelForProvider(usage.provider)} ${usage.service} (${usage.region})`,
        bucket: "cloud_provider",
        provider: usage.provider,
        forecastUnits: usage.forecastUnits,
        unitLabel: "unmatched",
        pricePerUnit: 0,
        currency: baseCurrency,
        amount: 0,
        source: "estimate",
        confidence: "low",
      });
      continue;
    }
    if (price.currency !== baseCurrency) {
      warnings.push({
        id: `currency_mismatch:${price.id}`,
        severity: "high",
        text: `${price.id} is priced in ${price.currency}, estimate base is ${baseCurrency}.`,
        remediation: "Convert via an explicit FX rate before producing the estimate.",
      });
      continue;
    }
    const amount = round2(usage.forecastUnits * price.pricePerUnit);
    lineItems.push({
      id: `cloud:${price.id}`,
      label: `${labelForProvider(usage.provider)} ${price.service} (${price.region})`,
      bucket: "cloud_provider",
      provider: usage.provider,
      forecastUnits: usage.forecastUnits,
      unitLabel: price.unit,
      pricePerUnit: price.pricePerUnit,
      currency: price.currency,
      amount,
      source: price.source,
      confidence: price.confidence,
    });
  }

  // VxL platform line items.
  for (const usage of input.vxlUsage) {
    const rule = input.vxlRules.find((r) => r.id === usage.ruleId);
    if (!rule) {
      warnings.push({
        id: `unknown_vxl_rule:${usage.ruleId}`,
        severity: "high",
        text: `Discovered usage references an unknown VxL pricing rule: ${usage.ruleId}.`,
        remediation: "Add the rule or drop the discovered usage row.",
      });
      continue;
    }
    if (rule.currency !== baseCurrency) {
      warnings.push({
        id: `currency_mismatch:${rule.id}`,
        severity: "high",
        text: `VxL rule ${rule.id} is priced in ${rule.currency}, estimate base is ${baseCurrency}.`,
      });
      continue;
    }
    if (rule.sunsetAt && rule.sunsetAt < now) {
      warnings.push({
        id: `sunset:${rule.id}`,
        severity: "medium",
        text: `VxL rule ${rule.id} has sunset. Falling back to its last published price.`,
      });
    }
    const included = rule.includedQuantity ?? 0;
    const billableUnits = Math.max(0, usage.forecastUnits - included);
    const amount = round2(billableUnits * rule.pricePerUnit);
    lineItems.push({
      id: `vxl:${rule.id}`,
      label: rule.label,
      bucket: "vxl_platform",
      provider: null,
      forecastUnits: usage.forecastUnits,
      unitLabel: rule.unit,
      pricePerUnit: rule.pricePerUnit,
      currency: rule.currency,
      amount,
      source: "live", // VxL rules are live by definition — we set them
      confidence: "high",
    });
  }

  const cloudProviderSubtotal = sum(lineItems.filter((l) => l.bucket === "cloud_provider").map((l) => l.amount));
  const vxlPlatformSubtotal   = sum(lineItems.filter((l) => l.bucket === "vxl_platform").map((l) => l.amount));
  const containsSandbox = lineItems.some((l) => l.source === "sandbox");
  if (containsSandbox) {
    warnings.push({
      id: "sandbox_present",
      severity: "critical",
      text: "Estimate contains sandbox-only prices and MUST NOT be used for a real quote.",
      remediation: "Replace sandbox sources with live or cached provider data.",
    });
  }

  const summary: EstimateSummary = {
    cloudProviderSubtotal: round2(cloudProviderSubtotal),
    vxlPlatformSubtotal: round2(vxlPlatformSubtotal),
    total: round2(cloudProviderSubtotal + vxlPlatformSubtotal),
    currency: baseCurrency,
    hasNonLowConfidence: lineItems.some((l) => l.confidence !== "low"),
    containsSandbox,
  };

  // Self-serve eligibility: nothing in the estimate may be sandbox,
  // nothing may be unmatched, and at least one line item must have
  // medium-or-better confidence. Otherwise a human must approve the
  // resulting quote before it goes to the client.
  const selfServeEligible =
    !summary.containsSandbox &&
    warnings.every((w) => w.severity !== "critical" && w.severity !== "high") &&
    summary.hasNonLowConfidence;

  return {
    organizationId: input.organizationId,
    generatedAt: now,
    lineItems,
    assumptions: input.assumptions ? [...input.assumptions] : [],
    warnings,
    summary,
    selfServeEligible,
    disclaimer: DISCLAIMER,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported so tests can pin behavior directly.
   ────────────────────────────────────────────────────────────── */

export function matchCloudPrice(
  prices: ReadonlyArray<CloudProviderPriceRow>,
  usage: DiscoveredCloudUsageItem,
): CloudProviderPriceRow | undefined {
  // Exact match on (provider, service, sku, region). The catalog is
  // expected to be keyed this way; no fuzzy matching, no fallbacks —
  // unmatched rows surface as a warning instead.
  return prices.find((p) =>
    p.provider === usage.provider &&
    p.service === usage.service &&
    p.sku === usage.sku &&
    p.region === usage.region,
  );
}

export function labelForProvider(provider: PriceSourceMode | "aws" | "azure" | "gcp"): string {
  switch (provider) {
    case "aws":   return "AWS";
    case "azure": return "Azure";
    case "gcp":   return "GCP";
    default:      return provider;
  }
}

function sum(xs: ReadonlyArray<number>): number {
  return xs.reduce((acc, n) => acc + n, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

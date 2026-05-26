/**
 * Phase 439 — pricing engine type system.
 *
 * Closed-union vocabulary for everything the engine consumes and
 * produces. Lives under lib/pricing/engine/ so it doesn't collide
 * with the existing membership/builder/tier modules — those drive
 * the legacy fixed-plan upgrade flow and are kept untouched.
 *
 * No runtime, just types. The estimate computation lives in
 * computeEstimate.ts.
 */

/* ──────────────────────────────────────────────────────────────────
   Provider pricing — the abstraction over AWS / Azure / GCP rate
   cards. Live API integration lands later; this is the contract
   every adapter must satisfy.
   ────────────────────────────────────────────────────────────── */

export type CloudProviderId = "aws" | "azure" | "gcp";

export type PriceSourceMode =
  | "live"        // pulled from a live provider pricing API in the last sync
  | "cached"      // pulled previously, served from local store, may be stale
  | "estimate"    // hand-curated or extrapolated — labeled estimate in UI
  | "sandbox";    // demo/sandbox-only synthetic data, never billed against

export type PriceConfidence = "high" | "medium" | "low";

/**
 * One row in the cached provider price catalog. The contract
 * intentionally over-specifies so the engine never has to guess
 * (region, SKU, unit, currency are all explicit).
 */
export interface CloudProviderPriceRow {
  /** Stable id — `${provider}:${service}:${sku}:${region}`. */
  id: string;
  provider: CloudProviderId;
  /** Human-readable service name — "EC2", "S3", "Lambda", "ARM Compute", "Cloud Run". */
  service: string;
  /** Provider-side SKU id — opaque to the engine, useful for source-line evidence. */
  sku: string;
  /** Region code in the provider's own format (us-east-1, eastus, us-central1, ...). */
  region: string;
  /** Unit the price is quoted in — "hour", "GB-month", "1M requests", etc. */
  unit: string;
  /** Price per unit. Always positive; the engine multiplies by usage. */
  pricePerUnit: number;
  /** ISO 4217 — "USD", "EUR", etc. The engine never silently converts currencies. */
  currency: string;
  /** When this row became effective (provider-side effective date). */
  effectiveAt: Date;
  /** When this row was last refreshed from the provider source. */
  lastUpdatedAt: Date;
  /** Where this row was sourced from — keeps audit evidence intact. */
  source: PriceSourceMode;
  /** Optional URL/API endpoint we sourced from. */
  sourceRef?: string;
  /** How sure we are about this rate — drives the UI's "estimate" badge. */
  confidence: PriceConfidence;
}

/* ──────────────────────────────────────────────────────────────────
   VisionXIXLabs charge rules — our side of the bill.
   ────────────────────────────────────────────────────────────── */

export type VxlChargeCategory =
  | "platform_base"      // monthly access to the platform
  | "workspace_seat"     // per-user / per-seat
  | "agent_enabled"      // per AI engineer enabled
  | "automation_run"     // per workflow / script / remediation run
  | "ai_usage"           // OpenAI/Anthropic/local model usage
  | "monitoring_volume"  // logs/metrics/traces/events ingested
  | "cloud_management"   // % of cloud spend or per managed resource
  | "support_tier"       // monthly support contract
  | "enterprise_custom"; // bespoke line item

export type VxlChargeUnit =
  | "month"
  | "seat"
  | "agent"
  | "run"
  | "1M_tokens"
  | "GB_ingested"
  | "managed_resource"
  | "percent_of_cloud_spend"
  | "custom";

export interface VxlPricingRule {
  /** Stable id — `${category}:${rule_short_name}`. */
  id: string;
  category: VxlChargeCategory;
  /** Operator-readable label. */
  label: string;
  /** What we charge per unit, in our base currency. */
  pricePerUnit: number;
  unit: VxlChargeUnit;
  /** ISO 4217. The engine treats all VxL charges in this currency. */
  currency: string;
  /**
   * Optional included quota — first N units free per billing period.
   * Used to express "X automation runs included, then $Y per run."
   */
  includedQuantity?: number;
  /** When this rule became effective. */
  effectiveAt: Date;
  /** When this rule sunsets, if ever. */
  sunsetAt?: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Discovered usage — input to the estimate computation.
   ────────────────────────────────────────────────────────────── */

export interface DiscoveredCloudUsageItem {
  provider: CloudProviderId;
  service: string;
  region: string;
  sku: string;
  /** Forecasted units consumed per billing period — engine multiplies by price. */
  forecastUnits: number;
  /** Operator-readable explanation of how forecast was derived. */
  forecastBasis: string;
}

export interface DiscoveredVxlUsageItem {
  category: VxlChargeCategory;
  ruleId: string;
  /** Forecasted units. */
  forecastUnits: number;
  forecastBasis: string;
}

/* ──────────────────────────────────────────────────────────────────
   Output — what the engine returns.
   ────────────────────────────────────────────────────────────── */

export interface PriceLineItem {
  /** Stable id derived from the input — useful for diffing across reruns. */
  id: string;
  /** Operator-readable label. */
  label: string;
  /** "cloud_provider" | "vxl_platform" — top-level bucket for the UI. */
  bucket: "cloud_provider" | "vxl_platform";
  /** Provider this rolls up under (null for vxl_platform). */
  provider: CloudProviderId | null;
  forecastUnits: number;
  unitLabel: string;
  pricePerUnit: number;
  currency: string;
  /** forecastUnits × pricePerUnit. Cached for UI; computed in engine. */
  amount: number;
  /** Source mode — drives the "estimate / live / cached" badge. */
  source: PriceSourceMode;
  /** Confidence — drives the rose/amber/emerald UI tone. */
  confidence: PriceConfidence;
}

export interface PricingAssumption {
  /** Stable id; the dashboard surfaces these as a list. */
  id: string;
  text: string;
  /** "user_input" | "discovered" | "default" — explains where the assumption came from. */
  source: "user_input" | "discovered" | "default";
}

export interface PricingRiskWarning {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  text: string;
  /** Recommended remediation, if any. */
  remediation?: string;
}

export interface EstimateSummary {
  /** Sum of cloud_provider line items. Billed by the provider, never marked up by us. */
  cloudProviderSubtotal: number;
  /** Sum of vxl_platform line items. Billed by VisionXIXLabs. */
  vxlPlatformSubtotal: number;
  /** cloudProviderSubtotal + vxlPlatformSubtotal. */
  total: number;
  currency: string;
  /** True iff the estimate contains any non-low confidence line items. */
  hasNonLowConfidence: boolean;
  /** True iff any source is sandbox — never bill against a sandbox-only estimate. */
  containsSandbox: boolean;
}

export interface PricingEstimate {
  organizationId: string;
  generatedAt: Date;
  lineItems: PriceLineItem[];
  assumptions: PricingAssumption[];
  warnings: PricingRiskWarning[];
  summary: EstimateSummary;
  /** True iff the estimate qualifies for direct client display without quote approval. */
  selfServeEligible: boolean;
  /** Disclaimer string the UI must render with every estimate. */
  disclaimer: string;
}

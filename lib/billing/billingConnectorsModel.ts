/**
 * Live Billing Connectors — typed contract.
 *
 * Canonical model for every billing connector Axiom can ingest from.
 * Pure read-only. Costs are NEVER fabricated — when the connector
 * is preview/blocked, the entry surfaces a `confirmedDollarsLast30d`
 * of `0` and the UI renders a "preview" pill. Once a live connector
 * lands, the same shape gets populated by the per-provider builder.
 *
 * The model also declares typed anomaly classifications so the
 * autonomy loop can route a billing anomaly into the Risk Queue
 * without an extra translation layer.
 *
 * safetyContract literal 'billing_summary_read_only'.
 */

export type BillingProvider =
  | "aws_cost_explorer"
  | "azure_cost_management"
  | "gcp_billing"
  | "github_billing"
  | "stripe_meter"          // For Axiom itself
  | "vercel_billing";       // For Axiom itself

export type BillingSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type BillingAnomalyKind =
  | "spend_spike_7d"
  | "unattributed_spend"
  | "idle_resource_costing"
  | "egress_spike"
  | "savings_plan_expired"
  | "committed_use_underuse"
  | "untagged_resource"
  | "budget_threshold_breach";

export type BillingAnomalySeverity = "critical" | "high" | "medium" | "low" | "info";

export interface BillingAnomaly {
  id: string;
  kind: BillingAnomalyKind;
  severity: BillingAnomalySeverity;
  /** Affected service / SKU / line item. */
  scope: string;
  /** Operator-readable one-liner. */
  headline: string;
  /** Honest impact summary; zero-confidence values omit dollars entirely. */
  impactSummary: string;
  /** Dollar delta vs. baseline (only when confidence > 0.6, else undefined). */
  deltaUsd?: number;
  /** Baseline period the delta is measured against. */
  baselinePeriod?: string;
  /** Provider this signal came from. */
  sourceProvider: BillingProvider;
  /** Evidence ref the operator can verify. */
  evidenceRef: string;
  /** Confidence 0..1 — derived from data freshness + sample size. */
  confidence: number;
  /** Suggested next operator action — never a mutation. */
  safeNextAction: { label: string; href: string };
}

export interface BillingProviderPosture {
  provider: BillingProvider;
  mode: BillingSourceMode;
  configured: boolean;
  headline: string;
  /** Honest confirmed spend over the last 30 days. Zero until live. */
  confirmedDollarsLast30d: number;
  /** Honest confirmed spend over the previous 30 days (T-30 to T-60). */
  confirmedDollarsPrev30d: number;
  /** Distinct anomalies surfaced by this connector. */
  anomalies: BillingAnomaly[];
  /** Operator-readable list of what's required to flip to live. */
  missingRequirements: string[];
  /** Provider-specific console link for verification. */
  externalConsoleHref?: string;
  /** Operator-actionable next-step route. */
  safeNextAction: { label: string; href: string };
}

export interface BillingConnectorsReport {
  generatedAt: string;
  tenantId?: string;
  providers: BillingProviderPosture[];
  anomalies: BillingAnomaly[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    totalConfirmedDollarsLast30d: number;
    totalConfirmedDollarsPrev30d: number;
    /** Delta percent — only meaningful when totals > 0. Else undefined. */
    spendDeltaPct?: number;
    anomaliesTotal: number;
    anomaliesCritical: number;
    anomaliesHigh: number;
    anomaliesByKind: Record<BillingAnomalyKind, number>;
  };
  overallSourceMode: BillingSourceMode;
  safetyContract: "billing_summary_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const BILLING_PROVIDER_LABEL: Record<BillingProvider, string> = {
  aws_cost_explorer:    "AWS Cost Explorer",
  azure_cost_management:"Azure Cost Management",
  gcp_billing:          "GCP Billing",
  github_billing:       "GitHub Billing",
  stripe_meter:         "Stripe Meter (Axiom)",
  vercel_billing:       "Vercel Billing (Axiom)",
};

export const ANOMALY_KIND_LABEL: Record<BillingAnomalyKind, string> = {
  spend_spike_7d:           "Spend spike (7d)",
  unattributed_spend:       "Unattributed spend",
  idle_resource_costing:    "Idle resource costing",
  egress_spike:             "Egress spike",
  savings_plan_expired:     "Savings plan expired",
  committed_use_underuse:   "Committed-use underuse",
  untagged_resource:        "Untagged resource",
  budget_threshold_breach:  "Budget threshold breach",
};

export const ANOMALY_SEVERITY_TONE: Record<BillingAnomalySeverity, "rose" | "amber" | "cyan" | "emerald" | "zinc"> = {
  critical: "rose",
  high:     "amber",
  medium:   "cyan",
  low:      "emerald",
  info:     "zinc",
};

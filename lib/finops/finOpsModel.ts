/**
 * FinOps foundation — typed contract.
 *
 * Cost intelligence without fabricated savings. The model declares the
 * shape; the builder reports honest foundation state until AWS Cost
 * Explorer / Azure Cost Management / GCP Billing connectors are wired.
 *
 * No guaranteed savings. No saved-money claims. The platform reports
 * "cost telemetry required" until real data lands.
 */

export type FinOpsConnectorStatus =
  | "live"               // real cost data flowing
  | "ready_pending_config" // adapter exists, needs creds
  | "foundation"         // adapter not yet built
  | "blocked"            // configured but failing
  | "disabled";          // intentionally turned off

export type FinOpsConnectorId =
  | "aws_cost_explorer"
  | "azure_cost_management"
  | "gcp_billing"
  | "github_actions_billing";

export interface FinOpsConnectorState {
  id: FinOpsConnectorId;
  label: string;
  status: FinOpsConnectorStatus;
  sourceMode: string;
  headline: string;
  /** Setup requirements when not live. */
  missingConfig: string[];
  /** What this connector unlocks when live. */
  unlocks: string[];
  /** Operator's next safe step. */
  safeNextAction: { label: string; href: string };
  /** Evidence ref the operator can audit. */
  evidenceRef: string;
}

export interface FinOpsSignal {
  /** Stable id. */
  id: string;
  /** What kind of signal this is. */
  kind: "cost_visibility" | "optimization_opportunity" | "anomaly" | "forecast";
  title: string;
  description: string;
  /** Operator-readable status — never "applied". */
  status:
    | "evidence_unavailable"     // no telemetry yet
    | "review_recommended"        // visible but operator should verify
    | "potential_savings"         // honest preview language
    | "requires_cost_telemetry";  // blocked
  sourceMode: string;
  /** Honest "what would this surface when telemetry lands". */
  expectedOutcome: string;
  evidenceRefs: string[];
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

export interface FinOpsReport {
  generatedAt: string;
  tenantId?: string;
  connectors: FinOpsConnectorState[];
  signals: FinOpsSignal[];
  summary: {
    liveConnectors: number;
    foundationConnectors: number;
    blockedConnectors: number;
    /** Always 0 until telemetry is wired — kept honest. */
    confirmedDollarSavings: 0;
    /** Number of "potential savings" signals — opportunities, not savings. */
    potentialOpportunities: number;
  };
  overallStatus: "no_telemetry" | "partial_telemetry" | "full_telemetry";
  /** Hard literal — no fake dollar savings, ever. */
  safetyContract: "no_fabricated_savings_or_costs";
  /** Honest limitations operators (and auditors) need to see. */
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const CONNECTOR_STATUS_LABEL: Record<FinOpsConnectorStatus, string> = {
  live:                 "Live · cost data flowing",
  ready_pending_config: "Ready · pending config",
  foundation:           "Foundation",
  blocked:              "Blocked",
  disabled:             "Disabled",
};

export const CONNECTOR_STATUS_TONE: Record<FinOpsConnectorStatus, "emerald" | "amber" | "cyan" | "rose" | "zinc"> = {
  live:                 "emerald",
  ready_pending_config: "amber",
  foundation:           "cyan",
  blocked:              "rose",
  disabled:             "zinc",
};

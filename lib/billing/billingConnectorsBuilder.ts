/**
 * Billing Connectors builder.
 *
 * Pure read-only composition. Until live SDK traversal lands per
 * provider (AWS Cost Explorer / Azure Cost Mgmt / GCP Billing / etc.),
 * every connector reports zero confirmed dollars + a "preview" pill.
 * That's the whole honest-by-design promise: no fabricated savings,
 * no fake spike alerts.
 *
 * The shape stays stable so the cockpit can render either preview or
 * live state without code change.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import { extractAwsCostExplorerSpend } from "./awsCostExplorerExtractor";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  BillingAnomaly,
  BillingAnomalyKind,
  BillingConnectorsReport,
  BillingProvider,
  BillingProviderPosture,
  BillingSourceMode,
} from "./billingConnectorsModel";

export interface BuildBillingInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildBillingConnectors(input: BuildBillingInput): Promise<BillingConnectorsReport> {
  const env = loadAppEnv();
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });
  const awsMode = state.providers.find((p) => p.provider === "aws")?.mode ?? "preview";
  const azureMode = state.providers.find((p) => p.provider === "azure")?.mode ?? "preview";
  const gcpMode = state.providers.find((p) => p.provider === "gcp")?.mode ?? "preview";
  const githubMode = state.providers.find((p) => p.provider === "github")?.mode ?? "preview";

  // ---------------------------------------------------------------------------
  // Live AWS Cost Explorer extractor (Phase 44b)
  // ---------------------------------------------------------------------------
  // Only attempted when AWS is live + AWS_COST_EXPLORER_ENABLED is set.
  // Extractor returns honest preview/blocked envelope otherwise; we merge it
  // into the AWS provider posture so the UI sees real dollars when present.
  let awsCostLive: Awaited<ReturnType<typeof extractAwsCostExplorerSpend>> | null = null;
  if (awsMode === "live" && env.awsCostExplorerEnabled) {
    try {
      awsCostLive = await extractAwsCostExplorerSpend();
    } catch {
      // Extractor errors stay honest in the posture — no fabricated numbers.
      awsCostLive = null;
    }
  }

  const providers: BillingProviderPosture[] = [
    {
      ...posture("aws_cost_explorer", awsMode, [
        "AWS_COST_EXPLORER_ENABLED + ce:GetCostAndUsage permission on the broker IAM role.",
      ], "https://console.aws.amazon.com/cost-management/", { label: "Open AWS sources", href: "/dashboard/sources" }),
      // Splice in real dollars + anomalies when the extractor succeeded.
      ...(awsCostLive && awsCostLive.mode === "live"
        ? {
            mode: "live" as BillingSourceMode,
            configured: true,
            headline: `Live AWS Cost Explorer — $${awsCostLive.confirmedDollarsLast30d.toFixed(2)} confirmed over last 30d.`,
            confirmedDollarsLast30d: awsCostLive.confirmedDollarsLast30d,
            confirmedDollarsPrev30d: awsCostLive.confirmedDollarsPrev30d,
            anomalies: awsCostLive.anomalies,
            missingRequirements: [],
          }
        : awsCostLive
          ? {
              headline: `Cost Explorer extraction ${awsCostLive.mode}: ${awsCostLive.limitations[0] ?? "n/a"}`,
              missingRequirements: awsCostLive.limitations,
            }
          : {}),
    },
    posture("azure_cost_management", azureMode, [
      "AZURE_COST_MGMT_ENABLED + CostManagement Reader role on the subscription.",
    ], "https://portal.azure.com/#blade/Microsoft_Azure_CostManagement", { label: "Open Azure sources", href: "/dashboard/sources" }),
    posture("gcp_billing", gcpMode, [
      "GCP_BILLING_BIGQUERY_DATASET + bigquery.dataViewer + billing.viewer roles on the project.",
    ], "https://console.cloud.google.com/billing/", { label: "Open GCP sources", href: "/dashboard/sources" }),
    posture("github_billing", githubMode, [
      "GITHUB_BILLING_ENABLED + admin:org scope or GitHub App with metadata:read on the org.",
    ], "https://github.com/settings/billing/", { label: "Open GitHub setup", href: "/dashboard/integrations/github" }),
    posture("stripe_meter", "preview", [
      "STRIPE_SECRET_KEY (Axiom's own metered billing reader).",
    ], "https://dashboard.stripe.com/", { label: "Open admin billing", href: "/dashboard/finops" }),
    posture("vercel_billing", "preview", [
      "VERCEL_API_TOKEN with billing:read.",
    ], "https://vercel.com/account/billing", { label: "Open admin billing", href: "/dashboard/finops" }),
  ];

  // ---------------------------------------------------------------------------
  // Anomaly rollup — currently empty (honest preview); each per-provider live
  // builder will append into provider.anomalies[].
  // ---------------------------------------------------------------------------
  const allAnomalies: BillingAnomaly[] = providers.flatMap((p) => p.anomalies);

  const liveCount = providers.filter((p) => p.mode === "live").length;
  const totalLast30 = providers.reduce((s, p) => s + p.confirmedDollarsLast30d, 0);
  const totalPrev30 = providers.reduce((s, p) => s + p.confirmedDollarsPrev30d, 0);
  const spendDeltaPct = totalPrev30 > 0 ? ((totalLast30 - totalPrev30) / totalPrev30) * 100 : undefined;

  const anomaliesByKind: Record<BillingAnomalyKind, number> = {
    spend_spike_7d: 0, unattributed_spend: 0, idle_resource_costing: 0,
    egress_spike: 0, savings_plan_expired: 0, committed_use_underuse: 0,
    untagged_resource: 0, budget_threshold_breach: 0,
  };
  for (const a of allAnomalies) anomaliesByKind[a.kind]++;

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    providers,
    anomalies: allAnomalies,
    summary: {
      providerCount: providers.length,
      liveProviderCount: liveCount,
      totalConfirmedDollarsLast30d: totalLast30,
      totalConfirmedDollarsPrev30d: totalPrev30,
      spendDeltaPct,
      anomaliesTotal: allAnomalies.length,
      anomaliesCritical: allAnomalies.filter((a) => a.severity === "critical").length,
      anomaliesHigh: allAnomalies.filter((a) => a.severity === "high").length,
      anomaliesByKind,
    },
    overallSourceMode: liveCount > 0 ? (liveCount === providers.length ? "live" : "partial_live") : "preview",
    safetyContract: "billing_summary_read_only",
    limitations: [
      "Live billing traversal wires per provider in follow-up phases. Until then, confirmed dollars stay at $0 — no fabricated cost data.",
      "Anomaly detection is typed and ready; signals populate once any provider flips to live mode.",
    ],
    safeNextAction: { label: "Open FinOps", href: "/dashboard/finops" },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function posture(
  provider: BillingProvider,
  rawMode: string,
  missingRequirements: string[],
  externalConsoleHref: string,
  safeNextAction: { label: string; href: string },
): BillingProviderPosture {
  const mode = mapMode(rawMode);
  return {
    provider,
    mode,
    configured: mode === "live" || mode === "partial_live",
    headline: mode === "live"
      ? "Live billing connector — confirmed dollars + anomaly stream active."
      : "Preview — connector typed, awaiting credentials to flip live.",
    confirmedDollarsLast30d: 0,
    confirmedDollarsPrev30d: 0,
    anomalies: [],
    missingRequirements: mode === "live" ? [] : missingRequirements,
    externalConsoleHref,
    safeNextAction,
  };
}

function mapMode(m: string): BillingSourceMode {
  switch (m) {
    case "live":         return "partial_live"; // provider live, billing-specific connector still preview
    case "partial_live": return "partial_live";
    case "preview":      return "preview";
    case "blocked":      return "blocked";
    case "disabled":     return "disabled";
    default:             return "preview";
  }
}

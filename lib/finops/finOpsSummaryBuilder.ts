/**
 * FinOps Summary builder.
 *
 * Reports honest cost foundation state. Until AWS Cost Explorer /
 * Azure Cost Management / GCP Billing connectors are wired, every
 * signal is labeled "evidence_unavailable" or "requires_cost_telemetry".
 *
 * Zero confirmed dollar savings until real telemetry lands. This is
 * enforced by a literal type — TS prevents drift.
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type {
  FinOpsConnectorState,
  FinOpsReport,
  FinOpsSignal,
} from "./finOpsModel";

export interface BuildFinOpsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildFinOpsReport(input: BuildFinOpsInput): Promise<FinOpsReport> {
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });

  // ---------------------------------------------------------------------------
  // Connectors — honest foundation state per provider
  // ---------------------------------------------------------------------------
  const connectors: FinOpsConnectorState[] = [
    {
      id: "aws_cost_explorer",
      label: "AWS Cost Explorer",
      status: "ready_pending_config",
      sourceMode: "foundation",
      headline: "@aws-sdk/client-cost-explorer wired; cost-allocation tags + permissions required",
      missingConfig: [
        "AWS_COST_EXPLORER_ENABLED env flag",
        "ce:GetCostAndUsage IAM permission on broker role",
        "cost allocation tags enabled on AWS account",
      ],
      unlocks: ["top cost drivers", "cost anomaly detection", "right-sizing opportunities"],
      safeNextAction: { label: "Open AWS setup docs", href: "/docs/aws-setup" },
      evidenceRef: "package.json:@aws-sdk/client-cost-explorer",
    },
    {
      id: "azure_cost_management",
      label: "Azure Cost Management",
      status: "foundation",
      sourceMode: "foundation",
      headline: "Adapter not yet built — Azure live inventory ships first",
      missingConfig: [
        "@azure/arm-costmanagement SDK wiring",
        "Cost Management Reader role on subscription",
      ],
      unlocks: ["Azure subscription cost view", "resource group breakdown"],
      safeNextAction: { label: "Open Azure setup docs", href: "/docs/azure-setup" },
      evidenceRef: "lib/cloud/azure/* (no cost module yet)",
    },
    {
      id: "gcp_billing",
      label: "GCP Cloud Billing",
      status: "foundation",
      sourceMode: "foundation",
      headline: "Adapter not yet built — GCP live inventory ships first",
      missingConfig: [
        "@google-cloud/billing SDK wiring",
        "Billing Account Viewer role on the linked billing account",
      ],
      unlocks: ["GCP project cost view", "billing export to BigQuery"],
      safeNextAction: { label: "Open GCP setup docs", href: "/docs/gcp-setup" },
      evidenceRef: "lib/cloud/gcp/* (no billing module yet)",
    },
    {
      id: "github_actions_billing",
      label: "GitHub Actions billing",
      status: "foundation",
      sourceMode: "foundation",
      headline: "GitHub Actions minutes consumption — adapter not yet built",
      missingConfig: ["billing scope on GITHUB_PAT or GitHub App installation"],
      unlocks: ["CI minutes consumption", "self-hosted vs hosted breakdown"],
      safeNextAction: { label: "Open GitHub setup", href: "/dashboard/integrations/github" },
      evidenceRef: "lib/connectors/github/* (no billing module yet)",
    },
  ];

  // ---------------------------------------------------------------------------
  // Signals — every one labeled honestly until telemetry exists
  // ---------------------------------------------------------------------------
  const signals: FinOpsSignal[] = [
    {
      id: "finops:cost_visibility:overall",
      kind: "cost_visibility",
      title: "Tenant-wide cost visibility",
      description: "Cost data is not yet flowing — connect AWS Cost Explorer / Azure Cost Management / GCP Billing to populate.",
      status: "requires_cost_telemetry",
      sourceMode: state.sourceMode,
      expectedOutcome: "When AWS Cost Explorer is wired, this surface will show monthly + 30-day cost trends per provider.",
      evidenceRefs: ["finops:no_telemetry_yet"],
      limitations: ["No cost telemetry connectors wired."],
      safeNextAction: { label: "Open AWS setup docs", href: "/docs/aws-setup" },
    },
    {
      id: "finops:optimization:right_sizing",
      kind: "optimization_opportunity",
      title: "Resource right-sizing opportunities",
      description: "Live AWS inventory contains CPU + storage signals; pairing with cost data would surface right-sizing candidates.",
      status: "evidence_unavailable",
      sourceMode: state.sourceMode,
      expectedOutcome: "When inventory + cost data are paired, this surface will list per-resource potential savings ranges with evidence refs.",
      evidenceRefs: ["axiomOS:providers[aws]"],
      limitations: ["Right-sizing requires both live inventory + cost telemetry."],
      safeNextAction: { label: "Open AWS journey", href: "/dashboard/aws" },
    },
    {
      id: "finops:anomaly:placeholder",
      kind: "anomaly",
      title: "Cost anomaly detection",
      description: "Anomaly detection requires historical cost data — at least 30 days of telemetry.",
      status: "requires_cost_telemetry",
      sourceMode: state.sourceMode,
      expectedOutcome: "Once Cost Explorer telemetry is wired and persisted, anomalies will surface as risks in the Risk Queue.",
      evidenceRefs: ["finops:no_history_yet"],
      limitations: ["Historical persistence + cost telemetry both required."],
      safeNextAction: { label: "Open Readiness", href: "/dashboard/readiness" },
    },
  ];

  // Honest rollup — no fabricated savings
  const liveConnectors        = connectors.filter((c) => c.status === "live").length;
  const foundationConnectors  = connectors.filter((c) => c.status === "foundation").length;
  const blockedConnectors     = connectors.filter((c) => c.status === "blocked").length;
  const potentialOpportunities = signals.filter((s) => s.status === "potential_savings").length;
  const overallStatus =
    liveConnectors === connectors.length ? "full_telemetry"    :
    liveConnectors > 0                   ? "partial_telemetry" :
                                            "no_telemetry";

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    connectors,
    signals,
    summary: {
      liveConnectors,
      foundationConnectors,
      blockedConnectors,
      confirmedDollarSavings: 0,  // literal type — cannot be promoted
      potentialOpportunities,
    },
    overallStatus,
    safetyContract: "no_fabricated_savings_or_costs",
    limitations: [
      "Cost telemetry connectors are not yet wired — the platform reports 'evidence_unavailable' rather than fabricating dollar figures.",
      "No 'guaranteed savings' / 'saved money' claims will appear in this report. Until telemetry lands, every signal uses honest preview language.",
    ],
    safeNextAction: { label: "Open AWS journey", href: "/dashboard/aws" },
  };
}

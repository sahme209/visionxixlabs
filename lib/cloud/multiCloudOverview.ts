/**
 * Multi-cloud overview aggregator.
 *
 * One pure function the Command Center + topology + a future
 * /dashboard/multi-cloud page read. Composes the three provider preview
 * scanners + their capability tables into a single normalised view
 * a customer can read at a glance — the "you don't need to bounce
 * between consoles" value the user asked for.
 *
 * Pure: takes optional snapshot inputs, never makes SDK calls. The
 * caller decides whether to invoke live scanners and pass the output in.
 */

import type { CloudProvider } from "@/lib/domain/provider";
import type { DataSource } from "@/lib/domain/source";
import { capabilitiesFor, summarizeCapabilities } from "./providerCapabilities";
import { getCloudProviderMode, type ProviderMode } from "@/lib/config/providerModes";

// ---------------------------------------------------------------------------
// Per-provider normalised slice
// ---------------------------------------------------------------------------

export interface NormalisedProviderSlice {
  provider: CloudProvider;
  mode: ProviderMode;
  source: DataSource;
  /** Quick numbers for the tile. */
  totals: {
    resources: number;
    findings: number;
    recommendations: number;
    highRiskFindings: number;
  };
  /** Categorised resource counts. */
  resourceCounts: Record<string, number>;
  /** Highest-risk finding, when available. */
  topFinding?: { ruleCode: string; risk: string; resourceRef: string };
  /** Honest one-liner explaining the current state for the UI. */
  headline: string;
  /** Safe next action for this provider. */
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Input — caller passes whatever preview/live output it has on hand
// ---------------------------------------------------------------------------

interface FindingShape  { ruleCode: string; risk: string; resourceRef: string }
interface RecShape      { id: string }
interface SnapshotShape { resourceCounts: Record<string, number>; resources: { id: string }[] }
interface ProviderPayload { snapshot: SnapshotShape; findings: FindingShape[]; recommendations: RecShape[] }

export interface MultiCloudOverviewInputs {
  aws?:   ProviderPayload;
  azure?: ProviderPayload;
  gcp?:   ProviderPayload;
}

// ---------------------------------------------------------------------------
// Aggregator (pure)
// ---------------------------------------------------------------------------

export interface MultiCloudOverview {
  /** Per-provider normalised slices. */
  slices: NormalisedProviderSlice[];
  /** Aggregate totals across all providers. */
  totals: NormalisedProviderSlice["totals"];
  /** Provider count where source !== "empty". */
  providersWithData: number;
  /** Honest summary line for the Command Center. */
  summary: string;
  /** Capability rollup driven by `providerCapabilities.ts`. */
  capabilitySummary: ReturnType<typeof summarizeCapabilities>;
}

const HIGH_RISKS = new Set(["high", "critical"]);

function buildSlice(
  provider: CloudProvider,
  mode: ProviderMode,
  payload?: ProviderPayload,
): NormalisedProviderSlice {
  if (!payload) {
    return {
      provider,
      mode,
      source: "preview",
      totals: { resources: 0, findings: 0, recommendations: 0, highRiskFindings: 0 },
      resourceCounts: {},
      headline:
        mode === "live"     ? `${provider.toUpperCase()} live mode — no scan output supplied yet.`        :
        mode === "preview"  ? `${provider.toUpperCase()} preview mode — connect to populate.`             :
        mode === "expanding" ? `${provider.toUpperCase()} expanding tier — adapter foundation ready.`     :
                                `${provider.toUpperCase()} disabled.`,
      safeNextAction:
        provider === "aws"   ? { label: "Connect AWS",   href: "/operator/onboarding" } :
        provider === "azure" ? { label: "View Azure setup", href: "/docs/azure-setup" } :
                                { label: "View GCP setup",   href: "/docs/gcp-setup" },
    };
  }

  const totalResources = Object.values(payload.snapshot.resourceCounts).reduce((s, n) => s + n, 0);
  const highRisk = payload.findings.filter((f) => HIGH_RISKS.has(f.risk));
  // Pick the highest-risk finding for display.
  const topFinding = [...payload.findings].sort((a, b) => {
    const rank = (r: string) => (r === "critical" ? 4 : r === "high" ? 3 : r === "medium" ? 2 : r === "low" ? 1 : 0);
    return rank(b.risk) - rank(a.risk);
  })[0];

  return {
    provider,
    mode,
    source: "preview",
    totals: {
      resources: totalResources,
      findings: payload.findings.length,
      recommendations: payload.recommendations.length,
      highRiskFindings: highRisk.length,
    },
    resourceCounts: payload.snapshot.resourceCounts,
    topFinding: topFinding
      ? { ruleCode: topFinding.ruleCode, risk: topFinding.risk, resourceRef: topFinding.resourceRef }
      : undefined,
    headline: `${totalResources} resources · ${payload.findings.length} findings · ${highRisk.length} high-risk.`,
    safeNextAction: { label: "Open Command Center", href: "/dashboard/command-center" },
  };
}

export function buildMultiCloudOverview(inputs: MultiCloudOverviewInputs = {}): MultiCloudOverview {
  const slices = [
    buildSlice("aws",   getCloudProviderMode("aws"),   inputs.aws),
    buildSlice("azure", getCloudProviderMode("azure"), inputs.azure),
    buildSlice("gcp",   getCloudProviderMode("gcp"),   inputs.gcp),
  ];
  const totals = slices.reduce(
    (acc, s) => ({
      resources:        acc.resources + s.totals.resources,
      findings:         acc.findings + s.totals.findings,
      recommendations:  acc.recommendations + s.totals.recommendations,
      highRiskFindings: acc.highRiskFindings + s.totals.highRiskFindings,
    }),
    { resources: 0, findings: 0, recommendations: 0, highRiskFindings: 0 },
  );
  const providersWithData = slices.filter((s) => s.totals.resources > 0).length;
  const summary = providersWithData === 0
    ? "No provider has live data yet. Preview scanners produce honest sample data per provider."
    : `${providersWithData} provider${providersWithData === 1 ? "" : "s"} with data · ${totals.findings} findings · ${totals.highRiskFindings} high-risk.`;
  return {
    slices,
    totals,
    providersWithData,
    summary,
    capabilitySummary: summarizeCapabilities(),
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function providerHeading(provider: CloudProvider): string {
  if (provider === "aws") return "Amazon Web Services";
  if (provider === "azure") return "Microsoft Azure";
  return "Google Cloud Platform";
}

export function providerColor(provider: CloudProvider): string {
  if (provider === "aws")   return "text-orange-300 bg-orange-500/10 border-orange-500/20";
  if (provider === "azure") return "text-blue-300 bg-blue-500/10 border-blue-500/20";
  return "text-red-300 bg-red-500/10 border-red-500/20";
}

/** Pure capability comparison shape — useful for side-by-side rendering. */
export function compareCapability(category: string): { provider: CloudProvider; status: string; providerName: string }[] {
  const providers: CloudProvider[] = ["aws", "azure", "gcp"];
  return providers.map((p) => {
    const cap = capabilitiesFor(p).find((c) => c.category === category);
    return {
      provider: p,
      status: cap?.status ?? "planned",
      providerName: cap?.providerName ?? "—",
    };
  });
}

import type { CloudSnapshot, ComputeResource, StorageResource, CloudProvider } from "../cloudSnapshot";
import type { CostSignal, ConfidenceScore, ProviderLabels } from "../costSignals";
import { computeConfidence, LABELS } from "../costSignals";
import type { SavingsEstimate } from "../enums";
import type { ActionDisposition } from "./types";

// ---------------------------------------------------------------------------
// Rich recommendation — agent-facing output that powers the UI and chat
// ---------------------------------------------------------------------------

export type RichRecommendation = {
  id: string;
  title: string;
  plainEnglishSummary: string;
  technicalReason: string;
  impact: string;
  estimatedSavings: SavingsEstimate;
  confidence: ConfidenceScore;
  safetyLevel: ActionDisposition;
  recommendedAction: string;
  requiresApproval: boolean;
  executionPreview: string[];
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function buildRecommendations(
  signals: CostSignal[],
  snapshot: CloudSnapshot,
): RichRecommendation[] {
  const L = LABELS[snapshot.provider];
  const ctx = deriveContext(snapshot);

  return signals.map((signal, i) => {
    const kind = classifySignal(signal);
    return BUILDERS[kind](signal, i, L, ctx);
  });
}

// ---------------------------------------------------------------------------
// Snapshot context — precomputed values used across all builders
// ---------------------------------------------------------------------------

type SnapshotContext = {
  provider: CloudProvider;
  computeCount: number;
  storageCount: number;
  regionCount: number;
  primaryRegion: string;
  regions: string[];
  hasSpendData: boolean;
  confidence: ConfidenceScore;
};

function deriveContext(snapshot: CloudSnapshot): SnapshotContext {
  const compute = snapshot.resources.filter(
    (r): r is ComputeResource => r.resourceType === "compute" && r.state === "running",
  );
  const storage = snapshot.resources.filter(
    (r): r is StorageResource => r.resourceType === "storage",
  );
  return {
    provider: snapshot.provider,
    computeCount: compute.length,
    storageCount: storage.length,
    regionCount: snapshot.regions.length,
    primaryRegion: snapshot.regions[0] ?? "us-east-1",
    regions: snapshot.regions,
    hasSpendData: snapshot.monthlySpend !== undefined && snapshot.monthlySpend > 0,
    confidence: computeConfidence(
      snapshot.monthlySpend !== undefined && snapshot.monthlySpend > 0,
      compute,
    ),
  };
}

// ---------------------------------------------------------------------------
// Signal classification
// ---------------------------------------------------------------------------

type SignalKind =
  | "compute_rightsize"
  | "commitment_plan"
  | "storage_tiering"
  | "single_region_risk"
  | "multi_region_sprawl";

function classifySignal(signal: CostSignal): SignalKind {
  const text = `${signal.resource} ${signal.issue}`.toLowerCase();
  if (text.includes("oversized") || text.includes("under-utilized")) return "compute_rightsize";
  if (text.includes("on-demand") || (text.includes("no ") && text.includes("detected"))) return "commitment_plan";
  if (text.includes("tiering") || text.includes("cold data")) return "storage_tiering";
  if (text.includes("one region") || text.includes("outage risk")) return "single_region_risk";
  if (text.includes("multi-region") || text.includes("unnecessary redundancy")) return "multi_region_sprawl";
  return "compute_rightsize";
}

// ---------------------------------------------------------------------------
// Builder per signal kind
// ---------------------------------------------------------------------------

type BuilderFn = (
  signal: CostSignal,
  index: number,
  L: ProviderLabels,
  ctx: SnapshotContext,
) => RichRecommendation;

function toSavings(signal: CostSignal): SavingsEstimate {
  return {
    monthlyLow: Math.round(signal.annualSavingsEstimate.low / 12),
    monthlyHigh: Math.round(signal.annualSavingsEstimate.high / 12),
    yearlyLow: signal.annualSavingsEstimate.low,
    yearlyHigh: signal.annualSavingsEstimate.high,
  };
}

function fmtRange(low: number, high: number): string {
  if (low === high) return `$${low.toLocaleString()}`;
  return `$${low.toLocaleString()}–$${high.toLocaleString()}`;
}

function extractCount(text: string): number {
  const match = text.match(/^(\d+)\s/);
  return match ? parseInt(match[1], 10) : 0;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

// ---- Compute right-sizing ----

const buildComputeRightsize: BuilderFn = (signal, index, L, ctx) => {
  const count = extractCount(signal.resource) || ctx.computeCount;
  const savings = toSavings(signal);

  return {
    id: `rec-${index + 1}`,
    title: `Resize ${count} oversized ${plural(count, L.compute, L.computePlural)}`,
    plainEnglishSummary:
      `I found ${count} ${plural(count, L.compute, L.computePlural)} consistently running well below capacity. ` +
      `Downsizing them would cut compute costs without affecting workload performance.`,
    technicalReason:
      `${L.metricsSource} data shows sustained CPU utilization below 40% across a 7-day window. ` +
      `These instances are provisioned for peak loads that aren't materializing.`,
    impact:
      `Estimated ${fmtRange(savings.yearlyLow, savings.yearlyHigh)}/year in savings. ` +
      `No application changes required — resizes stay within the same instance family.`,
    estimatedSavings: savings,
    confidence: signal.confidenceScore,
    safetyLevel: "approval_required",
    recommendedAction:
      `Right-size ${count} ${plural(count, L.compute, L.computePlural)} to smaller variants in the same family`,
    requiresApproval: true,
    executionPreview: signal.proOutputPreview ?? [
      `Generate ${L.terraformOrIac} to resize instances`,
      `Apply rolling resize with health checks (zero-downtime)`,
      `Verify post-resize via ${L.metricsSource}`,
    ],
  };
};

// ---- Commitment plan ----

const buildCommitmentPlan: BuilderFn = (signal, index, L, ctx) => {
  const savings = toSavings(signal);

  return {
    id: `rec-${index + 1}`,
    title: `Enable ${L.commitmentPlan} coverage`,
    plainEnglishSummary:
      `Your ${L.computePlural} are running entirely on on-demand pricing. ` +
      `A ${L.commitmentPlan} would lock in a discount on the compute hours you're already using.`,
    technicalReason:
      `100% of compute spend is on-demand. Historical usage shows a stable baseline ` +
      `suitable for a 1-year no-upfront commitment covering the majority of your fleet.`,
    impact:
      `Estimated ${fmtRange(savings.yearlyLow, savings.yearlyHigh)}/year in savings. ` +
      `No infrastructure changes — this is a billing optimization only.`,
    estimatedSavings: savings,
    confidence: signal.confidenceScore,
    safetyLevel: "report_only",
    recommendedAction: `Purchase a ${L.commitmentPlanFull} covering 70–90% of baseline compute`,
    requiresApproval: false,
    executionPreview: signal.proOutputPreview ?? [
      `Calculate optimal ${L.commitmentPlan} commitment based on usage history`,
      `Generate purchase recommendation with hourly commitment rate`,
      `Walk through purchase in the cloud console`,
    ],
  };
};

// ---- Storage tiering ----

const buildStorageTiering: BuilderFn = (signal, index, L, ctx) => {
  const count = extractCount(signal.resource) || ctx.storageCount;
  const savings = toSavings(signal);
  const bulkChange = count > 10;

  return {
    id: `rec-${index + 1}`,
    title: `Enable ${L.tieringAction} on ${count} ${plural(count, L.storage, L.storagePlural)}`,
    plainEnglishSummary:
      `I found ${count} ${plural(count, L.storage, L.storagePlural)} storing data in Standard tier that hasn't been accessed in over 30 days. ` +
      `Switching to ${L.tieringAction} would reduce storage costs automatically.`,
    technicalReason:
      `Access pattern analysis shows approximately 80% of objects across these ${plural(count, L.storage, L.storagePlural)} are cold ` +
      `(last accessed 30+ days ago). ${L.tieringAction} moves cold objects to cheaper tiers transparently.`,
    impact:
      `Estimated ${fmtRange(savings.yearlyLow, savings.yearlyHigh)}/year in savings. ` +
      `No application changes — reads from tiered storage work identically.`,
    estimatedSavings: savings,
    confidence: signal.confidenceScore,
    safetyLevel: bulkChange ? "approval_required" : "auto_fix_candidate",
    recommendedAction:
      `Apply ${L.tieringAction} lifecycle policies to ${count} ${plural(count, L.storage, L.storagePlural)}`,
    requiresApproval: bulkChange,
    executionPreview: signal.proOutputPreview ?? [
      `Scan access patterns across all ${count} ${plural(count, L.storage, L.storagePlural)}`,
      `Generate lifecycle policies for ${L.tieringAction}`,
      `Apply policies automatically — no manual bucket-by-bucket configuration`,
    ],
  };
};

// ---- Single-region risk ----

const buildSingleRegionRisk: BuilderFn = (signal, index, L, ctx) => {
  const count = ctx.computeCount;
  const savings = toSavings(signal);

  return {
    id: `rec-${index + 1}`,
    title: "Add second-region recovery path",
    plainEnglishSummary:
      `All ${count} ${plural(count, L.compute, L.computePlural)} are deployed in ${ctx.primaryRegion}. ` +
      `If that region goes down, there's no failover. Adding a recovery region protects against regional outages.`,
    technicalReason:
      `Zero multi-region redundancy detected. A single-region failure would take down all compute workloads ` +
      `with no automatic recovery path.`,
    impact:
      `No direct cost savings — this is a resilience improvement. ` +
      `Estimated annual downtime cost risk: ${fmtRange(savings.yearlyLow, savings.yearlyHigh)}.`,
    estimatedSavings: savings,
    confidence: "medium",
    safetyLevel: "report_only",
    recommendedAction: `Generate multi-region ${L.terraformOrIac} with ${L.failoverTool} failover`,
    requiresApproval: false,
    executionPreview: [
      `Deploy a warm standby in a second region`,
      `Configure ${L.failoverTool} health-checked failover`,
      `Estimated additional cost: 15–30% of current compute spend`,
    ],
  };
};

// ---- Multi-region sprawl ----

const buildMultiRegionSprawl: BuilderFn = (signal, index, L, ctx) => {
  const savings = toSavings(signal);

  return {
    id: `rec-${index + 1}`,
    title: `Review multi-region sprawl across ${ctx.regionCount} regions`,
    plainEnglishSummary:
      `Your workload is spread across ${ctx.regionCount} regions, which may include unnecessary redundancy. ` +
      `Consolidating to essential regions could reduce cross-region transfer costs and operational complexity.`,
    technicalReason:
      `Resources detected in ${ctx.regionCount} regions (${ctx.regions.join(", ")}). ` +
      `Cross-region data transfer and management overhead increase with each additional region.`,
    impact: `Estimated ${fmtRange(savings.yearlyLow, savings.yearlyHigh)}/year in potential savings from consolidation.`,
    estimatedSavings: savings,
    confidence: "medium",
    safetyLevel: "report_only",
    recommendedAction: "Analyze per-region utilization and consolidate workloads to essential regions",
    requiresApproval: false,
    executionPreview: [
      "Audit per-region utilization and traffic patterns",
      "Identify regions with less than 10% of total traffic",
      "Migrate workloads to primary regions and decommission unused ones",
    ],
  };
};

// ---------------------------------------------------------------------------
// Builder registry
// ---------------------------------------------------------------------------

const BUILDERS: Record<SignalKind, BuilderFn> = {
  compute_rightsize: buildComputeRightsize,
  commitment_plan: buildCommitmentPlan,
  storage_tiering: buildStorageTiering,
  single_region_risk: buildSingleRegionRisk,
  multi_region_sprawl: buildMultiRegionSprawl,
};

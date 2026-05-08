import type { CloudProvider, CloudSnapshot, ComputeResource, StorageResource } from "./cloudSnapshot";

export type ConfidenceScore = "low" | "medium" | "high";

export type CostSignal = {
  resource: string;
  issue: string;
  signalType: SignalType;
  monthlyCostEstimate: { low: number; high: number };
  annualSavingsEstimate: { low: number; high: number };
  confidence: "measured" | "estimated";
  confidenceScore: ConfidenceScore;
  proFix: string;
  proOutputPreview?: string[];
};

export type SignalType =
  | "compute_rightsizing"
  | "commitment_discount"
  | "storage_tiering"
  | "single_region_risk"
  | "multi_region_sprawl"
  | "idle_compute"
  | "public_storage"
  | "backup_warning";

export type CostSummary = {
  signals: CostSignal[];
  totalAnnualSavings: { low: number; high: number };
};

// ---------------------------------------------------------------------------
// Legacy input type — kept for backward compatibility with existing callers.
// New code should pass a CloudSnapshot directly.
// ---------------------------------------------------------------------------

type SnapshotInput = {
  ec2InstanceCount: number;
  s3BucketCount: number;
  regions: string[];
  flags: { singleRegion: boolean; noBackupsDetected: boolean };
  insights?: Array<{ title: string; severity: string }>;
};

// ---------------------------------------------------------------------------
// Provider-aware labels
// ---------------------------------------------------------------------------

export type ProviderLabels = {
  compute: string;
  computePlural: string;
  storage: string;
  storagePlural: string;
  commitmentPlan: string;
  commitmentPlanFull: string;
  tieringAction: string;
  terraformOrIac: string;
  metricsSource: string;
  failoverTool: string;
  backupService: string;
  lifecyclePolicy: string;
};

export const LABELS: Record<CloudProvider, ProviderLabels> = {
  aws: {
    compute: "EC2 instance",
    computePlural: "EC2 instances",
    storage: "S3 bucket",
    storagePlural: "S3 buckets",
    commitmentPlan: "RI/Savings Plan",
    commitmentPlanFull: "Compute Savings Plan, 1yr no-upfront",
    tieringAction: "S3 Intelligent-Tiering",
    terraformOrIac: "Terraform",
    metricsSource: "CloudWatch CPU/mem",
    failoverTool: "Route 53",
    backupService: "AWS Backup / EBS Snapshots",
    lifecyclePolicy: "S3 Lifecycle Configuration",
  },
  azure: {
    compute: "VM",
    computePlural: "VMs",
    storage: "Storage Account",
    storagePlural: "Storage Accounts",
    commitmentPlan: "Azure Reserved VM Instance",
    commitmentPlanFull: "Reserved VM Instance, 1yr no-upfront",
    tieringAction: "Cool/Archive tiering",
    terraformOrIac: "Bicep/Terraform",
    metricsSource: "Azure Monitor CPU/mem",
    failoverTool: "Traffic Manager",
    backupService: "Azure Backup / Recovery Services Vault",
    lifecyclePolicy: "Blob Lifecycle Management Policy",
  },
  gcp: {
    compute: "instance",
    computePlural: "Compute Engine instances",
    storage: "GCS bucket",
    storagePlural: "GCS buckets",
    commitmentPlan: "Committed Use Discount",
    commitmentPlanFull: "Committed Use Discount, 1yr",
    tieringAction: "Nearline/Autoclass",
    terraformOrIac: "Terraform",
    metricsSource: "Cloud Monitoring CPU",
    failoverTool: "Cloud DNS",
    backupService: "Persistent Disk Snapshots",
    lifecyclePolicy: "Object Lifecycle Management",
  },
};

// ---------------------------------------------------------------------------
// Provider-specific cost constants
// ---------------------------------------------------------------------------

const PROVIDER_COMPUTE_AVG_MONTHLY: Record<CloudProvider, number> = {
  aws: 85,
  azure: 95,
  gcp: 80,
};

const PROVIDER_STORAGE_AVG_MONTHLY: Record<CloudProvider, number> = {
  aws: 23,
  azure: 18,
  gcp: 20,
};

const RIGHTSIZING_SAVINGS_PCT = 0.25;
const COMMITMENT_SAVINGS_PCT = 0.35;
const TIERING_SAVINGS_PCT = 0.30;

const MULTI_REGION_OVERHEAD_PER_INSTANCE = 12;
const SINGLE_REGION_DOWNTIME_COST_PER_INSTANCE = 45;

const IDLE_CPU_THRESHOLD = 5;
const IDLE_WINDOW_HOURS = 168; // 7 days

// ---------------------------------------------------------------------------
// Main entry — supports both legacy SnapshotInput and new CloudSnapshot
// ---------------------------------------------------------------------------

export function deriveCostSignals(
  snapshot: SnapshotInput | CloudSnapshot,
  monthlySpend?: number | null,
): CostSummary {
  const resolved = resolveInput(snapshot);
  return deriveSignals(resolved, monthlySpend ?? null);
}

type ResolvedInput = {
  provider: CloudProvider;
  computeCount: number;
  storageCount: number;
  regions: string[];
  primaryRegion: string;
  flags: { singleRegion: boolean; noBackupsDetected: boolean };
  topComputeResource?: ComputeResource;
  computeResources: ComputeResource[];
  allComputeResources: ComputeResource[];
  storageResources: StorageResource[];
  monthlySpendOverride?: number | null;
};

function resolveInput(snapshot: SnapshotInput | CloudSnapshot): ResolvedInput {
  if ("provider" in snapshot && "resources" in snapshot) {
    const cs = snapshot as CloudSnapshot;
    const allCompute = cs.resources.filter(
      (r): r is ComputeResource => r.resourceType === "compute",
    );
    const running = allCompute.filter(
      (r) => r.state !== "stopped" && r.state !== "deallocated",
    );
    const storage = cs.resources.filter(
      (r): r is StorageResource => r.resourceType === "storage",
    );
    const sorted = [...running].sort((a, b) => (b.monthlyCostEstimate ?? 0) - (a.monthlyCostEstimate ?? 0));
    return {
      provider: cs.provider,
      computeCount: running.length,
      storageCount: storage.length,
      regions: cs.regions,
      primaryRegion: cs.regions[0] ?? "us-east-1",
      flags: cs.flags,
      topComputeResource: sorted[0],
      computeResources: running,
      allComputeResources: allCompute,
      storageResources: storage,
      monthlySpendOverride: cs.monthlySpend,
    };
  }

  const legacy = snapshot as SnapshotInput;
  return {
    provider: "aws",
    computeCount: legacy.ec2InstanceCount,
    storageCount: legacy.s3BucketCount,
    regions: legacy.regions,
    primaryRegion: legacy.regions[0] ?? "us-east-1",
    flags: legacy.flags,
    computeResources: [],
    allComputeResources: [],
    storageResources: [],
  };
}

// ---------------------------------------------------------------------------
// Confidence scoring — grades signal quality based on available data
// ---------------------------------------------------------------------------

export function computeConfidence(
  hasSpendData: boolean,
  computeResources: ComputeResource[],
): ConfidenceScore {
  const total = computeResources.length;
  if (total === 0) return hasSpendData ? "medium" : "low";

  const withCpu = computeResources.filter((r) => r.usage?.cpuAvgPct !== undefined);
  const cpuCoverage = withCpu.length / total;
  const hasLongWindow = withCpu.some((r) => (r.usage?.sampleWindowHours ?? 0) >= 168);

  if (hasSpendData && cpuCoverage > 0.5 && hasLongWindow) return "high";
  if (hasSpendData || cpuCoverage > 0.3) return "medium";
  return "low";
}

function scoreStorageConfidence(storageResources: StorageResource[]): ConfidenceScore {
  if (storageResources.length === 0) return "low";
  const withAccess = storageResources.filter((r) => r.lastAccessedDaysAgo !== undefined);
  const withSize = storageResources.filter((r) => r.sizeGb !== undefined);
  if (withAccess.length > storageResources.length * 0.5 && withSize.length > storageResources.length * 0.5) return "high";
  if (withSize.length > 0 || withAccess.length > 0) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Signal derivation — 8 signal types, provider-aware
// ---------------------------------------------------------------------------

function deriveSignals(input: ResolvedInput, monthlySpend: number | null): CostSummary {
  const signals: CostSignal[] = [];
  const L = LABELS[input.provider];
  const compute = input.computeCount;
  const storage = input.storageCount;
  const spend = input.monthlySpendOverride ?? monthlySpend;
  const avgComputeMonthly = PROVIDER_COMPUTE_AVG_MONTHLY[input.provider];
  const avgStorageMonthly = PROVIDER_STORAGE_AVG_MONTHLY[input.provider];
  const computeScore = computeConfidence(!!spend, input.computeResources);
  const storageScore = scoreStorageConfidence(input.storageResources);

  // ---- 1. Compute right-sizing ----
  if (compute > 0) {
    const baseMonthlyCost = spend
      ? (spend * 0.6)
      : (compute * avgComputeMonthly);

    const rightsizeLow = Math.round(baseMonthlyCost * RIGHTSIZING_SAVINGS_PCT * 0.6);
    const rightsizeHigh = Math.round(baseMonthlyCost * RIGHTSIZING_SAVINGS_PCT * 1.2);
    const avgPerInstance = Math.round(baseMonthlyCost / compute);
    const optimizedPerInstance = Math.round(avgPerInstance * (1 - RIGHTSIZING_SAVINGS_PCT));
    const savingsPerInstance = avgPerInstance - optimizedPerInstance;

    const exampleId = input.topComputeResource?.resourceId
      ? maskResourceId(input.topComputeResource.resourceId)
      : defaultMaskedId(input.provider);

    const exampleType = input.topComputeResource?.instanceType ?? defaultInstanceType(input.provider);
    const downsizeType = suggestDownsize(exampleType, input.provider);

    signals.push({
      resource: `${compute} ${compute !== 1 ? L.computePlural : L.compute}`,
      issue: "Likely oversized or under-utilized instances",
      signalType: "compute_rightsizing",
      monthlyCostEstimate: { low: Math.round(baseMonthlyCost * 0.8), high: Math.round(baseMonthlyCost * 1.2) },
      annualSavingsEstimate: { low: rightsizeLow * 12, high: rightsizeHigh * 12 },
      confidence: spend ? "measured" : "estimated",
      confidenceScore: computeScore,
      proFix: `Auto-generate ${L.terraformOrIac} to right-size instances`,
      proOutputPreview: [
        `Example: ${exampleId} (${input.primaryRegion}) → ${exampleType} → ${downsizeType}`,
        `Current avg cost per ${L.compute}: ~$${avgPerInstance}/mo`,
        `Optimized cost per ${L.compute}: ~$${optimizedPerInstance}/mo`,
        `Per-${L.compute} savings: ~$${savingsPerInstance}/mo ($${(savingsPerInstance * 12).toLocaleString()}/yr)`,
        `Pro scans ${L.metricsSource} to find exact downsize targets across all ${compute} ${compute !== 1 ? L.computePlural : L.compute}`,
        `→ Generates ${L.terraformOrIac} + safe rolling resize plan (zero-downtime)`,
      ],
    });

    // ---- 2. Commitment plan (RI / Reserved VM / CUD) ----
    if (!spend || spend > 500) {
      const reservedLow = Math.round(baseMonthlyCost * COMMITMENT_SAVINGS_PCT * 0.5);
      const reservedHigh = Math.round(baseMonthlyCost * COMMITMENT_SAVINGS_PCT);
      const hourlyCommitment = (baseMonthlyCost * 0.65 / 730).toFixed(2);
      const coveragePct = compute > 10 ? "70–80%" : "75–90%";
      signals.push({
        resource: "On-Demand pricing",
        issue: `No ${L.commitmentPlan} detected`,
        signalType: "commitment_discount",
        monthlyCostEstimate: { low: Math.round(baseMonthlyCost), high: Math.round(baseMonthlyCost * 1.2) },
        annualSavingsEstimate: { low: reservedLow * 12, high: reservedHigh * 12 },
        confidence: "estimated",
        confidenceScore: computeScore,
        proFix: `Generate ${L.commitmentPlan} recommendation report`,
        proOutputPreview: [
          `Recommended: ${L.commitmentPlanFull}`,
          `Coverage: ${coveragePct} of your ${compute}-${L.compute} baseline`,
          `Hourly commitment: ~$${hourlyCommitment}/hr`,
          `Projected savings: $${(reservedLow * 12).toLocaleString()} – $${(reservedHigh * 12).toLocaleString()}/yr`,
          `→ Calculates exact commitment and walks you through purchase in console`,
        ],
      });
    }
  }

  // ---- 3. Storage tiering ----
  if (storage > 5) {
    const storageMonthlyCost = storage * avgStorageMonthly;
    const tierLow = Math.round(storageMonthlyCost * TIERING_SAVINGS_PCT * 0.5);
    const tierHigh = Math.round(storageMonthlyCost * TIERING_SAVINGS_PCT);
    const perUnitSavingsLow = Math.round(avgStorageMonthly * TIERING_SAVINGS_PCT * 0.5 * 12);
    const perUnitSavingsHigh = Math.round(avgStorageMonthly * TIERING_SAVINGS_PCT * 12);

    signals.push({
      resource: `${storage} ${storage !== 1 ? L.storagePlural : L.storage}`,
      issue: `Storage tiering not verified — likely using Standard for cold data`,
      signalType: "storage_tiering",
      monthlyCostEstimate: { low: Math.round(storageMonthlyCost * 0.7), high: Math.round(storageMonthlyCost * 1.3) },
      annualSavingsEstimate: { low: tierLow * 12, high: tierHigh * 12 },
      confidence: "estimated",
      confidenceScore: storageScore,
      proFix: `Scan access patterns and apply ${L.tieringAction}`,
      proOutputPreview: [
        `Example: ${defaultStorageName(input.provider)} → ~80% objects unaccessed 30+ days`,
        `Recommendation: Enable ${L.tieringAction} via ${L.lifecyclePolicy}`,
        `Per-${L.storage} savings: ~$${perUnitSavingsLow}–$${perUnitSavingsHigh}/yr`,
        `Pro scans access patterns across all ${storage} ${storage !== 1 ? L.storagePlural : L.storage} and generates lifecycle policies`,
        `→ Applies policies automatically — no manual bucket-by-bucket config`,
      ],
    });
  }

  // ---- 4. Single-region risk ----
  if (input.flags.singleRegion && compute > 0) {
    const downtimeCost = compute * SINGLE_REGION_DOWNTIME_COST_PER_INSTANCE;
    signals.push({
      resource: "Single-region deployment",
      issue: `All ${compute} ${compute !== 1 ? L.computePlural : L.compute} in one region — outage risk with no failover`,
      signalType: "single_region_risk",
      monthlyCostEstimate: { low: 0, high: 0 },
      annualSavingsEstimate: { low: Math.round(downtimeCost * 6), high: Math.round(downtimeCost * 18) },
      confidence: "estimated",
      confidenceScore: "medium",
      proFix: `Generate multi-region ${L.terraformOrIac} with ${L.failoverTool} failover`,
    });
  }

  // ---- 5. Multi-region sprawl ----
  if (input.regions.length > 2 && compute > 3) {
    const overheadMonthly = compute * MULTI_REGION_OVERHEAD_PER_INSTANCE;
    signals.push({
      resource: `${input.regions.length} active regions`,
      issue: "Multi-region spread may include unnecessary redundancy",
      signalType: "multi_region_sprawl",
      monthlyCostEstimate: { low: Math.round(overheadMonthly * 0.5), high: overheadMonthly },
      annualSavingsEstimate: { low: Math.round(overheadMonthly * 0.3) * 12, high: Math.round(overheadMonthly * 0.6) * 12 },
      confidence: "estimated",
      confidenceScore: "medium",
      proFix: "Analyze region utilization and consolidate workloads",
    });
  }

  // ---- 6. Idle/unused compute ----
  const idleInstances = input.computeResources.filter((r) => {
    const cpu = r.usage?.cpuAvgPct;
    const window = r.usage?.sampleWindowHours ?? 0;
    return cpu !== undefined && cpu < IDLE_CPU_THRESHOLD && window >= IDLE_WINDOW_HOURS;
  });

  const stoppedInstances = input.allComputeResources.filter(
    (r) => r.state === "stopped" || r.state === "deallocated",
  );

  if (idleInstances.length > 0 || stoppedInstances.length > 0) {
    const idleCount = idleInstances.length;
    const stoppedCount = stoppedInstances.length;
    const totalIdle = idleCount + stoppedCount;

    const idleMonthlyCost = idleInstances.reduce((s, r) => s + (r.monthlyCostEstimate ?? avgComputeMonthly), 0);
    const stoppedDiskCost = stoppedCount * 8;
    const totalWaste = idleMonthlyCost + stoppedDiskCost;

    const parts: string[] = [];
    if (idleCount > 0) parts.push(`${idleCount} running with <${IDLE_CPU_THRESHOLD}% avg CPU`);
    if (stoppedCount > 0) parts.push(`${stoppedCount} stopped (disks still billing)`);

    const preview: string[] = [];
    if (idleCount > 0) {
      const topIdle = idleInstances[0];
      preview.push(
        `Idle: ${maskResourceId(topIdle.resourceId)} — ${topIdle.instanceType}, ${topIdle.usage?.cpuAvgPct?.toFixed(1)}% avg CPU over ${Math.round((topIdle.usage?.sampleWindowHours ?? 0) / 24)}d`,
        `Action: Stop or terminate → saves ~$${Math.round(topIdle.monthlyCostEstimate ?? avgComputeMonthly)}/mo`,
      );
    }
    if (stoppedCount > 0) {
      preview.push(
        `Stopped: ${stoppedCount} ${stoppedCount !== 1 ? L.computePlural : L.compute} with attached disks (~$${stoppedDiskCost}/mo)`,
        `Action: Snapshot disks → delete instances and volumes`,
      );
    }
    preview.push(`→ Pro identifies all ${totalIdle} candidates and generates ${L.terraformOrIac} cleanup plan`);

    signals.push({
      resource: `${totalIdle} idle/unused ${totalIdle !== 1 ? L.computePlural : L.compute}`,
      issue: parts.join("; "),
      signalType: "idle_compute",
      monthlyCostEstimate: { low: Math.round(totalWaste * 0.8), high: Math.round(totalWaste * 1.2) },
      annualSavingsEstimate: { low: Math.round(totalWaste * 0.8) * 12, high: Math.round(totalWaste * 1.2) * 12 },
      confidence: idleCount > 0 ? "measured" : "estimated",
      confidenceScore: idleCount > 0 ? "high" : "medium",
      proFix: `Generate decommission plan for idle ${L.computePlural}`,
      proOutputPreview: preview,
    });
  }

  // ---- 7. Public storage exposure warning ----
  const publicBuckets = input.storageResources.filter((r) => {
    const tags = r.tags ?? {};
    const hasPublicTag =
      tags["public_access"] === "true" ||
      tags["publicAccess"] === "true" ||
      tags["public-access-prevention"] === "inherited";
    return hasPublicTag;
  });

  if (publicBuckets.length > 0) {
    signals.push({
      resource: `${publicBuckets.length} ${publicBuckets.length !== 1 ? L.storagePlural : L.storage}`,
      issue: `Public access detected — potential data exposure risk`,
      signalType: "public_storage",
      monthlyCostEstimate: { low: 0, high: 0 },
      annualSavingsEstimate: { low: 0, high: 0 },
      confidence: "measured",
      confidenceScore: "high",
      proFix: `Audit public access and generate ${L.terraformOrIac} to restrict`,
      proOutputPreview: [
        `${publicBuckets.length} ${publicBuckets.length !== 1 ? L.storagePlural : L.storage} with public access enabled`,
        `Affected: ${publicBuckets.slice(0, 3).map((b) => maskResourceId(b.resourceId)).join(", ")}${publicBuckets.length > 3 ? ` +${publicBuckets.length - 3} more` : ""}`,
        `→ Pro audits ACLs/policies and generates least-privilege ${L.terraformOrIac}`,
      ],
    });
  }

  // ---- 8. Backup/replication warning ----
  if (input.flags.noBackupsDetected && (compute > 0 || storage > 0)) {
    const atRiskCount = compute + storage;
    signals.push({
      resource: `${atRiskCount} resources without backup`,
      issue: `No ${L.backupService} detected — data loss risk`,
      signalType: "backup_warning",
      monthlyCostEstimate: { low: 0, high: 0 },
      annualSavingsEstimate: { low: 0, high: 0 },
      confidence: "estimated",
      confidenceScore: compute > 0 ? computeScore : storageScore,
      proFix: `Generate ${L.backupService} configuration via ${L.terraformOrIac}`,
      proOutputPreview: [
        `No backup or replication strategy detected for ${atRiskCount} resources`,
        `At risk: ${compute} ${compute !== 1 ? L.computePlural : L.compute}, ${storage} ${storage !== 1 ? L.storagePlural : L.storage}`,
        `Recommended: Enable ${L.backupService} with daily snapshots + 30-day retention`,
        `→ Pro generates full backup ${L.terraformOrIac} with cross-region replication`,
      ],
    });
  }

  const totalLow = signals.reduce((sum, s) => sum + s.annualSavingsEstimate.low, 0);
  const totalHigh = signals.reduce((sum, s) => sum + s.annualSavingsEstimate.high, 0);

  return {
    signals,
    totalAnnualSavings: { low: totalLow, high: totalHigh },
  };
}

// ---------------------------------------------------------------------------
// Provider-specific helpers — minimal, no duplication
// ---------------------------------------------------------------------------

function maskResourceId(id: string): string {
  if (id.length <= 6) return id;
  return id.slice(0, 4) + "…" + id.slice(-2);
}

function defaultMaskedId(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return "i-xxxx";
    case "azure": return "vm-xxxx";
    case "gcp": return "inst-xxxx";
  }
}

function defaultInstanceType(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return "m5.2xlarge";
    case "azure": return "Standard_D8s_v3";
    case "gcp": return "n2-standard-8";
  }
}

export function suggestDownsize(current: string, provider: CloudProvider): string {
  switch (provider) {
    case "aws": {
      const m = current.match(/^(\w+)\.(\d*)x?large$/);
      if (m) {
        const family = m[1];
        const size = m[2];
        if (size === "2") return `${family}.xlarge`;
        if (size === "4") return `${family}.2xlarge`;
        if (size === "8") return `${family}.4xlarge`;
        if (!size || size === "") return `${family}.large`;
      }
      return current.replace("2xlarge", "xlarge").replace("xlarge", "large");
    }
    case "azure": {
      const m = current.match(/^(Standard_\w)(\d+)(s?_v\d+)$/);
      if (m) {
        const prefix = m[1];
        const vcpus = parseInt(m[2], 10);
        const suffix = m[3];
        if (vcpus > 2) return `${prefix}${Math.floor(vcpus / 2)}${suffix}`;
      }
      return current;
    }
    case "gcp": {
      const m = current.match(/^(.+-)(\d+)$/);
      if (m) {
        const prefix = m[1];
        const vcpus = parseInt(m[2], 10);
        if (vcpus > 2) return `${prefix}${Math.floor(vcpus / 2)}`;
      }
      return current;
    }
  }
}

function defaultStorageName(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return 'bucket "logs-prod"';
    case "azure": return 'account "stprodlogs"';
    case "gcp": return 'bucket "logs-prod"';
  }
}

// ---------------------------------------------------------------------------
// Cross-account aggregation — merges signals from multiple providers/accounts
// ---------------------------------------------------------------------------

export type AggregatedSavings = {
  totalEstimatedSavingsLow: number;
  totalEstimatedSavingsHigh: number;
  signalCount: number;
  providerCount: number;
  providers: CloudProvider[];
  formatted: string;
};

export function getTotalSavings(summaries: CostSummary[]): AggregatedSavings {
  let totalLow = 0;
  let totalHigh = 0;
  let signalCount = 0;
  const providers = new Set<CloudProvider>();

  for (const summary of summaries) {
    if (!summary?.signals) continue;
    totalLow += summary.totalAnnualSavings.low;
    totalHigh += summary.totalAnnualSavings.high;
    signalCount += summary.signals.length;
    for (const signal of summary.signals) {
      const provider = inferProvider(signal);
      if (provider) providers.add(provider);
    }
  }

  const providerList = [...providers];

  return {
    totalEstimatedSavingsLow: totalLow,
    totalEstimatedSavingsHigh: totalHigh,
    signalCount,
    providerCount: providerList.length,
    providers: providerList,
    formatted: totalHigh > 0
      ? `Estimated total savings across your ${providerList.length > 1 ? "accounts" : "account"}: $${totalLow.toLocaleString()} – $${totalHigh.toLocaleString()} / year`
      : "No savings signals detected yet.",
  };
}

function inferProvider(signal: CostSignal): CloudProvider | null {
  const text = `${signal.resource} ${signal.proFix}`;
  if (/EC2|S3|Route 53|CloudWatch|Savings Plan/.test(text)) return "aws";
  if (/VM|Azure|Bicep|Traffic Manager/.test(text)) return "azure";
  if (/Compute Engine|GCS|Cloud DNS|Cloud Monitoring|Committed Use/.test(text)) return "gcp";
  return null;
}

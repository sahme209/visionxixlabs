import type {
  CloudProvider,
  CloudSnapshot,
  ComputeResource,
  StorageResource,
  StorageClass,
} from "./cloudSnapshot";
import { suggestDownsize } from "./costSignals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType =
  | "resize_compute"
  | "apply_storage_policy"
  | "purchase_commitment"
  | "decommission_compute";

export type RiskLevel = "low" | "medium" | "high";

export type ExecutionPlanItem = {
  id: string;
  provider: CloudProvider;
  actionType: ActionType;
  resourceIds: string[];
  region: string;
  currentState: string;
  recommendedState: string;
  estimatedSavings: { monthly: number; yearly: number };
  riskLevel: RiskLevel;
  requiresDowntime: boolean;
  rollbackSteps: string[];
};

export type ExecutionPlan = {
  generatedAt: string;
  provider: CloudProvider;
  accountId: string;
  items: ExecutionPlanItem[];
  totalEstimatedSavings: { monthly: number; yearly: number };
  summary: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RIGHTSIZING_SAVINGS_PCT = 0.25;
const TIERING_SAVINGS_PER_BUCKET_MONTHLY = 7;
const COMMITMENT_SAVINGS_PCT = 0.35;

const STORAGE_TIERING_TARGET: Record<StorageClass, StorageClass> = {
  standard: "intelligent",
  infrequent: "infrequent",
  archive: "archive",
  intelligent: "intelligent",
  cold: "cold",
  unknown: "intelligent",
};

const STORAGE_TIER_LABEL: Record<CloudProvider, Record<string, string>> = {
  aws: { intelligent: "S3 Intelligent-Tiering", infrequent: "S3 Standard-IA", archive: "S3 Glacier" },
  azure: { intelligent: "Cool (auto-tiered)", infrequent: "Cool", archive: "Archive" },
  gcp: { intelligent: "Autoclass", infrequent: "Nearline", archive: "Coldline" },
};

const COMMITMENT_LABEL: Record<CloudProvider, string> = {
  aws: "Compute Savings Plan, 1yr no-upfront",
  azure: "Reserved VM Instance, 1yr no-upfront",
  gcp: "Committed Use Discount, 1yr",
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function generateExecutionPlan(snapshot: CloudSnapshot): ExecutionPlan {
  const items: ExecutionPlanItem[] = [];
  let planIdx = 0;

  const running = snapshot.resources.filter(
    (r): r is ComputeResource => r.resourceType === "compute" && r.state === "running",
  );
  const stopped = snapshot.resources.filter(
    (r): r is ComputeResource => r.resourceType === "compute" && (r.state === "stopped" || r.state === "deallocated"),
  );
  const storage = snapshot.resources.filter(
    (r): r is StorageResource => r.resourceType === "storage",
  );

  // ---- 1. Compute right-sizing (grouped by region + instance type) ----
  const resizeGroups = groupBy(running, (r) => `${r.region}::${r.instanceType}`);

  for (const [key, instances] of resizeGroups) {
    const [region, instanceType] = key.split("::");
    const recommended = suggestDownsize(instanceType, snapshot.provider);
    if (recommended === instanceType) continue;

    const avgCost = instances.reduce((s, r) => s + (r.monthlyCostEstimate ?? 85), 0) / instances.length;
    const savingsPerMonth = Math.round(avgCost * RIGHTSIZING_SAVINGS_PCT * instances.length);

    const underUtilized = instances.filter((r) => (r.usage?.cpuAvgPct ?? 100) < 40);
    const candidates = underUtilized.length > 0 ? underUtilized : instances;

    items.push({
      id: `plan-${++planIdx}`,
      provider: snapshot.provider,
      actionType: "resize_compute",
      resourceIds: candidates.map((r) => r.resourceId),
      region,
      currentState: `${candidates.length}x ${instanceType} (${candidates.length > 1 ? "avg " : ""}${Math.round(avgCost)}/mo each)`,
      recommendedState: `${candidates.length}x ${recommended}`,
      estimatedSavings: { monthly: savingsPerMonth, yearly: savingsPerMonth * 12 },
      riskLevel: assessResizeRisk(candidates),
      requiresDowntime: snapshot.provider !== "aws",
      rollbackSteps: [
        `Resize back to ${instanceType}`,
        snapshot.provider === "aws"
          ? "Stop instance → Change instance type → Start instance"
          : `Redeploy with original size via ${snapshot.provider === "azure" ? "Bicep/Terraform" : "Terraform"}`,
      ],
    });
  }

  // ---- 2. Decommission stopped/deallocated instances ----
  if (stopped.length > 0) {
    const stoppedGroups = groupBy(stopped, (r) => r.region);
    for (const [region, instances] of stoppedGroups) {
      const diskCostPerMonth = instances.length * 8;
      items.push({
        id: `plan-${++planIdx}`,
        provider: snapshot.provider,
        actionType: "decommission_compute",
        resourceIds: instances.map((r) => r.resourceId),
        region,
        currentState: `${instances.length}x stopped/deallocated (disks still billing ~$${diskCostPerMonth}/mo)`,
        recommendedState: "Snapshot disks → Delete instances + volumes",
        estimatedSavings: { monthly: diskCostPerMonth, yearly: diskCostPerMonth * 12 },
        riskLevel: "medium",
        requiresDowntime: false,
        rollbackSteps: ["Restore from snapshot", "Re-create instance from saved AMI/image"],
      });
    }
  }

  // ---- 3. Storage tiering ----
  const tierCandidates = storage.filter((s) => {
    const target = STORAGE_TIERING_TARGET[s.storageClass];
    return target !== s.storageClass;
  });

  if (tierCandidates.length > 0) {
    const storageGroups = groupBy(tierCandidates, (r) => r.region);
    for (const [region, buckets] of storageGroups) {
      const savingsPerMonth = buckets.length * TIERING_SAVINGS_PER_BUCKET_MONTHLY;
      const targetClass = STORAGE_TIERING_TARGET[buckets[0].storageClass];
      const targetLabel = STORAGE_TIER_LABEL[snapshot.provider][targetClass] ?? targetClass;

      items.push({
        id: `plan-${++planIdx}`,
        provider: snapshot.provider,
        actionType: "apply_storage_policy",
        resourceIds: buckets.map((b) => b.resourceId),
        region,
        currentState: `${buckets.length}x Standard tier`,
        recommendedState: `Enable ${targetLabel} on ${buckets.length} ${buckets.length === 1 ? "resource" : "resources"}`,
        estimatedSavings: { monthly: savingsPerMonth, yearly: savingsPerMonth * 12 },
        riskLevel: "low",
        requiresDowntime: false,
        rollbackSteps: [`Revert to Standard tier via lifecycle policy update`],
      });
    }
  }

  // ---- 4. Commitment plan ----
  if (running.length > 0) {
    const totalMonthly = running.reduce((s, r) => s + (r.monthlyCostEstimate ?? 85), 0);
    if (totalMonthly > 300) {
      const savingsPerMonth = Math.round(totalMonthly * COMMITMENT_SAVINGS_PCT);
      const hourlyCommitment = ((totalMonthly * 0.65) / 730).toFixed(2);

      items.push({
        id: `plan-${++planIdx}`,
        provider: snapshot.provider,
        actionType: "purchase_commitment",
        resourceIds: running.map((r) => r.resourceId),
        region: snapshot.regions[0] ?? "global",
        currentState: `${running.length} instances on on-demand pricing (~$${Math.round(totalMonthly)}/mo)`,
        recommendedState: `${COMMITMENT_LABEL[snapshot.provider]} at ~$${hourlyCommitment}/hr`,
        estimatedSavings: { monthly: savingsPerMonth, yearly: savingsPerMonth * 12 },
        riskLevel: "low",
        requiresDowntime: false,
        rollbackSteps: ["Commitment expires at term end — no rollback needed", "Do not auto-renew if workload changes"],
      });
    }
  }

  // Sort: highest yearly savings first (deterministic)
  items.sort((a, b) => b.estimatedSavings.yearly - a.estimatedSavings.yearly);

  const totalMonthly = items.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
  const totalYearly = items.reduce((s, i) => s + i.estimatedSavings.yearly, 0);

  return {
    generatedAt: new Date().toISOString(),
    provider: snapshot.provider,
    accountId: snapshot.accountId,
    items,
    totalEstimatedSavings: { monthly: totalMonthly, yearly: totalYearly },
    summary: items.length > 0
      ? `${items.length} actions across ${snapshot.regions.length} region(s) — estimated savings: $${totalMonthly.toLocaleString()}/mo ($${totalYearly.toLocaleString()}/yr)`
      : "No actionable optimizations found.",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function assessResizeRisk(instances: ComputeResource[]): RiskLevel {
  const withMetrics = instances.filter((r) => r.usage?.cpuAvgPct !== undefined);
  if (withMetrics.length === 0) return "high";

  const avgCpu = withMetrics.reduce((s, r) => s + (r.usage!.cpuAvgPct ?? 0), 0) / withMetrics.length;
  const hasLongWindow = withMetrics.some((r) => (r.usage?.sampleWindowHours ?? 0) >= 168);

  if (avgCpu < 20 && hasLongWindow) return "low";
  if (avgCpu < 50) return "medium";
  return "high";
}

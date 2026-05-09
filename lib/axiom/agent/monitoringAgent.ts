/**
 * Axiom Continuous Monitoring Agent
 *
 * Watches connected cloud environments by comparing historical snapshots
 * and proactively alerting users when meaningful changes occur.
 *
 * Detects 8 change categories:
 *   1. New public exposure
 *   2. Large cost increase
 *   3. Idle resource growth
 *   4. Resilience degradation
 *   5. Region concentration risk
 *   6. New optimization opportunities
 *   7. Failed execution verification
 *   8. Drift from previous execution plans
 *
 * Anti-noise strategy:
 *   - Per-rule cooldowns prevent repeated alerts
 *   - Deduplication hashes suppress identical alerts within a window
 *   - Severity floor filters out low-importance noise
 *   - Snooze support lets users silence specific rules
 *   - Significance thresholds require meaningful deltas before firing
 */

import type {
  CloudProvider,
  CloudSnapshot,
  ComputeResource,
  StorageResource,
  CloudResource,
} from "../cloudSnapshot";
import type { ExecutionPlanItem, ActionType } from "../executionPlan";
import type { AgentFinding, FindingSeverity } from "./types";
import type { AgentPlan, PlanPhase } from "./planningEngine";

// ---------------------------------------------------------------------------
// 1. Core monitoring types
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertCategory =
  | "public_exposure"
  | "cost_spike"
  | "idle_growth"
  | "resilience_degradation"
  | "region_concentration"
  | "new_optimization"
  | "verification_failure"
  | "plan_drift";

export type MonitorAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  summary: string;
  detail: string;
  provider: CloudProvider;
  regions: string[];
  affectedResources: string[];
  timestamp: string;
  deduplicationHash: string;

  delta: AlertDelta;
  recommendation: string;
  suppressible: boolean;
  requiresAction: boolean;
};

export type AlertDelta = {
  metric: string;
  previousValue: number | string | null;
  currentValue: number | string;
  changePercent: number | null;
  direction: "increased" | "decreased" | "new" | "removed" | "changed";
};

// ---------------------------------------------------------------------------
// 2. Snapshot delta — deep resource-level diff
// ---------------------------------------------------------------------------

export type SnapshotDelta = {
  provider: CloudProvider;
  previousScannedAt: string;
  currentScannedAt: string;

  addedResources: CloudResource[];
  removedResources: CloudResource[];
  changedResources: ResourceChange[];

  computeDelta: ComputeDelta;
  storageDelta: StorageDelta;
  regionDelta: RegionDelta;
  costDelta: CostDelta;
  flagsDelta: FlagsDelta;
};

export type ResourceChange = {
  resourceId: string;
  resourceType: "compute" | "storage";
  provider: CloudProvider;
  region: string;
  changes: FieldChange[];
};

export type FieldChange = {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
};

export type ComputeDelta = {
  totalBefore: number;
  totalAfter: number;
  runningBefore: number;
  runningAfter: number;
  stoppedBefore: number;
  stoppedAfter: number;
  newIdleCount: number;
  resizedCount: number;
};

export type StorageDelta = {
  totalBefore: number;
  totalAfter: number;
  newPublicCount: number;
  publicRemovedCount: number;
  classChanges: number;
};

export type RegionDelta = {
  regionsBefore: string[];
  regionsAfter: string[];
  addedRegions: string[];
  removedRegions: string[];
  concentrationBefore: number;
  concentrationAfter: number;
};

export type CostDelta = {
  monthlyBefore: number;
  monthlyAfter: number;
  absoluteChange: number;
  percentChange: number;
};

export type FlagsDelta = {
  singleRegionBefore: boolean;
  singleRegionAfter: boolean;
  noBackupsBefore: boolean;
  noBackupsAfter: boolean;
};

// ---------------------------------------------------------------------------
// 3. Diff rules — each rule evaluates a snapshot delta and produces alerts
// ---------------------------------------------------------------------------

export type DiffRule = {
  id: string;
  category: AlertCategory;
  name: string;
  description: string;
  defaultSeverity: AlertSeverity;
  cooldownMinutes: number;
  evaluate: (delta: SnapshotDelta, ctx: MonitorContext) => MonitorAlert[];
};

export type MonitorContext = {
  organizationId: string;
  cloudAccountId: string;
  provider: CloudProvider;
  alertPolicy: AlertPolicy;
  suppressionState: SuppressionState;
  activePlan: AgentPlan | null;
  previousAlerts: PreviousAlert[];
  lastVerifiedItems: VerifiedItem[];
};

export type VerifiedItem = {
  itemId: string;
  actionType: ActionType;
  verifiedAt: string;
  resourceIds: string[];
  expectedState: string;
};

export type PreviousAlert = {
  id: string;
  category: AlertCategory;
  deduplicationHash: string;
  firedAt: string;
  severity: AlertSeverity;
};

// ---------------------------------------------------------------------------
// 4. Alert policy & suppression
// ---------------------------------------------------------------------------

export type AlertPolicy = {
  organizationId: string;
  severityFloor: AlertSeverity;
  enabledCategories: AlertCategory[];
  cooldownOverrides: Partial<Record<AlertCategory, number>>;
  costSpikeThresholdPercent: number;
  idleGrowthThreshold: number;
  concentrationThresholdPercent: number;
  snoozedRules: SnoozedRule[];
  escalationRules: EscalationRule[];
};

export type SnoozedRule = {
  ruleId: string;
  snoozedUntil: string;
  reason: string;
};

export type EscalationRule = {
  fromSeverity: AlertSeverity;
  toSeverity: AlertSeverity;
  afterOccurrences: number;
  withinHours: number;
};

export type SuppressionState = {
  recentHashes: Map<string, string>;
  lastFiredAt: Map<AlertCategory, string>;
  occurrenceCounts: Map<string, number>;
};

export const DEFAULT_ALERT_POLICY: AlertPolicy = {
  organizationId: "",
  severityFloor: "info",
  enabledCategories: [
    "public_exposure",
    "cost_spike",
    "idle_growth",
    "resilience_degradation",
    "region_concentration",
    "new_optimization",
    "verification_failure",
    "plan_drift",
  ],
  cooldownOverrides: {},
  costSpikeThresholdPercent: 15,
  idleGrowthThreshold: 3,
  concentrationThresholdPercent: 85,
  snoozedRules: [],
  escalationRules: [
    {
      fromSeverity: "warning",
      toSeverity: "critical",
      afterOccurrences: 3,
      withinHours: 72,
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Monitor output
// ---------------------------------------------------------------------------

export type MonitorResult = {
  provider: CloudProvider;
  monitoredAt: string;
  snapshotDelta: SnapshotDelta;
  alerts: MonitorAlert[];
  suppressed: SuppressedAlert[];
  totalAlertsGenerated: number;
  totalAlertsSuppressed: number;
  nextCheckRecommended: string;
};

export type SuppressedAlert = {
  category: AlertCategory;
  reason: string;
  deduplicationHash: string;
};

// ---------------------------------------------------------------------------
// 6. Notification payloads
// ---------------------------------------------------------------------------

export type MonitorNotification = {
  type: "monitor_alert";
  organizationId: string;
  cloudAccountId: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  alerts: MonitorAlert[];
  actionUrl: string | null;
  data: {
    provider: CloudProvider;
    alertCount: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topCategory: AlertCategory;
    estimatedImpact: string;
  };
};

// ---------------------------------------------------------------------------
// 7. Snapshot differ — deep resource-level comparison
// ---------------------------------------------------------------------------

export function diffSnapshots(
  previous: CloudSnapshot,
  current: CloudSnapshot,
): SnapshotDelta {
  const prevResourceMap = new Map(previous.resources.map((r) => [r.resourceId, r]));
  const currResourceMap = new Map(current.resources.map((r) => [r.resourceId, r]));

  const addedResources: CloudResource[] = [];
  const removedResources: CloudResource[] = [];
  const changedResources: ResourceChange[] = [];

  for (const [id, resource] of currResourceMap) {
    if (!prevResourceMap.has(id)) {
      addedResources.push(resource);
    }
  }

  for (const [id, resource] of prevResourceMap) {
    if (!currResourceMap.has(id)) {
      removedResources.push(resource);
    }
  }

  for (const [id, currRes] of currResourceMap) {
    const prevRes = prevResourceMap.get(id);
    if (!prevRes) continue;
    const changes = diffResource(prevRes, currRes);
    if (changes.length > 0) {
      changedResources.push({
        resourceId: id,
        resourceType: currRes.resourceType,
        provider: currRes.provider,
        region: currRes.region,
        changes,
      });
    }
  }

  const prevCompute = previous.resources.filter((r): r is ComputeResource => r.resourceType === "compute");
  const currCompute = current.resources.filter((r): r is ComputeResource => r.resourceType === "compute");
  const prevStorage = previous.resources.filter((r): r is StorageResource => r.resourceType === "storage");
  const currStorage = current.resources.filter((r): r is StorageResource => r.resourceType === "storage");

  const prevRunning = prevCompute.filter((c) => c.state === "running").length;
  const currRunning = currCompute.filter((c) => c.state === "running").length;
  const prevStopped = prevCompute.filter((c) => c.state === "stopped" || c.state === "deallocated").length;
  const currStopped = currCompute.filter((c) => c.state === "stopped" || c.state === "deallocated").length;

  const prevIdleIds = new Set(
    prevCompute
      .filter((c) => c.state === "running" && (c.usage?.cpuAvgPct ?? 100) < 5)
      .map((c) => c.resourceId),
  );
  const currIdleIds = currCompute
    .filter((c) => c.state === "running" && (c.usage?.cpuAvgPct ?? 100) < 5)
    .map((c) => c.resourceId);
  const newIdleCount = currIdleIds.filter((id) => !prevIdleIds.has(id)).length;

  const resizedCount = changedResources.filter(
    (c) => c.resourceType === "compute" && c.changes.some((ch) => ch.field === "instanceType"),
  ).length;

  const prevPublicStorage = countPublicStorage(prevStorage);
  const currPublicStorage = countPublicStorage(currStorage);
  const classChanges = changedResources.filter(
    (c) => c.resourceType === "storage" && c.changes.some((ch) => ch.field === "storageClass"),
  ).length;

  const prevMonthly = previous.monthlySpend ?? estimateMonthlyCost(previous.resources);
  const currMonthly = current.monthlySpend ?? estimateMonthlyCost(current.resources);

  const prevRegions = [...new Set(previous.resources.map((r) => r.region))];
  const currRegions = [...new Set(current.resources.map((r) => r.region))];

  return {
    provider: current.provider,
    previousScannedAt: previous.scannedAt,
    currentScannedAt: current.scannedAt,
    addedResources,
    removedResources,
    changedResources,
    computeDelta: {
      totalBefore: prevCompute.length,
      totalAfter: currCompute.length,
      runningBefore: prevRunning,
      runningAfter: currRunning,
      stoppedBefore: prevStopped,
      stoppedAfter: currStopped,
      newIdleCount,
      resizedCount,
    },
    storageDelta: {
      totalBefore: prevStorage.length,
      totalAfter: currStorage.length,
      newPublicCount: Math.max(0, currPublicStorage - prevPublicStorage),
      publicRemovedCount: Math.max(0, prevPublicStorage - currPublicStorage),
      classChanges,
    },
    regionDelta: {
      regionsBefore: prevRegions,
      regionsAfter: currRegions,
      addedRegions: currRegions.filter((r) => !prevRegions.includes(r)),
      removedRegions: prevRegions.filter((r) => !currRegions.includes(r)),
      concentrationBefore: regionConcentration(previous.resources),
      concentrationAfter: regionConcentration(current.resources),
    },
    costDelta: {
      monthlyBefore: prevMonthly,
      monthlyAfter: currMonthly,
      absoluteChange: currMonthly - prevMonthly,
      percentChange: prevMonthly > 0 ? ((currMonthly - prevMonthly) / prevMonthly) * 100 : 0,
    },
    flagsDelta: {
      singleRegionBefore: previous.flags.singleRegion,
      singleRegionAfter: current.flags.singleRegion,
      noBackupsBefore: previous.flags.noBackupsDetected,
      noBackupsAfter: current.flags.noBackupsDetected,
    },
  };
}

function diffResource(prev: CloudResource, curr: CloudResource): FieldChange[] {
  const changes: FieldChange[] = [];
  const TRACKED_FIELDS_COMPUTE = ["instanceType", "state", "vcpus", "memoryGb"];
  const TRACKED_FIELDS_STORAGE = ["storageClass", "sizeGb"];

  const fields = curr.resourceType === "compute" ? TRACKED_FIELDS_COMPUTE : TRACKED_FIELDS_STORAGE;

  for (const field of fields) {
    const pv = (prev as Record<string, unknown>)[field];
    const cv = (curr as Record<string, unknown>)[field];
    if (pv !== cv && pv !== undefined && cv !== undefined) {
      changes.push({ field, previousValue: pv, currentValue: cv });
    }
  }

  return changes;
}

function countPublicStorage(resources: StorageResource[]): number {
  return resources.filter((r) => r.tags?.["public_access"] === "true" || r.storageClass === "standard").length;
}

function estimateMonthlyCost(resources: CloudResource[]): number {
  return resources.reduce((sum, r) => sum + (r.monthlyCostEstimate ?? 0), 0);
}

function regionConcentration(resources: CloudResource[]): number {
  if (resources.length === 0) return 0;
  const regionCounts = new Map<string, number>();
  for (const r of resources) {
    regionCounts.set(r.region, (regionCounts.get(r.region) ?? 0) + 1);
  }
  const maxCount = Math.max(...regionCounts.values());
  return (maxCount / resources.length) * 100;
}

// ---------------------------------------------------------------------------
// 8. Diff rules — 8 detection rules
// ---------------------------------------------------------------------------

function makeAlertId(category: AlertCategory): string {
  return `alert_${category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeHash(category: AlertCategory, ...parts: string[]): string {
  const raw = [category, ...parts].join("::");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

// Rule 1: New Public Exposure
const publicExposureRule: DiffRule = {
  id: "public_exposure",
  category: "public_exposure",
  name: "New Public Exposure",
  description: "Detects storage resources newly exposed to the public internet",
  defaultSeverity: "critical",
  cooldownMinutes: 0, // no cooldown — security alerts always fire
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];

    if (delta.storageDelta.newPublicCount > 0) {
      const publicResources = delta.addedResources
        .filter((r): r is StorageResource =>
          r.resourceType === "storage" &&
          (r.tags?.["public_access"] === "true" || r.storageClass === "standard"),
        )
        .map((r) => r.resourceId);

      const changedToPublic = delta.changedResources
        .filter((c) => c.changes.some((ch) => ch.field === "storageClass"))
        .map((c) => c.resourceId);

      const allAffected = [...new Set([...publicResources, ...changedToPublic])];

      if (allAffected.length > 0) {
        alerts.push({
          id: makeAlertId("public_exposure"),
          category: "public_exposure",
          severity: "critical",
          title: `${allAffected.length} storage resource(s) newly exposed to public access`,
          summary: `Detected ${allAffected.length} storage resource(s) with public access enabled in ${delta.provider}. This may expose sensitive data.`,
          detail: `Resources: ${allAffected.join(", ")}. Public storage is a common vector for data breaches and compliance violations (SOC 2, HIPAA, PCI-DSS).`,
          provider: delta.provider,
          regions: [...new Set(delta.addedResources.filter((r) => allAffected.includes(r.resourceId)).map((r) => r.region))],
          affectedResources: allAffected,
          timestamp: new Date().toISOString(),
          deduplicationHash: makeHash("public_exposure", delta.provider, ...allAffected),
          delta: {
            metric: "public_storage_count",
            previousValue: delta.storageDelta.totalBefore - delta.storageDelta.newPublicCount,
            currentValue: `${delta.storageDelta.newPublicCount} new`,
            changePercent: null,
            direction: "new",
          },
          recommendation: "Restrict public access immediately using bucket policies or ACLs. Review whether public access was intentional.",
          suppressible: false,
          requiresAction: true,
        });
      }
    }

    return alerts;
  },
};

// Rule 2: Large Cost Increase
const costSpikeRule: DiffRule = {
  id: "cost_spike",
  category: "cost_spike",
  name: "Large Cost Increase",
  description: "Detects significant month-over-month cost increases",
  defaultSeverity: "warning",
  cooldownMinutes: 1440, // 24h cooldown
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];
    const threshold = ctx.alertPolicy.costSpikeThresholdPercent;
    const { costDelta } = delta;

    if (costDelta.percentChange >= threshold && costDelta.absoluteChange > 50) {
      const severity: AlertSeverity = costDelta.percentChange >= 50 ? "critical" : "warning";

      alerts.push({
        id: makeAlertId("cost_spike"),
        category: "cost_spike",
        severity,
        title: `Monthly spend increased ${Math.round(costDelta.percentChange)}% (+$${fmt(costDelta.absoluteChange)}/mo)`,
        summary: `${providerLabel(delta.provider)} monthly spend rose from $${fmt(costDelta.monthlyBefore)} to $${fmt(costDelta.monthlyAfter)}, a ${Math.round(costDelta.percentChange)}% increase.`,
        detail: buildCostDetail(delta),
        provider: delta.provider,
        regions: delta.regionDelta.regionsAfter,
        affectedResources: delta.addedResources.map((r) => r.resourceId),
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("cost_spike", delta.provider, String(Math.round(costDelta.percentChange / 10))),
        delta: {
          metric: "monthly_spend",
          previousValue: costDelta.monthlyBefore,
          currentValue: costDelta.monthlyAfter,
          changePercent: costDelta.percentChange,
          direction: "increased",
        },
        recommendation: `Review ${delta.addedResources.length} new resource(s) and ${delta.computeDelta.totalAfter - delta.computeDelta.totalBefore} compute delta. Consider right-sizing or removing unused resources.`,
        suppressible: true,
        requiresAction: costDelta.percentChange >= 30,
      });
    }

    return alerts;
  },
};

// Rule 3: Idle Resource Growth
const idleGrowthRule: DiffRule = {
  id: "idle_growth",
  category: "idle_growth",
  name: "Idle Resource Growth",
  description: "Detects growing number of idle or near-zero utilization resources",
  defaultSeverity: "warning",
  cooldownMinutes: 4320, // 72h cooldown
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];
    const threshold = ctx.alertPolicy.idleGrowthThreshold;

    if (delta.computeDelta.newIdleCount >= threshold) {
      const monthlyCost = delta.computeDelta.newIdleCount * 85; // avg $85/instance

      alerts.push({
        id: makeAlertId("idle_growth"),
        category: "idle_growth",
        severity: delta.computeDelta.newIdleCount >= 10 ? "critical" : "warning",
        title: `${delta.computeDelta.newIdleCount} new idle compute instance(s) detected`,
        summary: `${delta.computeDelta.newIdleCount} compute instance(s) in ${providerLabel(delta.provider)} dropped below 5% CPU utilization. Estimated waste: ~$${fmt(monthlyCost)}/mo.`,
        detail: `Previously ${delta.computeDelta.stoppedBefore} stopped, now ${delta.computeDelta.stoppedAfter}. Running instances went from ${delta.computeDelta.runningBefore} to ${delta.computeDelta.runningAfter}. ${delta.computeDelta.newIdleCount} instance(s) are running but idle (<5% CPU).`,
        provider: delta.provider,
        regions: delta.regionDelta.regionsAfter,
        affectedResources: [],
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("idle_growth", delta.provider, String(delta.computeDelta.newIdleCount)),
        delta: {
          metric: "idle_instance_count",
          previousValue: 0,
          currentValue: delta.computeDelta.newIdleCount,
          changePercent: null,
          direction: "increased",
        },
        recommendation: `Review idle instances — consider stopping, snapshotting, or terminating. Potential savings: ~$${fmt(monthlyCost * 12)}/yr.`,
        suppressible: true,
        requiresAction: false,
      });
    }

    return alerts;
  },
};

// Rule 4: Resilience Degradation
const resilienceDegradationRule: DiffRule = {
  id: "resilience_degradation",
  category: "resilience_degradation",
  name: "Resilience Degradation",
  description: "Detects loss of multi-region redundancy or backup coverage",
  defaultSeverity: "warning",
  cooldownMinutes: 1440,
  evaluate(delta) {
    const alerts: MonitorAlert[] = [];

    // Single-region regression
    if (!delta.flagsDelta.singleRegionBefore && delta.flagsDelta.singleRegionAfter) {
      alerts.push({
        id: makeAlertId("resilience_degradation"),
        category: "resilience_degradation",
        severity: "critical",
        title: "Infrastructure collapsed to single region",
        summary: `${providerLabel(delta.provider)} resources are now concentrated in a single region. Previously distributed across ${delta.regionDelta.regionsBefore.length} regions.`,
        detail: `Regions removed: ${delta.regionDelta.removedRegions.join(", ")}. All resources now in ${delta.regionDelta.regionsAfter[0] ?? "unknown"}. Single-region deployments have no geographic redundancy — a regional outage would cause complete downtime.`,
        provider: delta.provider,
        regions: delta.regionDelta.regionsAfter,
        affectedResources: [],
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("resilience_degradation", delta.provider, "single_region"),
        delta: {
          metric: "region_count",
          previousValue: delta.regionDelta.regionsBefore.length,
          currentValue: delta.regionDelta.regionsAfter.length,
          changePercent: null,
          direction: "decreased",
        },
        recommendation: "Evaluate whether this consolidation was intentional. If not, restore multi-region deployment for production workloads.",
        suppressible: false,
        requiresAction: true,
      });
    }

    // Backup regression
    if (!delta.flagsDelta.noBackupsBefore && delta.flagsDelta.noBackupsAfter) {
      alerts.push({
        id: makeAlertId("resilience_degradation"),
        category: "resilience_degradation",
        severity: "critical",
        title: "Backup coverage lost",
        summary: `${providerLabel(delta.provider)} no longer has detectable backup configurations. Previously had backup coverage.`,
        detail: "Loss of backup coverage means data loss in the event of accidental deletion, corruption, or ransomware. This is a significant resilience regression.",
        provider: delta.provider,
        regions: delta.regionDelta.regionsAfter,
        affectedResources: [],
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("resilience_degradation", delta.provider, "no_backups"),
        delta: {
          metric: "backup_coverage",
          previousValue: "enabled",
          currentValue: "none",
          changePercent: null,
          direction: "removed",
        },
        recommendation: "Re-enable automated backups immediately. Check for accidental policy deletion or misconfiguration.",
        suppressible: false,
        requiresAction: true,
      });
    }

    // Region removal
    if (delta.regionDelta.removedRegions.length > 0 && !delta.flagsDelta.singleRegionAfter) {
      alerts.push({
        id: makeAlertId("resilience_degradation"),
        category: "resilience_degradation",
        severity: "warning",
        title: `${delta.regionDelta.removedRegions.length} region(s) removed from deployment`,
        summary: `Resources removed from: ${delta.regionDelta.removedRegions.join(", ")}. Remaining regions: ${delta.regionDelta.regionsAfter.join(", ")}.`,
        detail: "Fewer regions reduces geographic redundancy and may increase latency for users in affected areas.",
        provider: delta.provider,
        regions: delta.regionDelta.removedRegions,
        affectedResources: delta.removedResources.map((r) => r.resourceId),
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("resilience_degradation", delta.provider, "region_removed", ...delta.regionDelta.removedRegions),
        delta: {
          metric: "region_count",
          previousValue: delta.regionDelta.regionsBefore.length,
          currentValue: delta.regionDelta.regionsAfter.length,
          changePercent: null,
          direction: "decreased",
        },
        recommendation: "Verify this consolidation was planned. If production traffic serves these regions, consider maintaining presence.",
        suppressible: true,
        requiresAction: false,
      });
    }

    return alerts;
  },
};

// Rule 5: Region Concentration Risk
const regionConcentrationRule: DiffRule = {
  id: "region_concentration",
  category: "region_concentration",
  name: "Region Concentration Risk",
  description: "Alerts when resource concentration in a single region exceeds threshold",
  defaultSeverity: "info",
  cooldownMinutes: 10080, // 7 days
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];
    const threshold = ctx.alertPolicy.concentrationThresholdPercent;

    if (
      delta.regionDelta.concentrationAfter >= threshold &&
      delta.regionDelta.concentrationBefore < threshold &&
      delta.regionDelta.regionsAfter.length > 1
    ) {
      alerts.push({
        id: makeAlertId("region_concentration"),
        category: "region_concentration",
        severity: "info",
        title: `${Math.round(delta.regionDelta.concentrationAfter)}% of resources concentrated in one region`,
        summary: `Resource concentration in ${providerLabel(delta.provider)} crossed ${threshold}% threshold. Previously ${Math.round(delta.regionDelta.concentrationBefore)}%.`,
        detail: `While resources span ${delta.regionDelta.regionsAfter.length} regions, the primary region holds ${Math.round(delta.regionDelta.concentrationAfter)}% of all resources. This creates a soft single-point-of-failure.`,
        provider: delta.provider,
        regions: delta.regionDelta.regionsAfter,
        affectedResources: [],
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("region_concentration", delta.provider, String(Math.round(delta.regionDelta.concentrationAfter / 10))),
        delta: {
          metric: "region_concentration_pct",
          previousValue: delta.regionDelta.concentrationBefore,
          currentValue: delta.regionDelta.concentrationAfter,
          changePercent: delta.regionDelta.concentrationAfter - delta.regionDelta.concentrationBefore,
          direction: "increased",
        },
        recommendation: "Consider distributing workloads more evenly across regions for better fault tolerance.",
        suppressible: true,
        requiresAction: false,
      });
    }

    return alerts;
  },
};

// Rule 6: New Optimization Opportunities
const newOptimizationRule: DiffRule = {
  id: "new_optimization",
  category: "new_optimization",
  name: "New Optimization Opportunities",
  description: "Detects newly added resources that could be optimized",
  defaultSeverity: "info",
  cooldownMinutes: 4320, // 72h
  evaluate(delta) {
    const alerts: MonitorAlert[] = [];

    const newCompute = delta.addedResources.filter(
      (r): r is ComputeResource => r.resourceType === "compute",
    );
    const newStorage = delta.addedResources.filter(
      (r): r is StorageResource => r.resourceType === "storage",
    );

    const oversized = newCompute.filter(
      (c) => c.usage && c.usage.cpuAvgPct !== undefined && c.usage.cpuAvgPct < 30 && c.vcpus >= 4,
    );
    const coldStorage = newStorage.filter(
      (s) => s.storageClass === "standard" && s.lastAccessedDaysAgo !== undefined && s.lastAccessedDaysAgo > 60,
    );

    if (oversized.length > 0) {
      const estSavings = oversized.reduce(
        (sum, c) => sum + (c.monthlyCostEstimate ?? 85) * 0.4,
        0,
      );
      alerts.push({
        id: makeAlertId("new_optimization"),
        category: "new_optimization",
        severity: estSavings > 500 ? "warning" : "info",
        title: `${oversized.length} new oversized compute instance(s) detected`,
        summary: `${oversized.length} newly provisioned instance(s) in ${providerLabel(delta.provider)} are running below 30% CPU with 4+ vCPUs. Potential savings: ~$${fmt(estSavings)}/mo.`,
        detail: `Instances: ${oversized.map((c) => `${c.resourceId} (${c.instanceType}, ${c.usage?.cpuAvgPct ?? 0}% CPU)`).join("; ")}`,
        provider: delta.provider,
        regions: [...new Set(oversized.map((c) => c.region))],
        affectedResources: oversized.map((c) => c.resourceId),
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("new_optimization", delta.provider, "compute", String(oversized.length)),
        delta: {
          metric: "oversized_instance_count",
          previousValue: null,
          currentValue: oversized.length,
          changePercent: null,
          direction: "new",
        },
        recommendation: `Right-size these instances. Based on usage patterns, downsizing by one tier would save ~$${fmt(estSavings * 12)}/yr.`,
        suppressible: true,
        requiresAction: false,
      });
    }

    if (coldStorage.length > 0) {
      alerts.push({
        id: makeAlertId("new_optimization"),
        category: "new_optimization",
        severity: "info",
        title: `${coldStorage.length} new storage resource(s) using Standard tier with cold data`,
        summary: `${coldStorage.length} storage resource(s) in ${providerLabel(delta.provider)} have data older than 60 days in Standard tier.`,
        detail: `Resources: ${coldStorage.map((s) => `${s.resourceId} (last accessed ${s.lastAccessedDaysAgo}d ago)`).join("; ")}`,
        provider: delta.provider,
        regions: [...new Set(coldStorage.map((s) => s.region))],
        affectedResources: coldStorage.map((s) => s.resourceId),
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("new_optimization", delta.provider, "storage", String(coldStorage.length)),
        delta: {
          metric: "cold_standard_storage_count",
          previousValue: null,
          currentValue: coldStorage.length,
          changePercent: null,
          direction: "new",
        },
        recommendation: "Enable intelligent tiering or lifecycle policies to automatically move cold data to cheaper storage tiers.",
        suppressible: true,
        requiresAction: false,
      });
    }

    return alerts;
  },
};

// Rule 7: Failed Execution Verification
const verificationFailureRule: DiffRule = {
  id: "verification_failure",
  category: "verification_failure",
  name: "Failed Execution Verification",
  description: "Detects when previously applied changes have reverted or failed",
  defaultSeverity: "warning",
  cooldownMinutes: 720, // 12h
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];

    if (ctx.lastVerifiedItems.length === 0) return alerts;

    const currentResourceMap = new Map<string, CloudResource>();
    for (const r of delta.addedResources) currentResourceMap.set(r.resourceId, r);
    for (const c of delta.changedResources) {
      const curr = delta.changedResources.find((ch) => ch.resourceId === c.resourceId);
      if (curr) currentResourceMap.set(c.resourceId, { resourceId: c.resourceId, provider: c.provider, region: c.region } as CloudResource);
    }

    const revertedItems: VerifiedItem[] = [];

    for (const verified of ctx.lastVerifiedItems) {
      const reverted = delta.changedResources.find((c) =>
        verified.resourceIds.includes(c.resourceId) &&
        c.changes.some((ch) => {
          if (verified.actionType === "resize_compute" && ch.field === "instanceType") return true;
          if (verified.actionType === "apply_storage_policy" && ch.field === "storageClass") return true;
          return false;
        }),
      );

      const removed = verified.resourceIds.some((rid) =>
        delta.removedResources.some((r) => r.resourceId === rid),
      );

      if (reverted || removed) {
        revertedItems.push(verified);
      }
    }

    if (revertedItems.length > 0) {
      const resourceIds = revertedItems.flatMap((v) => v.resourceIds);
      alerts.push({
        id: makeAlertId("verification_failure"),
        category: "verification_failure",
        severity: "warning",
        title: `${revertedItems.length} previously applied change(s) appear reverted`,
        summary: `${revertedItems.length} action(s) that were verified as applied in ${providerLabel(delta.provider)} have changed or been removed.`,
        detail: `Affected actions: ${revertedItems.map((v) => `${v.actionType} on ${v.resourceIds.join(", ")} (verified ${v.verifiedAt})`).join("; ")}. This may indicate manual intervention, auto-scaling override, or deployment rollback.`,
        provider: delta.provider,
        regions: [...new Set(delta.changedResources.filter((c) => resourceIds.includes(c.resourceId)).map((c) => c.region))],
        affectedResources: resourceIds,
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("verification_failure", delta.provider, ...resourceIds.slice(0, 5)),
        delta: {
          metric: "reverted_actions",
          previousValue: 0,
          currentValue: revertedItems.length,
          changePercent: null,
          direction: "increased",
        },
        recommendation: "Investigate why changes reverted. Common causes: auto-scaling policies, IaC drift, manual intervention, or deployment overrides.",
        suppressible: true,
        requiresAction: true,
      });
    }

    return alerts;
  },
};

// Rule 8: Drift from Execution Plan
const planDriftRule: DiffRule = {
  id: "plan_drift",
  category: "plan_drift",
  name: "Drift from Execution Plan",
  description: "Detects when current infrastructure state has drifted from the active execution plan",
  defaultSeverity: "warning",
  cooldownMinutes: 1440,
  evaluate(delta, ctx) {
    const alerts: MonitorAlert[] = [];

    if (!ctx.activePlan || ctx.activePlan.status !== "in_progress") return alerts;

    const completedPhases = ctx.activePlan.phases.filter((p) => p.status === "completed");
    if (completedPhases.length === 0) return alerts;

    const plannedResources = new Set(
      completedPhases.flatMap((p) => p.items.flatMap((i) => i.resourceIds)),
    );

    const driftedResources = delta.changedResources.filter((c) =>
      plannedResources.has(c.resourceId),
    );
    const removedPlannedResources = delta.removedResources.filter((r) =>
      plannedResources.has(r.resourceId),
    );

    const totalDrifted = driftedResources.length + removedPlannedResources.length;

    if (totalDrifted > 0) {
      const severity: AlertSeverity = totalDrifted >= 5 ? "critical" : "warning";
      const affectedIds = [
        ...driftedResources.map((c) => c.resourceId),
        ...removedPlannedResources.map((r) => r.resourceId),
      ];

      alerts.push({
        id: makeAlertId("plan_drift"),
        category: "plan_drift",
        severity,
        title: `${totalDrifted} resource(s) drifted from active execution plan`,
        summary: `Infrastructure in ${providerLabel(delta.provider)} has drifted from plan "${ctx.activePlan.name}". ${driftedResources.length} changed, ${removedPlannedResources.length} removed.`,
        detail: `Plan "${ctx.activePlan.name}" (${ctx.activePlan.archetype}) has ${completedPhases.length} completed phase(s). Resources that drifted: ${affectedIds.join(", ")}. This may invalidate remaining phases.`,
        provider: delta.provider,
        regions: [...new Set([
          ...driftedResources.map((c) => c.region),
          ...removedPlannedResources.map((r) => r.region),
        ])],
        affectedResources: affectedIds,
        timestamp: new Date().toISOString(),
        deduplicationHash: makeHash("plan_drift", ctx.activePlan.id, String(totalDrifted)),
        delta: {
          metric: "drifted_resource_count",
          previousValue: 0,
          currentValue: totalDrifted,
          changePercent: null,
          direction: "increased",
        },
        recommendation: `Pause the current plan and re-scan. ${totalDrifted} resource(s) no longer match the expected state. Remaining phases may need re-planning.`,
        suppressible: false,
        requiresAction: true,
      });
    }

    return alerts;
  },
};

export const ALL_RULES: DiffRule[] = [
  publicExposureRule,
  costSpikeRule,
  idleGrowthRule,
  resilienceDegradationRule,
  regionConcentrationRule,
  newOptimizationRule,
  verificationFailureRule,
  planDriftRule,
];

// ---------------------------------------------------------------------------
// 9. Alert suppression engine
// ---------------------------------------------------------------------------

export function shouldSuppress(
  alert: MonitorAlert,
  rule: DiffRule,
  ctx: MonitorContext,
): { suppress: boolean; reason: string } {
  // 1. Severity floor
  const sevRank: Record<AlertSeverity, number> = { info: 0, warning: 1, critical: 2 };
  if (sevRank[alert.severity] < sevRank[ctx.alertPolicy.severityFloor]) {
    return { suppress: true, reason: `Below severity floor (${ctx.alertPolicy.severityFloor})` };
  }

  // 2. Category disabled
  if (!ctx.alertPolicy.enabledCategories.includes(alert.category)) {
    return { suppress: true, reason: `Category "${alert.category}" disabled in alert policy` };
  }

  // 3. Snoozed
  const snooze = ctx.alertPolicy.snoozedRules.find((s) => s.ruleId === rule.id);
  if (snooze && new Date(snooze.snoozedUntil) > new Date()) {
    return { suppress: true, reason: `Rule snoozed until ${snooze.snoozedUntil}: ${snooze.reason}` };
  }

  // 4. Cooldown
  const cooldown = ctx.alertPolicy.cooldownOverrides[alert.category] ?? rule.cooldownMinutes;
  const lastFired = ctx.suppressionState.lastFiredAt.get(alert.category);
  if (lastFired && cooldown > 0) {
    const elapsed = (Date.now() - new Date(lastFired).getTime()) / 60000;
    if (elapsed < cooldown) {
      return { suppress: true, reason: `Cooldown active (${Math.round(cooldown - elapsed)}min remaining)` };
    }
  }

  // 5. Deduplication
  const existingHash = ctx.suppressionState.recentHashes.get(alert.deduplicationHash);
  if (existingHash) {
    return { suppress: true, reason: `Duplicate alert (hash ${alert.deduplicationHash})` };
  }

  // 6. Previous identical alert in last 24h
  const duplicatePrev = ctx.previousAlerts.find(
    (p) =>
      p.deduplicationHash === alert.deduplicationHash &&
      Date.now() - new Date(p.firedAt).getTime() < 86400000,
  );
  if (duplicatePrev) {
    return { suppress: true, reason: `Identical alert fired ${timeSince(duplicatePrev.firedAt)} ago` };
  }

  return { suppress: false, reason: "" };
}

function applyEscalation(
  alert: MonitorAlert,
  ctx: MonitorContext,
): MonitorAlert {
  for (const rule of ctx.alertPolicy.escalationRules) {
    if (alert.severity !== rule.fromSeverity) continue;

    const count = ctx.suppressionState.occurrenceCounts.get(alert.deduplicationHash) ?? 0;
    if (count >= rule.afterOccurrences) {
      const recentPrev = ctx.previousAlerts.filter(
        (p) =>
          p.deduplicationHash === alert.deduplicationHash &&
          Date.now() - new Date(p.firedAt).getTime() < rule.withinHours * 3600000,
      );
      if (recentPrev.length >= rule.afterOccurrences) {
        return {
          ...alert,
          severity: rule.toSeverity,
          title: `[Escalated] ${alert.title}`,
          detail: `${alert.detail}\n\nEscalated from ${rule.fromSeverity} to ${rule.toSeverity} after ${rule.afterOccurrences}+ occurrences within ${rule.withinHours}h.`,
        };
      }
    }
  }

  return alert;
}

// ---------------------------------------------------------------------------
// 10. Notification payload builder
// ---------------------------------------------------------------------------

export function buildMonitorNotification(
  ctx: MonitorContext,
  alerts: MonitorAlert[],
): MonitorNotification | null {
  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  const topSeverity = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "info";
  const topCategory = alerts[0].category;

  const title = criticalCount > 0
    ? `🔴 ${criticalCount} critical alert(s) in ${providerLabel(alerts[0].provider)}`
    : warningCount > 0
      ? `🟡 ${warningCount} warning(s) in ${providerLabel(alerts[0].provider)}`
      : `ℹ️ ${infoCount} update(s) in ${providerLabel(alerts[0].provider)}`;

  const body = buildNotificationBody(alerts);

  const actionUrl = criticalCount > 0 ? "/operator/dashboard?tab=alerts" : null;

  return {
    type: "monitor_alert",
    organizationId: ctx.organizationId,
    cloudAccountId: ctx.cloudAccountId,
    severity: topSeverity,
    title,
    body,
    alerts,
    actionUrl,
    data: {
      provider: ctx.provider,
      alertCount: alerts.length,
      criticalCount,
      warningCount,
      infoCount,
      topCategory,
      estimatedImpact: summarizeImpact(alerts),
    },
  };
}

function buildNotificationBody(alerts: MonitorAlert[]): string {
  const lines: string[] = [];

  const critical = alerts.filter((a) => a.severity === "critical");
  const warning = alerts.filter((a) => a.severity === "warning");
  const info = alerts.filter((a) => a.severity === "info");

  if (critical.length > 0) {
    lines.push("**Requires immediate attention:**");
    for (const a of critical) lines.push(`• ${a.summary}`);
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push("**Warnings:**");
    for (const a of warning) lines.push(`• ${a.summary}`);
    lines.push("");
  }

  if (info.length > 0) {
    lines.push("**Information:**");
    for (const a of info.slice(0, 3)) lines.push(`• ${a.summary}`);
    if (info.length > 3) lines.push(`• ...and ${info.length - 3} more`);
  }

  return lines.join("\n");
}

function summarizeImpact(alerts: MonitorAlert[]): string {
  const costAlerts = alerts.filter((a) => a.category === "cost_spike" || a.category === "idle_growth" || a.category === "new_optimization");
  if (costAlerts.length > 0) {
    const totalDelta = costAlerts.reduce((sum, a) => {
      if (typeof a.delta.currentValue === "number" && typeof a.delta.previousValue === "number") {
        return sum + (a.delta.currentValue - a.delta.previousValue);
      }
      return sum;
    }, 0);
    if (totalDelta !== 0) return `~$${fmt(Math.abs(totalDelta))}/mo ${totalDelta > 0 ? "increase" : "savings opportunity"}`;
  }

  const securityAlerts = alerts.filter((a) => a.category === "public_exposure");
  if (securityAlerts.length > 0) {
    const totalResources = securityAlerts.reduce((s, a) => s + a.affectedResources.length, 0);
    return `${totalResources} resource(s) with security exposure`;
  }

  return `${alerts.length} change(s) detected`;
}

// ---------------------------------------------------------------------------
// 11. Top-level monitor pipeline — public entry point
// ---------------------------------------------------------------------------

export function runMonitor(
  previousSnapshot: CloudSnapshot,
  currentSnapshot: CloudSnapshot,
  ctx: MonitorContext,
): MonitorResult {
  const snapshotDelta = diffSnapshots(previousSnapshot, currentSnapshot);

  const allAlerts: MonitorAlert[] = [];
  const suppressed: SuppressedAlert[] = [];

  for (const rule of ALL_RULES) {
    const ruleAlerts = rule.evaluate(snapshotDelta, ctx);

    for (let alert of ruleAlerts) {
      alert = applyEscalation(alert, ctx);

      const suppression = shouldSuppress(alert, rule, ctx);
      if (suppression.suppress) {
        suppressed.push({
          category: alert.category,
          reason: suppression.reason,
          deduplicationHash: alert.deduplicationHash,
        });
        continue;
      }

      allAlerts.push(alert);

      // Update suppression state for subsequent rules in same run
      ctx.suppressionState.recentHashes.set(alert.deduplicationHash, alert.timestamp);
      ctx.suppressionState.lastFiredAt.set(alert.category, alert.timestamp);
      const prevCount = ctx.suppressionState.occurrenceCounts.get(alert.deduplicationHash) ?? 0;
      ctx.suppressionState.occurrenceCounts.set(alert.deduplicationHash, prevCount + 1);
    }
  }

  // Sort: critical first, then warning, then info
  const sevRank: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
  allAlerts.sort((a, b) => sevRank[b.severity] - sevRank[a.severity]);

  const nextCheckMs = computeNextCheckInterval(allAlerts);
  const nextCheck = new Date(Date.now() + nextCheckMs).toISOString();

  return {
    provider: currentSnapshot.provider,
    monitoredAt: new Date().toISOString(),
    snapshotDelta,
    alerts: allAlerts,
    suppressed,
    totalAlertsGenerated: allAlerts.length + suppressed.length,
    totalAlertsSuppressed: suppressed.length,
    nextCheckRecommended: nextCheck,
  };
}

function computeNextCheckInterval(alerts: MonitorAlert[]): number {
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const hasWarning = alerts.some((a) => a.severity === "warning");

  if (hasCritical) return 30 * 60 * 1000;    // 30 minutes
  if (hasWarning) return 4 * 3600 * 1000;     // 4 hours
  return 24 * 3600 * 1000;                     // 24 hours
}

// ---------------------------------------------------------------------------
// 12. Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function providerLabel(provider: CloudProvider): string {
  return provider === "aws" ? "AWS" : provider === "azure" ? "Azure" : provider === "gcp" ? "Google Cloud" : provider;
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `${Math.floor(ms / 60000)}min`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function buildCostDetail(delta: SnapshotDelta): string {
  const parts: string[] = [];
  const { computeDelta, storageDelta, costDelta } = delta;

  if (computeDelta.totalAfter > computeDelta.totalBefore) {
    parts.push(`Compute: ${computeDelta.totalBefore} → ${computeDelta.totalAfter} (+${computeDelta.totalAfter - computeDelta.totalBefore})`);
  }
  if (storageDelta.totalAfter > storageDelta.totalBefore) {
    parts.push(`Storage: ${storageDelta.totalBefore} → ${storageDelta.totalAfter} (+${storageDelta.totalAfter - storageDelta.totalBefore})`);
  }
  if (delta.addedResources.length > 0) {
    parts.push(`${delta.addedResources.length} new resource(s) added`);
  }
  if (computeDelta.resizedCount > 0) {
    parts.push(`${computeDelta.resizedCount} instance(s) resized (check for upsizing)`);
  }

  parts.push(`Total: $${fmt(costDelta.monthlyBefore)}/mo → $${fmt(costDelta.monthlyAfter)}/mo`);
  return parts.join(". ");
}

// ---------------------------------------------------------------------------
// 13. Invariant tests
// ---------------------------------------------------------------------------

export type MonitoringTestResult = { name: string; passed: boolean; detail: string };

export function runMonitoringTests(): MonitoringTestResult[] {
  const results: MonitoringTestResult[] = [];

  const baseSnapshot: CloudSnapshot = {
    provider: "aws",
    accountId: "123456789",
    scannedAt: new Date(Date.now() - 86400000).toISOString(),
    regions: ["us-east-1", "us-west-2"],
    resources: [
      {
        resourceType: "compute" as const,
        provider: "aws" as const,
        resourceId: "i-existing-1",
        region: "us-east-1",
        instanceType: "m5.xlarge",
        tier: "general" as const,
        vcpus: 4,
        memoryGb: 16,
        state: "running" as const,
        usage: { cpuAvgPct: 45 },
        monthlyCostEstimate: 150,
      },
      {
        resourceType: "storage" as const,
        provider: "aws" as const,
        resourceId: "bucket-private",
        region: "us-east-1",
        storageClass: "standard" as const,
        sizeGb: 100,
        monthlyCostEstimate: 2.3,
      },
    ],
    monthlySpend: 152,
    flags: { singleRegion: false, noBackupsDetected: false },
  };

  const baseCtx: MonitorContext = {
    organizationId: "test-org",
    cloudAccountId: "test-account",
    provider: "aws",
    alertPolicy: { ...DEFAULT_ALERT_POLICY },
    suppressionState: {
      recentHashes: new Map(),
      lastFiredAt: new Map(),
      occurrenceCounts: new Map(),
    },
    activePlan: null,
    previousAlerts: [],
    lastVerifiedItems: [],
  };

  // Test 1: Identical snapshots produce no alerts
  {
    const result = runMonitor(baseSnapshot, baseSnapshot, { ...baseCtx, suppressionState: freshSuppressionState() });
    results.push({
      name: "Identical snapshots produce zero alerts",
      passed: result.alerts.length === 0,
      detail: `Alerts: ${result.alerts.length}`,
    });
  }

  // Test 2: New public storage produces critical alert
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      resources: [
        ...baseSnapshot.resources,
        {
          resourceType: "storage" as const,
          provider: "aws" as const,
          resourceId: "bucket-public-new",
          region: "us-east-1",
          storageClass: "standard" as const,
          sizeGb: 50,
          tags: { public_access: "true" },
        },
      ],
    };
    const result = runMonitor(baseSnapshot, current, { ...baseCtx, suppressionState: freshSuppressionState() });
    const publicAlert = result.alerts.find((a) => a.category === "public_exposure");
    results.push({
      name: "New public storage triggers critical alert",
      passed: publicAlert !== undefined && publicAlert.severity === "critical",
      detail: publicAlert ? `Severity: ${publicAlert.severity}` : "No public_exposure alert",
    });
  }

  // Test 3: Cost spike above threshold produces alert
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      monthlySpend: 250,
      resources: [
        ...baseSnapshot.resources,
        {
          resourceType: "compute" as const,
          provider: "aws" as const,
          resourceId: "i-expensive-new",
          region: "us-east-1",
          instanceType: "m5.4xlarge",
          tier: "general" as const,
          vcpus: 16,
          memoryGb: 64,
          state: "running" as const,
          monthlyCostEstimate: 98,
        },
      ],
    };
    const result = runMonitor(baseSnapshot, current, { ...baseCtx, suppressionState: freshSuppressionState() });
    const costAlert = result.alerts.find((a) => a.category === "cost_spike");
    results.push({
      name: "Cost spike above threshold produces alert",
      passed: costAlert !== undefined,
      detail: costAlert ? `Change: ${Math.round(costAlert.delta.changePercent ?? 0)}%` : "No cost_spike alert",
    });
  }

  // Test 4: Severity floor suppresses info alerts
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      resources: [
        ...baseSnapshot.resources,
        {
          resourceType: "compute" as const,
          provider: "aws" as const,
          resourceId: "i-oversized",
          region: "us-east-1",
          instanceType: "m5.2xlarge",
          tier: "general" as const,
          vcpus: 8,
          memoryGb: 32,
          state: "running" as const,
          usage: { cpuAvgPct: 10 },
          monthlyCostEstimate: 250,
        },
      ],
    };
    const strictCtx = {
      ...baseCtx,
      alertPolicy: { ...DEFAULT_ALERT_POLICY, severityFloor: "warning" as AlertSeverity },
      suppressionState: freshSuppressionState(),
    };
    const result = runMonitor(baseSnapshot, current, strictCtx);
    const infoAlerts = result.alerts.filter((a) => a.severity === "info");
    results.push({
      name: "Severity floor suppresses info-level alerts",
      passed: infoAlerts.length === 0,
      detail: `Info alerts after floor=warning: ${infoAlerts.length}, suppressed: ${result.totalAlertsSuppressed}`,
    });
  }

  // Test 5: Cooldown prevents duplicate category alerts
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      monthlySpend: 300,
    };
    const cooldownCtx = {
      ...baseCtx,
      suppressionState: {
        ...freshSuppressionState(),
        lastFiredAt: new Map([["cost_spike" as AlertCategory, new Date().toISOString()]]),
      },
    };
    const result = runMonitor(baseSnapshot, current, cooldownCtx);
    const costAlerts = result.alerts.filter((a) => a.category === "cost_spike");
    const suppressed = result.suppressed.filter((s) => s.category === "cost_spike");
    results.push({
      name: "Cooldown suppresses repeated category alerts",
      passed: costAlerts.length === 0 && suppressed.length > 0,
      detail: `Cost alerts: ${costAlerts.length}, suppressed: ${suppressed.length}`,
    });
  }

  // Test 6: Public exposure alerts are never suppressed by cooldown
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      resources: [
        ...baseSnapshot.resources,
        {
          resourceType: "storage" as const,
          provider: "aws" as const,
          resourceId: "bucket-leaked",
          region: "us-east-1",
          storageClass: "standard" as const,
          tags: { public_access: "true" },
        },
      ],
    };
    const cooldownCtx = {
      ...baseCtx,
      suppressionState: {
        ...freshSuppressionState(),
        lastFiredAt: new Map([["public_exposure" as AlertCategory, new Date().toISOString()]]),
      },
    };
    const result = runMonitor(baseSnapshot, current, cooldownCtx);
    const pubAlerts = result.alerts.filter((a) => a.category === "public_exposure");
    results.push({
      name: "Public exposure alerts bypass cooldown (cooldownMinutes=0)",
      passed: pubAlerts.length > 0,
      detail: `Public exposure alerts: ${pubAlerts.length}`,
    });
  }

  // Test 7: Resilience degradation when going to single region
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      regions: ["us-east-1"],
      resources: baseSnapshot.resources.map((r) => ({ ...r, region: "us-east-1" })),
      flags: { singleRegion: true, noBackupsDetected: false },
    };
    const result = runMonitor(baseSnapshot, current, { ...baseCtx, suppressionState: freshSuppressionState() });
    const resilAlert = result.alerts.find((a) => a.category === "resilience_degradation");
    results.push({
      name: "Single-region collapse triggers critical resilience alert",
      passed: resilAlert !== undefined && resilAlert.severity === "critical",
      detail: resilAlert ? `Severity: ${resilAlert.severity}` : "No resilience alert",
    });
  }

  // Test 8: Alerts sorted by severity (critical first)
  {
    const current: CloudSnapshot = {
      ...baseSnapshot,
      scannedAt: new Date().toISOString(),
      monthlySpend: 500,
      regions: ["us-east-1"],
      resources: [
        ...baseSnapshot.resources.map((r) => ({ ...r, region: "us-east-1" })),
        {
          resourceType: "storage" as const,
          provider: "aws" as const,
          resourceId: "bucket-public-bad",
          region: "us-east-1",
          storageClass: "standard" as const,
          tags: { public_access: "true" },
        },
      ],
      flags: { singleRegion: true, noBackupsDetected: false },
    };
    const result = runMonitor(baseSnapshot, current, { ...baseCtx, suppressionState: freshSuppressionState() });
    const severities = result.alerts.map((a) => a.severity);
    const sevOrder: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
    const isSorted = severities.every((s, i) => i === 0 || sevOrder[s] <= sevOrder[severities[i - 1]]);
    results.push({
      name: "Alerts sorted by severity (critical first)",
      passed: isSorted,
      detail: `Order: [${severities.join(", ")}]`,
    });
  }

  // Test 9: Next check interval adapts to severity
  {
    const criticalResult = runMonitor(
      baseSnapshot,
      {
        ...baseSnapshot,
        scannedAt: new Date().toISOString(),
        regions: ["us-east-1"],
        resources: baseSnapshot.resources.map((r) => ({ ...r, region: "us-east-1" })),
        flags: { singleRegion: true, noBackupsDetected: false },
      },
      { ...baseCtx, suppressionState: freshSuppressionState() },
    );
    const cleanResult = runMonitor(baseSnapshot, baseSnapshot, { ...baseCtx, suppressionState: freshSuppressionState() });

    const criticalNext = new Date(criticalResult.nextCheckRecommended).getTime() - Date.now();
    const cleanNext = new Date(cleanResult.nextCheckRecommended).getTime() - Date.now();

    results.push({
      name: "Critical alerts shorten next check interval",
      passed: criticalNext < cleanNext,
      detail: `Critical: ${Math.round(criticalNext / 60000)}min, clean: ${Math.round(cleanNext / 60000)}min`,
    });
  }

  return results;
}

function freshSuppressionState(): SuppressionState {
  return {
    recentHashes: new Map(),
    lastFiredAt: new Map(),
    occurrenceCounts: new Map(),
  };
}

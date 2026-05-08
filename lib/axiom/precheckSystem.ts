import type { ExecutionPlanItem, ActionType } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";
import { INSTANCE_FAMILY_MAP } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrecheckResult = {
  itemId: string;
  actionType: ActionType;
  provider: CloudProvider;
  passed: boolean;
  warnings: string[];
  blockers: string[];
  checksRun: PrecheckDetail[];
  durationMs: number;
};

export type PrecheckDetail = {
  name: string;
  passed: boolean;
  message: string;
  severity: "blocker" | "warning" | "info";
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function runPrechecks(item: ExecutionPlanItem): PrecheckResult {
  const start = Date.now();
  const checker = CHECKERS[item.actionType];

  if (!checker) {
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      passed: false,
      warnings: [],
      blockers: [`No precheck rules defined for action type: ${item.actionType}`],
      checksRun: [],
      durationMs: Date.now() - start,
    };
  }

  const checks = checker(item);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.passed).map((c) => c.message);
  const blockers = checks.filter((c) => c.severity === "blocker" && !c.passed).map((c) => c.message);
  const passed = blockers.length === 0;

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    passed,
    warnings,
    blockers,
    checksRun: checks,
    durationMs: Date.now() - start,
  };
}

export function runAllPrechecks(items: ExecutionPlanItem[]): PrecheckResult[] {
  return items.map(runPrechecks);
}

export function allPassed(results: PrecheckResult[]): boolean {
  return results.every((r) => r.passed);
}

// ---------------------------------------------------------------------------
// Checker registry
// ---------------------------------------------------------------------------

type Checker = (item: ExecutionPlanItem) => PrecheckDetail[];

const CHECKERS: Record<string, Checker> = {
  resize_compute: checkResizeCompute,
  apply_storage_policy: checkStoragePolicy,
  purchase_commitment: checkCommitment,
  decommission_compute: checkDecommission,
};

// ---------------------------------------------------------------------------
// 1. Compute resize prechecks
// ---------------------------------------------------------------------------

function checkResizeCompute(item: ExecutionPlanItem): PrecheckDetail[] {
  const checks: PrecheckDetail[] = [];
  const recommended = item.recommendedState.replace(/^\d+x\s*/, "");

  // ---- Resource IDs exist and look valid ----
  checks.push(checkResourceIds(item));

  // ---- Instance ID format per provider ----
  checks.push(checkInstanceIdFormat(item));

  // ---- Instance is not terminated/deleted ----
  checks.push(checkNotTerminated(item));

  // ---- Recommended size is a known valid type ----
  checks.push(checkRecommendedSizeValid(item, recommended));

  // ---- Region is non-empty ----
  checks.push(checkRegionPresent(item));

  // ---- Autoscaling conflict detection ----
  checks.push(checkAutoscalingConflict(item));

  // ---- Backup/snapshot warning ----
  checks.push(checkBackupWarning(item));

  // ---- Cross-family resize warning ----
  checks.push(checkCrossFamilyResize(item, recommended));

  // ---- Batch size warning ----
  checks.push(checkBatchSize(item, 10));

  return checks;
}

function checkResourceIds(item: ExecutionPlanItem): PrecheckDetail {
  if (item.resourceIds.length === 0) {
    return { name: "resource_ids_present", passed: false, message: "No resource IDs specified.", severity: "blocker" };
  }
  const hasEmpty = item.resourceIds.some((id) => !id || id.trim().length === 0);
  if (hasEmpty) {
    return { name: "resource_ids_present", passed: false, message: "One or more resource IDs are empty.", severity: "blocker" };
  }
  return { name: "resource_ids_present", passed: true, message: `${item.resourceIds.length} resource ID(s) present.`, severity: "info" };
}

function checkInstanceIdFormat(item: ExecutionPlanItem): PrecheckDetail {
  const invalid: string[] = [];

  for (const id of item.resourceIds) {
    switch (item.provider) {
      case "aws":
        if (!/^i-[0-9a-f]{8,17}$/.test(id)) invalid.push(id);
        break;
      case "azure":
        if (id.length === 0 || id.length > 80) invalid.push(id);
        break;
      case "gcp":
        if (!/^[a-z][a-z0-9-]{0,62}$/.test(id)) invalid.push(id);
        break;
    }
  }

  if (invalid.length > 0) {
    return {
      name: "instance_id_format",
      passed: false,
      message: `${invalid.length} resource ID(s) don't match expected ${item.provider.toUpperCase()} format: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`,
      severity: "blocker",
    };
  }
  return { name: "instance_id_format", passed: true, message: `All resource IDs match ${item.provider.toUpperCase()} format.`, severity: "info" };
}

function checkNotTerminated(item: ExecutionPlanItem): PrecheckDetail {
  const state = item.currentState.toLowerCase();
  const terminated = ["terminated", "deleted", "deleting", "deallocating"];
  const isTerminated = terminated.some((t) => state.includes(t));

  if (isTerminated) {
    return { name: "not_terminated", passed: false, message: `Instance state "${item.currentState}" indicates resource is terminated or being deleted.`, severity: "blocker" };
  }

  if (state.includes("stopped") || state.includes("deallocated")) {
    return { name: "not_terminated", passed: true, message: `Instance is stopped/deallocated — resize is still possible but verify instance exists.`, severity: "warning" };
  }

  return { name: "not_terminated", passed: true, message: "Instance appears to be in a valid state for resize.", severity: "info" };
}

function checkRecommendedSizeValid(item: ExecutionPlanItem, recommended: string): PrecheckDetail {
  const knownSizes = getAllKnownSizes(item.provider);

  if (knownSizes.has(recommended)) {
    return { name: "recommended_size_valid", passed: true, message: `Target size "${recommended}" is a known ${item.provider.toUpperCase()} instance type.`, severity: "info" };
  }

  // For GCP custom types, validate the pattern
  if (item.provider === "gcp" && /^custom-\d+-\d+$/.test(recommended)) {
    return { name: "recommended_size_valid", passed: true, message: `Target size "${recommended}" is a valid GCP custom machine type.`, severity: "info" };
  }

  return {
    name: "recommended_size_valid",
    passed: false,
    message: `Target size "${recommended}" is not in the known ${item.provider.toUpperCase()} instance type catalog. Verify it is available in ${item.region}.`,
    severity: "blocker",
  };
}

function checkRegionPresent(item: ExecutionPlanItem): PrecheckDetail {
  if (!item.region || item.region.trim().length === 0) {
    return { name: "region_present", passed: false, message: "No region specified for action.", severity: "blocker" };
  }
  return { name: "region_present", passed: true, message: `Region: ${item.region}`, severity: "info" };
}

function checkAutoscalingConflict(item: ExecutionPlanItem): PrecheckDetail {
  const tags = extractTagsHint(item);
  const asgIndicators = [
    "aws:autoscaling:groupname",
    "autoscaling",
    "instance-group",
    "vmss",
    "scale-set",
    "managed-instance-group",
  ];

  const hasAsg = asgIndicators.some((indicator) =>
    tags.some((t) => t.toLowerCase().includes(indicator)) ||
    item.currentState.toLowerCase().includes(indicator),
  );

  if (hasAsg) {
    return {
      name: "no_autoscaling_conflict",
      passed: false,
      message: "Resource appears to be part of an auto-scaling group. Resizing individual instances will be overridden by the ASG/VMSS/MIG. Resize the launch template or group configuration instead.",
      severity: "blocker",
    };
  }

  return { name: "no_autoscaling_conflict", passed: true, message: "No autoscaling conflict detected.", severity: "info" };
}

function checkBackupWarning(item: ExecutionPlanItem): PrecheckDetail {
  const hasDowntime = item.requiresDowntime || item.provider !== "aws";

  if (hasDowntime && item.riskLevel !== "low") {
    return {
      name: "backup_recommended",
      passed: true,
      message: `Resize requires instance stop (${item.provider === "azure" ? "deallocation" : "stop/start"}). Create a snapshot or AMI/image backup before proceeding — data on instance store volumes will be lost.`,
      severity: "warning",
    };
  }

  return { name: "backup_recommended", passed: true, message: "Low-risk resize — backup recommended but not critical.", severity: "info" };
}

function checkCrossFamilyResize(item: ExecutionPlanItem, recommended: string): PrecheckDetail {
  const current = item.currentState;
  const currentFamily = extractInstanceFamily(current, item.provider);
  const recommendedFamily = extractInstanceFamily(recommended, item.provider);

  if (currentFamily && recommendedFamily && currentFamily !== recommendedFamily) {
    return {
      name: "cross_family_resize",
      passed: true,
      message: `Cross-family resize detected: ${currentFamily} → ${recommendedFamily}. Verify compatibility — ENA/NVMe driver support, EBS optimization, and network bandwidth may differ.`,
      severity: "warning",
    };
  }

  return { name: "cross_family_resize", passed: true, message: "Same instance family — compatible.", severity: "info" };
}

function checkBatchSize(item: ExecutionPlanItem, threshold: number): PrecheckDetail {
  if (item.resourceIds.length > threshold) {
    return {
      name: "batch_size",
      passed: true,
      message: `Large batch: ${item.resourceIds.length} instances. Consider applying in rolling batches of 2-3 to avoid capacity pressure in ${item.region}.`,
      severity: "warning",
    };
  }
  return { name: "batch_size", passed: true, message: `Batch size: ${item.resourceIds.length} instance(s).`, severity: "info" };
}

// ---------------------------------------------------------------------------
// 2. Storage lifecycle prechecks
// ---------------------------------------------------------------------------

function checkStoragePolicy(item: ExecutionPlanItem): PrecheckDetail[] {
  const checks: PrecheckDetail[] = [];

  // ---- Resource IDs exist ----
  checks.push(checkResourceIds(item));

  // ---- Region present ----
  checks.push(checkRegionPresent(item));

  // ---- Bucket/account name format ----
  checks.push(checkStorageNameFormat(item));

  // ---- Lifecycle policy is supported for this provider ----
  checks.push(checkLifecyclePolicySupport(item));

  // ---- Conflicting lifecycle policy warning ----
  checks.push(checkConflictingLifecyclePolicy(item));

  // ---- Versioning/retention warning ----
  checks.push(checkVersioningRetention(item));

  // ---- Object lock / legal hold warning ----
  checks.push(checkObjectLock(item));

  // ---- Replication warning ----
  checks.push(checkReplicationConflict(item));

  return checks;
}

function checkStorageNameFormat(item: ExecutionPlanItem): PrecheckDetail {
  const invalid: string[] = [];

  for (const id of item.resourceIds) {
    switch (item.provider) {
      case "aws":
        // S3 bucket: 3-63 chars, lowercase, numbers, hyphens, dots
        if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/.test(id)) invalid.push(id);
        break;
      case "azure":
        // Storage account: 3-24 chars, lowercase, numbers only
        if (!/^[a-z0-9]{3,24}$/.test(id)) invalid.push(id);
        break;
      case "gcp":
        // GCS bucket: 3-63 chars, lowercase, numbers, hyphens, dots
        if (!/^[a-z0-9][a-z0-9.\-_]{1,61}[a-z0-9]$/.test(id)) invalid.push(id);
        break;
    }
  }

  if (invalid.length > 0) {
    return {
      name: "storage_name_format",
      passed: false,
      message: `${invalid.length} resource name(s) don't match ${item.provider.toUpperCase()} naming rules: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`,
      severity: "blocker",
    };
  }
  return { name: "storage_name_format", passed: true, message: `All storage resource names match ${item.provider.toUpperCase()} format.`, severity: "info" };
}

function checkLifecyclePolicySupport(item: ExecutionPlanItem): PrecheckDetail {
  // All 3 providers support lifecycle policies — this check verifies the recommended state makes sense
  const rec = item.recommendedState.toLowerCase();
  const supported: Record<CloudProvider, string[]> = {
    aws: ["intelligent-tiering", "standard-ia", "glacier", "deep archive"],
    azure: ["cool", "archive", "auto-tiered"],
    gcp: ["nearline", "coldline", "archive", "autoclass"],
  };

  const providerTiers = supported[item.provider];
  const hasSupportedTier = providerTiers.some((tier) => rec.includes(tier));

  if (!hasSupportedTier) {
    return {
      name: "lifecycle_policy_supported",
      passed: true,
      message: `Recommended tiering "${item.recommendedState}" could not be matched to a known ${item.provider.toUpperCase()} storage class. Verify the target tier exists.`,
      severity: "warning",
    };
  }

  return { name: "lifecycle_policy_supported", passed: true, message: `Target storage class is supported by ${item.provider.toUpperCase()}.`, severity: "info" };
}

function checkConflictingLifecyclePolicy(item: ExecutionPlanItem): PrecheckDetail {
  // Conservative: always warn that existing policies may conflict
  return {
    name: "no_conflicting_lifecycle",
    passed: true,
    message: `Verify no existing lifecycle rules on ${item.resourceIds.length} resource(s) that would conflict. Axiom rules use the "axiom-" prefix to avoid collisions, but pre-existing rules with overlapping scope may cause unexpected transitions.`,
    severity: "warning",
  };
}

function checkVersioningRetention(item: ExecutionPlanItem): PrecheckDetail {
  const providerNote: Record<CloudProvider, string> = {
    aws: "If S3 versioning is enabled, noncurrent versions will also be transitioned. If Object Lock retention is active, transitions may be blocked.",
    azure: "If blob versioning or immutability policies are active, lifecycle rules may not apply to protected versions.",
    gcp: "If bucket has a retention policy, objects cannot be deleted or transitioned until the retention period expires.",
  };

  return {
    name: "versioning_retention",
    passed: true,
    message: providerNote[item.provider],
    severity: "warning",
  };
}

function checkObjectLock(item: ExecutionPlanItem): PrecheckDetail {
  const providerNote: Record<CloudProvider, string> = {
    aws: "If S3 Object Lock (governance or compliance mode) is enabled, lifecycle transitions to Glacier may be blocked for locked objects.",
    azure: "If legal hold or time-based retention is active on the container, lifecycle actions will be restricted.",
    gcp: "If bucket-level retention lock is enabled, lifecycle delete actions will fail. Tiering transitions are unaffected.",
  };

  return {
    name: "object_lock_check",
    passed: true,
    message: providerNote[item.provider],
    severity: "warning",
  };
}

function checkReplicationConflict(item: ExecutionPlanItem): PrecheckDetail {
  const providerNote: Record<CloudProvider, string> = {
    aws: "If cross-region replication (CRR) is configured, lifecycle rules on the source bucket do not replicate — apply separately to destination.",
    azure: "If geo-redundant storage (GRS/GZRS) is enabled, lifecycle policies apply only to the primary. Failover copies retain original tier.",
    gcp: "If dual-region or multi-region bucket, lifecycle rules apply globally. No per-location override is possible.",
  };

  return {
    name: "replication_conflict",
    passed: true,
    message: providerNote[item.provider],
    severity: "warning",
  };
}

// ---------------------------------------------------------------------------
// 3. Commitment prechecks (advisory — always pass)
// ---------------------------------------------------------------------------

function checkCommitment(item: ExecutionPlanItem): PrecheckDetail[] {
  return [
    checkResourceIds(item),
    checkRegionPresent(item),
    {
      name: "commitment_advisory",
      passed: true,
      message: "Commitment purchases are manual — no automated precheck required. Verify workload stability for at least 3 months before purchasing.",
      severity: "warning",
    },
    {
      name: "commitment_irreversible",
      passed: true,
      message: "Commitments cannot be cancelled once purchased. They expire at term end.",
      severity: "warning",
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Decommission prechecks (conservative — always warn)
// ---------------------------------------------------------------------------

function checkDecommission(item: ExecutionPlanItem): PrecheckDetail[] {
  const checks: PrecheckDetail[] = [];

  checks.push(checkResourceIds(item));
  checks.push(checkRegionPresent(item));
  checks.push(checkInstanceIdFormat(item));

  checks.push({
    name: "snapshot_before_delete",
    passed: true,
    message: "CRITICAL: Create snapshots of all attached volumes/disks before deleting. Data on ephemeral/instance store volumes cannot be recovered.",
    severity: "warning",
  });

  checks.push({
    name: "dependency_check",
    passed: true,
    message: "Verify no other services, DNS records, load balancers, or security groups reference these instances. Orphaned references can cause routing failures.",
    severity: "warning",
  });

  checks.push({
    name: "decommission_irreversible",
    passed: true,
    message: `Deleting ${item.resourceIds.length} instance(s) is irreversible. Recovery requires restoring from snapshot and re-creating the instance.`,
    severity: "warning",
  });

  return checks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllKnownSizes(provider: CloudProvider): Set<string> {
  const sizes = new Set<string>();
  for (const family of Object.values(INSTANCE_FAMILY_MAP)) {
    const size = family[provider];
    if (size) sizes.add(size);
  }
  // Add common sizes not in the family map
  for (const extra of EXTRA_KNOWN_SIZES[provider] ?? []) {
    sizes.add(extra);
  }
  return sizes;
}

const EXTRA_KNOWN_SIZES: Record<CloudProvider, string[]> = {
  aws: [
    "t3.micro", "t3.small", "t3.medium", "t3.large", "t3.xlarge", "t3.2xlarge",
    "t3a.micro", "t3a.small", "t3a.medium", "t3a.large",
    "m5.large", "m5.xlarge", "m5.2xlarge", "m5.4xlarge", "m5.8xlarge",
    "m6i.large", "m6i.xlarge", "m6i.2xlarge", "m6i.4xlarge",
    "c5.large", "c5.xlarge", "c5.2xlarge", "c5.4xlarge",
    "c6i.large", "c6i.xlarge", "c6i.2xlarge", "c6i.4xlarge",
    "r5.large", "r5.xlarge", "r5.2xlarge", "r5.4xlarge",
    "r6i.large", "r6i.xlarge", "r6i.2xlarge",
  ],
  azure: [
    "Standard_B1s", "Standard_B1ms", "Standard_B2s", "Standard_B2ms", "Standard_B4ms",
    "Standard_D2s_v3", "Standard_D4s_v3", "Standard_D8s_v3", "Standard_D16s_v3",
    "Standard_D2s_v4", "Standard_D4s_v4", "Standard_D8s_v4",
    "Standard_D2s_v5", "Standard_D4s_v5", "Standard_D8s_v5",
    "Standard_E2s_v3", "Standard_E4s_v3", "Standard_E8s_v3",
    "Standard_F2s_v2", "Standard_F4s_v2", "Standard_F8s_v2",
    "Standard_NC6s_v3", "Standard_NC12s_v3",
  ],
  gcp: [
    "e2-micro", "e2-small", "e2-medium", "e2-standard-2", "e2-standard-4", "e2-standard-8",
    "n2-standard-2", "n2-standard-4", "n2-standard-8", "n2-standard-16", "n2-standard-32",
    "n2-highmem-2", "n2-highmem-4", "n2-highmem-8",
    "n1-standard-1", "n1-standard-2", "n1-standard-4", "n1-standard-8",
    "c2-standard-4", "c2-standard-8", "c2-standard-16",
    "a2-highgpu-1g",
  ],
};

function extractInstanceFamily(sizeOrState: string, provider: CloudProvider): string | null {
  switch (provider) {
    case "aws": {
      const match = sizeOrState.match(/\b([a-z]\d[a-z]?)\./);
      return match ? match[1] : null;
    }
    case "azure": {
      const match = sizeOrState.match(/Standard_([A-Z]+)\d/);
      return match ? match[1] : null;
    }
    case "gcp": {
      const match = sizeOrState.match(/\b([a-z]\d)-/);
      return match ? match[1] : null;
    }
  }
}

function extractTagsHint(item: ExecutionPlanItem): string[] {
  // Tags aren't on ExecutionPlanItem, but autoscaling info may be embedded in currentState
  const hints: string[] = [];
  if (item.currentState) hints.push(item.currentState);
  if (item.recommendedState) hints.push(item.recommendedState);
  return hints;
}

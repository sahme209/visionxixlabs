/**
 * CloudSnapshot Normalizer
 *
 * Sits between provider-specific snapshot generators and the Axiom Agent core.
 * Ensures raw provider objects never leak past this boundary, assesses data
 * quality per resource, and attaches provider evidence for debugging.
 *
 * Data flow:
 *   [AWS/Azure/GCP snapshot generator]
 *     → normalizeAwsSnapshot() / normalizeAzureSnapshot() / normalizeGcpSnapshot()
 *       → NormalizedSnapshot (stable schema for agent core)
 */

import type {
  CloudProvider,
  CloudSnapshot,
  CloudResource,
  ComputeResource,
  StorageResource,
} from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Data quality — per-resource and per-snapshot quality assessment
// ---------------------------------------------------------------------------

export type DataQuality =
  | "complete"
  | "partial"
  | "missing_metrics"
  | "estimated_costs";

export type ResourceQuality = {
  quality: DataQuality;
  notes: string[];
};

export type SnapshotDataQuality = {
  overall: DataQuality;
  completenessScore: number; // 0–100
  computeQuality: DataQuality;
  storageQuality: DataQuality;
  metricsAvailability: number; // 0–1, fraction of compute with CPU metrics
  costConfidence: "measured" | "estimated" | "unknown";
};

// ---------------------------------------------------------------------------
// Provider evidence — serializable debugging context, NOT raw SDK objects
// ---------------------------------------------------------------------------

export type ProviderEvidence = {
  provider: CloudProvider;
  collectedAt: string;
  apiCallsSucceeded: string[];
  apiCallsFailed: string[];
  rawResourceCount: { compute: number; storage: number };
  partialErrors: string[];
  enrichment: {
    cpuMetricsAvailable: number;
    cpuMetricsMissing: number;
    storageSizeKnown: number;
    storageSizeMissing: number;
    backupDetected: boolean;
  };
  providerSpecific: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Normalized resource — base resource + quality assessment
// ---------------------------------------------------------------------------

export type NormalizedComputeResource = ComputeResource & {
  dataQuality: ResourceQuality;
};

export type NormalizedStorageResource = StorageResource & {
  dataQuality: ResourceQuality;
};

export type NormalizedResource = NormalizedComputeResource | NormalizedStorageResource;

// ---------------------------------------------------------------------------
// NormalizedSnapshot — the stable contract that agent core consumes
// ---------------------------------------------------------------------------

export type NormalizedSnapshot = {
  provider: CloudProvider;
  accountId: string;
  scannedAt: string;
  regions: string[];
  resources: NormalizedResource[];
  monthlySpend: number;
  flags: {
    singleRegion: boolean;
    noBackupsDetected: boolean;
  };
  insights: Array<{ title: string; severity: string }>;
  dataQuality: SnapshotDataQuality;
  providerEvidence: ProviderEvidence;
};

// ---------------------------------------------------------------------------
// Per-resource quality assessment
// ---------------------------------------------------------------------------

function assessComputeQuality(r: ComputeResource): ResourceQuality {
  const notes: string[] = [];
  let quality: DataQuality = "complete";

  if (r.monthlyCostEstimate === undefined || r.monthlyCostEstimate === null) {
    notes.push("No cost data — estimate unavailable");
    quality = "estimated_costs";
  }

  const hasCpu = r.usage?.cpuAvgPct !== undefined;
  const hasMemory = r.usage?.memoryAvgPct !== undefined;

  if (!hasCpu && !hasMemory) {
    notes.push("No CPU or memory metrics — right-sizing confidence is low");
    quality = "missing_metrics";
  } else if (!hasCpu) {
    notes.push("CPU metrics missing — only memory data available");
    if (quality === "complete") quality = "partial";
  } else if (!hasMemory) {
    notes.push("Memory metrics missing — common on AWS without CloudWatch Agent");
    if (quality === "complete") quality = "partial";
  }

  if (r.state === "unknown") {
    notes.push("Instance state unknown — API may not have returned power status");
    if (quality === "complete") quality = "partial";
  }

  if (r.tier === "unknown") {
    notes.push("Instance tier could not be classified — custom or unrecognized machine type");
    if (quality === "complete") quality = "partial";
  }

  if (notes.length === 0) notes.push("All fields populated");

  return { quality, notes };
}

function assessStorageQuality(r: StorageResource): ResourceQuality {
  const notes: string[] = [];
  let quality: DataQuality = "complete";

  if (r.monthlyCostEstimate === undefined || r.monthlyCostEstimate === null) {
    notes.push("No cost data — using static estimate");
    quality = "estimated_costs";
  }

  if (r.sizeGb === undefined || r.sizeGb === null) {
    notes.push("Bucket/container size unknown — object listing may require additional permissions");
    if (quality === "complete") quality = "partial";
  }

  if (r.objectCount === undefined || r.objectCount === null) {
    notes.push("Object count unknown");
    if (quality === "complete") quality = "partial";
  }

  if (r.lastAccessedDaysAgo === undefined || r.lastAccessedDaysAgo === null) {
    notes.push("Last access date unknown — tiering recommendations will be conservative");
    if (quality === "complete") quality = "partial";
  }

  if (r.storageClass === "unknown") {
    notes.push("Storage class could not be determined");
    if (quality === "complete") quality = "partial";
  }

  if (notes.length === 0) notes.push("All fields populated");

  return { quality, notes };
}

function assessResourceQuality(r: CloudResource): ResourceQuality {
  if (r.resourceType === "compute") return assessComputeQuality(r);
  return assessStorageQuality(r);
}

// ---------------------------------------------------------------------------
// Snapshot-level quality rollup
// ---------------------------------------------------------------------------

function rollupQuality(
  resources: NormalizedResource[],
  hasRealCosts: boolean,
): SnapshotDataQuality {
  const compute = resources.filter(
    (r): r is NormalizedComputeResource => r.resourceType === "compute",
  );
  const storage = resources.filter(
    (r): r is NormalizedStorageResource => r.resourceType === "storage",
  );

  const computeWithCpu = compute.filter((c) => c.usage?.cpuAvgPct !== undefined).length;
  const metricsAvailability = compute.length > 0 ? computeWithCpu / compute.length : 1;

  const computeQuality = worstQuality(compute.map((c) => c.dataQuality.quality));
  const storageQuality = worstQuality(storage.map((s) => s.dataQuality.quality));

  const allQualities = resources.map((r) => r.dataQuality.quality);
  const overall = worstQuality(allQualities);

  let score = 100;
  const incomplete = allQualities.filter((q) => q !== "complete").length;
  if (allQualities.length > 0) {
    score = Math.round(((allQualities.length - incomplete) / allQualities.length) * 100);
  }

  return {
    overall,
    completenessScore: score,
    computeQuality,
    storageQuality,
    metricsAvailability: Math.round(metricsAvailability * 100) / 100,
    costConfidence: hasRealCosts ? "measured" : "estimated",
  };
}

const QUALITY_RANK: Record<DataQuality, number> = {
  complete: 0,
  partial: 1,
  estimated_costs: 2,
  missing_metrics: 3,
};

function worstQuality(qualities: DataQuality[]): DataQuality {
  if (qualities.length === 0) return "complete";
  let worst: DataQuality = "complete";
  for (const q of qualities) {
    if (QUALITY_RANK[q] > QUALITY_RANK[worst]) worst = q;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Normalize resources — strips any extra fields, attaches quality
// ---------------------------------------------------------------------------

function normalizeComputeResource(raw: ComputeResource, provider: CloudProvider): NormalizedComputeResource {
  const clean: ComputeResource = {
    resourceType: "compute",
    provider,
    resourceId: raw.resourceId,
    region: raw.region,
    instanceType: raw.instanceType,
    tier: raw.tier,
    vcpus: raw.vcpus,
    memoryGb: raw.memoryGb,
    state: raw.state,
    monthlyCostEstimate: raw.monthlyCostEstimate,
    ...(raw.usage && { usage: { ...raw.usage } }),
    ...(raw.tags && { tags: { ...raw.tags } }),
  };

  return { ...clean, dataQuality: assessComputeQuality(clean) };
}

function normalizeStorageResource(raw: StorageResource, provider: CloudProvider): NormalizedStorageResource {
  const clean: StorageResource = {
    resourceType: "storage",
    provider,
    resourceId: raw.resourceId,
    region: raw.region,
    storageClass: raw.storageClass,
    monthlyCostEstimate: raw.monthlyCostEstimate,
    ...(raw.sizeGb !== undefined && { sizeGb: raw.sizeGb }),
    ...(raw.objectCount !== undefined && { objectCount: raw.objectCount }),
    ...(raw.lastAccessedDaysAgo !== undefined && { lastAccessedDaysAgo: raw.lastAccessedDaysAgo }),
    ...(raw.tags && { tags: { ...raw.tags } }),
  };

  return { ...clean, dataQuality: assessStorageQuality(clean) };
}

function normalizeResource(raw: CloudResource, provider: CloudProvider): NormalizedResource {
  if (raw.resourceType === "compute") return normalizeComputeResource(raw, provider);
  return normalizeStorageResource(raw, provider);
}

// ---------------------------------------------------------------------------
// AWS normalizer
// ---------------------------------------------------------------------------

export type AwsSnapshotInput = CloudSnapshot & {
  partialErrors?: string[];
};

export function normalizeAwsSnapshot(raw: AwsSnapshotInput): NormalizedSnapshot {
  const resources = raw.resources.map((r) => normalizeResource(r, "aws"));

  const compute = resources.filter((r) => r.resourceType === "compute");
  const storage = resources.filter((r) => r.resourceType === "storage");
  const computeWithCpu = compute.filter(
    (r) => r.resourceType === "compute" && r.usage?.cpuAvgPct !== undefined,
  ).length;

  const apiSucceeded: string[] = ["ec2:DescribeInstances", "s3:ListBuckets"];
  const apiFailed: string[] = [];

  if (computeWithCpu > 0) apiSucceeded.push("cloudwatch:GetMetricStatistics");
  else if (compute.length > 0) apiFailed.push("cloudwatch:GetMetricStatistics");

  const evidence: ProviderEvidence = {
    provider: "aws",
    collectedAt: raw.scannedAt,
    apiCallsSucceeded: apiSucceeded,
    apiCallsFailed: apiFailed,
    rawResourceCount: { compute: compute.length, storage: storage.length },
    partialErrors: raw.partialErrors ?? [],
    enrichment: {
      cpuMetricsAvailable: computeWithCpu,
      cpuMetricsMissing: compute.length - computeWithCpu,
      storageSizeKnown: storage.filter((s) => s.resourceType === "storage" && s.sizeGb !== undefined).length,
      storageSizeMissing: storage.filter((s) => s.resourceType === "storage" && s.sizeGb === undefined).length,
      backupDetected: !raw.flags.noBackupsDetected,
    },
    providerSpecific: {
      accountId: raw.accountId,
      regionCount: raw.regions.length,
    },
  };

  return {
    provider: "aws",
    accountId: raw.accountId,
    scannedAt: raw.scannedAt,
    regions: [...raw.regions],
    resources,
    monthlySpend: raw.monthlySpend ?? 0,
    flags: { ...raw.flags },
    insights: [...(raw.insights ?? [])],
    dataQuality: rollupQuality(resources, raw.monthlySpend !== undefined),
    providerEvidence: evidence,
  };
}

// ---------------------------------------------------------------------------
// Azure normalizer
// ---------------------------------------------------------------------------

export type AzureResourceGroupInput = {
  name: string;
  location: string;
  provisioningState: string;
  tags?: Record<string, string>;
};

export type AzureBlobContainerInput = {
  name: string;
  publicAccess: string;
  lastModified: string | null;
};

export type AzureSnapshotInput = CloudSnapshot & {
  resourceGroups?: AzureResourceGroupInput[];
  blobContainers?: Record<string, AzureBlobContainerInput[]>;
  partialErrors?: string[];
};

export function normalizeAzureSnapshot(raw: AzureSnapshotInput): NormalizedSnapshot {
  const resources = raw.resources.map((r) => normalizeResource(r, "azure"));

  const compute = resources.filter((r) => r.resourceType === "compute");
  const storage = resources.filter((r) => r.resourceType === "storage");
  const computeWithCpu = compute.filter(
    (r) => r.resourceType === "compute" && r.usage?.cpuAvgPct !== undefined,
  ).length;

  const apiSucceeded: string[] = [];
  const apiFailed: string[] = [];

  if (compute.length > 0) apiSucceeded.push("Microsoft.Compute/virtualMachines/read");
  else apiFailed.push("Microsoft.Compute/virtualMachines/read");

  if (storage.length > 0) apiSucceeded.push("Microsoft.Storage/storageAccounts/read");
  else apiFailed.push("Microsoft.Storage/storageAccounts/read");

  if (raw.resourceGroups && raw.resourceGroups.length > 0) {
    apiSucceeded.push("Microsoft.Resources/subscriptions/resourceGroups/read");
  }

  if (computeWithCpu > 0) apiSucceeded.push("Microsoft.Insights/metrics/read");
  else if (compute.length > 0) apiFailed.push("Microsoft.Insights/metrics/read");

  if (raw.blobContainers && Object.keys(raw.blobContainers).length > 0) {
    apiSucceeded.push("Microsoft.Storage/storageAccounts/blobServices/containers/read");
  }

  const totalContainers = raw.blobContainers
    ? Object.values(raw.blobContainers).reduce((s, c) => s + c.length, 0)
    : 0;

  const evidence: ProviderEvidence = {
    provider: "azure",
    collectedAt: raw.scannedAt,
    apiCallsSucceeded: apiSucceeded,
    apiCallsFailed: apiFailed,
    rawResourceCount: { compute: compute.length, storage: storage.length },
    partialErrors: raw.partialErrors ?? [],
    enrichment: {
      cpuMetricsAvailable: computeWithCpu,
      cpuMetricsMissing: compute.length - computeWithCpu,
      storageSizeKnown: storage.filter((s) => s.resourceType === "storage" && s.sizeGb !== undefined).length,
      storageSizeMissing: storage.filter((s) => s.resourceType === "storage" && s.sizeGb === undefined).length,
      backupDetected: !raw.flags.noBackupsDetected,
    },
    providerSpecific: {
      subscriptionId: raw.accountId,
      resourceGroupCount: raw.resourceGroups?.length ?? 0,
      blobContainerCount: totalContainers,
    },
  };

  return {
    provider: "azure",
    accountId: raw.accountId,
    scannedAt: raw.scannedAt,
    regions: [...raw.regions],
    resources,
    monthlySpend: raw.monthlySpend ?? 0,
    flags: { ...raw.flags },
    insights: [...(raw.insights ?? [])],
    dataQuality: rollupQuality(resources, raw.monthlySpend !== undefined),
    providerEvidence: evidence,
  };
}

// ---------------------------------------------------------------------------
// GCP normalizer
// ---------------------------------------------------------------------------

export type GcpBucketMetadataInput = {
  name: string;
  location: string;
  storageClass: string;
  objectCount: number | null;
  totalSizeBytes: number | null;
  lifecycleRules: number;
  publicAccessPrevention: string;
  versioningEnabled: boolean;
};

export type GcpSnapshotInput = CloudSnapshot & {
  bucketMetadata?: GcpBucketMetadataInput[];
  partialErrors?: string[];
};

export function normalizeGcpSnapshot(raw: GcpSnapshotInput): NormalizedSnapshot {
  const resources = raw.resources.map((r) => normalizeResource(r, "gcp"));

  const compute = resources.filter((r) => r.resourceType === "compute");
  const storage = resources.filter((r) => r.resourceType === "storage");
  const computeWithCpu = compute.filter(
    (r) => r.resourceType === "compute" && r.usage?.cpuAvgPct !== undefined,
  ).length;

  const apiSucceeded: string[] = [];
  const apiFailed: string[] = [];

  if (compute.length > 0) apiSucceeded.push("compute.instances.aggregatedList");
  else apiFailed.push("compute.instances.aggregatedList");

  if (storage.length > 0) apiSucceeded.push("storage.buckets.list");
  else apiFailed.push("storage.buckets.list");

  if (computeWithCpu > 0) apiSucceeded.push("monitoring.timeSeries.list");
  else if (compute.length > 0) apiFailed.push("monitoring.timeSeries.list");

  if (raw.bucketMetadata && raw.bucketMetadata.length > 0) {
    apiSucceeded.push("storage.buckets.get");
    const withObjects = raw.bucketMetadata.filter((b) => b.objectCount !== null).length;
    if (withObjects > 0) apiSucceeded.push("storage.objects.list");
  }

  const bucketsWithLifecycle = (raw.bucketMetadata ?? []).filter((b) => b.lifecycleRules > 0).length;
  const bucketsWithVersioning = (raw.bucketMetadata ?? []).filter((b) => b.versioningEnabled).length;

  const evidence: ProviderEvidence = {
    provider: "gcp",
    collectedAt: raw.scannedAt,
    apiCallsSucceeded: apiSucceeded,
    apiCallsFailed: apiFailed,
    rawResourceCount: { compute: compute.length, storage: storage.length },
    partialErrors: raw.partialErrors ?? [],
    enrichment: {
      cpuMetricsAvailable: computeWithCpu,
      cpuMetricsMissing: compute.length - computeWithCpu,
      storageSizeKnown: storage.filter((s) => s.resourceType === "storage" && s.sizeGb !== undefined).length,
      storageSizeMissing: storage.filter((s) => s.resourceType === "storage" && s.sizeGb === undefined).length,
      backupDetected: !raw.flags.noBackupsDetected,
    },
    providerSpecific: {
      projectId: raw.accountId,
      bucketMetadataCount: raw.bucketMetadata?.length ?? 0,
      bucketsWithLifecycle,
      bucketsWithVersioning,
    },
  };

  return {
    provider: "gcp",
    accountId: raw.accountId,
    scannedAt: raw.scannedAt,
    regions: [...raw.regions],
    resources,
    monthlySpend: raw.monthlySpend ?? 0,
    flags: { ...raw.flags },
    insights: [...(raw.insights ?? [])],
    dataQuality: rollupQuality(resources, raw.monthlySpend !== undefined),
    providerEvidence: evidence,
  };
}

// ---------------------------------------------------------------------------
// Universal entry point — dispatches by provider field
// ---------------------------------------------------------------------------

export function normalizeSnapshot(
  raw: AwsSnapshotInput | AzureSnapshotInput | GcpSnapshotInput,
): NormalizedSnapshot {
  switch (raw.provider) {
    case "aws":   return normalizeAwsSnapshot(raw as AwsSnapshotInput);
    case "azure": return normalizeAzureSnapshot(raw as AzureSnapshotInput);
    case "gcp":   return normalizeGcpSnapshot(raw as GcpSnapshotInput);
  }
}

/**
 * GCP Snapshot Generator — produces a CloudSnapshot from Compute Engine & Cloud Storage.
 * Uses existing credential system and @google-cloud packages already installed.
 *
 * Required IAM roles (minimum):
 *   - roles/compute.viewer      (compute.instances.list, compute.zones.list)
 *   - roles/storage.objectViewer (storage.buckets.list, storage.buckets.get)
 *   - roles/monitoring.viewer    (monitoring.timeSeries.list — for CPU metrics)
 *
 * No BigQuery billing export needed — uses static machine type pricing map.
 */

import { InstancesClient } from "@google-cloud/compute";
import { Storage } from "@google-cloud/storage";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";
import type {
  CloudSnapshot,
  ComputeResource,
  ComputeTier,
  StorageResource,
  StorageClass,
} from "@/lib/axiom/cloudSnapshot";

// ---------------------------------------------------------------------------
// Static cost map — conservative monthly USD estimates for common machine types.
// Source: GCP pricing calculator (on-demand, us-central1, standard tier).
// Updated: 2026-Q2. Pro uses real billing for accuracy.
// ---------------------------------------------------------------------------

const MACHINE_COST_MAP: Record<string, { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier }> = {
  // N2 general-purpose
  "n2-standard-2":  { monthlyCost: 69,   vcpus: 2,  memoryGb: 8,   tier: "general" },
  "n2-standard-4":  { monthlyCost: 138,  vcpus: 4,  memoryGb: 16,  tier: "general" },
  "n2-standard-8":  { monthlyCost: 276,  vcpus: 8,  memoryGb: 32,  tier: "general" },
  "n2-standard-16": { monthlyCost: 553,  vcpus: 16, memoryGb: 64,  tier: "general" },
  "n2-standard-32": { monthlyCost: 1106, vcpus: 32, memoryGb: 128, tier: "general" },
  // N1 general-purpose (legacy, still common)
  "n1-standard-1":  { monthlyCost: 24,   vcpus: 1,  memoryGb: 3.75, tier: "general" },
  "n1-standard-2":  { monthlyCost: 49,   vcpus: 2,  memoryGb: 7.5,  tier: "general" },
  "n1-standard-4":  { monthlyCost: 97,   vcpus: 4,  memoryGb: 15,   tier: "general" },
  "n1-standard-8":  { monthlyCost: 194,  vcpus: 8,  memoryGb: 30,   tier: "general" },
  "n1-standard-16": { monthlyCost: 389,  vcpus: 16, memoryGb: 60,   tier: "general" },
  // E2 cost-optimized
  "e2-micro":       { monthlyCost: 6,    vcpus: 2,  memoryGb: 1,   tier: "general" },
  "e2-small":       { monthlyCost: 12,   vcpus: 2,  memoryGb: 2,   tier: "general" },
  "e2-medium":      { monthlyCost: 24,   vcpus: 2,  memoryGb: 4,   tier: "general" },
  "e2-standard-2":  { monthlyCost: 49,   vcpus: 2,  memoryGb: 8,   tier: "general" },
  "e2-standard-4":  { monthlyCost: 97,   vcpus: 4,  memoryGb: 16,  tier: "general" },
  "e2-standard-8":  { monthlyCost: 194,  vcpus: 8,  memoryGb: 32,  tier: "general" },
  // C2 compute-optimized
  "c2-standard-4":  { monthlyCost: 125,  vcpus: 4,  memoryGb: 16,  tier: "compute" },
  "c2-standard-8":  { monthlyCost: 250,  vcpus: 8,  memoryGb: 32,  tier: "compute" },
  "c2-standard-16": { monthlyCost: 501,  vcpus: 16, memoryGb: 64,  tier: "compute" },
  // N2 high-mem
  "n2-highmem-2":   { monthlyCost: 91,   vcpus: 2,  memoryGb: 16,  tier: "memory" },
  "n2-highmem-4":   { monthlyCost: 183,  vcpus: 4,  memoryGb: 32,  tier: "memory" },
  "n2-highmem-8":   { monthlyCost: 365,  vcpus: 8,  memoryGb: 64,  tier: "memory" },
  "n2-highmem-16":  { monthlyCost: 730,  vcpus: 16, memoryGb: 128, tier: "memory" },
  // N1 high-mem (legacy)
  "n1-highmem-2":   { monthlyCost: 66,   vcpus: 2,  memoryGb: 13,  tier: "memory" },
  "n1-highmem-4":   { monthlyCost: 131,  vcpus: 4,  memoryGb: 26,  tier: "memory" },
  "n1-highmem-8":   { monthlyCost: 262,  vcpus: 8,  memoryGb: 52,  tier: "memory" },
  "n1-highmem-16":  { monthlyCost: 524,  vcpus: 16, memoryGb: 104, tier: "memory" },
  // A2 GPU
  "a2-highgpu-1g":  { monthlyCost: 2430, vcpus: 12, memoryGb: 85,  tier: "gpu" },
};

const FALLBACK_COST_PER_VCPU = 34;

const AVG_BUCKET_MONTHLY = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRegion(zone: string): string {
  // "us-central1-a" → "us-central1"
  return zone.replace(/-[a-z]$/, "");
}

function lookupMachineType(machineType: string): { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier } {
  // machineType from API is a URL like "zones/us-central1-a/machineTypes/n2-standard-4"
  const shortName = machineType.includes("/") ? machineType.split("/").pop()! : machineType;
  const key = shortName.toLowerCase();
  if (MACHINE_COST_MAP[key]) return MACHINE_COST_MAP[key];

  // Parse custom machine types: "custom-4-16384" = 4 vCPUs, 16GB
  const customMatch = key.match(/custom-(\d+)-(\d+)/);
  if (customMatch) {
    const vcpus = parseInt(customMatch[1], 10);
    const memGb = Math.round(parseInt(customMatch[2], 10) / 1024);
    return {
      monthlyCost: vcpus * FALLBACK_COST_PER_VCPU,
      vcpus,
      memoryGb: memGb,
      tier: "general",
    };
  }

  // Fallback: extract vCPU count from name
  const vcpuMatch = key.match(/(\d+)$/);
  const guessVcpus = vcpuMatch ? parseInt(vcpuMatch[1], 10) : 2;
  return {
    monthlyCost: guessVcpus * FALLBACK_COST_PER_VCPU,
    vcpus: guessVcpus,
    memoryGb: guessVcpus * 4,
    tier: "unknown",
  };
}

function mapInstanceStatus(status: string | undefined | null): ComputeResource["state"] {
  switch (status?.toUpperCase()) {
    case "RUNNING": return "running";
    case "TERMINATED":
    case "STOPPED": return "stopped";
    case "SUSPENDED": return "stopped";
    default: return "unknown";
  }
}

function mapStorageClass(storageClass: string | undefined): StorageClass {
  switch (storageClass?.toUpperCase()) {
    case "STANDARD": return "standard";
    case "NEARLINE": return "infrequent";
    case "COLDLINE":
    case "ARCHIVE": return "archive";
    case "AUTOCLASS": return "intelligent";
    default: return "standard";
  }
}

// ---------------------------------------------------------------------------
// CPU metrics via Cloud Monitoring REST (avoids @google-cloud/monitoring dep)
// ---------------------------------------------------------------------------

async function fetchCpuMetrics(
  credentials: { client_email: string; private_key: string },
  projectId: string,
): Promise<Map<string, number>> {
  const cpuMap = new Map<string, number>();

  // Build a JWT to call monitoring API directly
  let accessToken: string;
  try {
    accessToken = await getAccessToken(credentials);
  } catch {
    return cpuMap;
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const filter = encodeURIComponent(
    'metric.type="compute.googleapis.com/instance/cpu/utilization"'
  );
  const interval = `interval.startTime=${weekAgo.toISOString()}&interval.endTime=${now.toISOString()}`;
  const url =
    `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries` +
    `?filter=${filter}&${interval}&aggregation.alignmentPeriod=86400s` +
    `&aggregation.perSeriesAligner=ALIGN_MEAN&aggregation.crossSeriesReducer=REDUCE_NONE`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return cpuMap;

    const data = await res.json();
    const timeSeries = data.timeSeries as Array<{
      resource?: { labels?: { instance_id?: string } };
      metric?: { labels?: Record<string, string> };
      points?: Array<{ value?: { doubleValue?: number } }>;
    }> | undefined;

    if (!timeSeries) return cpuMap;

    for (const series of timeSeries) {
      const instanceId = series.resource?.labels?.instance_id;
      if (!instanceId || !series.points?.length) continue;
      const avg = series.points.reduce((s, p) => s + (p.value?.doubleValue ?? 0), 0) / series.points.length;
      cpuMap.set(instanceId, Math.round(avg * 1000) / 10); // utilization is 0-1, convert to 0-100
    }
  } catch { /* best-effort */ }

  return cpuMap;
}

async function getAccessToken(
  credentials: { client_email: string; private_key: string },
): Promise<string> {
  // Use google-auth-library style JWT — but since we already have @google-cloud/compute
  // which bundles auth, we can use a lightweight approach via the Storage client
  const storage = new Storage({ credentials });
  const authClient = storage.authClient;
  const token = await (authClient as { getAccessToken(): Promise<{ token?: string | null }> }).getAccessToken();
  if (!token?.token) throw new Error("Failed to get access token");
  return token.token;
}

// ---------------------------------------------------------------------------
// Check for snapshots (backup detection)
// ---------------------------------------------------------------------------

async function hasSnapshots(
  credentials: { client_email: string; private_key: string },
  projectId: string,
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials);
    const res = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregated/snapshots?maxResults=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return false;
    const data = await res.json();
    const items = data.items as Record<string, { snapshots?: unknown[] }> | undefined;
    if (!items) return false;
    return Object.values(items).some((scoped) => (scoped.snapshots?.length ?? 0) > 0);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main: generate CloudSnapshot
// ---------------------------------------------------------------------------

type GCPInstance = {
  name?: string | null;
  id?: string | null;
  zone?: string | null;
  machineType?: string | null;
  status?: string | null;
  labels?: Record<string, string> | null;
};

export async function generateGCPSnapshot(
  credentials: { client_email: string; private_key: string },
  projectId: string,
): Promise<CloudSnapshot> {
  const instancesClient = new InstancesClient({ credentials });
  const storage = new Storage({ credentials, projectId });

  // Collect all instances across zones
  const instances: GCPInstance[] = [];
  for await (const [, scopedList] of instancesClient.aggregatedListAsync({ project: projectId })) {
    if (scopedList.instances) {
      for (const inst of scopedList.instances) {
        instances.push(inst as GCPInstance);
      }
    }
  }

  const [buckets] = await storage.getBuckets({ project: projectId });

  // Map instances to ComputeResource
  const computeResources: ComputeResource[] = instances.map((inst) => {
    const zone = inst.zone?.split("/").pop() ?? "unknown";
    const region = normalizeRegion(zone);
    const machineType = inst.machineType ?? "n1-standard-2";
    const lookup = lookupMachineType(machineType);
    const state = mapInstanceStatus(inst.status);

    return {
      resourceType: "compute" as const,
      provider: "gcp" as const,
      resourceId: inst.name ?? inst.id?.toString() ?? "unknown",
      region,
      instanceType: machineType.includes("/") ? machineType.split("/").pop()! : machineType,
      tier: lookup.tier,
      vcpus: lookup.vcpus,
      memoryGb: lookup.memoryGb,
      state,
      monthlyCostEstimate: state === "stopped" ? 0 : lookup.monthlyCost,
      tags: inst.labels
        ? Object.fromEntries(Object.entries(inst.labels).filter((e): e is [string, string] => e[1] != null))
        : undefined,
    };
  });

  // Map buckets to StorageResource
  const storageResources: StorageResource[] = (buckets ?? []).map((bucket) => {
    const meta = bucket.metadata;
    return {
      resourceType: "storage" as const,
      provider: "gcp" as const,
      resourceId: bucket.name,
      region: (meta.location ?? "us").toLowerCase(),
      storageClass: mapStorageClass(meta.storageClass),
      monthlyCostEstimate: AVG_BUCKET_MONTHLY,
      tags: meta.labels
        ? Object.fromEntries(Object.entries(meta.labels).filter((e): e is [string, string] => e[1] != null))
        : undefined,
    };
  });

  // Fetch CPU metrics + backup status in parallel
  const [cpuMetrics, backupsExist] = await Promise.all([
    fetchCpuMetrics(credentials, projectId),
    hasSnapshots(credentials, projectId),
  ]);

  // Enrich compute resources with CPU data
  // Monitoring API uses instance ID (numeric), match by iterating
  for (const cr of computeResources) {
    const inst = instances.find((i) => (i.name ?? "") === cr.resourceId);
    const instanceId = inst?.id?.toString();
    if (instanceId) {
      const cpu = cpuMetrics.get(instanceId);
      if (cpu !== undefined) {
        cr.usage = { cpuAvgPct: cpu, sampleWindowHours: 168 };
      }
    }
  }

  const allResources = [...computeResources, ...storageResources];
  const regions = [...new Set(allResources.map((r) => r.region))];
  const runningCompute = computeResources.filter((c) => c.state === "running");
  const totalMonthly = allResources.reduce((s, r) => s + (r.monthlyCostEstimate ?? 0), 0);

  return {
    provider: "gcp",
    accountId: projectId,
    scannedAt: new Date().toISOString(),
    regions,
    resources: allResources,
    monthlySpend: Math.round(totalMonthly),
    flags: {
      singleRegion: regions.length <= 1 && runningCompute.length > 0,
      noBackupsDetected: !backupsExist,
    },
    insights: buildInsights(computeResources, storageResources, cpuMetrics, backupsExist),
  };
}

function buildInsights(
  compute: ComputeResource[],
  storage: StorageResource[],
  cpuMetrics: Map<string, number>,
  hasBackups: boolean,
): Array<{ title: string; severity: string }> {
  const insights: Array<{ title: string; severity: string }> = [];

  const underUtilized = compute.filter((c) => {
    return c.usage?.cpuAvgPct !== undefined && c.usage.cpuAvgPct < 15 && c.state === "running";
  });
  if (underUtilized.length > 0) {
    insights.push({ title: `${underUtilized.length} instance(s) under 15% avg CPU — right-sizing candidates`, severity: "warning" });
  }

  const stopped = compute.filter((c) => c.state === "stopped");
  if (stopped.length > 0) {
    insights.push({ title: `${stopped.length} stopped instance(s) — persistent disks still billing`, severity: "info" });
  }

  const n1Instances = compute.filter((c) => c.instanceType.startsWith("n1-") && c.state === "running");
  if (n1Instances.length > 0) {
    insights.push({ title: `${n1Instances.length} N1-series instance(s) — consider migrating to N2/E2 for better price-performance`, severity: "info" });
  }

  const standardBuckets = storage.filter((s) => s.storageClass === "standard");
  if (standardBuckets.length > 3) {
    insights.push({ title: `${standardBuckets.length} buckets on Standard class — review for Nearline/Autoclass`, severity: "warning" });
  }

  if (!hasBackups) {
    insights.push({ title: "No Compute Engine snapshots detected — no backup strategy in place", severity: "critical" });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Execution plugin registration
// ---------------------------------------------------------------------------

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("gcp:snapshot-generator started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Snapshot generator is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const gcpCreds = await getCredentialProvider().getGCPCredentials(ctx.userId, ctx.credentialsKey);
  if (!gcpCreds) {
    return {
      ok: false,
      error: "GCP connector not linked or validated. Connect your GCP account in Connectors first.",
      summary: "GCP connector required.",
    };
  }

  try {
    const snapshot = await generateGCPSnapshot(gcpCreds.credentials, gcpCreds.projectId);

    const instanceCount = snapshot.resources.filter((r) => r.resourceType === "compute").length;
    const bucketCount = snapshot.resources.filter((r) => r.resourceType === "storage").length;
    const summary = `GCP snapshot: ${instanceCount} instances, ${bucketCount} buckets, ${snapshot.regions.length} region(s), ~$${snapshot.monthlySpend}/mo estimated`;

    logger.info("gcp:snapshot-generator completed", { instanceCount, bucketCount, regions: snapshot.regions.length });

    return {
      ok: true,
      data: snapshot as unknown as Record<string, unknown>,
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("gcp:snapshot-generator failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "GCP snapshot generation failed",
    };
  }
}

registerExecutionPlugin({
  id: "gcp:snapshot-generator",
  name: "GCP Snapshot Generator",
  description: "Generate normalized CloudSnapshot from Compute Engine instances and Cloud Storage buckets. Read-only.",
  scopesRequired: ["cloud:gcp", "cloud:read"],
  readOnly: true,
  run,
});

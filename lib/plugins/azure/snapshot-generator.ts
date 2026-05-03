/**
 * Azure Snapshot Generator — produces a CloudSnapshot from Azure resources.
 * Uses existing credential system and Azure SDK packages already installed.
 *
 * Required RBAC roles (minimum):
 *   - Reader on the subscription (Microsoft.Compute/virtualMachines/read,
 *     Microsoft.Storage/storageAccounts/read, Microsoft.RecoveryServices/vaults/read)
 *   - Monitoring Reader for CPU/memory metrics (Microsoft.Insights/metrics/read)
 *
 * No billing integration needed — uses static cost map for estimates.
 */

import { ComputeManagementClient } from "@azure/arm-compute";
import { StorageManagementClient } from "@azure/arm-storage";
import type { VirtualMachine } from "@azure/arm-compute";
import type { StorageAccount } from "@azure/arm-storage";
import type { TokenCredential } from "@azure/identity";
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
// Static cost map — conservative monthly USD estimates for common VM sizes.
// Source: Azure pricing calculator (pay-as-you-go, Linux, US regions).
// Updated: 2026-Q2. Good enough for signal derivation; Pro uses real billing.
// ---------------------------------------------------------------------------

const VM_COST_MAP: Record<string, { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier }> = {
  // General purpose — Dv3/Dv4/Dv5
  "standard_d2s_v3":  { monthlyCost: 70,  vcpus: 2,  memoryGb: 8,   tier: "general" },
  "standard_d4s_v3":  { monthlyCost: 140, vcpus: 4,  memoryGb: 16,  tier: "general" },
  "standard_d8s_v3":  { monthlyCost: 280, vcpus: 8,  memoryGb: 32,  tier: "general" },
  "standard_d16s_v3": { monthlyCost: 560, vcpus: 16, memoryGb: 64,  tier: "general" },
  "standard_d2s_v4":  { monthlyCost: 70,  vcpus: 2,  memoryGb: 8,   tier: "general" },
  "standard_d4s_v4":  { monthlyCost: 140, vcpus: 4,  memoryGb: 16,  tier: "general" },
  "standard_d8s_v4":  { monthlyCost: 281, vcpus: 8,  memoryGb: 32,  tier: "general" },
  "standard_d16s_v4": { monthlyCost: 562, vcpus: 16, memoryGb: 64,  tier: "general" },
  "standard_d2s_v5":  { monthlyCost: 70,  vcpus: 2,  memoryGb: 8,   tier: "general" },
  "standard_d4s_v5":  { monthlyCost: 140, vcpus: 4,  memoryGb: 16,  tier: "general" },
  "standard_d8s_v5":  { monthlyCost: 281, vcpus: 8,  memoryGb: 32,  tier: "general" },
  // B-series (burstable)
  "standard_b1s":     { monthlyCost: 8,   vcpus: 1,  memoryGb: 1,   tier: "general" },
  "standard_b2s":     { monthlyCost: 30,  vcpus: 2,  memoryGb: 4,   tier: "general" },
  "standard_b4ms":    { monthlyCost: 120, vcpus: 4,  memoryGb: 16,  tier: "general" },
  // Compute optimized — Fv2
  "standard_f2s_v2":  { monthlyCost: 62,  vcpus: 2,  memoryGb: 4,   tier: "compute" },
  "standard_f4s_v2":  { monthlyCost: 124, vcpus: 4,  memoryGb: 8,   tier: "compute" },
  "standard_f8s_v2":  { monthlyCost: 247, vcpus: 8,  memoryGb: 16,  tier: "compute" },
  "standard_f16s_v2": { monthlyCost: 494, vcpus: 16, memoryGb: 32,  tier: "compute" },
  // Memory optimized — Ev3/Ev4
  "standard_e2s_v3":  { monthlyCost: 91,  vcpus: 2,  memoryGb: 16,  tier: "memory" },
  "standard_e4s_v3":  { monthlyCost: 183, vcpus: 4,  memoryGb: 32,  tier: "memory" },
  "standard_e8s_v3":  { monthlyCost: 365, vcpus: 8,  memoryGb: 64,  tier: "memory" },
  "standard_e16s_v3": { monthlyCost: 730, vcpus: 16, memoryGb: 128, tier: "memory" },
  // GPU — NC series
  "standard_nc6s_v3": { monthlyCost: 2190, vcpus: 6, memoryGb: 112, tier: "gpu" },
};

const FALLBACK_COST_PER_VCPU = 35;

const AVG_STORAGE_ACCOUNT_MONTHLY = 25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function mapVmState(statuses: Array<{ code?: string }> | undefined): ComputeResource["state"] {
  if (!statuses) return "unknown";
  for (const s of statuses) {
    if (s.code === "PowerState/running") return "running";
    if (s.code === "PowerState/deallocated") return "deallocated";
    if (s.code === "PowerState/stopped") return "stopped";
  }
  return "unknown";
}

function lookupVmSize(size: string): { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier } {
  const key = size.toLowerCase();
  if (VM_COST_MAP[key]) return VM_COST_MAP[key];
  const vcpuMatch = key.match(/(\d+)/);
  const guessVcpus = vcpuMatch ? parseInt(vcpuMatch[1], 10) : 2;
  return {
    monthlyCost: guessVcpus * FALLBACK_COST_PER_VCPU,
    vcpus: guessVcpus,
    memoryGb: guessVcpus * 4,
    tier: "unknown",
  };
}

function mapStorageTier(accessTier: string | undefined): StorageClass {
  switch (accessTier?.toLowerCase()) {
    case "hot": return "standard";
    case "cool": return "infrequent";
    case "cold": return "cold";
    case "archive": return "archive";
    default: return "standard";
  }
}

function extractRegion(location: string | undefined): string {
  return (location ?? "unknown").toLowerCase().replace(/\s+/g, "");
}

function vmToComputeResource(vm: VirtualMachine): ComputeResource {
  const size = vm.hardwareProfile?.vmSize ?? "Standard_D2s_v3";
  const lookup = lookupVmSize(size);
  const region = extractRegion(vm.location);
  const state = mapVmState(vm.instanceView?.statuses);

  return {
    resourceType: "compute",
    provider: "azure",
    resourceId: vm.name ?? vm.id?.split("/").pop() ?? "unknown",
    region,
    instanceType: size,
    tier: lookup.tier,
    vcpus: lookup.vcpus,
    memoryGb: lookup.memoryGb,
    state,
    monthlyCostEstimate: state === "deallocated" ? 0 : lookup.monthlyCost,
    tags: vm.tags as Record<string, string> | undefined,
  };
}

function storageAccountToResource(sa: StorageAccount): StorageResource {
  return {
    resourceType: "storage",
    provider: "azure",
    resourceId: sa.name ?? "unknown",
    region: extractRegion(sa.location),
    storageClass: mapStorageTier(sa.accessTier),
    monthlyCostEstimate: AVG_STORAGE_ACCOUNT_MONTHLY,
    tags: sa.tags as Record<string, string> | undefined,
  };
}

// ---------------------------------------------------------------------------
// CPU metrics via Azure Monitor REST (avoids @azure/arm-monitor dependency)
// ---------------------------------------------------------------------------

async function fetchCpuMetrics(
  credential: TokenCredential,
  subscriptionId: string,
  vmResourceIds: string[],
): Promise<Map<string, number>> {
  const cpuMap = new Map<string, number>();
  if (vmResourceIds.length === 0) return cpuMap;

  let token: string;
  try {
    const t = await credential.getToken(["https://management.azure.com/.default"]);
    if (!t) return cpuMap;
    token = t.token;
  } catch {
    return cpuMap;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const timespan = `${start.toISOString()}/${end.toISOString()}`;

  const fetches = vmResourceIds.slice(0, 50).map(async (resourceId) => {
    try {
      const url =
        `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics` +
        `?api-version=2023-10-01&metricnames=Percentage CPU&aggregation=Average&timespan=${timespan}&interval=P1D`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      const timeseries = data?.value?.[0]?.timeseries?.[0]?.data;
      if (!Array.isArray(timeseries) || timeseries.length === 0) return;
      const avg = timeseries.reduce((s: number, d: { average?: number }) => s + (d.average ?? 0), 0) / timeseries.length;
      const vmName = resourceId.split("/").pop() ?? resourceId;
      cpuMap.set(vmName, Math.round(avg * 10) / 10);
    } catch { /* metric fetch is best-effort */ }
  });

  await Promise.allSettled(fetches);
  return cpuMap;
}

// ---------------------------------------------------------------------------
// Check for Recovery Services vaults (backup detection)
// ---------------------------------------------------------------------------

async function hasRecoveryVaults(
  credential: TokenCredential,
  subscriptionId: string,
): Promise<boolean> {
  try {
    const t = await credential.getToken(["https://management.azure.com/.default"]);
    if (!t) return false;
    const res = await fetch(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.RecoveryServices/vaults?api-version=2024-04-01`,
      { headers: { Authorization: `Bearer ${t.token}` }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.value) && data.value.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main: generate CloudSnapshot
// ---------------------------------------------------------------------------

export async function generateAzureSnapshot(
  credential: TokenCredential,
  subscriptionId: string,
): Promise<CloudSnapshot> {
  const computeClient = new ComputeManagementClient(credential, subscriptionId);
  const storageClient = new StorageManagementClient(credential, subscriptionId);

  const [vms, storageAccounts] = await Promise.all([
    collectAll(computeClient.virtualMachines.listAll({ expand: "instanceView" })),
    collectAll(storageClient.storageAccounts.list()),
  ]);

  const computeResources = vms.map(vmToComputeResource);
  const storageResources = storageAccounts.map(storageAccountToResource);

  const vmResourceIds = vms
    .filter((vm) => vm.id)
    .map((vm) => vm.id!);

  const [cpuMetrics, hasBackups] = await Promise.all([
    fetchCpuMetrics(credential, subscriptionId, vmResourceIds),
    hasRecoveryVaults(credential, subscriptionId),
  ]);

  for (const cr of computeResources) {
    const cpu = cpuMetrics.get(cr.resourceId);
    if (cpu !== undefined) {
      cr.usage = { cpuAvgPct: cpu, sampleWindowHours: 168 };
    }
  }

  const allResources = [...computeResources, ...storageResources];
  const regions = [...new Set(allResources.map((r) => r.region))];
  const runningCompute = computeResources.filter((c) => c.state === "running");
  const totalMonthly = allResources.reduce((s, r) => s + (r.monthlyCostEstimate ?? 0), 0);

  return {
    provider: "azure",
    accountId: subscriptionId,
    scannedAt: new Date().toISOString(),
    regions,
    resources: allResources,
    monthlySpend: Math.round(totalMonthly),
    flags: {
      singleRegion: regions.length <= 1 && runningCompute.length > 0,
      noBackupsDetected: !hasBackups,
    },
    insights: buildInsights(computeResources, storageResources, cpuMetrics, hasBackups),
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
    const cpu = cpuMetrics.get(c.resourceId);
    return cpu !== undefined && cpu < 15 && c.state === "running";
  });
  if (underUtilized.length > 0) {
    insights.push({ title: `${underUtilized.length} VM(s) under 15% avg CPU — right-sizing candidates`, severity: "warning" });
  }

  const deallocated = compute.filter((c) => c.state === "deallocated");
  if (deallocated.length > 0) {
    insights.push({ title: `${deallocated.length} deallocated VM(s) — disks still billing`, severity: "info" });
  }

  const hotStorage = storage.filter((s) => s.storageClass === "standard");
  if (hotStorage.length > 3) {
    insights.push({ title: `${hotStorage.length} storage accounts on Hot tier — review for Cool/Archive`, severity: "warning" });
  }

  if (!hasBackups) {
    insights.push({ title: "No Recovery Services vaults detected — no Azure Backup configured", severity: "critical" });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Execution plugin registration (follows existing pattern)
// ---------------------------------------------------------------------------

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("azure:snapshot-generator started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Snapshot generator is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const azureCreds = await getCredentialProvider().getAzureCredentials(ctx.userId, ctx.credentialsKey);
  if (!azureCreds) {
    return {
      ok: false,
      error: "Azure connector not linked or validated. Connect your Azure account in Connectors first.",
      summary: "Azure connector required.",
    };
  }

  try {
    const snapshot = await generateAzureSnapshot(azureCreds.credential, azureCreds.subscriptionId);

    const vmCount = snapshot.resources.filter((r) => r.resourceType === "compute").length;
    const saCount = snapshot.resources.filter((r) => r.resourceType === "storage").length;
    const summary = `Azure snapshot: ${vmCount} VMs, ${saCount} Storage Accounts, ${snapshot.regions.length} region(s), ~$${snapshot.monthlySpend}/mo estimated`;

    logger.info("azure:snapshot-generator completed", { vmCount, saCount, regions: snapshot.regions.length });

    return {
      ok: true,
      data: snapshot as unknown as Record<string, unknown>,
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("azure:snapshot-generator failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Azure snapshot generation failed",
    };
  }
}

registerExecutionPlugin({
  id: "azure:snapshot-generator",
  name: "Azure Snapshot Generator",
  description: "Generate normalized CloudSnapshot from Azure VMs and Storage Accounts. Read-only.",
  scopesRequired: ["cloud:azure", "cloud:read"],
  readOnly: true,
  run,
});

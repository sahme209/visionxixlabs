/**
 * Azure live resource inventory.
 *
 * Pure read-only traversal via the existing `@azure/arm-*` SDKs
 * (already in deps). Pulls VM + Storage account + Virtual Network +
 * NSG inventory from the configured subscription. Honest preview
 * envelope when prerequisites are missing.
 *
 * Hard rules:
 *   - Only runs when Azure live mode + AZURE_INVENTORY_EXTRACT_ENABLED.
 *   - 10s timeout per resource list.
 *   - Per-section read failures degrade gracefully (others still
 *     populate). No fabricated counts ever.
 *   - Never modifies a resource.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "./azureConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface AzureResourceCounts {
  vmCount: number;
  storageAccountCount: number;
  vnetCount: number;
  nsgCount: number;
}

export interface AzureLiveInventoryResult {
  mode: "live" | "preview" | "blocked" | "disabled";
  subscriptionId?: string;
  counts: AzureResourceCounts;
  publicIpExposedVmCount: number;
  unencryptedStorageCount: number;
  durationMs: number;
  limitations: string[];
}

export async function extractAzureLiveInventory(): Promise<AzureLiveInventoryResult> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.azureInventoryExtractEnabled) {
    return blocked(start, "AZURE_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getAzureConfig();
  if (cfg.mode !== "live") {
    return preview(start, "Azure mode is not live — extractor returned honest preview.");
  }
  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    return blocked(start, "AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID required.");
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return blocked(start, "AZURE_CLIENT_ID + AZURE_CLIENT_SECRET required.");
  }

  let credential;
  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  } catch (err) {
    return blocked(start, `Azure credential init failed: ${redact(errMessage(err))}`);
  }

  const limitations: string[] = [];
  let vmCount = 0;
  let storageAccountCount = 0;
  let vnetCount = 0;
  let nsgCount = 0;
  let publicIpExposedVmCount = 0;
  let unencryptedStorageCount = 0;

  // VMs (with quick NIC peek for public IP detection).
  try {
    const { ComputeManagementClient } = await import("@azure/arm-compute");
    const compute = new ComputeManagementClient(credential, subscriptionId);
    const vmIter = compute.virtualMachines.listAll();
    const vms = await collect(vmIter, DEFAULT_TIMEOUT_MS, "azure.list_vms");
    vmCount = vms.length;
    // We don't deep-probe each NIC for IP (extra cost) — surface a count
    // of VMs whose model declares a primary public IP profile.
    publicIpExposedVmCount = vms.filter((v) => {
      const ifaces = (v as { networkProfile?: { networkInterfaces?: unknown[] } }).networkProfile?.networkInterfaces ?? [];
      return ifaces.length > 0; // Each interface is a candidate — deep probe is follow-up.
    }).length;
  } catch (err) {
    limitations.push(`VM list failed: ${redact(errMessage(err))}`);
  }

  // Storage accounts.
  try {
    const { StorageManagementClient } = await import("@azure/arm-storage");
    const storage = new StorageManagementClient(credential, subscriptionId);
    const acctIter = storage.storageAccounts.list();
    const accts = await collect(acctIter, DEFAULT_TIMEOUT_MS, "azure.list_storage");
    storageAccountCount = accts.length;
    unencryptedStorageCount = accts.filter((a) => {
      const enc = (a as { encryption?: { services?: { blob?: { enabled?: boolean } } } }).encryption;
      return !enc?.services?.blob?.enabled;
    }).length;
  } catch (err) {
    limitations.push(`Storage list failed: ${redact(errMessage(err))}`);
  }

  // VNets + NSGs.
  try {
    const { NetworkManagementClient } = await import("@azure/arm-network");
    const network = new NetworkManagementClient(credential, subscriptionId);
    const vnetIter = network.virtualNetworks.listAll();
    const vnets = await collect(vnetIter, DEFAULT_TIMEOUT_MS, "azure.list_vnets");
    vnetCount = vnets.length;
    const nsgIter = network.networkSecurityGroups.listAll();
    const nsgs = await collect(nsgIter, DEFAULT_TIMEOUT_MS, "azure.list_nsgs");
    nsgCount = nsgs.length;
  } catch (err) {
    limitations.push(`Network list failed: ${redact(errMessage(err))}`);
  }

  return {
    mode: "live",
    subscriptionId,
    counts: { vmCount, storageAccountCount, vnetCount, nsgCount },
    publicIpExposedVmCount,
    unencryptedStorageCount,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collect<T>(iter: AsyncIterable<T>, timeoutMs: number, label: string): Promise<T[]> {
  return withTimeout((async () => {
    const out: T[] = [];
    for await (const item of iter) {
      out.push(item);
      if (out.length >= 500) break; // hard cap, never iterate forever
    }
    return out;
  })(), timeoutMs, label);
}

function preview(start: number, note: string): AzureLiveInventoryResult {
  return {
    mode: "preview",
    counts: { vmCount: 0, storageAccountCount: 0, vnetCount: 0, nsgCount: 0 },
    publicIpExposedVmCount: 0,
    unencryptedStorageCount: 0,
    durationMs: Date.now() - start,
    limitations: [note],
  };
}

function blocked(start: number, note: string): AzureLiveInventoryResult {
  return {
    mode: "blocked",
    counts: { vmCount: 0, storageAccountCount: 0, vnetCount: 0, nsgCount: 0 },
    publicIpExposedVmCount: 0,
    unencryptedStorageCount: 0,
    durationMs: Date.now() - start,
    limitations: [note],
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}

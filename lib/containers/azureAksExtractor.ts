/**
 * Azure AKS live cluster extractor.
 *
 * Pure read-only traversal via @azure/arm-containerservice + the
 * existing @azure/identity ClientSecretCredential pattern.
 *
 * Hard rules:
 *   - Only runs when Azure live mode + AZURE_INVENTORY_EXTRACT_ENABLED.
 *   - 10s timeout per list.
 *   - Maps Azure cluster state to canonical ContainerCluster shape
 *     (same as AWS EKS — keeps the typed contract uniform).
 *   - EOL k8s detection mirrors EKS — closed set of versions.
 *   - Never modifies a cluster.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "@/lib/cloud/azure/azureConfig";
import type { ContainerCluster } from "./containerOrchestrationModel";

const DEFAULT_TIMEOUT_MS = 10_000;
const EOL_K8S_VERSIONS = new Set(["1.21", "1.22", "1.23", "1.24", "1.25", "1.26", "1.27"]);

export interface AzureAksExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  clusters: ContainerCluster[];
  durationMs: number;
  limitations: string[];
}

export async function extractAzureAksClusters(): Promise<AzureAksExtraction> {
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

  let managedClusters;
  try {
    const { ContainerServiceClient } = await import("@azure/arm-containerservice");
    managedClusters = new ContainerServiceClient(credential, subscriptionId);
  } catch (err) {
    return blocked(start, `AKS client init failed: ${redact(errMessage(err))}`);
  }

  const items: unknown[] = [];
  try {
    await withTimeout((async () => {
      const iter = managedClusters.managedClusters.list();
      for await (const item of iter) {
        items.push(item);
        if (items.length >= 200) return;
      }
    })(), DEFAULT_TIMEOUT_MS * 2, "aks.list");
  } catch (err) {
    return blocked(start, `AKS list failed: ${redact(errMessage(err))}`);
  }

  const clusters: ContainerCluster[] = items.map((raw): ContainerCluster => {
    const c = raw as {
      id?: string;
      name?: string;
      location?: string;
      kubernetesVersion?: string;
      provisioningState?: string;
      apiServerAccessProfile?: { enablePrivateCluster?: boolean };
      agentPoolProfiles?: { count?: number; enableAutoScaling?: boolean }[];
      networkProfile?: { networkPlugin?: string };
      addonProfiles?: Record<string, { enabled?: boolean }>;
    };
    const version = c.kubernetesVersion?.split("-")[0];
    const isEol = !!version && EOL_K8S_VERSIONS.has(version);
    const isPrivate = c.apiServerAccessProfile?.enablePrivateCluster === true;
    const pools = c.agentPoolProfiles ?? [];
    const totalNodes = pools.reduce((sum, p) => sum + (p.count ?? 0), 0);
    const autoscalerEnabled = pools.some((p) => p.enableAutoScaling === true);
    const region = c.location ?? "unknown";
    const name = c.name ?? "unknown";
    return {
      id: c.id ?? `aks:${region}:${name}`,
      provider: "azure_aks",
      name,
      region,
      controlPlaneVersion: version,
      versionEol: isEol,
      status: c.provisioningState === "Succeeded"
        ? (isEol ? "version_eol" : "healthy")
        : c.provisioningState === "Updating" || c.provisioningState === "Creating"
          ? "upgrading"
          : "degraded",
      sourceMode: "live",
      nodePoolCount: pools.length,
      nodeCount: totalNodes,
      autoscalerEnabled,
      podCount: 0,
      workloadCount: 0,
      publicEndpointsCount: isPrivate ? 0 : 1,
      networkExposure: isPrivate ? "private" : "internet_routable",
      secretsPosture: c.addonProfiles?.["azureKeyvaultSecretsProvider"]?.enabled ? "managed_kms" : "unknown",
      workloads: [],
      limitations: [
        "Pod-level traversal requires KubeAPI auth — gated as a follow-up phase.",
        ...(isEol ? [`Kubernetes ${version} is past End-of-Standard-Support.`] : []),
      ],
      safeNextAction: { label: "Open Azure Sources", href: "/dashboard/sources" },
      externalConsoleHref: `https://portal.azure.com/#@${tenantId}/resource${c.id ?? ""}`,
    };
  });

  return { mode: "live", clusters, durationMs: Date.now() - start, limitations: [] };
}

function preview(start: number, note: string): AzureAksExtraction {
  return { mode: "preview", clusters: [], durationMs: Date.now() - start, limitations: [note] };
}
function blocked(start: number, note: string): AzureAksExtraction {
  return { mode: "blocked", clusters: [], durationMs: Date.now() - start, limitations: [note] };
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

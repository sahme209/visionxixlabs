/**
 * GCP GKE live cluster extractor.
 *
 * Uses @google-cloud/container to list clusters in every region of
 * the configured project. Mirrors the AWS EKS / Azure AKS shape.
 *
 * Hard rules:
 *   - Only runs when GCP live mode + GCP_INVENTORY_EXTRACT_ENABLED.
 *   - 10s per call.
 *   - EOL detection — closed set of k8s versions ≤1.27.
 *   - Never modifies a cluster.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getGcpConfig,
  resolveGcpServiceAccountJson,
  resolveGcpPrivateKey,
  resolveGcpClientEmail,
} from "@/lib/cloud/gcp/gcpConfig";
import type { ContainerCluster } from "./containerOrchestrationModel";

const DEFAULT_TIMEOUT_MS = 10_000;
const EOL_K8S_VERSIONS = new Set(["1.21", "1.22", "1.23", "1.24", "1.25", "1.26", "1.27"]);

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

export interface GcpGkeExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  clusters: ContainerCluster[];
  durationMs: number;
  limitations: string[];
}

export async function extractGcpGkeClusters(): Promise<GcpGkeExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.gcpInventoryExtractEnabled) {
    return blocked(start, "GCP_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getGcpConfig();
  if (cfg.mode !== "live") {
    return preview(start, "GCP mode is not live — extractor returned honest preview.");
  }
  const projectId = env.gcpProjectId;
  if (!projectId) {
    return blocked(start, "GCP_PROJECT_ID required.");
  }

  let key: ServiceAccountKey = {};
  try {
    const json = resolveGcpServiceAccountJson();
    if (json) {
      key = JSON.parse(json) as ServiceAccountKey;
    } else {
      key = {
        client_email: resolveGcpClientEmail(),
        private_key: resolveGcpPrivateKey(),
      };
    }
  } catch (err) {
    return blocked(start, `GCP credentials parse failed: ${redact(errMessage(err))}`);
  }
  if (!key.client_email || !key.private_key) {
    return blocked(start, "GCP credentials missing client_email or private_key.");
  }

  let clusterManager;
  try {
    const containerModule = await import("@google-cloud/container");
    const { ClusterManagerClient } = containerModule as { ClusterManagerClient: new (opts: unknown) => unknown };
    clusterManager = new ClusterManagerClient({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    }) as { listClusters: (req: { parent: string }) => Promise<[{ clusters?: unknown[] }]> };
  } catch (err) {
    return blocked(start, `GKE client init failed: ${redact(errMessage(err))}`);
  }

  // Use location=- for all regions/zones at once.
  let rawClusters: unknown[] = [];
  try {
    const [resp] = await withTimeout(
      clusterManager.listClusters({ parent: `projects/${projectId}/locations/-` }),
      DEFAULT_TIMEOUT_MS,
      "gke.list",
    );
    rawClusters = resp.clusters ?? [];
  } catch (err) {
    return blocked(start, `GKE list failed: ${redact(errMessage(err))}`);
  }

  const clusters: ContainerCluster[] = rawClusters.map((raw): ContainerCluster => {
    const c = raw as {
      name?: string;
      location?: string;
      currentMasterVersion?: string;
      status?: string;
      autopilot?: { enabled?: boolean };
      privateClusterConfig?: { enablePrivateEndpoint?: boolean };
      nodePools?: { initialNodeCount?: number; autoscaling?: { enabled?: boolean } }[];
      currentNodeCount?: number;
      databaseEncryption?: { state?: string };
    };
    const version = c.currentMasterVersion?.split(".").slice(0, 2).join(".");
    const isEol = !!version && EOL_K8S_VERSIONS.has(version);
    const isPrivate = c.privateClusterConfig?.enablePrivateEndpoint === true;
    const pools = c.nodePools ?? [];
    const autoscalerEnabled = pools.some((p) => p.autoscaling?.enabled === true) || c.autopilot?.enabled === true;
    const location = c.location ?? "unknown";
    const name = c.name ?? "unknown";
    const dbEncrypted = c.databaseEncryption?.state === "ENCRYPTED";
    return {
      id: `gke:${location}:${name}`,
      provider: "gcp_gke",
      name,
      region: location,
      controlPlaneVersion: c.currentMasterVersion,
      versionEol: isEol,
      status: c.status === "RUNNING"
        ? (isEol ? "version_eol" : "healthy")
        : c.status === "RECONCILING" || c.status === "PROVISIONING"
          ? "upgrading"
          : "degraded",
      sourceMode: "live",
      nodePoolCount: pools.length,
      nodeCount: c.currentNodeCount ?? pools.reduce((s, p) => s + (p.initialNodeCount ?? 0), 0),
      autoscalerEnabled,
      podCount: 0,
      workloadCount: 0,
      publicEndpointsCount: isPrivate ? 0 : 1,
      networkExposure: isPrivate ? "private" : "internet_routable",
      secretsPosture: dbEncrypted ? "managed_kms" : "unknown",
      workloads: [],
      limitations: [
        "Pod-level traversal requires KubeAPI auth — gated as a follow-up phase.",
        ...(isEol ? [`Kubernetes ${version} is past End-of-Standard-Support.`] : []),
        ...(c.autopilot?.enabled ? ["Autopilot cluster — node count managed by GKE."] : []),
      ],
      safeNextAction: { label: "Open GCP Sources", href: "/dashboard/sources" },
      externalConsoleHref: `https://console.cloud.google.com/kubernetes/clusters/details/${encodeURIComponent(location)}/${encodeURIComponent(name)}?project=${encodeURIComponent(projectId)}`,
    };
  });

  return { mode: "live", clusters, durationMs: Date.now() - start, limitations: [] };
}

function preview(start: number, note: string): GcpGkeExtraction {
  return { mode: "preview", clusters: [], durationMs: Date.now() - start, limitations: [note] };
}
function blocked(start: number, note: string): GcpGkeExtraction {
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

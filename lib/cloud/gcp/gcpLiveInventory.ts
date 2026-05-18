/**
 * GCP live resource inventory.
 *
 * Pure read-only traversal via the existing `@google-cloud/compute`
 * and `@google-cloud/storage` SDKs (already in deps). Pulls Compute
 * Engine instance + Storage bucket + Firewall rule counts from the
 * configured project. Honest preview envelope when prerequisites
 * are missing.
 *
 * Hard rules:
 *   - Only runs when GCP live mode + GCP_INVENTORY_EXTRACT_ENABLED.
 *   - 10s timeout per resource list.
 *   - Bucket public-access detection via IAM check.
 *   - Never modifies a resource.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getGcpConfig,
  resolveGcpServiceAccountJson,
  resolveGcpPrivateKey,
  resolveGcpClientEmail,
} from "./gcpConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface GcpResourceCounts {
  instanceCount: number;
  bucketCount: number;
  firewallRuleCount: number;
}

export interface GcpLiveInventoryResult {
  mode: "live" | "preview" | "blocked" | "disabled";
  projectId?: string;
  counts: GcpResourceCounts;
  publicBucketCount: number;
  allOpenFirewallCount: number;
  durationMs: number;
  limitations: string[];
}

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

export async function extractGcpLiveInventory(): Promise<GcpLiveInventoryResult> {
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
  // Resolve the service account key. Prefer the full JSON form when set;
  // fall back to the split client_email + private_key form.
  let key: ServiceAccountKey = {};
  try {
    const json = resolveGcpServiceAccountJson();
    if (json) {
      const parsed = JSON.parse(json) as ServiceAccountKey;
      key = parsed;
    } else {
      key = {
        client_email: resolveGcpClientEmail(),
        private_key: resolveGcpPrivateKey(),
        project_id: projectId,
      };
    }
  } catch (err) {
    return blocked(start, `GCP credentials parse failed: ${redact(errMessage(err))}`);
  }
  if (!key.client_email || !key.private_key) {
    return blocked(start, "GCP credentials missing client_email or private_key.");
  }

  const limitations: string[] = [];
  let instanceCount = 0;
  let bucketCount = 0;
  let firewallRuleCount = 0;
  let publicBucketCount = 0;
  let allOpenFirewallCount = 0;

  // Compute Engine instances (aggregated list across zones).
  try {
    const { InstancesClient } = await import("@google-cloud/compute");
    const instances = new InstancesClient({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    });
    const iter = instances.aggregatedListAsync({ project: projectId, maxResults: 100 });
    const items: unknown[] = [];
    await withTimeout((async () => {
      for await (const [, response] of iter as AsyncIterable<[string, { instances?: unknown[] }]>) {
        if (response.instances && response.instances.length > 0) {
          for (const inst of response.instances) {
            items.push(inst);
            if (items.length >= 500) return;
          }
        }
      }
    })(), DEFAULT_TIMEOUT_MS, "gcp.aggregated_instances");
    instanceCount = items.length;
  } catch (err) {
    limitations.push(`Compute instance list failed: ${redact(errMessage(err))}`);
  }

  // Storage buckets + public access detection.
  try {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    });
    const [buckets] = await withTimeout(
      storage.getBuckets({ maxResults: 200 }),
      DEFAULT_TIMEOUT_MS,
      "gcp.list_buckets",
    );
    bucketCount = buckets.length;
    // Public-access detection: check IAM policy for allUsers / allAuthenticatedUsers.
    for (const b of buckets.slice(0, 50)) {
      try {
        const [policy] = await withTimeout(
          b.iam.getPolicy(),
          DEFAULT_TIMEOUT_MS,
          `gcp.bucket_iam:${b.name}`,
        );
        const bindings = (policy?.bindings ?? []) as { members?: string[] }[];
        if (bindings.some((bnd) => (bnd.members ?? []).some((m) => m === "allUsers" || m === "allAuthenticatedUsers"))) {
          publicBucketCount++;
        }
      } catch {
        // Skip IAM probe failures — never inflate the public count.
      }
    }
  } catch (err) {
    limitations.push(`Storage bucket list failed: ${redact(errMessage(err))}`);
  }

  // Firewall rules.
  try {
    const { FirewallsClient } = await import("@google-cloud/compute");
    const fw = new FirewallsClient({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    });
    const iter = fw.listAsync({ project: projectId, maxResults: 200 });
    const rules: { sourceRanges?: string[]; allowed?: { IPProtocol?: string; ports?: string[] }[] }[] = [];
    await withTimeout((async () => {
      for await (const rule of iter as AsyncIterable<{ sourceRanges?: string[]; allowed?: { IPProtocol?: string; ports?: string[] }[] }>) {
        rules.push(rule);
        if (rules.length >= 500) return;
      }
    })(), DEFAULT_TIMEOUT_MS, "gcp.list_firewalls");
    firewallRuleCount = rules.length;
    allOpenFirewallCount = rules.filter((r) =>
      (r.sourceRanges ?? []).some((s) => s === "0.0.0.0/0") &&
      (r.allowed ?? []).length > 0,
    ).length;
  } catch (err) {
    limitations.push(`Firewall list failed: ${redact(errMessage(err))}`);
  }

  return {
    mode: "live",
    projectId,
    counts: { instanceCount, bucketCount, firewallRuleCount },
    publicBucketCount,
    allOpenFirewallCount,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function preview(start: number, note: string): GcpLiveInventoryResult {
  return {
    mode: "preview",
    counts: { instanceCount: 0, bucketCount: 0, firewallRuleCount: 0 },
    publicBucketCount: 0,
    allOpenFirewallCount: 0,
    durationMs: Date.now() - start,
    limitations: [note],
  };
}

function blocked(start: number, note: string): GcpLiveInventoryResult {
  return {
    mode: "blocked",
    counts: { instanceCount: 0, bucketCount: 0, firewallRuleCount: 0 },
    publicBucketCount: 0,
    allOpenFirewallCount: 0,
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

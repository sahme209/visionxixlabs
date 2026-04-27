/**
 * GCP Infrastructure Discovery — read-only inventory.
 * Uses Google Cloud SDK: Compute Instances, Storage Buckets.
 * Collects counts and service summaries.
 */

import { InstancesClient, ZoneOperationsClient } from "@google-cloud/compute";
import { Storage } from "@google-cloud/storage";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("gcp:infra-discovery started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Infrastructure discovery is read-only and must run with dryRun=true.",
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
    const { credentials, projectId } = gcpCreds;

    const instancesClient = new InstancesClient({ credentials });
    const storage = new Storage({ credentials, projectId });

    let instanceCount = 0;
    let bucketCount = 0;

    const [aggregatedList] = await instancesClient.aggregatedList({ project: projectId });
    if (aggregatedList) {
      for (const [, scopedList] of aggregatedList) {
        instanceCount += scopedList.instances?.length ?? 0;
      }
    }

    const [buckets] = await storage.getBuckets({ project: projectId });
    bucketCount = buckets?.length ?? 0;

    const services = [
      { type: "compute_instance" as const, count: instanceCount },
      { type: "storage_bucket" as const, count: bucketCount },
    ];

    const summary = `Compute Instances: ${instanceCount}, Storage Buckets: ${bucketCount}`;

    logger.info("gcp:infra-discovery completed", { instanceCount, bucketCount });

    return {
      ok: true,
      data: {
        instanceCount,
        bucketCount,
        services,
        summary,
        projectId,
      },
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("gcp:infra-discovery failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "GCP infrastructure discovery failed",
    };
  }
}

registerExecutionPlugin({
  id: "gcp:infra-discovery",
  name: "GCP Infrastructure Discovery",
  description: "Discover Compute Instances and Storage Buckets. Read-only.",
  scopesRequired: ["cloud:gcp", "cloud:read"],
  readOnly: true,
  run,
});

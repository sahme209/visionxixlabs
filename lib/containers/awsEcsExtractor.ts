/**
 * AWS ECS live cluster extractor.
 *
 * Pure read-only SDK traversal. AssumeRole via the broker → ECSClient →
 * ListClusters → DescribeClusters → ListServices → DescribeServices.
 * Each cluster + service is mapped into the canonical
 * ContainerCluster + ContainerWorkload shape.
 *
 * Hard rules:
 *   - Only runs when AWS mode = live + AWS_ECS_EXTRACT_ENABLED is set.
 *   - Per-call timeout 8s. Region-pinned to the customer's ambient
 *     region (no multi-region traversal here — that's a follow-up).
 *   - Honest preview/blocked envelope on any failure.
 *   - Never executes a Task / never modifies a Service.
 */

import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "@/lib/cloud/aws/awsConfig";
import type {
  ContainerCluster,
  ContainerWorkload,
  WorkloadRiskFlag,
} from "./containerOrchestrationModel";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface AwsEcsExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  clusters: ContainerCluster[];
  durationMs: number;
  limitations: string[];
}

export async function extractAwsEcsClusters(): Promise<AwsEcsExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.awsEcsExtractEnabled) {
    return blocked(start, "AWS_ECS_EXTRACT_ENABLED is not set — ECS traversal skipped.");
  }
  const awsCfg = getAwsConfig();
  if (awsCfg.mode !== "live") {
    return preview(start, "AWS mode is not live — extractor returned honest preview.");
  }
  const brokerKey = env.awsBrokerAccessKeyId;
  const brokerSecret = env.awsBrokerSecretAccessKey;
  if (!brokerKey || !brokerSecret) {
    return blocked(start, "Broker credentials missing — set AWS_CONNECTOR_BROKER_* env vars.");
  }
  const roleArn = env.awsAmbientRoleArn;
  const externalId = env.awsAmbientExternalId;
  const region = env.awsAmbientRegion;
  if (!roleArn || !externalId || !region) {
    return blocked(start, "Ambient AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION required.");
  }

  // AssumeRole.
  let creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string };
  try {
    const sts = new STSClient({
      region,
      credentials: { accessKeyId: brokerKey, secretAccessKey: brokerSecret },
    });
    const assumed = await withTimeout(
      sts.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `axiom-ecs-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 900,
      })),
      DEFAULT_TIMEOUT_MS,
      "sts.assume_role",
    );
    const c = assumed.Credentials;
    if (!c?.AccessKeyId || !c?.SecretAccessKey || !c?.SessionToken) {
      return blocked(start, "AssumeRole returned no credentials.");
    }
    creds = { accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretAccessKey, sessionToken: c.SessionToken };
  } catch (err) {
    return blocked(start, `AssumeRole failed: ${redact(errMessage(err))}`);
  }

  const ecs = new ECSClient({ region, credentials: creds });
  const limitations: string[] = [];

  // 1. List + describe clusters.
  let clusterArns: string[] = [];
  try {
    const listed = await withTimeout(
      ecs.send(new ListClustersCommand({})),
      DEFAULT_TIMEOUT_MS,
      "ecs.list_clusters",
    );
    clusterArns = listed.clusterArns ?? [];
  } catch (err) {
    return blocked(start, `ECS ListClusters failed: ${redact(errMessage(err))}`);
  }

  if (clusterArns.length === 0) {
    return {
      mode: "live",
      clusters: [],
      durationMs: Date.now() - start,
      limitations: [`No ECS clusters in region ${region}.`],
    };
  }

  let describedClusters: { clusterArn?: string; clusterName?: string; status?: string; runningTasksCount?: number; pendingTasksCount?: number; activeServicesCount?: number; registeredContainerInstancesCount?: number; capacityProviders?: string[] }[] = [];
  try {
    const described = await withTimeout(
      ecs.send(new DescribeClustersCommand({
        clusters: clusterArns,
        include: ["SETTINGS", "STATISTICS", "ATTACHMENTS"],
      })),
      DEFAULT_TIMEOUT_MS,
      "ecs.describe_clusters",
    );
    describedClusters = described.clusters ?? [];
  } catch (err) {
    limitations.push(`DescribeClusters partial: ${redact(errMessage(err))}`);
  }

  const clusters: ContainerCluster[] = [];
  for (const c of describedClusters) {
    const clusterArn = c.clusterArn ?? "";
    const clusterName = c.clusterName ?? clusterArn.split("/").pop() ?? "unknown";

    // 2. List + describe services in this cluster (cap 50 per cluster).
    const workloads: ContainerWorkload[] = [];
    try {
      const servicesList = await withTimeout(
        ecs.send(new ListServicesCommand({ cluster: clusterArn, maxResults: 50 })),
        DEFAULT_TIMEOUT_MS,
        "ecs.list_services",
      );
      const serviceArns = servicesList.serviceArns ?? [];
      if (serviceArns.length > 0) {
        const described = await withTimeout(
          ecs.send(new DescribeServicesCommand({
            cluster: clusterArn,
            services: serviceArns,
          })),
          DEFAULT_TIMEOUT_MS,
          "ecs.describe_services",
        );
        for (const s of described.services ?? []) {
          const risks: WorkloadRiskFlag[] = [];
          if ((s.desiredCount ?? 0) > 0 && (s.runningCount ?? 0) < (s.desiredCount ?? 0)) {
            risks.push("imagepullbackoff");
          }
          if (!(s.deploymentConfiguration?.minimumHealthyPercent ?? 0)) {
            risks.push("no_readiness_probe");
          }
          workloads.push({
            id: s.serviceArn ?? `${clusterArn}/${s.serviceName}`,
            name: s.serviceName ?? "unknown",
            kind: "ecs_service",
            replicas: s.desiredCount,
            readyReplicas: s.runningCount,
            riskFlags: risks,
            summary: `ECS service · running ${s.runningCount ?? 0}/${s.desiredCount ?? 0} (launch=${s.launchType ?? "n/a"})`,
            evidenceRef: s.serviceArn ?? `ecs:${clusterArn}/${s.serviceName}`,
          });
        }
      }
    } catch (err) {
      limitations.push(`Service traversal failed on ${clusterName}: ${redact(errMessage(err))}`);
    }

    const usesFargate = (c.capacityProviders ?? []).some((cp) => /fargate/i.test(cp));
    clusters.push({
      id: clusterArn,
      provider: "aws_ecs",
      name: clusterName,
      region,
      controlPlaneVersion: undefined,
      versionEol: false,
      status: c.status === "ACTIVE" ? "healthy" : c.status === "PROVISIONING" ? "upgrading" : "degraded",
      sourceMode: "live",
      nodePoolCount: usesFargate ? 0 : (c.registeredContainerInstancesCount ? 1 : 0),
      nodeCount: c.registeredContainerInstancesCount ?? 0,
      autoscalerEnabled: usesFargate || (c.capacityProviders ?? []).length > 0,
      podCount: (c.runningTasksCount ?? 0) + (c.pendingTasksCount ?? 0),
      workloadCount: c.activeServicesCount ?? workloads.length,
      publicEndpointsCount: 0,
      networkExposure: "unknown",
      secretsPosture: "managed_kms",
      workloads,
      limitations: [],
      safeNextAction: { label: "Open AWS Sources", href: "/dashboard/sources" },
      externalConsoleHref: `https://console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(clusterName)}?region=${encodeURIComponent(region)}`,
    });
  }

  return {
    mode: "live",
    clusters,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function preview(start: number, note: string): AwsEcsExtraction {
  return { mode: "preview", clusters: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): AwsEcsExtraction {
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
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}

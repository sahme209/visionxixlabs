/**
 * AWS EKS live cluster extractor.
 *
 * Pure read-only SDK traversal:
 *   STSClient → AssumeRole
 *   EKSClient → ListClusters → DescribeCluster (per cluster)
 *             → ListNodegroups → DescribeNodegroup (per nodegroup)
 *
 * Hard rules mirror the ECS extractor:
 *   - Only runs when AWS mode = live + AWS_EKS_EXTRACT_ENABLED is set.
 *   - 8s per-call timeout. Region-pinned to ambient AWS_REGION.
 *   - Honest preview/blocked envelope on any failure.
 *   - Never modifies nodegroups, kubeconfig, or workloads.
 *   - Identifies EOL Kubernetes versions (≤1.27 as of 2026-05) so
 *     the canonical model's `versionEol` flag is honest.
 */

import "server-only";

import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
} from "@aws-sdk/client-eks";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "@/lib/cloud/aws/awsConfig";
import { resolveAwsCredentials } from "@/lib/cloud/aws/awsCredentialResolver";
import type { ContainerCluster } from "./containerOrchestrationModel";

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Versions known to be at or past End-of-Standard-Support in AWS EKS
 * as of 2026-05. Update annually.
 */
const EOL_K8S_VERSIONS = new Set(["1.21", "1.22", "1.23", "1.24", "1.25", "1.26", "1.27"]);

export interface AwsEksExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  clusters: ContainerCluster[];
  durationMs: number;
  limitations: string[];
}

export async function extractAwsEksClusters(): Promise<AwsEksExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.awsEksExtractEnabled) {
    return blocked(start, "AWS_EKS_EXTRACT_ENABLED is not set — EKS traversal skipped.");
  }
  const awsCfg = getAwsConfig();
  if (awsCfg.mode !== "live") {
    return preview(start, "AWS mode is not live — extractor returned honest preview.");
  }
  const resolved = await resolveAwsCredentials({ sessionLabel: "eks" });
  if (resolved.mode !== "ok") return blocked(start, resolved.reason);
  const region = resolved.region;
  const eks = new EKSClient({ region, credentials: resolved.credentials });
  const limitations: string[] = [];

  // 1. List clusters.
  let clusterNames: string[] = [];
  try {
    const listed = await withTimeout(
      eks.send(new ListClustersCommand({})),
      DEFAULT_TIMEOUT_MS,
      "eks.list_clusters",
    );
    clusterNames = listed.clusters ?? [];
  } catch (err) {
    return blocked(start, `EKS ListClusters failed: ${redact(errMessage(err))}`);
  }

  if (clusterNames.length === 0) {
    return {
      mode: "live",
      clusters: [],
      durationMs: Date.now() - start,
      limitations: [`No EKS clusters in region ${region}.`],
    };
  }

  const clusters: ContainerCluster[] = [];
  for (const name of clusterNames) {
    let nodeCount = 0;
    let nodePoolCount = 0;
    let autoscalerEnabled = false;

    // Describe cluster.
    let described;
    try {
      const res = await withTimeout(
        eks.send(new DescribeClusterCommand({ name })),
        DEFAULT_TIMEOUT_MS,
        "eks.describe_cluster",
      );
      described = res.cluster;
    } catch (err) {
      limitations.push(`DescribeCluster failed for ${name}: ${redact(errMessage(err))}`);
      continue;
    }
    if (!described) continue;

    // List + describe nodegroups (cap 25 per cluster).
    try {
      const ng = await withTimeout(
        eks.send(new ListNodegroupsCommand({ clusterName: name, maxResults: 25 })),
        DEFAULT_TIMEOUT_MS,
        "eks.list_nodegroups",
      );
      const groups = ng.nodegroups ?? [];
      nodePoolCount = groups.length;
      for (const g of groups) {
        try {
          const dng = await withTimeout(
            eks.send(new DescribeNodegroupCommand({ clusterName: name, nodegroupName: g })),
            DEFAULT_TIMEOUT_MS,
            "eks.describe_nodegroup",
          );
          const sc = dng.nodegroup?.scalingConfig;
          if (sc) {
            nodeCount += sc.desiredSize ?? 0;
            if ((sc.maxSize ?? 0) > (sc.minSize ?? 0)) autoscalerEnabled = true;
          }
        } catch (err) {
          limitations.push(`Nodegroup ${g} describe failed on ${name}: ${redact(errMessage(err))}`);
        }
      }
    } catch (err) {
      limitations.push(`ListNodegroups failed on ${name}: ${redact(errMessage(err))}`);
    }

    const version = described.version ?? undefined;
    const isEol = !!version && EOL_K8S_VERSIONS.has(version);
    const publicEndpoint = described.resourcesVpcConfig?.endpointPublicAccess === true;

    clusters.push({
      id: described.arn ?? `eks:${region}:${name}`,
      provider: "aws_eks",
      name,
      region,
      controlPlaneVersion: version,
      versionEol: isEol,
      status: described.status === "ACTIVE"
        ? (isEol ? "version_eol" : "healthy")
        : described.status === "UPDATING"
          ? "upgrading"
          : described.status === "CREATING"
            ? "upgrading"
            : "degraded",
      sourceMode: "live",
      nodePoolCount,
      nodeCount,
      autoscalerEnabled,
      podCount: 0, // Pod count requires KubeAPI traversal — out of scope here.
      workloadCount: 0,
      publicEndpointsCount: publicEndpoint ? 1 : 0,
      networkExposure: publicEndpoint ? "internet_routable" : "private",
      secretsPosture: described.encryptionConfig && described.encryptionConfig.length > 0 ? "managed_kms" : "unknown",
      workloads: [],
      limitations: [
        "Pod-level traversal requires KubeAPI auth — gated as a follow-up phase.",
        ...(isEol ? [`Kubernetes ${version} is past End-of-Standard-Support.`] : []),
      ],
      safeNextAction: { label: "Open AWS Sources", href: "/dashboard/sources" },
      externalConsoleHref: `https://console.aws.amazon.com/eks/home?region=${encodeURIComponent(region)}#/clusters/${encodeURIComponent(name)}`,
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

function preview(start: number, note: string): AwsEksExtraction {
  return { mode: "preview", clusters: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): AwsEksExtraction {
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

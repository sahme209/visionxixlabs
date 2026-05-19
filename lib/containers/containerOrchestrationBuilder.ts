/**
 * Container Orchestration Surface builder.
 *
 * Pure read-only composition. Until live SDK traversal lands for each
 * provider, the builder honestly reports per-provider previews with
 * empty cluster arrays and a "blocked / preview / disabled" sourceMode
 * derived from the provider's mode in canonical AxiomOSState.
 *
 * When provider mode flips to "live", the per-provider extractor (to
 * be wired in a follow-up Phase) populates real cluster + workload
 * lists from the corresponding SDK. The contract here stays stable
 * — that's the whole point of the typed model.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import { extractAwsEcsClusters } from "./awsEcsExtractor";
import { extractAwsEksClusters } from "./awsEksExtractor";
import { extractAzureAksClusters } from "./azureAksExtractor";
import { extractGcpGkeClusters } from "./gcpGkeExtractor";
import { extractGhcrImages } from "./githubGhcrExtractor";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  ContainerCluster,
  ContainerOrchestrationReport,
  ContainerProvider,
  ContainerSourceMode,
  WorkloadRiskFlag,
} from "./containerOrchestrationModel";

export interface BuildContainerOrchestrationInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildContainerOrchestration(input: BuildContainerOrchestrationInput): Promise<ContainerOrchestrationReport> {
  const env = loadAppEnv();
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });

  const awsMode = state.providers.find((p) => p.provider === "aws")?.mode ?? "preview";

  // Try live AWS ECS extraction.
  let awsEcsLive: Awaited<ReturnType<typeof extractAwsEcsClusters>> | null = null;
  if (awsMode === "live" && env.awsEcsExtractEnabled) {
    try {
      awsEcsLive = await extractAwsEcsClusters();
    } catch {
      awsEcsLive = null;
    }
  }

  // Try live AWS EKS extraction.
  let awsEksLive: Awaited<ReturnType<typeof extractAwsEksClusters>> | null = null;
  if (awsMode === "live" && env.awsEksExtractEnabled) {
    try {
      awsEksLive = await extractAwsEksClusters();
    } catch {
      awsEksLive = null;
    }
  }

  // Try live Azure AKS extraction.
  let azureAksLive: Awaited<ReturnType<typeof extractAzureAksClusters>> | null = null;
  if (azureMode === "live" && env.azureInventoryExtractEnabled) {
    try {
      azureAksLive = await extractAzureAksClusters();
    } catch {
      azureAksLive = null;
    }
  }

  // Try live GCP GKE extraction.
  let gcpGkeLive: Awaited<ReturnType<typeof extractGcpGkeClusters>> | null = null;
  if (gcpMode === "live" && env.gcpInventoryExtractEnabled) {
    try {
      gcpGkeLive = await extractGcpGkeClusters();
    } catch {
      gcpGkeLive = null;
    }
  }

  // Try live GHCR extraction.
  let ghcrLive: Awaited<ReturnType<typeof extractGhcrImages>> | null = null;
  if (env.ghcrExtractEnabled) {
    try {
      ghcrLive = await extractGhcrImages();
    } catch {
      ghcrLive = null;
    }
  }
  const azureMode = state.providers.find((p) => p.provider === "azure")?.mode ?? "preview";
  const gcpMode = state.providers.find((p) => p.provider === "gcp")?.mode ?? "preview";
  const githubMode = state.providers.find((p) => p.provider === "github")?.mode ?? "preview";

  const clusters: ContainerCluster[] = [];

  // ---------------------------------------------------------------------------
  // AWS ECS — live SDK traversal when AWS mode + extractor flag are on
  // ---------------------------------------------------------------------------
  if (awsEcsLive && awsEcsLive.mode === "live" && awsEcsLive.clusters.length > 0) {
    // Real clusters from the SDK go straight in.
    for (const c of awsEcsLive.clusters) clusters.push(c);
  } else {
    clusters.push(previewCluster({
      id: "aws-ecs:preview",
      provider: "aws_ecs",
      name: "AWS ECS · preview",
      region: "us-east-1",
      providerMode: awsMode,
      limitations: awsEcsLive
        ? awsEcsLive.limitations
        : (awsMode === "live"
            ? ["AWS_ECS_EXTRACT_ENABLED is not set — flip it on to traverse ECS clusters."]
            : ["AWS mode not yet live — set AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION to unblock."]),
      externalConsoleHref: "https://console.aws.amazon.com/ecs/",
      safeNextAction: { label: "Open AWS Sources", href: "/dashboard/sources" },
    }));
  }

  // ---------------------------------------------------------------------------
  // AWS EKS — live SDK traversal when AWS mode + extractor flag are on
  // ---------------------------------------------------------------------------
  if (awsEksLive && awsEksLive.mode === "live" && awsEksLive.clusters.length > 0) {
    for (const c of awsEksLive.clusters) clusters.push(c);
  } else {
    clusters.push(previewCluster({
      id: "aws-eks:preview",
      provider: "aws_eks",
      name: "AWS EKS · preview",
      region: "us-east-1",
      providerMode: awsMode,
      limitations: awsEksLive
        ? awsEksLive.limitations
        : (awsMode === "live"
            ? ["AWS_EKS_EXTRACT_ENABLED is not set — flip it on to traverse EKS clusters + nodegroups."]
            : ["AWS mode not yet live."]),
      externalConsoleHref: "https://console.aws.amazon.com/eks/",
      safeNextAction: { label: "Open AWS Sources", href: "/dashboard/sources" },
    }));
  }

  // ---------------------------------------------------------------------------
  // GCP GKE — live SDK traversal when flag is on
  // ---------------------------------------------------------------------------
  if (gcpGkeLive && gcpGkeLive.mode === "live" && gcpGkeLive.clusters.length > 0) {
    for (const c of gcpGkeLive.clusters) clusters.push(c);
  } else {
    clusters.push(previewCluster({
      id: "gcp-gke:preview",
      provider: "gcp_gke",
      name: "GCP GKE · preview",
      region: "us-central1",
      providerMode: gcpMode,
      limitations: gcpGkeLive
        ? gcpGkeLive.limitations
        : (gcpMode === "live"
            ? ["GCP_INVENTORY_EXTRACT_ENABLED is not set — flip it on to traverse GKE clusters."]
            : ["GCP mode not yet live — set GCP_PROJECT_ID + GCP_SERVICE_ACCOUNT_JSON."]),
      externalConsoleHref: "https://console.cloud.google.com/kubernetes/",
      safeNextAction: { label: "Open GCP Sources", href: "/dashboard/sources" },
    }));
  }

  // ---------------------------------------------------------------------------
  // Azure AKS — live SDK traversal when flag is on
  // ---------------------------------------------------------------------------
  if (azureAksLive && azureAksLive.mode === "live" && azureAksLive.clusters.length > 0) {
    for (const c of azureAksLive.clusters) clusters.push(c);
  } else {
    clusters.push(previewCluster({
      id: "azure-aks:preview",
      provider: "azure_aks",
      name: "Azure AKS · preview",
      region: "eastus",
      providerMode: azureMode,
      limitations: azureAksLive
        ? azureAksLive.limitations
        : (azureMode === "live"
            ? ["AZURE_INVENTORY_EXTRACT_ENABLED is not set — flip it on to traverse AKS clusters."]
            : ["Azure mode not yet live — set AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID."]),
      externalConsoleHref: "https://portal.azure.com/",
      safeNextAction: { label: "Open Azure Sources", href: "/dashboard/sources" },
    }));
  }

  // ---------------------------------------------------------------------------
  // GitHub Container Registry — live SDK traversal when flag is on
  // ---------------------------------------------------------------------------
  if (ghcrLive && ghcrLive.mode === "live" && ghcrLive.cluster) {
    clusters.push(ghcrLive.cluster);
  } else {
    clusters.push(previewCluster({
      id: "ghcr:preview",
      provider: "github_ghcr",
      name: "GitHub Container Registry · preview",
      region: "global",
      providerMode: githubMode,
      limitations: ghcrLive
        ? ghcrLive.limitations
        : (githubMode === "live"
            ? ["GHCR_EXTRACT_ENABLED + GHCR_ORG not set — flip them on to enumerate org packages."]
            : ["GitHub mode not yet live — connect GITHUB_TOKEN with read:packages scope."]),
      externalConsoleHref: "https://github.com/orgs/?tab=packages",
      safeNextAction: { label: "Open GitHub Sources", href: "/dashboard/sources" },
    }));
  }

  // ---------------------------------------------------------------------------
  // Summary rollup
  // ---------------------------------------------------------------------------
  const byProvider: Record<ContainerProvider, number> = {
    aws_ecs: 0, aws_eks: 0, gcp_gke: 0, azure_aks: 0, github_ghcr: 0,
  };
  const riskFlagBreakdown: Record<WorkloadRiskFlag, number> = {
    no_resource_limits: 0, privileged_container: 0, root_user: 0,
    host_network: 0, secret_in_env: 0, no_readiness_probe: 0,
    no_liveness_probe: 0, imagepullbackoff: 0, outdated_image_tag: 0,
    unpatched_cve: 0,
  };
  let healthy = 0, degraded = 0, upgrading = 0, eol = 0;
  let publicEndpoints = 0, workloadsTotal = 0, podsTotal = 0, riskyWorkloads = 0;
  for (const c of clusters) {
    byProvider[c.provider]++;
    if (c.status === "healthy") healthy++;
    if (c.status === "degraded") degraded++;
    if (c.status === "upgrading") upgrading++;
    if (c.versionEol) eol++;
    publicEndpoints += c.publicEndpointsCount;
    workloadsTotal += c.workloadCount;
    podsTotal += c.podCount;
    for (const w of c.workloads) {
      if (w.riskFlags.length > 0) riskyWorkloads++;
      for (const f of w.riskFlags) riskFlagBreakdown[f]++;
    }
  }

  const overallSourceMode = rollupSourceMode(clusters.map((c) => c.sourceMode));

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    clusters,
    summary: {
      total: clusters.length,
      byProvider,
      healthy, degraded, upgrading,
      eolVersionsCount: eol,
      publicEndpointsTotal: publicEndpoints,
      workloadsTotal, podsTotal, riskyWorkloadsCount: riskyWorkloads,
      riskFlagBreakdown,
    },
    overallSourceMode,
    safetyContract: "container_orchestration_read_only",
    limitations: [
      "Live cluster traversal lands per provider in Phase 42b-e. Until then, entries declare the shape and surface their gating limitation honestly.",
      "Workload risk scanning will hook the existing security scanner once live inventory is wired.",
    ],
    safeNextAction: { label: "Open Sources", href: "/dashboard/sources" },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function previewCluster(args: {
  id: string;
  provider: ContainerProvider;
  name: string;
  region: string;
  providerMode: string;
  limitations: string[];
  externalConsoleHref?: string;
  safeNextAction: { label: string; href: string };
}): ContainerCluster {
  const sourceMode = mapMode(args.providerMode);
  return {
    id: args.id,
    provider: args.provider,
    name: args.name,
    region: args.region,
    controlPlaneVersion: undefined,
    versionEol: false,
    status: sourceMode === "live" ? "preview" : "preview",
    sourceMode,
    nodePoolCount: 0,
    nodeCount: 0,
    autoscalerEnabled: false,
    podCount: 0,
    workloadCount: 0,
    publicEndpointsCount: 0,
    networkExposure: "unknown",
    secretsPosture: "unknown",
    workloads: [],
    limitations: args.limitations,
    safeNextAction: args.safeNextAction,
    externalConsoleHref: args.externalConsoleHref,
  };
}

function mapMode(m: string): ContainerSourceMode {
  switch (m) {
    case "live":         return "partial_live"; // live provider, but cluster traversal still preview
    case "partial_live": return "partial_live";
    case "preview":      return "preview";
    case "expanding":    return "expanding";
    case "blocked":      return "blocked";
    case "disabled":     return "disabled";
    default:             return "preview";
  }
}

function rollupSourceMode(modes: ContainerSourceMode[]): ContainerSourceMode {
  if (modes.length === 0) return "unknown";
  if (modes.every((m) => m === "live")) return "live";
  if (modes.some((m) => m === "blocked")) return "blocked";
  if (modes.some((m) => m === "preview")) return "preview";
  return "partial_live";
}

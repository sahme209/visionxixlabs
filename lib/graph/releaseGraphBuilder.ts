/**
 * ReleaseOps → infrastructure graph builder.
 *
 * Connects repositories, pipelines, deployment environments, and Terraform
 * workspaces into the existing infrastructure graph. After this builder runs,
 * ReleaseOps surfaces share the same graph as cloud ops.
 *
 * Edges produced:
 *   repository contains pipeline
 *   pipeline triggers deployment_environment
 *   deployment_environment belongs_to account (the cloud account it ships to)
 *   terraform.workspace deployed_by pipeline
 *   terraform.module deployed_by terraform.workspace
 *   release execution_plan triggers pipeline
 */

import type { Repository, Pipeline, Release } from "@/lib/releaseops/releaseModel";
import {
  GraphBuilder,
  type InfrastructureGraph,
  type GraphNode,
} from "@/lib/graph/infrastructureGraph";

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

export interface ReleaseGraphInput {
  organizationId: string;
  repositories: Repository[];
  pipelines: Pipeline[];
  releases: Release[];
  /**
   * Map from environment name to cloud account ID. Optional — when present,
   * pipelines link their deployment environments to cloud accounts in the
   * graph, making the cross-system relationships visible.
   */
  environmentToAccountId?: Record<string, string>;
  /**
   * Map from environment name to cloud provider. Same purpose as above.
   */
  environmentToProvider?: Record<string, "aws" | "azure" | "gcp">;
}

// ---------------------------------------------------------------------------
// Standalone builder
// ---------------------------------------------------------------------------

export function buildGraphFromReleases(input: ReleaseGraphInput): InfrastructureGraph {
  const b = new GraphBuilder();
  applyReleasesToBuilder(b, input);
  return b.build(input.organizationId);
}

// ---------------------------------------------------------------------------
// In-place — extends an existing graph
// ---------------------------------------------------------------------------

export function extendGraphWithReleases(graph: InfrastructureGraph, input: ReleaseGraphInput): InfrastructureGraph {
  const b = new GraphBuilder();
  // Re-seed builder with existing nodes/edges so upsertNode merges
  for (const n of graph.nodes) b.upsertNode(n);
  for (const e of graph.edges) b.upsertEdge(e);
  applyReleasesToBuilder(b, input);
  return b.build(graph.organizationId, graph.source);
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function applyReleasesToBuilder(b: GraphBuilder, input: ReleaseGraphInput): void {
  const now = new Date().toISOString();

  for (const repo of input.repositories) {
    const repoNode: GraphNode = {
      id: `repo_${repo.system}_${repo.id}`,
      type: "repository",
      label: `${repo.organization}/${repo.name}`,
      provider: repo.system,
      status: "operational",
      riskLevel: "info",
      confidence: 1,
      metadata: { defaultBranch: repo.defaultBranch, visibility: repo.visibility },
      lastObservedAt: repo.observedAt,
    };
    b.upsertNode(repoNode);

    // Branch protection = governed_by edge from repo to its own protections
    for (const protection of repo.protections) {
      b.upsertNode({
        id: `protection_${repo.id}_${protection.branch}`,
        type: "approval_workflow",
        label: `${repo.name}@${protection.branch} protection`,
        provider: repo.system,
        status: "operational",
        riskLevel: protection.requiredReviewers >= 1 ? "info" : "medium",
        confidence: 1,
        metadata: {
          requiredReviewers: protection.requiredReviewers,
          requireCodeOwnerReviews: protection.requireCodeOwnerReviews,
          requireLinearHistory: protection.requireLinearHistory,
        },
        lastObservedAt: repo.observedAt,
      });
      b.link(repoNode.id, `protection_${repo.id}_${protection.branch}`, "governed_by", {
        evidence: [
          { name: "branch", value: protection.branch },
          { name: "requiredReviewers", value: String(protection.requiredReviewers) },
        ],
      });
    }
  }

  for (const pipeline of input.pipelines) {
    const pipelineId = `pipeline_${pipeline.system}_${pipeline.id}`;
    b.upsertNode({
      id: pipelineId,
      type: "pipeline",
      label: pipeline.name,
      provider: pipeline.system,
      status: "operational",
      riskLevel: "info",
      confidence: 1,
      metadata: { trigger: pipeline.trigger, environment: pipeline.environment ?? "" },
      lastObservedAt: pipeline.observedAt,
    });
    b.link(`repo_${pipeline.system}_${pipeline.repositoryId}`, pipelineId, "contains", {
      evidence: [{ name: "definitionPath", value: pipeline.definitionPath ?? "" }],
    });

    if (pipeline.environment) {
      const envId = `env_${pipeline.environment}`;
      b.upsertNode({
        id: envId,
        type: "deployment_environment",
        label: pipeline.environment,
        status: pipeline.environment === "production" ? "operational" : "operational",
        riskLevel: pipeline.environment === "production" ? "medium" : "low",
        confidence: 1,
        metadata: {},
        lastObservedAt: pipeline.observedAt,
      });
      b.link(pipelineId, envId, "triggers", { evidence: [{ name: "trigger", value: pipeline.trigger }] });

      // Cross-link environment → cloud account when mapping is provided
      const accountId = input.environmentToAccountId?.[pipeline.environment];
      const accountProvider = input.environmentToProvider?.[pipeline.environment];
      if (accountId && accountProvider) {
        b.link(envId, `account_${accountProvider}_${accountId}`, "deployed_by", {
          confidence: 0.9,
          evidence: [{ name: "mapping", value: "configured" }],
        });
      }
    }
  }

  for (const release of input.releases) {
    const releaseId = `release_${release.id}`;
    b.upsertNode({
      id: releaseId,
      type: "execution_plan",
      label: `${release.service} ${release.ref}`,
      provider: release.system,
      status:
        release.status === "succeeded" ? "operational" :
        release.status === "failed" || release.status === "rolled_back" || release.status === "blocked" ? "unhealthy" :
        release.status === "running" ? "scanning" :
        "unknown",
      riskLevel:
        release.blastRadius === "broad" ? "high" :
        release.blastRadius === "moderate" ? "medium" :
        "low",
      confidence: 1,
      metadata: {
        status: release.status,
        environment: release.environment,
        commit: release.commit,
        readinessScore: release.readinessScore ?? 0,
      },
      lastObservedAt: release.startedAt,
    });
    b.link(`pipeline_${release.system}_${release.pipelineId}`, releaseId, "triggers", {
      evidence: [{ name: "ref", value: release.ref }],
    });
    b.link(releaseId, `env_${release.environment}`, "deployed_by", {
      evidence: [{ name: "environment", value: release.environment }],
    });

    // Link affected cloud resources if present
    for (const resource of release.affectedCloudResources ?? []) {
      const resourceNodeId = `resource_${resource.provider}_${resource.id}`;
      b.link(releaseId, resourceNodeId, "executes", {
        confidence: 0.95,
        evidence: [{ name: "source", value: "release.affectedCloudResources" }],
      });
    }
  }

  void now;
}

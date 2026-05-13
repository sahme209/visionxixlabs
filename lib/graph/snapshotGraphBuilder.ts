/**
 * Snapshot → infrastructure graph builder.
 *
 * Converts a normalized CloudSnapshot into typed graph nodes + edges.
 * AWS / Azure / GCP all flow through the same builder thanks to the
 * normalized resource model.
 */

import type { CloudSnapshot, NormalizedResource } from "@/lib/cloud/snapshotModel";
import {
  GraphBuilder,
  type InfrastructureGraph,
  type GraphNode,
  type GraphNodeType,
  type NodeRiskLevel,
} from "@/lib/graph/infrastructureGraph";

// ---------------------------------------------------------------------------
// Kind → graph node-type mapping
// ---------------------------------------------------------------------------

function nodeTypeForKind(kind: NormalizedResource["kind"]): GraphNodeType {
  if (kind.startsWith("compute.serverless")) return "compute.serverless";
  if (kind.startsWith("compute.container")) return "compute.cluster";
  if (kind.startsWith("compute.")) return "compute.instance";
  if (kind === "storage.object") return "storage.object";
  if (kind.startsWith("storage.")) return "storage.block";
  if (kind.startsWith("database.")) return "database";
  if (kind === "network.vpc") return "vpc";
  if (kind === "network.subnet") return "subnet";
  if (kind === "network.firewall") return "firewall";
  if (kind === "network.loadbalancer") return "loadbalancer";
  if (kind.startsWith("identity.")) return "identity.principal";
  return "compute.instance";
}

function highestRisk(resource: NormalizedResource): NodeRiskLevel {
  let max: NodeRiskLevel = "info";
  const order: NodeRiskLevel[] = ["info", "low", "medium", "high", "critical"];
  for (const r of resource.risks) {
    if (order.indexOf(r.severity) > order.indexOf(max)) max = r.severity;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface BuildOptions {
  organizationId: string;
}

/**
 * Convert one or more snapshots into a unified infrastructure graph.
 * Multi-cloud snapshots can be combined — the graph merges them on
 * shared accounts / providers / regions.
 */
export function buildGraphFromSnapshots(snapshots: CloudSnapshot[], opts: BuildOptions): InfrastructureGraph {
  const b = new GraphBuilder();
  const now = new Date().toISOString();

  for (const snap of snapshots) {
    // Provider + account nodes
    for (const account of snap.accounts) {
      const providerNodeId = `provider_${account.provider}`;
      b.upsertNode({
        id: providerNodeId,
        type: "provider",
        label: account.provider.toUpperCase(),
        provider: account.provider,
        status: "operational",
        riskLevel: "info",
        confidence: 1,
        metadata: { accountCount: 1 },
        lastObservedAt: account.collectedAt,
      });

      const accountNodeId = `account_${account.provider}_${account.id}`;
      b.upsertNode({
        id: accountNodeId,
        type: "account",
        label: account.displayName ?? account.id,
        provider: account.provider,
        accountId: account.id,
        status: "operational",
        riskLevel: "info",
        confidence: 1,
        metadata: { regionCount: account.regions.length },
        sourceSnapshotId: snap.id,
        lastObservedAt: account.collectedAt,
      });
      b.link(providerNodeId, accountNodeId, "contains", { evidence: [{ name: "provider", value: account.provider }] });

      for (const region of account.regions) {
        const regionNodeId = `region_${account.provider}_${account.id}_${region}`;
        b.upsertNode({
          id: regionNodeId,
          type: "region",
          label: region,
          provider: account.provider,
          accountId: account.id,
          region,
          status: "operational",
          riskLevel: "info",
          confidence: 1,
          metadata: {},
          sourceSnapshotId: snap.id,
          lastObservedAt: account.collectedAt,
        });
        b.link(accountNodeId, regionNodeId, "contains", { evidence: [{ name: "region", value: region }] });
      }
    }

    // Resource nodes
    for (const resource of snap.resources) {
      const type = nodeTypeForKind(resource.kind);
      const accountNodeId = `account_${resource.ref.provider}_${resource.ref.accountId ?? "_"}`;
      const regionNodeId = resource.ref.region ? `region_${resource.ref.provider}_${resource.ref.accountId ?? "_"}_${resource.ref.region}` : undefined;
      const nodeId = `resource_${resource.ref.provider}_${resource.ref.id}`;

      b.upsertNode({
        id: nodeId,
        type,
        label: resource.name ?? resource.ref.id,
        provider: resource.ref.provider,
        accountId: resource.ref.accountId,
        region: resource.ref.region,
        status: resource.state === "running" ? "operational" : resource.state === "stopped" ? "degraded" : "unknown",
        riskLevel: highestRisk(resource),
        monthlyCostUsd: resource.monthlyCostUsd,
        confidence: resource.state === "unknown" ? 0.5 : 0.9,
        metadata: {
          kind: resource.kind,
          state: resource.state,
          ...stringifyTags(resource.tags),
        },
        sourceSnapshotId: snap.id,
        lastObservedAt: now,
      });

      // Resource → region (contains)
      if (regionNodeId) {
        b.link(regionNodeId, nodeId, "contains", { evidence: [{ name: "region", value: resource.ref.region ?? "_" }] });
      } else {
        b.link(accountNodeId, nodeId, "contains", {});
      }

      // Resource dependencies declared on the resource itself
      if (resource.dependencies) {
        for (const dep of resource.dependencies) {
          const depNodeId = `resource_${dep.provider}_${dep.id}`;
          b.link(nodeId, depNodeId, "depends_on", { confidence: 0.85, evidence: [{ name: "source", value: "snapshot.dependencies" }] });
        }
      }

      // Specialized edges by resource kind
      if (resource.kind.startsWith("compute.") && resource.config.security_groups && Array.isArray(resource.config.security_groups)) {
        for (const sg of resource.config.security_groups as string[]) {
          const sgNodeId = `resource_${resource.ref.provider}_${sg}`;
          b.link(nodeId, sgNodeId, "governed_by", { confidence: 0.9, evidence: [{ name: "security_group", value: sg }] });
        }
      }
      if (resource.kind === "network.loadbalancer" && resource.config.targets && Array.isArray(resource.config.targets)) {
        for (const target of resource.config.targets as string[]) {
          const targetNodeId = `resource_${resource.ref.provider}_${target}`;
          b.link(nodeId, targetNodeId, "exposes", { confidence: 0.95, evidence: [{ name: "target", value: target }] });
        }
      }
      if (resource.kind.startsWith("database.")) {
        // Database doesn't auto-link to compute readers — would require traffic data
        // Mark unknown clearly via lower confidence.
      }
    }
  }

  return b.build(opts.organizationId, snapshots[0]?.source === "live" ? "live" : "demo");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stringifyTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) out[`tag.${k}`] = v;
  return out;
}

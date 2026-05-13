/**
 * Multi-cloud infrastructure intelligence graph.
 *
 * Typed nodes + edges that span AWS / Azure / GCP / GitHub / Terraform /
 * desktop runtime / approval workflows / execution plans / audit events.
 *
 * This is the substrate the dependency reasoner, blast-radius engine,
 * topology UX, approval center, and execution detail surface all read from.
 *
 * Every relationship has explicit confidence + evidence — no inferred
 * relationships are surfaced as facts.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// Node taxonomy
// ---------------------------------------------------------------------------

export type GraphNodeType =
  // Cloud infrastructure
  | "provider"
  | "account"                  // AWS account / Azure subscription / GCP project
  | "region"
  | "vpc"                      // AWS VPC / Azure VNet / GCP VPC
  | "subnet"
  | "compute.instance"         // EC2 / Azure VM / GCE
  | "compute.serverless"       // Lambda / Functions / Cloud Run
  | "compute.cluster"          // ECS / AKS / GKE
  | "storage.object"           // S3 / Blob / GCS
  | "storage.block"            // EBS / Managed Disk / Persistent Disk
  | "database"                 // RDS / Azure SQL / Cloud SQL
  | "loadbalancer"             // ELB / Azure LB / GCLB
  | "firewall"                 // Security Group / NSG / VPC Firewall
  | "identity.principal"       // IAM user/role/SP/SA
  | "kubernetes.cluster"
  // ReleaseOps + CI/CD
  | "repository"
  | "pipeline"                 // GitHub Actions / GitLab CI / Jenkins
  | "deployment_environment"
  | "terraform.workspace"
  | "terraform.module"
  // Operational entities
  | "desktop.runtime"
  | "approval_workflow"
  | "execution_plan"
  | "audit_event";

// ---------------------------------------------------------------------------
// Edge taxonomy
// ---------------------------------------------------------------------------

export type GraphEdgeType =
  | "contains"        // account contains region; region contains VPC; VPC contains subnet
  | "depends_on"      // compute depends_on database; pipeline depends_on terraform.workspace
  | "connects_to"     // subnet connects_to gateway; service connects_to service
  | "exposes"         // loadbalancer exposes compute; firewall exposes ingress
  | "reads_from"      // compute reads_from storage; pipeline reads_from repository
  | "writes_to"       // compute writes_to storage / database
  | "deployed_by"     // resource deployed_by terraform.module / pipeline
  | "governed_by"     // resource governed_by identity.policy
  | "approved_by"     // execution_plan approved_by approval_workflow
  | "monitored_by"    // resource monitored_by alarm
  | "executes"        // execution_plan executes change-on resource
  | "rolls_back"      // execution_plan rolls_back from snapshot
  | "verifies"        // verification.check verifies resource
  | "belongs_to"      // resource belongs_to account / project / org
  | "triggers"        // pipeline triggers deployment; release triggers verification
  | "blocks";         // approval_workflow blocks execution_plan; dependency blocks rollback

// ---------------------------------------------------------------------------
// Node + edge types
// ---------------------------------------------------------------------------

export type NodeStatus = "operational" | "degraded" | "unknown" | "unhealthy" | "scanning";
export type NodeRiskLevel = "info" | "low" | "medium" | "high" | "critical";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  provider?: CloudProvider | "github" | "gitlab" | "azure_devops" | "jenkins" | "system" | "desktop";
  /** Account / subscription / project ID this node lives in. */
  accountId?: string;
  /** Region / location if applicable. */
  region?: string;
  status: NodeStatus;
  riskLevel: NodeRiskLevel;
  /** Cost signal if relevant — monthly USD. */
  monthlyCostUsd?: number;
  /** Confidence in [0, 1] for the node's data. */
  confidence: number;
  /** Free-form structured metadata. */
  metadata: Record<string, string | number | boolean>;
  /** Snapshot the data came from. */
  sourceSnapshotId?: string;
  /** Last time this node was observed. */
  lastObservedAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  confidence: number;
  /** Why we believe this edge exists. */
  evidence: { name: string; value: string }[];
  lastObservedAt: string;
}

export interface InfrastructureGraph {
  /** Tenant scope — graph is always partitioned per organization. */
  organizationId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** When the graph was last (re)built. */
  builtAt: string;
  /** Honest source tag — does the data reflect real scans or demo fixtures. */
  source: "live" | "demo" | "preview";
}

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

export class GraphBuilder {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();

  upsertNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      this.nodes.set(node.id, {
        ...existing,
        ...node,
        metadata: { ...existing.metadata, ...node.metadata },
        lastObservedAt: node.lastObservedAt,
        confidence: Math.max(existing.confidence, node.confidence),
      });
    } else {
      this.nodes.set(node.id, node);
    }
  }

  upsertEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  /** Link two nodes by type. Generates a stable edge id from source/target/type. */
  link(
    sourceId: string,
    targetId: string,
    type: GraphEdgeType,
    opts: { confidence?: number; evidence?: GraphEdge["evidence"]; observedAt?: string } = {}
  ): void {
    const id = `edge_${sourceId}__${type}__${targetId}`;
    this.upsertEdge({
      id,
      source: sourceId,
      target: targetId,
      type,
      confidence: opts.confidence ?? 0.9,
      evidence: opts.evidence ?? [],
      lastObservedAt: opts.observedAt ?? new Date().toISOString(),
    });
  }

  build(organizationId: string, source: InfrastructureGraph["source"] = "live"): InfrastructureGraph {
    return {
      organizationId,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      builtAt: new Date().toISOString(),
      source,
    };
  }
}

// ---------------------------------------------------------------------------
// Query helpers — pure functions over a built graph
// ---------------------------------------------------------------------------

export function nodesByType(graph: InfrastructureGraph, type: GraphNodeType): GraphNode[] {
  return graph.nodes.filter((n) => n.type === type);
}

export function findNode(graph: InfrastructureGraph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function outgoingEdges(graph: InfrastructureGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

export function incomingEdges(graph: InfrastructureGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.target === nodeId);
}

export function neighbors(graph: InfrastructureGraph, nodeId: string): GraphNode[] {
  const ids = new Set<string>();
  for (const e of graph.edges) {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  }
  return graph.nodes.filter((n) => ids.has(n.id));
}

/**
 * Bounded BFS from a starting node. Returns reachable nodes within `maxDepth`
 * along the given edge types. Used by the blast-radius engine.
 */
export function reachableFrom(
  graph: InfrastructureGraph,
  startId: string,
  maxDepth: number,
  edgeTypes?: GraphEdgeType[]
): { nodes: GraphNode[]; depths: Map<string, number> } {
  const depths = new Map<string, number>([[startId, 0]]);
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  const allowed = edgeTypes ? new Set(edgeTypes) : null;

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const e of graph.edges) {
      if (allowed && !allowed.has(e.type)) continue;
      const next = e.source === id ? e.target : e.target === id ? e.source : null;
      if (!next || depths.has(next)) continue;
      depths.set(next, depth + 1);
      queue.push({ id: next, depth: depth + 1 });
    }
  }

  return {
    nodes: graph.nodes.filter((n) => depths.has(n.id) && n.id !== startId),
    depths,
  };
}

/** Total monthly cost across all nodes in the graph. */
export function totalGraphCost(graph: InfrastructureGraph): number {
  return graph.nodes.reduce((s, n) => s + (n.monthlyCostUsd ?? 0), 0);
}

/** Summarize risk distribution across the graph. */
export function summarizeGraphRisk(graph: InfrastructureGraph): Record<NodeRiskLevel, number> {
  const out: Record<NodeRiskLevel, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const n of graph.nodes) out[n.riskLevel]++;
  return out;
}

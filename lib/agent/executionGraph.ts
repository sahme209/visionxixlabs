/**
 * Execution Graph — the AGI operations graph.
 *
 * Distinct from the infrastructure topology graph (which describes the
 * customer's cloud). This graph represents *operational work* —
 * observations, findings, recommendations, policy decisions, approvals,
 * execution plans, desktop handoffs, audit events, memory.
 *
 * Every Axiom subsystem feeds nodes + edges into this graph; the brain
 * reads from it; the autonomous-ops page renders it.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | "observation"
  | "provider_connection"
  | "validation_result"
  | "cloud_snapshot"
  | "security_scan"
  | "finding"
  | "recommendation"
  | "reasoning_trace"
  | "policy_decision"
  | "approval_request"
  | "execution_plan"
  | "terraform_preview"
  | "rollback_plan"
  | "verification_check"
  | "workflow"
  | "agent_job"
  | "releaseops_signal"
  | "github_workflow"
  | "desktop_handoff"
  | "audit_event"
  | "operation_trace"
  | "memory_record"
  | "next_action";

export type GraphNodeStatus =
  | "ready"
  | "pending"
  | "running"
  | "paused"
  | "blocked"
  | "completed"
  | "failed"
  | "preview"
  | "planned";

export type GraphRiskLevel = "informational" | "low" | "medium" | "high" | "critical";
export type GraphSourceMode = "live" | "preview" | "planned" | "blocked";

export interface ExecutionGraphNode {
  id: string;
  type: GraphNodeType;
  title: string;
  status: GraphNodeStatus;
  risk: GraphRiskLevel;
  /** Optional provider scope when relevant. */
  provider?: CloudProvider | "github" | "desktop" | "platform";
  /** Tenant id from currentContext — keeps graph multi-tenant ready. */
  tenantId?: string;
  /** Source module that produced this node (audit-friendly). */
  sourceModule: string;
  /** References to underlying typed records (coverage rows, finding ids, etc). */
  evidence: { label: string; ref: string }[];
  createdAt: string;
  updatedAt: string;
  /** 0..1 — confidence in the data backing this node. */
  confidence: number;
  /** Honest source mode. */
  sourceMode: GraphSourceMode;
  /** Optional short detail. */
  detail?: string;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export type GraphEdgeKind =
  | "produced_by"
  | "depends_on"
  | "blocked_by"
  | "requires_approval"
  | "governed_by"
  | "explains"
  | "verifies"
  | "remediates"
  | "creates"
  | "updates"
  | "triggers"
  | "supersedes"
  | "learned_from"
  | "ready_for"
  | "not_ready_because";

export interface ExecutionGraphEdge {
  id: string;
  kind: GraphEdgeKind;
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /** Optional short reason that explains why this edge exists. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Graph wrapper
// ---------------------------------------------------------------------------

export interface ExecutionGraph {
  generatedAt: string;
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
  /** Stats for quick UI rendering. */
  stats: {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<GraphNodeType, number>;
    nodesByStatus: Record<GraphNodeStatus, number>;
    criticalNodes: number;
    blockedNodes: number;
    approvalGated: number;
    desktopEligible: number;
  };
}

// ---------------------------------------------------------------------------
// Builder helpers (mutators) — used by executionGraphBuilder.ts
// ---------------------------------------------------------------------------

export class GraphBuilder {
  private readonly nodes: ExecutionGraphNode[] = [];
  private readonly edges: ExecutionGraphEdge[] = [];

  addNode(node: ExecutionGraphNode): ExecutionGraphNode {
    if (this.nodes.find((n) => n.id === node.id)) {
      // Idempotent — return existing.
      return this.nodes.find((n) => n.id === node.id)!;
    }
    this.nodes.push(node);
    return node;
  }

  addEdge(edge: Omit<ExecutionGraphEdge, "id"> & { id?: string }): ExecutionGraphEdge {
    const id = edge.id ?? `${edge.kind}:${edge.from}→${edge.to}`;
    if (this.edges.find((e) => e.id === id)) {
      return this.edges.find((e) => e.id === id)!;
    }
    const full: ExecutionGraphEdge = { id, kind: edge.kind, from: edge.from, to: edge.to, reason: edge.reason };
    this.edges.push(full);
    return full;
  }

  nodeIds(type: GraphNodeType): string[] {
    return this.nodes.filter((n) => n.type === type).map((n) => n.id);
  }

  build(): ExecutionGraph {
    const nodesByType = NODE_TYPES.reduce((acc, t) => {
      acc[t] = this.nodes.filter((n) => n.type === t).length;
      return acc;
    }, {} as Record<GraphNodeType, number>);
    const nodesByStatus = NODE_STATUSES.reduce((acc, s) => {
      acc[s] = this.nodes.filter((n) => n.status === s).length;
      return acc;
    }, {} as Record<GraphNodeStatus, number>);

    const criticalNodes  = this.nodes.filter((n) => n.risk === "critical").length;
    const blockedNodes   = this.nodes.filter((n) => n.status === "blocked").length;
    const approvalGated  = this.edges.filter((e) => e.kind === "requires_approval").length;
    const desktopEligible = this.nodes.filter((n) => n.type === "desktop_handoff" && n.status !== "blocked").length;

    return {
      generatedAt: new Date().toISOString(),
      nodes: [...this.nodes],
      edges: [...this.edges],
      stats: {
        nodeCount: this.nodes.length,
        edgeCount: this.edges.length,
        nodesByType,
        nodesByStatus,
        criticalNodes,
        blockedNodes,
        approvalGated,
        desktopEligible,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const NODE_TYPES: GraphNodeType[] = [
  "observation", "provider_connection", "validation_result", "cloud_snapshot",
  "security_scan", "finding", "recommendation", "reasoning_trace",
  "policy_decision", "approval_request", "execution_plan", "terraform_preview",
  "rollback_plan", "verification_check", "workflow", "agent_job",
  "releaseops_signal", "github_workflow", "desktop_handoff", "audit_event",
  "operation_trace", "memory_record", "next_action",
];

const NODE_STATUSES: GraphNodeStatus[] = [
  "ready", "pending", "running", "paused", "blocked", "completed",
  "failed", "preview", "planned",
];

export const NODE_TYPE_LABEL: Record<GraphNodeType, string> = {
  observation:         "Observation",
  provider_connection: "Provider connection",
  validation_result:   "Validation result",
  cloud_snapshot:      "Cloud snapshot",
  security_scan:       "Security scan",
  finding:             "Finding",
  recommendation:      "Recommendation",
  reasoning_trace:     "Reasoning trace",
  policy_decision:     "Policy decision",
  approval_request:    "Approval request",
  execution_plan:      "Execution plan",
  terraform_preview:   "Terraform preview",
  rollback_plan:       "Rollback plan",
  verification_check:  "Verification check",
  workflow:            "Workflow",
  agent_job:           "Agent job",
  releaseops_signal:   "ReleaseOps signal",
  github_workflow:     "GitHub workflow",
  desktop_handoff:     "Desktop handoff",
  audit_event:         "Audit event",
  operation_trace:     "Operation trace",
  memory_record:       "Memory record",
  next_action:         "Next action",
};

export const EDGE_KIND_LABEL: Record<GraphEdgeKind, string> = {
  produced_by:         "produced by",
  depends_on:          "depends on",
  blocked_by:          "blocked by",
  requires_approval:   "requires approval",
  governed_by:         "governed by",
  explains:            "explains",
  verifies:            "verifies",
  remediates:          "remediates",
  creates:             "creates",
  updates:             "updates",
  triggers:            "triggers",
  supersedes:          "supersedes",
  learned_from:        "learned from",
  ready_for:           "ready for",
  not_ready_because:   "not ready because",
};

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function nodesOfType(graph: ExecutionGraph, type: GraphNodeType): ExecutionGraphNode[] {
  return graph.nodes.filter((n) => n.type === type);
}

export function neighborsOf(graph: ExecutionGraph, nodeId: string): { in: ExecutionGraphEdge[]; out: ExecutionGraphEdge[] } {
  return {
    in:  graph.edges.filter((e) => e.to === nodeId),
    out: graph.edges.filter((e) => e.from === nodeId),
  };
}

export function highestRiskNodes(graph: ExecutionGraph, limit = 5): ExecutionGraphNode[] {
  const rank: Record<GraphRiskLevel, number> = {
    critical: 4, high: 3, medium: 2, low: 1, informational: 0,
  };
  return [...graph.nodes].sort((a, b) => rank[b.risk] - rank[a.risk]).slice(0, limit);
}

export function blockedNodes(graph: ExecutionGraph): ExecutionGraphNode[] {
  return graph.nodes.filter((n) => n.status === "blocked");
}

export function approvalGatedNodes(graph: ExecutionGraph): ExecutionGraphNode[] {
  const approvalEdges = graph.edges.filter((e) => e.kind === "requires_approval");
  const ids = new Set(approvalEdges.map((e) => e.from));
  return graph.nodes.filter((n) => ids.has(n.id));
}

export function nextActionsFromGraph(graph: ExecutionGraph): ExecutionGraphNode[] {
  return nodesOfType(graph, "next_action").filter((n) => n.status === "ready" || n.status === "pending");
}

/**
 * Desktop graph handoff — packages a subset of the infrastructure graph
 * relevant to an execution plan, so the desktop app can review the affected
 * topology + blast radius locally without round-tripping to the cloud.
 */

import type { InfrastructureGraph, GraphNode, GraphEdge } from "@/lib/graph/infrastructureGraph";
import type { BlastRadiusReport } from "@/lib/graph/blastRadius";

export interface GraphHandoffBundle {
  id: string;
  /** Plan this handoff supports. */
  planId: string;
  /** Subset of nodes relevant to the plan. */
  nodes: GraphNode[];
  /** Subset of edges relevant to the plan. */
  edges: GraphEdge[];
  /** Blast radius report attached. */
  blastRadius: BlastRadiusReport;
  /** Verification targets the desktop will run locally. */
  verificationTargets: string[];
  preparedAt: string;
  expiresAt: string;
}

/**
 * Build a graph handoff bundle for a given plan + blast radius report.
 * Only nodes + edges within the report's affected set are included — keeps
 * the bundle small for desktop sync.
 */
export function buildGraphHandoff(
  planId: string,
  graph: InfrastructureGraph,
  blastRadius: BlastRadiusReport,
  options: { expiryHours?: number } = {}
): GraphHandoffBundle {
  const affectedIds = new Set<string>([blastRadius.rootNodeId]);
  for (const n of [...blastRadius.directlyAffected, ...blastRadius.indirectlyAffected]) {
    affectedIds.add(n.id);
  }

  const nodes = graph.nodes.filter((n) => affectedIds.has(n.id));
  const edges = graph.edges.filter((e) => affectedIds.has(e.source) && affectedIds.has(e.target));

  const verificationTargets = nodes
    .filter((n) => n.type === "compute.instance" || n.type === "loadbalancer" || n.type === "database")
    .map((n) => n.id);

  const preparedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (options.expiryHours ?? 24) * 3600_000).toISOString();

  return {
    id: `graph_handoff_${planId}_${Date.now().toString(36)}`,
    planId,
    nodes,
    edges,
    blastRadius,
    verificationTargets,
    preparedAt,
    expiresAt,
  };
}

/** Total bundle size in bytes (estimate, for sync planning). */
export function bundleSizeBytes(bundle: GraphHandoffBundle): number {
  try {
    return JSON.stringify(bundle).length;
  } catch {
    return 0;
  }
}

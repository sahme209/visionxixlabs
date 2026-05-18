/**
 * Operating Graph — typed contract for the connected operating model.
 *
 * The Operating Graph is the canonical way to express "what is connected
 * to what" across Axiom's production systems:
 *
 *   source → integration_health → operating_loop → security_findings →
 *   remediation → simulation → policy → approval → desktop_review →
 *   audit → evidence → trust_center
 *
 * It is NOT a new persistence layer. It is a pure-function projection
 * over already-canonical state (AxiomOSState + IntegrationHealthReport).
 *
 * Nodes carry honest status / sourceMode / safeNextAction. Edges carry
 * typed relationships + canonical evidenceRefs the operator can verify.
 *
 * No SDK calls. No secrets. No fabrication. Tenant-scoped via the
 * underlying state builders.
 */

export type OperatingGraphNodeType =
  | "source"
  | "integration_health"
  | "operating_loop"
  | "security_findings"
  | "remediation"
  | "simulation"
  | "policy"
  | "approval"
  | "desktop_review"
  | "audit"
  | "evidence"
  | "trust_center"
  | "readiness";

export type OperatingGraphRelation =
  | "produced"
  | "detected"
  | "explains"
  | "recommends"
  | "prepares"
  | "simulates"
  | "requires_approval"
  | "approved_by"
  | "reviewed_on_desktop"
  | "audited_by"
  | "evidenced_by"
  | "notified_by"
  | "blocked_by"
  | "governed_by"
  | "improves_readiness"
  | "monitored_by"
  | "displayed_in";

export type OperatingGraphNodeStatus =
  | "healthy"
  | "in_progress"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type OperatingGraphSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "foundation"
  | "planned"
  | "blocked"
  | "disabled"
  | "unknown";

/** One operational object the graph reports on. */
export interface OperatingGraphNode {
  id: string;
  type: OperatingGraphNodeType;
  title: string;
  status: OperatingGraphNodeStatus;
  sourceMode: OperatingGraphSourceMode;
  /** Honest count when the node represents a collection (e.g. 5 findings). */
  count?: number;
  /** Severity rollup for finding/risk-like nodes. */
  severity?: "critical" | "high" | "medium" | "low";
  /** Route the operator can click to drill in. */
  route?: string;
  /** Limitations operators should see. */
  limitations: string[];
  /** Safe next action — never a mutation. */
  safeNextAction?: { label: string; href: string };
  /** Stable evidence ids the operator can audit. */
  evidenceRefs: string[];
}

/** One canonical relationship between two operational objects. */
export interface OperatingGraphEdge {
  from: string;
  to: string;
  relation: OperatingGraphRelation;
  /** Why this edge exists — operator-readable. */
  explanation: string;
  /** Evidence proving the link. */
  evidenceRefs: string[];
}

/** Composite shape the API returns. */
export interface OperatingGraph {
  generatedAt: string;
  tenantId?: string;
  nodes: OperatingGraphNode[];
  edges: OperatingGraphEdge[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    blockedNodes: number;
    previewNodes: number;
    healthyNodes: number;
  };
  /** Honest overall sourceMode rollup across all nodes. */
  overallSourceMode: OperatingGraphSourceMode;
  /** Limitations of the graph composition itself. */
  limitations: string[];
  /** Operator-level safeNextAction. */
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const NODE_TYPE_LABEL: Record<OperatingGraphNodeType, string> = {
  source:              "Source",
  integration_health:  "Integration health",
  operating_loop:      "Operating loop",
  security_findings:   "Security findings",
  remediation:         "Remediation",
  simulation:          "Simulation",
  policy:              "Policy governance",
  approval:            "Approval",
  desktop_review:      "Desktop review",
  audit:               "Audit",
  evidence:            "Evidence",
  trust_center:        "Trust Center",
  readiness:           "Readiness",
};

export const RELATION_LABEL: Record<OperatingGraphRelation, string> = {
  produced:            "produced",
  detected:            "detected",
  explains:            "explains",
  recommends:          "recommends",
  prepares:            "prepares",
  simulates:           "simulates",
  requires_approval:   "requires approval",
  approved_by:         "approved by",
  reviewed_on_desktop: "reviewed on desktop",
  audited_by:          "audited by",
  evidenced_by:        "evidenced by",
  notified_by:         "notified by",
  blocked_by:          "blocked by",
  governed_by:         "governed by",
  improves_readiness:  "improves readiness",
  monitored_by:        "monitored by",
  displayed_in:        "displayed in",
};

/** Most-conservative rollup of sourceMode across the graph. */
export function rollupGraphSourceMode(nodes: OperatingGraphNode[]): OperatingGraphSourceMode {
  if (nodes.length === 0) return "unknown";
  if (nodes.some((n) => n.sourceMode === "blocked"))      return "blocked";
  if (nodes.some((n) => n.sourceMode === "disabled"))     return "disabled";
  if (nodes.some((n) => n.sourceMode === "preview"))      return "preview";
  if (nodes.some((n) => n.sourceMode === "foundation"))   return "foundation";
  if (nodes.some((n) => n.sourceMode === "partial_live")) return "partial_live";
  if (nodes.every((n) => n.sourceMode === "live"))        return "live";
  return "unknown";
}

/** Group edges by source node for UI rendering. */
export function edgesFromNode(graph: OperatingGraph, nodeId: string): OperatingGraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

/** Group edges by target node for UI rendering. */
export function edgesToNode(graph: OperatingGraph, nodeId: string): OperatingGraphEdge[] {
  return graph.edges.filter((e) => e.to === nodeId);
}

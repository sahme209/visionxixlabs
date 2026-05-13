/**
 * Blast radius analysis engine.
 *
 * Given a starting node (resource, execution plan, deployment, etc.),
 * compute the typed BlastRadiusReport covering directly + indirectly
 * affected nodes, risk concentration, production exposure, provider
 * exposure, rollback complexity, and a safe next-action.
 *
 * Pure function over an InfrastructureGraph. Easy to test.
 */

import type {
  InfrastructureGraph,
  GraphNode,
  GraphEdgeType,
} from "@/lib/graph/infrastructureGraph";
import {
  findNode,
  reachableFrom,
} from "@/lib/graph/infrastructureGraph";

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export type BlastRadiusScore = "contained" | "moderate" | "broad" | "critical";

export interface BlastRadiusReport {
  /** Starting node for the analysis. */
  rootNodeId: string;
  /** Direct-edge neighbors (depth 1). */
  directlyAffected: GraphNode[];
  /** Indirectly affected — reached through dependency chains within depth limit. */
  indirectlyAffected: GraphNode[];
  /** Production environments / accounts in the affected set. */
  productionAffected: GraphNode[];
  /** Providers affected by the change. */
  providersAffected: string[];
  /** Deployment environments affected. */
  environmentsAffected: string[];
  /** Pipelines affected. */
  pipelinesAffected: string[];
  /** Resources affected. */
  resourcesAffected: string[];
  /** Risk concentration — distribution of risk levels in the affected set. */
  riskConcentration: Record<string, number>;
  /** Final blast-radius classification. */
  score: BlastRadiusScore;
  /** Plain-English summary the UI surfaces. */
  reason: string;
  /** Structured evidence — what drove the score. */
  evidence: { name: string; value: string }[];
  /** Suggested next action to reduce blast radius. */
  safeNextAction: string;
  /** Rollback complexity hint based on dependency depth. */
  rollbackComplexity: "trivial" | "moderate" | "complex" | "high";
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

interface AnalysisOptions {
  /** How far to walk dependency edges. Default 3. */
  maxDepth?: number;
  /** Edge types to traverse. Default: dependency-relevant edges. */
  edgeTypes?: GraphEdgeType[];
}

const DEFAULT_EDGE_TYPES: GraphEdgeType[] = [
  "depends_on",
  "exposes",
  "reads_from",
  "writes_to",
  "deployed_by",
  "executes",
  "triggers",
  "contains",
];

/**
 * Compute a BlastRadiusReport for a starting node.
 */
export function analyzeBlastRadius(
  graph: InfrastructureGraph,
  rootNodeId: string,
  options: AnalysisOptions = {}
): BlastRadiusReport {
  const root = findNode(graph, rootNodeId);
  if (!root) {
    return emptyReport(rootNodeId, "Root node not found in graph");
  }

  const maxDepth = options.maxDepth ?? 3;
  const edgeTypes = options.edgeTypes ?? DEFAULT_EDGE_TYPES;

  const { nodes, depths } = reachableFrom(graph, rootNodeId, maxDepth, edgeTypes);

  const directlyAffected = nodes.filter((n) => depths.get(n.id) === 1);
  const indirectlyAffected = nodes.filter((n) => (depths.get(n.id) ?? 0) >= 2);

  // Environment + production detection
  const productionAffected = nodes.filter(
    (n) =>
      n.type === "deployment_environment" && (n.label === "production" || (n.metadata.environment === "production" || false)) ||
      n.type === "account" && String(n.metadata.environment ?? "").toLowerCase() === "production"
  );

  // Provider / environment / pipeline / resource breakdowns
  const providersAffected = uniqueValues(nodes.map((n) => n.provider).filter(Boolean) as string[]);
  const environmentsAffected = nodes.filter((n) => n.type === "deployment_environment").map((n) => n.label);
  const pipelinesAffected = nodes.filter((n) => n.type === "pipeline").map((n) => n.label);
  const resourcesAffected = nodes.filter((n) =>
    n.type === "compute.instance" ||
    n.type === "storage.object" ||
    n.type === "storage.block" ||
    n.type === "database" ||
    n.type === "loadbalancer" ||
    n.type === "firewall"
  ).map((n) => n.label);

  // Risk concentration
  const riskConcentration: Record<string, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const n of [root, ...nodes]) riskConcentration[n.riskLevel]++;

  // Score
  const score = classify(directlyAffected.length + indirectlyAffected.length, productionAffected.length, riskConcentration);

  // Rollback complexity
  const maxDepthReached = Math.max(0, ...Array.from(depths.values()));
  const rollbackComplexity: BlastRadiusReport["rollbackComplexity"] =
    maxDepthReached <= 1 ? "trivial" :
    maxDepthReached === 2 ? "moderate" :
    maxDepthReached === 3 ? "complex" :
    "high";

  // Reason + evidence
  const evidence: { name: string; value: string }[] = [
    { name: "directlyAffected", value: String(directlyAffected.length) },
    { name: "indirectlyAffected", value: String(indirectlyAffected.length) },
    { name: "production", value: String(productionAffected.length) },
    { name: "maxDepth", value: String(maxDepthReached) },
    { name: "providers", value: providersAffected.join(",") || "none" },
  ];
  const reason = buildReason(root, score, directlyAffected.length, indirectlyAffected.length, productionAffected.length, maxDepthReached);

  // Safe next action
  const safeNextAction = buildSafeNextAction(score, productionAffected.length, rollbackComplexity);

  return {
    rootNodeId,
    directlyAffected,
    indirectlyAffected,
    productionAffected,
    providersAffected,
    environmentsAffected,
    pipelinesAffected,
    resourcesAffected,
    riskConcentration,
    score,
    reason,
    evidence,
    safeNextAction,
    rollbackComplexity,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classify(affectedCount: number, productionCount: number, risk: Record<string, number>): BlastRadiusScore {
  if (risk.critical > 0 || (productionCount > 0 && affectedCount > 20)) return "critical";
  if (productionCount > 0 || affectedCount > 20) return "broad";
  if (affectedCount > 5) return "moderate";
  return "contained";
}

function buildReason(
  root: GraphNode,
  score: BlastRadiusScore,
  direct: number,
  indirect: number,
  production: number,
  depth: number
): string {
  if (score === "critical") return `Critical blast radius — ${direct} direct + ${indirect} indirect dependencies, ${production} production node${production !== 1 ? "s" : ""} affected, max depth ${depth}.`;
  if (score === "broad") return `Broad blast radius — ${direct + indirect} affected nodes including production. Approval discipline required.`;
  if (score === "moderate") return `Moderate blast radius — ${direct} direct + ${indirect} indirect dependencies. No production nodes reachable.`;
  return `Contained blast radius — ${direct} direct neighbor${direct !== 1 ? "s" : ""}, no production exposure.`;
  void root;
}

function buildSafeNextAction(score: BlastRadiusScore, production: number, rollback: string): string {
  if (score === "critical") return `Block at governance gate. Require multi-party approval + manual rollback rehearsal before proceeding.`;
  if (score === "broad") return `Multi-party approval required. ${production > 0 ? "Production environment affected — ensure ALB drain configured." : ""}`;
  if (score === "moderate") return `Single approver review. Verify rollback (${rollback}) before apply.`;
  return `Low-risk change. Single approver review sufficient.`;
}

function uniqueValues<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function emptyReport(rootNodeId: string, reason: string): BlastRadiusReport {
  return {
    rootNodeId,
    directlyAffected: [],
    indirectlyAffected: [],
    productionAffected: [],
    providersAffected: [],
    environmentsAffected: [],
    pipelinesAffected: [],
    resourcesAffected: [],
    riskConcentration: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
    score: "contained",
    reason,
    evidence: [],
    safeNextAction: "Verify the affected resource is present in the graph before analyzing.",
    rollbackComplexity: "trivial",
  };
}

// ---------------------------------------------------------------------------
// Batch analysis — useful for execution plan candidates with multiple resources
// ---------------------------------------------------------------------------

export function analyzeBatch(
  graph: InfrastructureGraph,
  rootNodeIds: string[],
  options: AnalysisOptions = {}
): BlastRadiusReport[] {
  return rootNodeIds.map((id) => analyzeBlastRadius(graph, id, options));
}

/** Aggregate multiple blast radius reports into a worst-case summary. */
export function aggregateReports(reports: BlastRadiusReport[]): BlastRadiusReport {
  if (reports.length === 0) return emptyReport("aggregate", "No reports to aggregate");
  if (reports.length === 1) return reports[0];

  const order: BlastRadiusScore[] = ["contained", "moderate", "broad", "critical"];
  let worstScore: BlastRadiusScore = "contained";
  for (const r of reports) if (order.indexOf(r.score) > order.indexOf(worstScore)) worstScore = r.score;

  const directIds = new Set(reports.flatMap((r) => r.directlyAffected.map((n) => n.id)));
  const indirectIds = new Set(reports.flatMap((r) => r.indirectlyAffected.map((n) => n.id)));
  const allNodes = reports.flatMap((r) => [...r.directlyAffected, ...r.indirectlyAffected]);
  const nodeMap = new Map<string, GraphNode>();
  for (const n of allNodes) nodeMap.set(n.id, n);

  return {
    rootNodeId: "aggregate",
    directlyAffected: Array.from(nodeMap.values()).filter((n) => directIds.has(n.id)),
    indirectlyAffected: Array.from(nodeMap.values()).filter((n) => indirectIds.has(n.id) && !directIds.has(n.id)),
    productionAffected: uniqueByNodeId(reports.flatMap((r) => r.productionAffected)),
    providersAffected: uniqueValues(reports.flatMap((r) => r.providersAffected)),
    environmentsAffected: uniqueValues(reports.flatMap((r) => r.environmentsAffected)),
    pipelinesAffected: uniqueValues(reports.flatMap((r) => r.pipelinesAffected)),
    resourcesAffected: uniqueValues(reports.flatMap((r) => r.resourcesAffected)),
    riskConcentration: combineRiskMaps(reports.map((r) => r.riskConcentration)),
    score: worstScore,
    reason: `Aggregate of ${reports.length} reports — worst score: ${worstScore}.`,
    evidence: [{ name: "reportCount", value: String(reports.length) }],
    safeNextAction: reports[0]?.safeNextAction ?? "Review individual reports for safe next action.",
    rollbackComplexity: reports.reduce((worst, r) => worseRollback(worst, r.rollbackComplexity), "trivial" as BlastRadiusReport["rollbackComplexity"]),
  };
}

function uniqueByNodeId(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  return nodes.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
}

function combineRiskMaps(maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const m of maps) for (const k of Object.keys(out)) out[k] += m[k] ?? 0;
  return out;
}

function worseRollback(a: BlastRadiusReport["rollbackComplexity"], b: BlastRadiusReport["rollbackComplexity"]): BlastRadiusReport["rollbackComplexity"] {
  const order = ["trivial", "moderate", "complex", "high"] as const;
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

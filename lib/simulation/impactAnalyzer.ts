/**
 * Impact Analyzer.
 *
 * Computes blast radius + dependency impact for a ChangeSet against the
 * digital twin. Honest about unknowns: if a resource has no recorded
 * dependencies, the analyzer says so rather than fabricating "no impact".
 */

import type { DigitalTwin, DigitalTwinResource, DigitalTwinRelationship, DigitalTwinRiskLevel } from "@/lib/digitalTwin/digitalTwinModel";
import type { ChangeSet, ChangeAction } from "@/lib/simulation/changeSetModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical" | "unknown";

export interface ResourceImpact {
  resourceId: string;
  resourceType: string;
  directlyAffected: boolean;
  impactLevel: ImpactLevel;
  reason: string;
  /** Confidence in the impact assessment (0..1). */
  confidence: number;
}

export interface ImpactReport {
  changeSetId: string;
  directlyAffected: ResourceImpact[];
  indirectlyAffected: ResourceImpact[];
  /** Highest impact across all affected resources. */
  overallImpact: ImpactLevel;
  /** Dependency hop counts — useful for the UI. */
  hopHistogram: Record<number, number>;
  /** Summary lines for the UI. */
  notes: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const RANK: Record<ImpactLevel, number> = { critical: 5, high: 4, medium: 3, low: 2, none: 1, unknown: 0 };

function maxImpact(a: ImpactLevel, b: ImpactLevel): ImpactLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

function riskToImpact(risk: DigitalTwinRiskLevel): ImpactLevel {
  switch (risk) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
    case "unknown":  return "unknown";
  }
}

function impactForAction(action: ChangeAction): ImpactLevel {
  switch (action.actionType) {
    case "delete":      return "critical";
    case "detach":      return "high";
    case "disable":     return "high";
    case "expand":      return "high";
    case "restrict":    return "medium";
    case "update":      return "medium";
    case "attach":      return "medium";
    case "create":      return "low";
    case "enable":      return "low";
    case "review_only": return "none";
  }
}

function neighborsByType(
  twin: DigitalTwin,
  resourceId: string,
): { incoming: DigitalTwinRelationship[]; outgoing: DigitalTwinRelationship[] } {
  return {
    incoming: twin.relationships.filter((r) => r.toResourceId   === resourceId),
    outgoing: twin.relationships.filter((r) => r.fromResourceId === resourceId),
  };
}

export function analyzeChangeSetImpact(twin: DigitalTwin, changeSet: ChangeSet): ImpactReport {
  const directIds = new Set<string>(changeSet.affectedResources);
  const directlyAffected: ResourceImpact[] = [];
  const indirectlyAffected: ResourceImpact[] = [];
  const hopHistogram: Record<number, number> = {};
  const visited = new Map<string, number>(); // resourceId → hop depth
  const notes: string[] = [];

  // Direct hits.
  for (const action of changeSet.proposedActions) {
    const target = twin.resources.find((r) => r.id === action.targetResourceId);
    const directImpact = impactForAction(action);
    directlyAffected.push({
      resourceId: action.targetResourceId,
      resourceType: target?.type as string ?? "unknown",
      directlyAffected: true,
      impactLevel: maxImpact(directImpact, riskToImpact(action.riskLevel)),
      reason: `${action.actionType.replace(/_/g, " ")} requested on this resource.`,
      confidence: target ? Math.max(0.6, target.confidence) : 0.4,
    });
    visited.set(action.targetResourceId, 0);
    hopHistogram[0] = (hopHistogram[0] ?? 0) + 1;
  }

  // BFS through dependencies up to 3 hops.
  const queue: { id: string; depth: number }[] = [];
  for (const id of directIds) queue.push({ id, depth: 0 });

  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (depth >= 3) continue;
    const { incoming, outgoing } = neighborsByType(twin, id);
    for (const rel of [...incoming, ...outgoing]) {
      const neighborId = rel.fromResourceId === id ? rel.toResourceId : rel.fromResourceId;
      if (directIds.has(neighborId)) continue;
      const existingDepth = visited.get(neighborId);
      const newDepth = depth + 1;
      if (existingDepth !== undefined && existingDepth <= newDepth) continue;
      visited.set(neighborId, newDepth);
      hopHistogram[newDepth] = (hopHistogram[newDepth] ?? 0) + 1;

      const neighbor = twin.resources.find((r) => r.id === neighborId);
      const baseImpact: ImpactLevel = newDepth === 1 ? "medium" : newDepth === 2 ? "low" : "low";
      indirectlyAffected.push({
        resourceId: neighborId,
        resourceType: neighbor?.type as string ?? "unknown",
        directlyAffected: false,
        impactLevel: maxImpact(baseImpact, riskToImpact(rel.riskLevel)),
        reason: `${rel.relationshipType.replace(/_/g, " ")} connection · ${newDepth} hop${newDepth > 1 ? "s" : ""} from change.`,
        confidence: rel.confidence,
      });
      queue.push({ id: neighborId, depth: newDepth });
    }
  }

  // Honest unknown when twin has no relationships to reason over.
  if (twin.relationships.length === 0) {
    notes.push("Twin has no recorded relationships — indirect impact is unknown.");
  }
  if (twin.sourceMode !== "live") {
    notes.push(`Twin source mode is ${twin.sourceMode}; impact estimates are preview-quality.`);
  }

  const overallImpact = [...directlyAffected, ...indirectlyAffected]
    .reduce<ImpactLevel>((acc, r) => maxImpact(acc, r.impactLevel), "none");

  return {
    changeSetId: changeSet.id,
    directlyAffected,
    indirectlyAffected,
    overallImpact,
    hopHistogram,
    notes,
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeImpact(report: ImpactReport): {
  totalAffected: number;
  directCount: number;
  indirectCount: number;
  overallImpact: ImpactLevel;
} {
  return {
    totalAffected: report.directlyAffected.length + report.indirectlyAffected.length,
    directCount:   report.directlyAffected.length,
    indirectCount: report.indirectlyAffected.length,
    overallImpact: report.overallImpact,
  };
}

// Help the TwinResource type stay referenced when this module is imported.
export type _TwinResourceRef = DigitalTwinResource;

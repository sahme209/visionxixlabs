/**
 * Pure change-risk assessor.
 *
 * Input: a proposed change descriptor (which resource, which kind of
 * action, what scope) + the service topology (services + dependencies
 * + tier criticality). Output: a typed BlastRadius score with closed-
 * union severity + an operator-readable narrative of what's affected.
 *
 * Pure / no I/O. The kernel walks the topology graph (BFS within a
 * bounded depth) and counts downstream + cross-tier dependencies of
 * the change target.
 *
 * Why this matters for AGI:
 *   The approval engine refuses to escalate critical-tier changes
 *   without a quantified blast radius. This kernel produces the
 *   numbers the approver attaches to the packet.
 */

export type ChangeActionKind =
  | "config_update"
  | "iam_change"
  | "schema_migration"
  | "deploy"
  | "rollback"
  | "delete_resource"
  | "rotate_secret"
  | "network_change"
  | "feature_flag";

export type ServiceTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";

export type BlastRadiusSeverity = "low" | "medium" | "high" | "critical";

export interface ServiceNode {
  /** Stable id (e.g. "api-prod"). */
  id: string;
  /** Closed-union criticality tier (0 = most critical). */
  tier: ServiceTier;
  /** Ids of services THIS service directly depends on. */
  dependsOn: readonly string[];
  /** True if the service is in a regulated path (payments, PII). */
  regulated: boolean;
}

export interface ServiceTopology {
  services: readonly ServiceNode[];
}

export interface ProposedChange {
  /** Stable id for the change. */
  id: string;
  /** Target service id — must exist in the topology. */
  targetServiceId: string;
  /** Closed-union action kind. */
  actionKind: ChangeActionKind;
  /**
   * Operator-stated scope of the change. Drives the base risk score
   * before topology fan-out is added.
   */
  scope: "single_resource" | "single_service" | "multi_service" | "infrastructure_wide";
  /** True if the change is reversible without data loss. */
  reversible: boolean;
  /** True if the change touches production. */
  touchesProd: boolean;
}

export interface BlastRadiusReport {
  changeId: string;
  /** Closed-union final severity. */
  severity: BlastRadiusSeverity;
  /** 0..100 numeric score (audit-friendly). */
  score: number;
  /** Ids of services affected DOWNSTREAM of the target (transitively). */
  affectedServiceIds: readonly string[];
  /** Affected tier-0 + tier-1 services — these drive the severity. */
  criticalServiceIds: readonly string[];
  /** True if any regulated service sits in the affected set. */
  regulatedReach: boolean;
  /** Closed-union recommended gate. */
  recommendedGate: "no_gate" | "single_approval" | "dual_approval" | "council_3_of_5";
  /** Operator-readable rationale. */
  rationale: string;
}

const ACTION_BASE_SCORE: Record<ChangeActionKind, number> = {
  feature_flag:    5,
  config_update:   10,
  rollback:        15,
  deploy:          20,
  network_change:  25,
  iam_change:      35,
  rotate_secret:   30,
  schema_migration: 40,
  delete_resource: 50,
};

const SCOPE_MULTIPLIER: Record<ProposedChange["scope"], number> = {
  single_resource:      1.0,
  single_service:       1.2,
  multi_service:        1.5,
  infrastructure_wide:  2.0,
};

const TIER_WEIGHT: Record<ServiceTier, number> = {
  tier_0: 3,
  tier_1: 2,
  tier_2: 1,
  tier_3: 0.5,
};

/**
 * Walk the topology graph: for every service, build a list of services
 * that depend (transitively) on it. Bounded BFS to avoid cycles.
 */
function buildReverseDeps(topology: ServiceTopology): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();
  for (const s of topology.services) reverse.set(s.id, new Set());
  for (const s of topology.services) {
    for (const dep of s.dependsOn) {
      const set = reverse.get(dep);
      if (set) set.add(s.id);
    }
  }
  return reverse;
}

function downstreamReach(targetId: string, reverse: Map<string, Set<string>>, maxDepth = 6): readonly string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (depth >= maxDepth) continue;
    const deps = reverse.get(id);
    if (!deps) continue;
    for (const d of deps) {
      if (!visited.has(d)) queue.push({ id: d, depth: depth + 1 });
    }
  }
  visited.delete(targetId);
  return [...visited];
}

function severityFromScore(score: number): BlastRadiusSeverity {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function gateFromSeverity(sev: BlastRadiusSeverity, regulated: boolean): BlastRadiusReport["recommendedGate"] {
  if (sev === "critical") return "council_3_of_5";
  if (sev === "high")     return regulated ? "council_3_of_5" : "dual_approval";
  if (sev === "medium")   return "single_approval";
  return regulated ? "single_approval" : "no_gate";
}

export class ChangeRiskAssessorError extends Error {}

export function assessChangeRisk(
  change: ProposedChange,
  topology: ServiceTopology,
): BlastRadiusReport {
  const target = topology.services.find((s) => s.id === change.targetServiceId);
  if (!target) {
    throw new ChangeRiskAssessorError(`Target service ${change.targetServiceId} not in topology.`);
  }

  // Base score from action kind + scope.
  let score = ACTION_BASE_SCORE[change.actionKind] * SCOPE_MULTIPLIER[change.scope];

  // Production touch is a multiplier.
  if (change.touchesProd) score *= 1.3;

  // Reversibility reduces the score.
  if (change.reversible) score *= 0.85;

  // Topology fan-out: every downstream service adds weight, scaled by tier.
  const reverse = buildReverseDeps(topology);
  const downstream = downstreamReach(target.id, reverse);
  const affectedServices = topology.services.filter((s) => downstream.includes(s.id));
  const criticalServices = affectedServices.filter((s) => s.tier === "tier_0" || s.tier === "tier_1");
  for (const s of affectedServices) {
    score += TIER_WEIGHT[s.tier];
  }

  // Target service tier multiplier — touching a tier-0 service is
  // riskier than touching a tier-3 one.
  score *= 1 + TIER_WEIGHT[target.tier] / 10;

  // Regulated reach raises the floor.
  const regulatedReach = affectedServices.some((s) => s.regulated) || target.regulated;
  if (regulatedReach) score = Math.max(score, 40);

  // Clamp + round.
  score = Math.max(0, Math.min(100, Math.round(score)));
  const severity = severityFromScore(score);
  const recommendedGate = gateFromSeverity(severity, regulatedReach);

  const reasons: string[] = [];
  reasons.push(`base ${ACTION_BASE_SCORE[change.actionKind]} × scope ${SCOPE_MULTIPLIER[change.scope]}`);
  if (change.touchesProd) reasons.push("prod multiplier");
  if (change.reversible)  reasons.push("reversible discount");
  reasons.push(`target tier ${target.tier}`);
  reasons.push(`${affectedServices.length} downstream service(s) affected`);
  if (criticalServices.length > 0) reasons.push(`${criticalServices.length} tier-0/1 reach`);
  if (regulatedReach) reasons.push("regulated path");

  return {
    changeId: change.id,
    severity,
    score,
    affectedServiceIds: affectedServices.map((s) => s.id),
    criticalServiceIds: criticalServices.map((s) => s.id),
    regulatedReach,
    recommendedGate,
    rationale: reasons.join(" · "),
  };
}

/**
 * Risk Queue builder.
 *
 * Pure read-only composition over the Priority Engine. Each priority
 * item becomes a typed RiskItem with an honest derived status:
 *
 *   - security findings with no remediation yet  → "open"
 *   - integration blockers                       → "blocked"
 *   - approval-pending                           → "approval_required"
 *   - simulation candidates                      → "simulation_ready"
 *   - candidates with simulation done            → "remediation_prepared"
 *
 * No SDK calls. Tenant-scoped via underlying state.
 */

import "server-only";

import { buildPriorityReport } from "@/lib/intelligence/priorityEngine";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { PriorityItem } from "@/lib/intelligence/priorityModel";
import type {
  RiskCategory,
  RiskItem,
  RiskOwnerRole,
  RiskQueueReport,
  RiskSeverity,
  RiskSourceMode,
  RiskStatus,
} from "./riskQueueModel";

export interface BuildRiskQueueInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildRiskQueue(input: BuildRiskQueueInput): Promise<RiskQueueReport> {
  const [priorities, state] = await Promise.all([
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  const items: RiskItem[] = [];

  for (const p of priorities.items) {
    const status = deriveStatus(p, state);
    const category = mapCategory(p.category);
    if (!category) continue;

    items.push({
      id: `risk:${p.id}`,
      rank: 0,
      title: p.title,
      description: p.reasonSummary,
      sourceSystem: p.sourceSystem,
      sourceMode: p.sourceMode as RiskSourceMode,
      severity: p.severity as RiskSeverity,
      category,
      affectedSystem: p.affectedSystem,
      status,
      ownerRole: ownerForCategory(category),
      evidenceRefs: p.evidenceRefs,
      linkedGraphNodeIds: p.linkedGraphNodeIds,
      firstSeenAt: state.generatedAt,
      lastSeenAt: state.generatedAt,
      suspectedCause: suspectedCauseFor(p),
      whyItMatters: p.whyItMatters,
      safeNextAction: p.safeNextAction,
      route: p.safeNextAction.href,
      limitations: p.limitations,
    });
  }

  // Sort: open + approval_required + blocked first; resolved/closed last.
  const ranked = items
    .sort((a, b) => statusWeight(a.status) - statusWeight(b.status))
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const bySeverity: Record<RiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byCategory: Record<RiskCategory, number> = {
    security_finding: 0, release_blocker: 0, integration_blocker: 0,
    policy_violation: 0, readiness_blocker: 0, desktop_blocker: 0,
    scheduled_scan_failure: 0, operational_drift: 0,
  };
  for (const r of ranked) {
    bySeverity[r.severity]++;
    byCategory[r.category]++;
  }

  const summary = {
    total:               ranked.length,
    open:                ranked.filter((r) => r.status === "open").length,
    investigating:       ranked.filter((r) => r.status === "investigating").length,
    remediationPrepared: ranked.filter((r) => r.status === "remediation_prepared").length,
    simulationReady:     ranked.filter((r) => r.status === "simulation_ready").length,
    approvalRequired:    ranked.filter((r) => r.status === "approval_required").length,
    blocked:             ranked.filter((r) => r.status === "blocked").length,
    resolvedSimulated:   ranked.filter((r) => r.status === "resolved_simulated").length,
    closed:              ranked.filter((r) => r.status === "closed").length,
    bySeverity,
    byCategory,
  };

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    items: ranked,
    summary,
    overallSourceMode: state.sourceMode as RiskSourceMode,
    limitations: [
      "Risk Queue is a pure projection of canonical signals — no manual state-machine persistence yet.",
      "When persistence is wired, statuses like 'investigating' / 'accepted_risk' will reflect operator decisions instead of derived defaults.",
      ...priorities.limitations.slice(0, 1),
    ],
    safeNextAction: { label: "Open Priorities", href: "/dashboard/priorities" },
    safetyContract: "risk_review_only_no_execution",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapCategory(c: PriorityItem["category"]): RiskCategory | null {
  switch (c) {
    case "security_finding":    return "security_finding";
    case "release_blocker":     return "release_blocker";
    case "integration_blocker": return "integration_blocker";
    case "policy_violation":    return "policy_violation";
    case "readiness_blocker":   return "readiness_blocker";
    case "desktop_blocker":     return "desktop_blocker";
    case "operational_drift":   return "operational_drift";
    case "approval_pending":    return "release_blocker"; // approval pending = something is queued to release
    case "evidence_gap":        return "readiness_blocker";
    case "recurring":           return "operational_drift";
    default:                    return null;
  }
}

function ownerForCategory(c: RiskCategory): RiskOwnerRole {
  switch (c) {
    case "security_finding":       return "security_reviewer";
    case "release_blocker":        return "release_manager";
    case "integration_blocker":    return "cloud_engineer";
    case "policy_violation":       return "admin";
    case "readiness_blocker":      return "admin";
    case "desktop_blocker":        return "admin";
    case "scheduled_scan_failure": return "cloud_engineer";
    case "operational_drift":      return "cloud_engineer";
  }
}

function deriveStatus(p: PriorityItem, state: Awaited<ReturnType<typeof buildAxiomOSState>>): RiskStatus {
  // Blocked when the priority item declares blocked_by
  if (p.blockedBy === "missing_config" || p.blockedBy === "policy") return "blocked";

  // Approval pending → approval_required
  if (p.category === "approval_pending") return "approval_required";

  // Operational drift = remediation candidates exist
  if (p.category === "operational_drift") {
    const rem = state.remediationPosture.data;
    if (rem.simulatedCount > 0)      return "remediation_prepared";
    if (rem.candidateCount > 0)      return "simulation_ready";
    return "investigating";
  }

  // Security findings — escalate to simulation_ready when remediation+simulation done
  if (p.category === "security_finding") {
    const rem = state.remediationPosture.data;
    if (rem.simulatedCount > 0 && rem.candidateCount > 0) return "remediation_prepared";
    if (rem.candidateCount > 0)                            return "simulation_ready";
    return "open";
  }

  return "open";
}

function suspectedCauseFor(p: PriorityItem): string | undefined {
  if (p.blockedBy === "missing_config") {
    return `Suspected cause: missing configuration (${p.limitations[0] ?? "see provider setup"}). Operator action required.`;
  }
  if (p.blockedBy === "policy") {
    return "Suspected cause: governance policy blocks proceeding. Review the violated rule before retrying.";
  }
  if (p.category === "security_finding" && p.severity === "critical") {
    return "Suspected cause: critical resource configuration drift detected by the scanner. Verify against the affected resource list.";
  }
  return undefined;
}

function statusWeight(s: RiskStatus): number {
  switch (s) {
    case "approval_required":    return 0;
    case "open":                 return 1;
    case "blocked":              return 2;
    case "investigating":        return 3;
    case "simulation_ready":     return 4;
    case "remediation_prepared": return 5;
    case "accepted_risk":        return 6;
    case "resolved_simulated":   return 7;
    case "closed":               return 8;
  }
}

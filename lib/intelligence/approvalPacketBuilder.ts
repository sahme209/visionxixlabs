/**
 * Approval Packet builder.
 *
 * Pure read-only composition. Consumes PriorityReport (filters for
 * approval-related categories) + AxiomOSState (approvalPosture +
 * remediationPosture + desktopPosture) and emits one ApprovalPacket
 * per approval-eligible operator decision.
 *
 * No SDK calls. No new persistence. Approving a packet from the
 * resulting UI never executes anything — it flips the status in the
 * existing approval engine route.
 */

import "server-only";

import { buildPriorityReport } from "./priorityEngine";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { PriorityItem } from "./priorityModel";
import type {
  ApprovalPacket,
  ApprovalPacketReport,
  ApprovalReadiness,
  ApprovalRisk,
} from "./approvalPacketModel";

export interface BuildApprovalPacketsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildApprovalPackets(input: BuildApprovalPacketsInput): Promise<ApprovalPacketReport> {
  const [priorities, state] = await Promise.all([
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // ---------------------------------------------------------------------------
  // Build a packet per approval-eligible signal
  // ---------------------------------------------------------------------------
  const packets: ApprovalPacket[] = [];

  // 1) Direct approval-pending priorities (e.g. queued approvals)
  for (const p of priorities.items.filter((i) => i.category === "approval_pending")) {
    packets.push(buildFromApprovalPosture(p, state));
  }

  // 2) Critical / high security findings that would require approval
  //    before any remediation could be applied. Surface them as
  //    "simulation_required" packets so the operator sees the
  //    governance gate before approving.
  for (const p of priorities.items.filter((i) =>
    (i.category === "security_finding" && (i.severity === "critical" || i.severity === "high"))
  )) {
    packets.push(buildFromSecurityPriority(p, state));
  }

  // 3) Remediation candidates that have not yet been simulated — these
  //    must reach simulation before they can become approval-eligible.
  if (state.remediationPosture.data.candidateCount > 0 &&
      state.remediationPosture.data.simulatedCount < state.remediationPosture.data.candidateCount) {
    packets.push(buildFromUnsimulatedRemediation(state));
  }

  // Rank: ready_for_review first, then by risk severity, then by source
  const ranked = packets
    .sort((a, b) => {
      const readinessRank = readinessWeight(a.readiness) - readinessWeight(b.readiness);
      if (readinessRank !== 0) return readinessRank;
      return riskWeight(b.risk) - riskWeight(a.risk);
    })
    .map((pkt, idx) => ({ ...pkt, rank: idx + 1 }));

  // Summary
  const summary = {
    total:                     ranked.length,
    readyForReview:            ranked.filter((p) => p.readiness === "ready_for_review").length,
    simulationRequired:        ranked.filter((p) => p.readiness === "simulation_required").length,
    policyBlocked:             ranked.filter((p) => p.readiness === "policy_blocked").length,
    desktopReviewRecommended:  ranked.filter((p) => p.readiness === "desktop_review_recommended").length,
    missingEvidence:           ranked.filter((p) => p.readiness === "missing_evidence").length,
    blockedByConfig:           ranked.filter((p) => p.readiness === "blocked_by_config").length,
  };

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    packets: ranked,
    summary,
    safetyContract: "approval_only_no_execution",
    limitations: [
      "Approval Packet view never executes a change — it surfaces the canonical decision context for human review.",
      ...priorities.limitations.slice(0, 1),
    ],
    safeNextAction: { label: "Open Approval queue", href: "/dashboard/approvals" },
  };
}

// ---------------------------------------------------------------------------
// Packet constructors
// ---------------------------------------------------------------------------

function buildFromApprovalPosture(p: PriorityItem, state: ReturnedFromAxiomOSState): ApprovalPacket {
  const ap = state.approvalPosture.data;
  const readiness: ApprovalReadiness =
    ap.expiredCount > 0   ? "missing_evidence" :
    ap.highRiskCount > 0  ? "desktop_review_recommended" :
                            "ready_for_review";

  const risk: ApprovalRisk = ap.highRiskCount > 0 ? "high" : "medium";

  return {
    id: `packet:${p.id}`,
    rank: 0,
    requestedAction: `Review ${ap.pendingCount} pending approval${ap.pendingCount === 1 ? "" : "s"}`,
    sourceSystem: "approval_engine",
    sourceMode: state.approvalPosture.sourceMode,
    risk,
    riskSummary: `${ap.highRiskCount} high-risk · ${ap.expiredCount} expired · ${ap.pendingCount} pending decision`,
    simulationSummary: undefined,
    policyDecision: {
      allowed: false,
      requiresApproval: true,
      reason: "Every queued item routes through the approval-gating policy — operator decision required.",
    },
    rollbackPlan: {
      available: true,
      summary: "Approvals are reversible — decision history is auditable via /dashboard/audit.",
    },
    verificationChecklist: {
      available: true,
      summary: "Each item carries its own verification checklist when remediation runs simulation.",
    },
    affectedSystems: [],
    expectedImpact:
      ap.highRiskCount > 0
        ? "Approving high-risk items unblocks downstream remediation. Approval does not auto-execute — it only marks the item as approved."
        : "Approving these items unblocks the operating loop. No mutation occurs from approval itself.",
    readiness,
    readinessReason:
      readiness === "missing_evidence"           ? "Expired items need refreshed evidence before review." :
      readiness === "desktop_review_recommended" ? "High-risk items benefit from desktop review for additional context." :
                                                   "Items are ready for direct operator review.",
    desktopReviewEligible: ap.highRiskCount > 0,
    evidence: [
      { ref: "axiomOS:approvalPosture", label: "Approval posture (canonical)" },
      ...p.evidenceRefs.map((r) => ({ ref: r, label: r })),
    ],
    limitations: state.approvalPosture.limitations,
    reviewRoute: p.safeNextAction,
    linkedPriorityId: p.id,
    linkedGraphNodeIds: ["approval:queue", "policy:approval_gated"],
  };
}

function buildFromSecurityPriority(p: PriorityItem, state: ReturnedFromAxiomOSState): ApprovalPacket {
  const sec = state.securityPosture.data;
  const remediationReady = state.remediationPosture.data.candidateCount > 0;
  const simulationReady = state.remediationPosture.data.simulatedCount > 0;

  const readiness: ApprovalReadiness =
    !remediationReady  ? "missing_evidence" :
    !simulationReady   ? "simulation_required" :
                          "ready_for_review";

  return {
    id: `packet:${p.id}`,
    rank: 0,
    requestedAction: `Approve remediation for ${p.severity} security finding${sec.criticalCount > 1 || sec.highCount > 1 ? "s" : ""}`,
    sourceSystem: "security_scanner",
    sourceMode: p.sourceMode,
    risk: p.severity === "critical" ? "critical" : "high",
    riskSummary: `${sec.criticalCount} critical · ${sec.highCount} high · ${sec.compoundedRiskCount} compound across ${sec.affectedSystems.length} system${sec.affectedSystems.length === 1 ? "" : "s"}`,
    simulationSummary: simulationReady
      ? `${state.remediationPosture.data.simulatedCount} candidate${state.remediationPosture.data.simulatedCount === 1 ? "" : "s"} simulated on the digital twin · before/after risk deltas available.`
      : "Not yet simulated. Run /api/simulations/create before approving.",
    policyDecision: {
      allowed: false,
      requiresApproval: true,
      reason: "Security remediation cannot reach apply without explicit approval (approval-gating policy).",
    },
    rollbackPlan: {
      available: remediationReady,
      summary: remediationReady
        ? "Rollback plan generated as part of the remediation pipeline output."
        : "Rollback plan generated when /api/remediation/plan runs.",
    },
    verificationChecklist: {
      available: remediationReady,
      summary: remediationReady
        ? "Verification checklist generated alongside the remediation candidates."
        : "Verification checklist generated when remediation pipeline runs.",
    },
    affectedSystems: sec.affectedSystems.slice(0, 4),
    expectedImpact: "Approval flags the change as authorized. Execution remains gated by desktop review / preflight / verification stages downstream — apply paths remain disabled by safety contract.",
    readiness,
    readinessReason:
      readiness === "missing_evidence"    ? "Remediation pipeline has not yet produced candidates for this finding." :
      readiness === "simulation_required" ? "Candidates exist but no simulation has been run — operator should preview before approving." :
                                             "Simulation deltas + rollback + verification artifacts are available.",
    desktopReviewEligible: state.remediationPosture.data.desktopReviewEligibleCount > 0,
    evidence: [
      { ref: "axiomOS:securityPosture",    label: "Security posture (canonical)" },
      { ref: "axiomOS:remediationPosture", label: "Remediation posture (canonical)" },
      ...p.evidenceRefs.map((r) => ({ ref: r, label: r })),
    ],
    limitations: [
      ...state.securityPosture.limitations,
      ...state.remediationPosture.limitations,
    ],
    reviewRoute: p.safeNextAction,
    linkedPriorityId: p.id,
    linkedGraphNodeIds: ["security_findings:all", "remediation:all", "simulation:all", "policy:approval_gated", "approval:queue"],
  };
}

function buildFromUnsimulatedRemediation(state: ReturnedFromAxiomOSState): ApprovalPacket {
  const rem = state.remediationPosture.data;
  const pending = rem.candidateCount - rem.simulatedCount;
  return {
    id: "packet:remediation:unsimulated",
    rank: 0,
    requestedAction: `Simulate ${pending} unprocessed remediation candidate${pending === 1 ? "" : "s"}`,
    sourceSystem: "remediation_pipeline",
    sourceMode: state.remediationPosture.sourceMode,
    risk: "medium",
    riskSummary: `${pending} candidate${pending === 1 ? "" : "s"} have not been simulated yet — required before approval.`,
    simulationSummary: undefined,
    policyDecision: {
      allowed: false,
      requiresApproval: false,
      reason: "Simulation does not require approval — it runs against the digital twin only.",
    },
    rollbackPlan: {
      available: true,
      summary: "Each candidate carries a typed rollback plan; simulation surfaces it before approval review.",
    },
    verificationChecklist: {
      available: true,
      summary: "Verification checklist generated alongside each candidate.",
    },
    affectedSystems: [],
    expectedImpact: "Simulation operates on the digital twin only — no real cloud resource is touched. Output is before/after risk deltas the operator can review before approval.",
    readiness: "simulation_required",
    readinessReason: "Candidates exist but have not been simulated. Run /api/simulations/create.",
    desktopReviewEligible: rem.desktopReviewEligibleCount > 0,
    evidence: [
      { ref: "axiomOS:remediationPosture", label: "Remediation posture (canonical)" },
    ],
    limitations: state.remediationPosture.limitations,
    reviewRoute: { label: "Open Simulations", href: "/dashboard/simulations" },
    linkedPriorityId: undefined,
    linkedGraphNodeIds: ["remediation:all", "simulation:all"],
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ReturnedFromAxiomOSState = Awaited<ReturnType<typeof buildAxiomOSState>>;

function readinessWeight(r: ApprovalReadiness): number {
  // Lower wins (sorted ascending)
  switch (r) {
    case "ready_for_review":           return 0;
    case "desktop_review_recommended": return 1;
    case "simulation_required":        return 2;
    case "missing_evidence":           return 3;
    case "policy_blocked":             return 4;
    case "blocked_by_config":          return 5;
    case "disabled_execution":         return 6;
  }
}

function riskWeight(r: ApprovalRisk): number {
  // Higher wins (so sorted descending in caller)
  switch (r) {
    case "critical": return 4;
    case "high":     return 3;
    case "medium":   return 2;
    case "low":      return 1;
  }
}

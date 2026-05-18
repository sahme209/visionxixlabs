/**
 * Desktop Intelligence Workstation builder.
 *
 * Pure read-only composition. Consumes PriorityReport, ApprovalPacketReport,
 * AutomationBoundaryReport and AxiomOSState.desktopPosture and emits one
 * DesktopReviewItem per item that an operator could / should review on
 * the desktop runtime.
 *
 * No SDK calls. No persistence. Hand-off itself is performed by the
 * existing handoff endpoints — this builder only assembles the typed
 * review payload the workstation page renders.
 */

import "server-only";

import { buildPriorityReport } from "@/lib/intelligence/priorityEngine";
import { buildApprovalPackets } from "@/lib/intelligence/approvalPacketBuilder";
import { buildAutomationBoundaryReport } from "@/lib/safety/automationBoundaryDetector";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { PriorityItem } from "@/lib/intelligence/priorityModel";
import type { ApprovalPacket } from "@/lib/intelligence/approvalPacketModel";
import type {
  AutomationActionClass,
  AutomationBoundaryEntry,
  AutomationBoundaryReport,
  BoundaryClassification,
} from "@/lib/safety/automationBoundaryModel";
import type {
  DesktopIntelligencePairing,
  DesktopIntelligenceReport,
  DesktopReviewCategory,
  DesktopReviewItem,
  DesktopReviewSeverity,
  DesktopReviewSourceMode,
  DesktopReviewStatus,
} from "./desktopIntelligenceModel";

export interface BuildDesktopIntelligenceInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildDesktopIntelligence(input: BuildDesktopIntelligenceInput): Promise<DesktopIntelligenceReport> {
  const env = loadAppEnv();
  const [priorities, packets, boundaries, state] = await Promise.all([
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildApprovalPackets({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAutomationBoundaryReport(),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  const pairing = derivePairing(state, env);

  const items: DesktopReviewItem[] = [];
  const usedPriorityIds = new Set<string>();

  // ---------------------------------------------------------------------------
  // 1) One review item per approval packet (highest-fidelity input)
  // ---------------------------------------------------------------------------
  for (const packet of packets.packets) {
    const item = fromApprovalPacket(packet, boundaries, pairing);
    items.push(item);
    if (packet.linkedPriorityId) usedPriorityIds.add(packet.linkedPriorityId);
  }

  // ---------------------------------------------------------------------------
  // 2) Add priority items that aren't already packets but warrant desktop
  //    review — desktop blockers, critical/high security findings, release
  //    blockers, policy violations, integration blockers, operational drift.
  // ---------------------------------------------------------------------------
  for (const p of priorities.items) {
    if (usedPriorityIds.has(p.id)) continue;
    const category = mapPriorityCategory(p);
    if (!category) continue;
    items.push(fromPriorityItem(p, category, boundaries, pairing));
  }

  // ---------------------------------------------------------------------------
  // 3) Sort by status weight then priority score (highest first)
  // ---------------------------------------------------------------------------
  items.sort((a, b) => {
    const sw = statusWeight(a.status) - statusWeight(b.status);
    if (sw !== 0) return sw;
    return b.priorityScore - a.priorityScore;
  });
  items.forEach((it, idx) => { it.rank = idx + 1; });

  // ---------------------------------------------------------------------------
  // Summary rollup
  // ---------------------------------------------------------------------------
  const bySeverity: Record<DesktopReviewSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byCategory: Record<DesktopReviewCategory, number> = {
    approval_packet: 0, security_finding: 0, remediation_candidate: 0,
    release_blocker: 0, policy_violation: 0, integration_blocker: 0,
    operational_drift: 0,
  };
  let readyForHandoff = 0;
  let awaitingSimulation = 0;
  let policyBlocked = 0;
  let missingEvidence = 0;
  let blockedByPairing = 0;
  let blockedByConfig = 0;
  let disabledLocalExecution = 0;
  for (const it of items) {
    bySeverity[it.severity]++;
    byCategory[it.category]++;
    switch (it.status) {
      case "ready_for_handoff":        readyForHandoff++; break;
      case "awaiting_simulation":      awaitingSimulation++; break;
      case "policy_blocked":           policyBlocked++; break;
      case "missing_evidence":         missingEvidence++; break;
      case "blocked_by_pairing":       blockedByPairing++; break;
      case "blocked_by_config":        blockedByConfig++; break;
      case "disabled_local_execution": disabledLocalExecution++; break;
    }
  }

  const limitations: string[] = [];
  if (!pairing.paired) {
    limitations.push("No paired desktop session detected — handoff routes will preview until pairing completes.");
  }
  if (!pairing.signingKeyConfigured) {
    limitations.push("DESKTOP_HANDOFF_SIGNING_KEY not set — handoffs sign with the NEXTAUTH_SECRET fallback.");
  }
  if (pairing.signingStatus !== "signed_notarized") {
    limitations.push("Desktop binary is not fully signed + notarized — install friction expected on first launch.");
  }
  if (items.length === 0) {
    limitations.push("No review items pending — workstation is idle.");
  }

  const safeNextAction = items.find((i) => i.status === "ready_for_handoff")?.handoffRoute
    ?? (pairing.paired
      ? { label: "Open Desktop Runtime", href: "/dashboard/desktop" }
      : { label: "Install Axiom Agent Desktop", href: "/download" });

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    pairing,
    items,
    summary: {
      total: items.length,
      readyForHandoff, awaitingSimulation, policyBlocked, missingEvidence,
      blockedByPairing, blockedByConfig, disabledLocalExecution,
      bySeverity, byCategory,
    },
    safetyContract: "desktop_review_only_no_local_execution",
    limitations,
    safeNextAction,
  };
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

type ReturnedFromAxiomOSState = Awaited<ReturnType<typeof buildAxiomOSState>>;
type Env = ReturnType<typeof loadAppEnv>;

function derivePairing(state: ReturnedFromAxiomOSState, env: Env): DesktopIntelligencePairing {
  const desk = state.desktopPosture.data;
  return {
    paired: desk.pairedSessions > 0,
    signingKeyConfigured: env.desktopHandoffSigningKeySet,
    binaryAvailable: desk.binaryAvailable,
    signingStatus: desk.signingStatus,
    safeNextAction: desk.pairedSessions > 0
      ? { label: "Open Desktop Runtime", href: "/dashboard/desktop" }
      : { label: "Install Axiom Agent Desktop", href: "/download" },
    limitations: state.desktopPosture.limitations,
  };
}

function fromApprovalPacket(
  p: { id: string; rank: number; requestedAction: string; sourceSystem: string; sourceMode: string;
       risk: "low" | "medium" | "high" | "critical"; riskSummary: string;
       readiness: import("@/lib/intelligence/approvalPacketModel").ApprovalReadiness;
       readinessReason: string; desktopReviewEligible: boolean;
       affectedSystems: string[]; expectedImpact: string;
       evidence: { ref: string; label: string }[]; limitations: string[];
       reviewRoute: { label: string; href: string };
       linkedPriorityId?: string; linkedGraphNodeIds: string[];
       policyDecision: { allowed: boolean; requiresApproval: boolean; reason: string }; },
  boundaries: AutomationBoundaryReport,
  pairing: DesktopIntelligencePairing,
): DesktopReviewItem {
  const classification = boundaryFor(boundaries, "desktop_review_item");
  const severity = mapRiskToSeverity(p.risk);
  const status = deriveStatus({
    readiness: p.readiness,
    policyBlocked: !p.policyDecision.allowed,
    paired: pairing.paired,
    classification,
  });
  return {
    id: `desktop:${p.id}`,
    rank: 0,
    title: p.requestedAction,
    summary: p.riskSummary,
    category: "approval_packet",
    severity,
    sourceSystem: p.sourceSystem,
    sourceMode: p.sourceMode as DesktopReviewSourceMode,
    priorityScore: riskScore(p.risk),
    linkedPriorityId: p.linkedPriorityId,
    linkedApprovalPacketId: p.id,
    linkedGraphNodeIds: p.linkedGraphNodeIds,
    approvalReadiness: p.readiness,
    automationClassification: classification,
    status,
    statusReason: statusReason(status, p.readinessReason, p.policyDecision.reason, pairing),
    expectedImpact: p.expectedImpact,
    affectedSystems: p.affectedSystems,
    evidenceRefs: p.evidence.map((e) => e.ref),
    limitations: p.limitations,
    inspectRoute: p.reviewRoute,
    handoffRoute: pairing.paired
      ? { label: "Hand off to desktop", href: "/dashboard/desktop" }
      : { label: "Install desktop to enable", href: "/download" },
  };
}

function fromPriorityItem(
  p: PriorityItem,
  category: DesktopReviewCategory,
  boundaries: AutomationBoundaryReport,
  pairing: DesktopIntelligencePairing,
): DesktopReviewItem {
  const classification = boundaryFor(boundaries, "desktop_review_item");
  const severity: DesktopReviewSeverity = p.severity;
  const status = deriveStatus({
    readiness: undefined,
    policyBlocked: p.category === "policy_violation",
    paired: pairing.paired,
    classification,
  });
  return {
    id: `desktop:${p.id}`,
    rank: 0,
    title: p.title,
    summary: p.reasonSummary,
    category,
    severity,
    sourceSystem: p.sourceSystem,
    sourceMode: p.sourceMode as DesktopReviewSourceMode,
    priorityScore: p.score.composite,
    linkedPriorityId: p.id,
    linkedApprovalPacketId: undefined,
    linkedGraphNodeIds: p.linkedGraphNodeIds,
    approvalReadiness: undefined,
    automationClassification: classification,
    status,
    statusReason: statusReason(status, p.whyItMatters, "", pairing),
    expectedImpact: p.businessImpactSummary ?? p.technicalImpactSummary ?? p.reasonSummary,
    affectedSystems: p.affectedSystem ? [p.affectedSystem] : [],
    evidenceRefs: p.evidenceRefs,
    limitations: p.limitations,
    inspectRoute: p.safeNextAction,
    handoffRoute: pairing.paired
      ? { label: "Hand off to desktop", href: "/dashboard/desktop" }
      : { label: "Install desktop to enable", href: "/download" },
  };
}

function mapPriorityCategory(p: PriorityItem): DesktopReviewCategory | null {
  switch (p.category) {
    case "security_finding":     return (p.severity === "critical" || p.severity === "high") ? "security_finding" : null;
    case "release_blocker":      return "release_blocker";
    case "policy_violation":     return "policy_violation";
    case "integration_blocker":  return "integration_blocker";
    case "desktop_blocker":      return "operational_drift";
    case "operational_drift":    return "operational_drift";
    default:                     return null;
  }
}

function boundaryFor(report: AutomationBoundaryReport, actionClass: AutomationActionClass): BoundaryClassification {
  const entry: AutomationBoundaryEntry | undefined = report.entries.find((e) => e.actionClass === actionClass);
  return entry?.classification ?? "desktop_review_allowed";
}

function deriveStatus(args: {
  readiness?: import("@/lib/intelligence/approvalPacketModel").ApprovalReadiness;
  policyBlocked: boolean;
  paired: boolean;
  classification: BoundaryClassification;
}): DesktopReviewStatus {
  if (args.classification === "unsafe_never_automate") return "disabled_local_execution";
  if (args.classification === "disabled_until_credentials") return "blocked_by_config";
  if (args.classification === "disabled_until_policy")      return "policy_blocked";

  if (args.readiness) {
    switch (args.readiness) {
      case "ready_for_review":            return args.paired ? "ready_for_handoff" : "blocked_by_pairing";
      case "desktop_review_recommended":  return args.paired ? "ready_for_handoff" : "blocked_by_pairing";
      case "simulation_required":         return "awaiting_simulation";
      case "policy_blocked":              return "policy_blocked";
      case "missing_evidence":            return "missing_evidence";
      case "blocked_by_config":           return "blocked_by_config";
      case "disabled_execution":          return "disabled_local_execution";
    }
  }
  if (args.policyBlocked) return "policy_blocked";
  return args.paired ? "ready_for_handoff" : "blocked_by_pairing";
}

function statusReason(
  status: DesktopReviewStatus,
  readinessReason: string,
  policyReason: string,
  pairing: DesktopIntelligencePairing,
): string {
  switch (status) {
    case "ready_for_handoff":
      return "Operator can hand this item off to a paired desktop runtime for offline review.";
    case "awaiting_simulation":
      return readinessReason || "Simulation must run on the digital twin before this item is approval-eligible.";
    case "policy_blocked":
      return policyReason || readinessReason || "Tenant policy blocks this action class.";
    case "missing_evidence":
      return readinessReason || "Evidence refs incomplete — packet not approval-ready.";
    case "blocked_by_pairing":
      return pairing.binaryAvailable
        ? "No paired desktop session detected. Install + pair the desktop runtime to enable handoff."
        : "Desktop binary not yet published — pairing unavailable in this build.";
    case "blocked_by_config":
      return policyReason || readinessReason || "Required credentials or configuration are missing.";
    case "disabled_local_execution":
      return "Local execution remains disabled by the automation boundary. Operator review only.";
  }
}

function statusWeight(s: DesktopReviewStatus): number {
  // Lower wins → ready first, then waiting states, then blocked
  switch (s) {
    case "ready_for_handoff":         return 0;
    case "awaiting_simulation":       return 1;
    case "missing_evidence":          return 2;
    case "policy_blocked":            return 3;
    case "blocked_by_pairing":        return 4;
    case "blocked_by_config":         return 5;
    case "disabled_local_execution":  return 6;
  }
}

function mapRiskToSeverity(r: "low" | "medium" | "high" | "critical"): DesktopReviewSeverity {
  switch (r) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
  }
}

function riskScore(r: "low" | "medium" | "high" | "critical"): number {
  switch (r) {
    case "critical": return 95;
    case "high":     return 75;
    case "medium":   return 50;
    case "low":      return 25;
  }
}

/**
 * Operational Priority Engine.
 *
 * Pure read-only composition. Builds the canonical AxiomOSState +
 * Operating Graph, then derives a ranked list of PriorityItems with
 * fully-explained scoring breakdowns. Operators can audit the score:
 *
 *   composite = severityWeight × evidenceMultiplier ×
 *               confidenceMultiplier × blockerPenalty
 *
 * No SDK calls. No fabrication. Tenant-scoped.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { buildOperatingGraph } from "@/lib/operatingGraph/operatingGraphBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import {
  computePriorityScore,
  confidenceFromScore,
  type PriorityCategory,
  type PriorityItem,
  type PriorityReport,
  type PrioritySeverity,
  type PrioritySourceMode,
} from "./priorityModel";

export interface BuildPriorityReportInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildPriorityReport(input: BuildPriorityReportInput): Promise<PriorityReport> {
  const [state, graph] = await Promise.all([
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildOperatingGraph({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  const items: PriorityItem[] = [];

  // ---------------------------------------------------------------------------
  // 1) Security findings — top severity buckets become priority items
  // ---------------------------------------------------------------------------
  const sec = state.securityPosture.data;
  const secMode = state.securityPosture.sourceMode as PrioritySourceMode;
  if (sec.criticalCount > 0) {
    items.push(buildItem({
      id: "priority:security:critical",
      title: `${sec.criticalCount} critical security finding${sec.criticalCount === 1 ? "" : "s"} require operator attention`,
      reasonSummary: "Critical findings are the top of the operator stack — every unresolved one expands blast radius.",
      whyItMatters: `Affected systems: ${sec.affectedSystems.slice(0, 3).join(", ") || "tenant-wide"}. Compound risks: ${sec.compoundedRiskCount}.`,
      category: "security_finding",
      severity: "critical",
      urgency: "now",
      sourceSystem: "security_scanner",
      sourceMode: secMode,
      evidenceRefs: ["axiomOS:securityPosture", "operatingGraph:security_findings:all"],
      linkedGraphNodeIds: ["security_findings:all"],
      safeNextAction: state.securityPosture.safeNextAction ?? { label: "Review findings", href: "/dashboard/security" },
      affectedSystem: sec.affectedSystems[0],
      technicalImpactSummary: `${sec.criticalCount} critical + ${sec.highCount} high + ${sec.compoundedRiskCount} compound across ${sec.affectedSystems.length} system${sec.affectedSystems.length === 1 ? "" : "s"}.`,
      limitations: state.securityPosture.limitations,
    }));
  }
  if (sec.highCount > 0) {
    items.push(buildItem({
      id: "priority:security:high",
      title: `${sec.highCount} high-risk finding${sec.highCount === 1 ? "" : "s"} pending review`,
      reasonSummary: "High-risk findings are the next attention band after critical.",
      whyItMatters: "Review and decide whether to remediate, accept risk, or escalate.",
      category: "security_finding",
      severity: "high",
      urgency: sec.criticalCount > 0 ? "this_week" : "now",
      sourceSystem: "security_scanner",
      sourceMode: secMode,
      evidenceRefs: ["axiomOS:securityPosture"],
      linkedGraphNodeIds: ["security_findings:all"],
      safeNextAction: { label: "Open Security Scanner", href: "/dashboard/security" },
      limitations: state.securityPosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // 2) Critical blockers from canonical state
  // ---------------------------------------------------------------------------
  for (const blocker of state.criticalBlockers) {
    items.push(buildItem({
      id: `priority:blocker:${slug(blocker.area)}`,
      title: blocker.area,
      reasonSummary: blocker.reason,
      whyItMatters: "Critical blockers prevent canonical flows from completing — operator action is required.",
      category: "integration_blocker",
      severity: "high",
      urgency: "now",
      sourceSystem: "axiom_os",
      sourceMode: state.sourceMode as PrioritySourceMode,
      blockedBy: "config_or_permission",
      evidenceRefs: ["axiomOS:criticalBlockers"],
      linkedGraphNodeIds: [],
      safeNextAction: blocker.safeNextAction ?? { label: "Open Sources", href: "/dashboard/sources" },
      limitations: [],
    }));
  }

  // ---------------------------------------------------------------------------
  // 3) Pending approvals — every queued approval is a priority item
  // ---------------------------------------------------------------------------
  const ap = state.approvalPosture.data;
  if (ap.pendingCount > 0) {
    items.push(buildItem({
      id: "priority:approval:pending",
      title: `${ap.pendingCount} approval${ap.pendingCount === 1 ? "" : "s"} waiting for operator`,
      reasonSummary: "Pending approvals block remediation + simulation from progressing.",
      whyItMatters: `${ap.highRiskCount} high-risk · ${ap.expiredCount} expired.`,
      category: "approval_pending",
      severity: ap.highRiskCount > 0 ? "high" : "medium",
      urgency: ap.expiredCount > 0 ? "now" : "this_week",
      sourceSystem: "approval_engine",
      sourceMode: state.approvalPosture.sourceMode as PrioritySourceMode,
      evidenceRefs: ["axiomOS:approvalPosture"],
      linkedGraphNodeIds: ["approval:queue"],
      safeNextAction: state.approvalPosture.safeNextAction ?? { label: "Open Approvals", href: "/dashboard/approvals" },
      limitations: state.approvalPosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // 4) Provider preview/blocked sources — actionable integration work
  // ---------------------------------------------------------------------------
  for (const p of state.providers) {
    if (p.mode === "live" || p.mode === "partial_live") continue;
    const blockedByConfig = p.missingRequirements.length > 0;
    items.push(buildItem({
      id: `priority:provider:${p.provider}`,
      title: `${p.provider.toUpperCase()} source · ${p.mode.replace(/_/g, " ")}`,
      reasonSummary: p.headline,
      whyItMatters: blockedByConfig
        ? `Missing: ${p.missingRequirements.slice(0, 2).join(", ")}${p.missingRequirements.length > 2 ? "…" : ""}.`
        : "Source is in preview — connect credentials to unlock live read-only mode.",
      category: "integration_blocker",
      severity: p.mode === "blocked" ? "high" : "medium",
      urgency: "this_week",
      sourceSystem: p.provider,
      sourceMode: p.mode as PrioritySourceMode,
      affectedSystem: p.provider,
      blockedBy: blockedByConfig ? "missing_config" : undefined,
      evidenceRefs: [`axiomOS:providers[${p.provider}]`],
      linkedGraphNodeIds: [`source:${p.provider}`],
      safeNextAction: p.safeNextAction ?? { label: `Open ${p.provider.toUpperCase()}`, href: `/dashboard/${p.provider}` },
      limitations: [],
    }));
  }

  // ---------------------------------------------------------------------------
  // 5) Remediation candidates ready to advance
  // ---------------------------------------------------------------------------
  const rem = state.remediationPosture.data;
  if (rem.candidateCount > 0 && rem.simulatedCount < rem.candidateCount) {
    items.push(buildItem({
      id: "priority:remediation:simulate_next",
      title: `${rem.candidateCount - rem.simulatedCount} remediation candidate${rem.candidateCount - rem.simulatedCount === 1 ? "" : "s"} ready to simulate`,
      reasonSummary: "Simulation is the next safe step before requesting approval.",
      whyItMatters: `Approval-gated: ${rem.approvalGatedCount} · Desktop-eligible: ${rem.desktopReviewEligibleCount}.`,
      category: "operational_drift",
      severity: "medium",
      urgency: "this_week",
      sourceSystem: "remediation_pipeline",
      sourceMode: state.remediationPosture.sourceMode as PrioritySourceMode,
      evidenceRefs: ["axiomOS:remediationPosture", "operatingGraph:remediation:all"],
      linkedGraphNodeIds: ["remediation:all", "simulation:all"],
      safeNextAction: { label: "Open Simulations", href: "/dashboard/simulations" },
      limitations: state.remediationPosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // 6) Persistence preview — readiness blocker for pilot
  // ---------------------------------------------------------------------------
  if (!state.auditPosture.data.persistent) {
    items.push(buildItem({
      id: "priority:persistence:audit",
      title: "Audit log is in-memory only",
      reasonSummary: "Audit events are lost on restart until DATABASE_URL is set.",
      whyItMatters: "Audit persistence is a pilot-readiness prerequisite — auditors expect durable history.",
      category: "readiness_blocker",
      severity: "high",
      urgency: "this_month",
      sourceSystem: "audit_store",
      sourceMode: "preview",
      blockedBy: "missing_config",
      evidenceRefs: ["axiomOS:auditPosture"],
      linkedGraphNodeIds: ["audit:log"],
      safeNextAction: { label: "Setup persistence", href: "/docs/architecture#persistence" },
      limitations: state.auditPosture.limitations,
    }));
  }
  if (!state.memoryPosture.data.persistent) {
    items.push(buildItem({
      id: "priority:persistence:memory",
      title: "Operational memory is in-memory only",
      reasonSummary: "Memory records reset on every server boot until persistence is wired.",
      whyItMatters: "Loss of operational memory weakens recurring-issue detection over time.",
      category: "readiness_blocker",
      severity: "medium",
      urgency: "this_month",
      sourceSystem: "memory_store",
      sourceMode: "preview",
      blockedBy: "missing_config",
      evidenceRefs: ["axiomOS:memoryPosture"],
      linkedGraphNodeIds: [],
      safeNextAction: { label: "Setup persistence", href: "/docs/architecture#persistence" },
      limitations: state.memoryPosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // 7) Evidence coverage gap
  // ---------------------------------------------------------------------------
  const ev = state.evidencePosture.data;
  const evRatio = ev.totalRecords > 0 ? ev.verifiedRecords / ev.totalRecords : 0;
  if (ev.totalRecords === 0 || evRatio < 0.3) {
    items.push(buildItem({
      id: "priority:evidence:coverage",
      title: ev.totalRecords === 0 ? "No evidence records collected yet" : `${Math.round(evRatio * 100)}% evidence verified — coverage gap`,
      reasonSummary: "Evidence coverage is what makes Axiom auditable. Low coverage means weak trust posture.",
      whyItMatters: `${ev.totalRecords} record${ev.totalRecords === 1 ? "" : "s"} · ${ev.verifiedRecords} verified · ${Math.round(ev.coverageScore * 100)}% coverage score.`,
      category: "evidence_gap",
      severity: ev.totalRecords === 0 ? "medium" : "low",
      urgency: "this_month",
      sourceSystem: "evidence_collector",
      sourceMode: state.evidencePosture.sourceMode as PrioritySourceMode,
      evidenceRefs: ["axiomOS:evidencePosture"],
      linkedGraphNodeIds: ["evidence:library"],
      safeNextAction: { label: "Open Evidence", href: "/dashboard/evidence" },
      limitations: state.evidencePosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // 8) Desktop unpaired — readiness signal
  // ---------------------------------------------------------------------------
  if (state.desktopPosture.data.pairedSessions === 0) {
    items.push(buildItem({
      id: "priority:desktop:pair",
      title: "No paired desktop session",
      reasonSummary: "Desktop review workstation is unavailable until at least one session pairs.",
      whyItMatters: "Approval items can be reviewed in the web but governed desktop review is unavailable.",
      category: "desktop_blocker",
      severity: "low",
      urgency: "scheduled",
      sourceSystem: "desktop_runtime",
      sourceMode: state.desktopPosture.sourceMode as PrioritySourceMode,
      evidenceRefs: ["axiomOS:desktopPosture"],
      linkedGraphNodeIds: ["desktop_review:workstation"],
      safeNextAction: state.desktopPosture.safeNextAction ?? { label: "Open Desktop", href: "/dashboard/desktop" },
      limitations: state.desktopPosture.limitations,
    }));
  }

  // ---------------------------------------------------------------------------
  // Rank everything by composite score
  // ---------------------------------------------------------------------------
  const ranked = items
    .sort((a, b) => b.score.composite - a.score.composite)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // Summary rollup
  const summary = {
    total:           ranked.length,
    critical:        ranked.filter((i) => i.severity === "critical").length,
    high:            ranked.filter((i) => i.severity === "high").length,
    medium:          ranked.filter((i) => i.severity === "medium").length,
    low:             ranked.filter((i) => i.severity === "low").length,
    info:            ranked.filter((i) => i.severity === "info").length,
    blockedByConfig: ranked.filter((i) => i.blockedBy === "missing_config").length,
    blockedByPolicy: ranked.filter((i) => i.blockedBy === "policy").length,
  };

  const averageConfidence = ranked.length === 0
    ? 0
    : Math.round((ranked.reduce((acc, i) => acc + i.confidence, 0) / ranked.length) * 100) / 100;

  // Quiet the unused variable warning by referencing the graph
  void graph;

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    items: ranked,
    summary,
    averageConfidence,
    overallSourceMode: state.sourceMode as PrioritySourceMode,
    limitations: [
      "Priority scoring is a pure projection over canonical AxiomOSState — it never auto-executes.",
      "Confidence reflects evidence quality + sourceMode; preview data lowers confidence honestly.",
      ...state.limitations,
    ],
    safeNextAction: { label: "Open Command Center", href: "/dashboard/command-center" },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BuildItemInput {
  id: string;
  title: string;
  reasonSummary: string;
  whyItMatters: string;
  category: PriorityCategory;
  severity: PrioritySeverity;
  urgency: PriorityItem["urgency"];
  sourceSystem: string;
  sourceMode: PrioritySourceMode;
  affectedSystem?: string;
  blockedBy?: string;
  technicalImpactSummary?: string;
  businessImpactSummary?: string;
  evidenceRefs: string[];
  linkedGraphNodeIds: string[];
  safeNextAction: { label: string; href: string };
  limitations: string[];
}

function buildItem(i: BuildItemInput): PriorityItem {
  const score = computePriorityScore({
    severity: i.severity,
    sourceMode: i.sourceMode,
    evidenceCount: i.evidenceRefs.length,
    blockedByConfig: i.blockedBy === "missing_config",
    blockedByPolicy: i.blockedBy === "policy",
  });
  return {
    id: i.id,
    rank: 0, // assigned after sort
    title: i.title,
    reasonSummary: i.reasonSummary,
    category: i.category,
    severity: i.severity,
    urgency: i.urgency,
    confidence: confidenceFromScore(score),
    score,
    sourceSystem: i.sourceSystem,
    sourceMode: i.sourceMode,
    affectedSystem: i.affectedSystem,
    blockedBy: i.blockedBy,
    whyItMatters: i.whyItMatters,
    businessImpactSummary: i.businessImpactSummary,
    technicalImpactSummary: i.technicalImpactSummary,
    safeNextAction: i.safeNextAction,
    limitations: i.limitations,
    evidenceRefs: i.evidenceRefs,
    linkedGraphNodeIds: i.linkedGraphNodeIds,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

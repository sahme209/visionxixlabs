/**
 * Operating Graph builder.
 *
 * Pure read-only composition. Calls buildAxiomOSState() + builds canonical
 * nodes per provider/posture, then declares the canonical edges that
 * connect them (the operational chain Axiom enforces by design):
 *
 *   source → operating_loop → security_findings → remediation →
 *   simulation → policy → approval → desktop_review → audit →
 *   evidence → trust_center → readiness
 *
 * Plus a parallel integration_health node that monitors every source.
 *
 * No SDK calls. No new persistence. Tenant-scoped via the state builder.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { ProviderPosture, SectionEnvelope } from "@/lib/axiomOS/axiomOSModel";
import {
  rollupGraphSourceMode,
  type OperatingGraph,
  type OperatingGraphEdge,
  type OperatingGraphNode,
  type OperatingGraphNodeStatus,
  type OperatingGraphSourceMode,
} from "./operatingGraphModel";

export interface BuildOperatingGraphInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildOperatingGraph(input: BuildOperatingGraphInput): Promise<OperatingGraph> {
  const state = await buildAxiomOSState({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });

  const nodes: OperatingGraphNode[] = [];
  const edges: OperatingGraphEdge[] = [];

  // ---------------------------------------------------------------------------
  // 1) source nodes — one per provider
  // ---------------------------------------------------------------------------
  for (const p of state.providers) {
    const id = `source:${p.provider}`;
    nodes.push({
      id,
      type: "source",
      title: p.provider.toUpperCase(),
      status: providerStatus(p),
      sourceMode: providerSourceMode(p),
      count: typeof p.findingCount === "number" ? p.findingCount : undefined,
      route: routeForProvider(p.provider),
      limitations: p.missingRequirements,
      safeNextAction: p.safeNextAction,
      evidenceRefs: [`axiomOS:providers[${p.provider}]`],
    });

    // source → integration_health (parallel monitor)
    edges.push({
      from: id,
      to: "integration_health:all",
      relation: "monitored_by",
      explanation: `${p.provider.toUpperCase()} source is monitored by Integration Health.`,
      evidenceRefs: [`axiomOS:providers[${p.provider}]`, "integrationHealth:all"],
    });
  }

  // ---------------------------------------------------------------------------
  // 2) integration_health node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "integration_health:all",
    type: "integration_health",
    title: "Integration Health Center",
    status: state.providers.some((p) => p.mode === "blocked") ? "blocked" :
            state.providers.every((p) => p.mode === "live")    ? "healthy" :
                                                                  "preview",
    sourceMode: providerCompositeSourceMode(state.providers),
    count: state.providers.length,
    route: "/dashboard/integrations/health",
    limitations: state.limitations,
    safeNextAction: { label: "Open Integration Health", href: "/dashboard/integrations/health" },
    evidenceRefs: ["axiomOS:providers", "integrationHealth:report"],
  });

  // ---------------------------------------------------------------------------
  // 3) operating_loop nodes — one per provider that has a loop
  // ---------------------------------------------------------------------------
  for (const l of state.operatingLoops) {
    const id = `operating_loop:${l.provider}`;
    nodes.push({
      id,
      type: "operating_loop",
      title: `${l.provider.toUpperCase()} loop`,
      status: l.status === "completed"            ? "healthy"     :
              l.status === "in_progress"          ? "in_progress" :
              l.status === "paused_for_approval"  ? "blocked"     :
              l.status === "paused_for_user_input"? "blocked"     :
              l.status === "failed"               ? "blocked"     :
              l.status === "blocked"              ? "blocked"     :
                                                    "preview",
      sourceMode: l.sourceMode as OperatingGraphSourceMode,
      count: l.attentionRequiredCount,
      route: routeForProvider(l.provider),
      limitations: l.attentionRequiredCount > 0
        ? [`${l.attentionRequiredCount} attention-required signal${l.attentionRequiredCount === 1 ? "" : "s"} pending`]
        : [],
      safeNextAction: l.topSafeNextAction,
      evidenceRefs: [`axiomOS:operatingLoops[${l.provider}]`],
    });

    // source → operating_loop
    const sourceId = `source:${l.provider}`;
    if (state.providers.find((p) => p.provider === l.provider)) {
      edges.push({
        from: sourceId,
        to: id,
        relation: "produced",
        explanation: `${l.provider.toUpperCase()} source produces operating-loop runs.`,
        evidenceRefs: [`axiomOS:operatingLoops[${l.provider}]`],
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4) security_findings node — cross-cutting
  // ---------------------------------------------------------------------------
  nodes.push(envelopeNode({
    id: "security_findings:all",
    type: "security_findings",
    title: "Security findings",
    envelope: state.securityPosture,
    count: state.securityPosture.data.totalFindings,
    severity: highestSeverity(state.securityPosture.data),
    route: "/dashboard/security",
    safeNextAction: state.securityPosture.safeNextAction ?? { label: "Open Security", href: "/dashboard/security" },
    evidenceRefs: ["axiomOS:securityPosture"],
  }));
  // Every operating loop feeds security findings (cross-cutting)
  for (const l of state.operatingLoops) {
    edges.push({
      from: `operating_loop:${l.provider}`,
      to:   "security_findings:all",
      relation: "detected",
      explanation: `${l.provider.toUpperCase()} loop emits signals into the cross-cutting Security Scanner.`,
      evidenceRefs: [`axiomOS:operatingLoops[${l.provider}]`, "axiomOS:securityPosture"],
    });
  }

  // ---------------------------------------------------------------------------
  // 5) remediation node
  // ---------------------------------------------------------------------------
  nodes.push(envelopeNode({
    id: "remediation:all",
    type: "remediation",
    title: "Remediation candidates",
    envelope: state.remediationPosture,
    count: state.remediationPosture.data.candidateCount,
    route: "/dashboard/remediation",
    safeNextAction: state.remediationPosture.safeNextAction ?? { label: "Open Remediation", href: "/dashboard/remediation" },
    evidenceRefs: ["axiomOS:remediationPosture"],
  }));
  edges.push({
    from: "security_findings:all",
    to:   "remediation:all",
    relation: "recommends",
    explanation: "Findings produce remediation candidates with Terraform / CLI / rollback / verification.",
    evidenceRefs: ["axiomOS:securityPosture", "axiomOS:remediationPosture"],
  });

  // ---------------------------------------------------------------------------
  // 6) simulation node — derived from remediationPosture.simulatedCount
  // ---------------------------------------------------------------------------
  const simStatus: OperatingGraphNodeStatus =
    state.remediationPosture.data.simulatedCount > 0 ? "healthy" : "preview";
  nodes.push({
    id: "simulation:all",
    type: "simulation",
    title: "Simulation runs",
    status: simStatus,
    sourceMode: state.remediationPosture.sourceMode as OperatingGraphSourceMode,
    count: state.remediationPosture.data.simulatedCount,
    route: "/dashboard/simulations",
    limitations: state.remediationPosture.data.simulatedCount === 0
      ? ["No simulations executed yet — click Create simulation."]
      : [],
    safeNextAction: { label: "Open Simulations", href: "/dashboard/simulations" },
    evidenceRefs: ["axiomOS:remediationPosture"],
  });
  edges.push({
    from: "remediation:all",
    to:   "simulation:all",
    relation: "simulates",
    explanation: "Remediation candidates are applied to the digital twin only (never the real cloud).",
    evidenceRefs: ["axiomOS:remediationPosture"],
  });

  // ---------------------------------------------------------------------------
  // 7) policy node — literal governance reminder
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "policy:approval_gated",
    type: "policy",
    title: "Approval gating",
    status: "healthy",
    sourceMode: "live",
    route: "/dashboard/approvals",
    limitations: [],
    safeNextAction: { label: "Open Approval queue", href: "/dashboard/approvals" },
    evidenceRefs: ["axiomOS:safetyStatus", "approvalPolicy:strict"],
  });
  edges.push({
    from: "simulation:all",
    to:   "policy:approval_gated",
    relation: "governed_by",
    explanation: "Simulated changes cannot apply without crossing the approval-gating policy.",
    evidenceRefs: ["approvalPolicy:strict"],
  });

  // ---------------------------------------------------------------------------
  // 8) approval node
  // ---------------------------------------------------------------------------
  nodes.push(envelopeNode({
    id: "approval:queue",
    type: "approval",
    title: "Approval queue",
    envelope: state.approvalPosture,
    count: state.approvalPosture.data.pendingCount,
    route: "/dashboard/approvals",
    safeNextAction: state.approvalPosture.safeNextAction ?? { label: "Open Approvals", href: "/dashboard/approvals" },
    evidenceRefs: ["axiomOS:approvalPosture"],
  }));
  edges.push({
    from: "policy:approval_gated",
    to:   "approval:queue",
    relation: "requires_approval",
    explanation: "Approval-gating policy routes changes into the operator approval queue.",
    evidenceRefs: ["axiomOS:approvalPosture"],
  });

  // ---------------------------------------------------------------------------
  // 9) desktop_review node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "desktop_review:workstation",
    type: "desktop_review",
    title: "Desktop review",
    status: state.desktopPosture.data.pairedSessions > 0 ? "healthy" : "preview",
    sourceMode: state.desktopPosture.sourceMode as OperatingGraphSourceMode,
    count: state.desktopPosture.data.pairedSessions,
    route: "/dashboard/desktop",
    limitations: [
      ...state.desktopPosture.limitations,
      "Local execution disabled by safety contract",
    ],
    safeNextAction: state.desktopPosture.safeNextAction ?? { label: "Open Desktop", href: "/dashboard/desktop" },
    evidenceRefs: ["axiomOS:desktopPosture"],
  });
  edges.push({
    from: "approval:queue",
    to:   "desktop_review:workstation",
    relation: "reviewed_on_desktop",
    explanation: "Approval items are reviewable on the paired desktop workstation (no apply).",
    evidenceRefs: ["axiomOS:desktopPosture"],
  });

  // ---------------------------------------------------------------------------
  // 10) audit node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "audit:log",
    type: "audit",
    title: "Audit log",
    status: state.auditPosture.data.persistent ? "healthy" : "preview",
    sourceMode: state.auditPosture.sourceMode as OperatingGraphSourceMode,
    count: state.auditPosture.data.recentEventCount,
    route: "/dashboard/audit",
    limitations: state.auditPosture.limitations,
    safeNextAction: { label: "Open Audit", href: "/dashboard/audit" },
    evidenceRefs: ["axiomOS:auditPosture"],
  });
  edges.push({
    from: "approval:queue",
    to:   "audit:log",
    relation: "audited_by",
    explanation: "Every approval decision writes a SecureAuditRecord.",
    evidenceRefs: ["axiomOS:auditPosture"],
  });

  // ---------------------------------------------------------------------------
  // 11) evidence node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "evidence:library",
    type: "evidence",
    title: "Evidence library",
    status: state.evidencePosture.data.verifiedRecords > 0 ? "healthy" : "preview",
    sourceMode: state.evidencePosture.sourceMode as OperatingGraphSourceMode,
    count: state.evidencePosture.data.totalRecords,
    route: "/dashboard/evidence",
    limitations: state.evidencePosture.limitations,
    safeNextAction: { label: "Inspect evidence", href: "/dashboard/evidence" },
    evidenceRefs: ["axiomOS:evidencePosture"],
  });
  edges.push({
    from: "audit:log",
    to:   "evidence:library",
    relation: "evidenced_by",
    explanation: "Audit events feed the evidence library; bundles are exportable.",
    evidenceRefs: ["axiomOS:evidencePosture"],
  });

  // ---------------------------------------------------------------------------
  // 12) trust_center node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "trust_center:summary",
    type: "trust_center",
    title: "Trust Center",
    status: "healthy",
    sourceMode: state.evidencePosture.sourceMode as OperatingGraphSourceMode,
    route: "/dashboard/trust",
    limitations: [],
    safeNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
    evidenceRefs: ["axiomOS:evidencePosture", "trustSummary"],
  });
  edges.push({
    from: "evidence:library",
    to:   "trust_center:summary",
    relation: "displayed_in",
    explanation: "Evidence + controls roll up into the Trust Center summary + export.",
    evidenceRefs: ["axiomOS:evidencePosture", "trustSummary"],
  });

  // ---------------------------------------------------------------------------
  // 13) readiness node
  // ---------------------------------------------------------------------------
  nodes.push({
    id: "readiness:overall",
    type: "readiness",
    title: "Readiness rollup",
    status: state.readinessScore >= 0.8 ? "healthy" : state.readinessScore >= 0.4 ? "in_progress" : "preview",
    sourceMode: state.sourceMode as OperatingGraphSourceMode,
    count: Math.round(state.readinessScore * 100),
    route: "/dashboard/readiness",
    limitations: state.limitations,
    safeNextAction: { label: "Open Readiness", href: "/dashboard/readiness" },
    evidenceRefs: ["axiomOS:readinessScore", "axiomOS:limitations"],
  });
  edges.push({
    from: "trust_center:summary",
    to:   "readiness:overall",
    relation: "improves_readiness",
    explanation: "Higher control + evidence coverage improves the readiness score.",
    evidenceRefs: ["axiomOS:readinessScore"],
  });

  // ---------------------------------------------------------------------------
  // Summary rollup
  // ---------------------------------------------------------------------------
  const nodesByType: Record<string, number> = {};
  for (const n of nodes) nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
  const blockedNodes = nodes.filter((n) => n.status === "blocked").length;
  const previewNodes = nodes.filter((n) => n.status === "preview").length;
  const healthyNodes = nodes.filter((n) => n.status === "healthy").length;

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodesByType,
      blockedNodes,
      previewNodes,
      healthyNodes,
    },
    overallSourceMode: rollupGraphSourceMode(nodes),
    limitations: [
      "Operating Graph is a pure projection of canonical state — it does not mutate or trigger anything.",
      ...state.limitations,
    ],
    safeNextAction: { label: "Open Command Center", href: "/dashboard/command-center" },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function providerStatus(p: ProviderPosture): OperatingGraphNodeStatus {
  if (p.mode === "live")          return "healthy";
  if (p.mode === "partial_live")  return "healthy";
  if (p.mode === "blocked")       return "blocked";
  if (p.mode === "disabled")      return "disabled";
  return "preview";
}

function providerSourceMode(p: ProviderPosture): OperatingGraphSourceMode {
  switch (p.mode) {
    case "live":         return "live";
    case "partial_live": return "partial_live";
    case "expanding":    return "foundation";
    case "preview":      return "preview";
    case "blocked":      return "blocked";
    case "disabled":     return "disabled";
    default:             return "unknown";
  }
}

function providerCompositeSourceMode(ps: ProviderPosture[]): OperatingGraphSourceMode {
  const modes = new Set(ps.map(providerSourceMode));
  if (modes.has("blocked"))      return "blocked";
  if (modes.has("disabled"))     return "disabled";
  if (modes.has("preview"))      return "preview";
  if (modes.has("foundation"))   return "foundation";
  if (modes.has("partial_live")) return "partial_live";
  if (modes.size === 1 && modes.has("live")) return "live";
  return "unknown";
}

function routeForProvider(provider: string): string {
  switch (provider) {
    case "aws":    return "/dashboard/aws";
    case "azure":  return "/dashboard/azure";
    case "gcp":    return "/dashboard/gcp";
    case "github": return "/dashboard/github";
    default:       return "/dashboard/sources";
  }
}

function highestSeverity(d: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number }): "critical" | "high" | "medium" | "low" | undefined {
  if (d.criticalCount > 0) return "critical";
  if (d.highCount > 0)     return "high";
  if (d.mediumCount > 0)   return "medium";
  if (d.lowCount > 0)      return "low";
  return undefined;
}

interface EnvelopeNodeInput {
  id: string;
  type: OperatingGraphNode["type"];
  title: string;
  envelope: SectionEnvelope<unknown>;
  count: number;
  severity?: "critical" | "high" | "medium" | "low";
  route?: string;
  safeNextAction?: { label: string; href: string };
  evidenceRefs: string[];
}

function envelopeNode(input: EnvelopeNodeInput): OperatingGraphNode {
  const status: OperatingGraphNodeStatus =
    input.envelope.status === "passing"  ? "healthy" :
    input.envelope.status === "partial"  ? "in_progress" :
    input.envelope.status === "preview"  ? "preview" :
    input.envelope.status === "blocked"  ? "blocked" :
    input.envelope.status === "failing"  ? "blocked" :
                                            "unknown";
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    status,
    sourceMode: input.envelope.sourceMode as OperatingGraphSourceMode,
    count: input.count,
    severity: input.severity,
    route: input.route,
    limitations: input.envelope.limitations,
    safeNextAction: input.safeNextAction,
    evidenceRefs: input.evidenceRefs,
  };
}

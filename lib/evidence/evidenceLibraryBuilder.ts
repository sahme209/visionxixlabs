/**
 * Evidence Library V2 builder.
 *
 * Pure read-only composition. Synthesises evidence records from
 * canonical state (providers, postures, risk queue, integration
 * health). Until persistence is fully wired, every record carries
 * an honest retentionStatus.
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { buildRiskQueue } from "@/lib/risk/riskQueueBuilder";
import { buildIntegrationHealthReport } from "@/lib/integrations/integrationHealthChecker";
import type {
  EvidenceLibraryReport,
  EvidenceRecord,
  EvidenceRetentionStatus,
  EvidenceSourceMode,
  EvidenceType,
} from "./evidenceLibraryModel";

export interface BuildEvidenceLibraryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildEvidenceLibrary(input: BuildEvidenceLibraryInput): Promise<EvidenceLibraryReport> {
  const [state, risk, health] = await Promise.all([
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildRiskQueue({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildIntegrationHealthReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // Persistence detection from audit posture
  const persistent = state.auditPosture.data.persistent;
  const retention: EvidenceRetentionStatus = persistent ? "retained_default" : "ephemeral_session";

  const records: EvidenceRecord[] = [];

  // ---------------------------------------------------------------------------
  // 1) Source posture evidence (one per provider)
  // ---------------------------------------------------------------------------
  for (const p of state.providers) {
    records.push({
      id: `evidence:source:${p.provider}`,
      type: "source_posture",
      title: `${p.provider.toUpperCase()} source posture · ${p.mode}`,
      summary: p.headline,
      sourceSystem: p.provider,
      sourceMode: p.mode as EvidenceSourceMode,
      createdAt: state.generatedAt,
      linkedObjectType: "provider",
      linkedObjectId: p.provider,
      retentionStatus: retention,
      exportable: true,
      limitations: p.missingRequirements,
      evidenceRef: `axiomOS:providers[${p.provider}]`,
    });
  }

  // ---------------------------------------------------------------------------
  // 2) Integration health evidence (one per integration)
  // ---------------------------------------------------------------------------
  for (const e of health.entries) {
    records.push({
      id: `evidence:health:${e.id}`,
      type: "integration_health",
      title: `${e.label} health · ${e.status}`,
      summary: e.headline,
      sourceSystem: e.id,
      sourceMode: e.sourceMode as EvidenceSourceMode,
      createdAt: e.lastCheckedAt,
      linkedObjectType: "integration_health",
      linkedObjectId: e.id,
      retentionStatus: retention,
      exportable: true,
      limitations: e.limitations,
      evidenceRef: e.evidenceRefs[0] ?? `integrationHealth:${e.id}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 3) Security finding evidence (aggregate)
  // ---------------------------------------------------------------------------
  const sec = state.securityPosture.data;
  if (sec.totalFindings > 0) {
    records.push({
      id: "evidence:security:posture",
      type: "security_finding",
      title: `${sec.totalFindings} security findings · ${sec.criticalCount} critical · ${sec.highCount} high`,
      summary: `Findings emitted by the cross-cutting scanner across ${sec.affectedSystems.length} system${sec.affectedSystems.length === 1 ? "" : "s"}.`,
      sourceSystem: "security_scanner",
      sourceMode: state.securityPosture.sourceMode as EvidenceSourceMode,
      createdAt: state.generatedAt,
      linkedObjectType: "security_posture",
      linkedObjectId: "all",
      retentionStatus: retention,
      exportable: true,
      limitations: state.securityPosture.limitations,
      evidenceRef: "axiomOS:securityPosture",
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Risk signal evidence (top 10)
  // ---------------------------------------------------------------------------
  for (const r of risk.items.slice(0, 10)) {
    records.push({
      id: `evidence:risk:${r.id}`,
      type: "risk_signal",
      title: r.title,
      summary: r.description,
      sourceSystem: r.sourceSystem,
      sourceMode: r.sourceMode as EvidenceSourceMode,
      createdAt: r.firstSeenAt,
      linkedObjectType: "risk",
      linkedObjectId: r.id,
      retentionStatus: retention,
      exportable: true,
      limitations: r.limitations,
      evidenceRef: r.evidenceRefs[0] ?? `risk:${r.id}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 5) Remediation candidate evidence (count-only)
  // ---------------------------------------------------------------------------
  const rem = state.remediationPosture.data;
  if (rem.candidateCount > 0) {
    records.push({
      id: "evidence:remediation:candidates",
      type: "remediation_candidate",
      title: `${rem.candidateCount} remediation candidates prepared`,
      summary: `${rem.simulatedCount} simulated · ${rem.approvalGatedCount} approval-gated · ${rem.desktopReviewEligibleCount} desktop-eligible. Generated by the remediation pipeline.`,
      sourceSystem: "remediation_pipeline",
      sourceMode: state.remediationPosture.sourceMode as EvidenceSourceMode,
      createdAt: state.generatedAt,
      linkedObjectType: "remediation",
      linkedObjectId: "all",
      retentionStatus: retention,
      exportable: true,
      limitations: state.remediationPosture.limitations,
      evidenceRef: "axiomOS:remediationPosture",
    });
  }

  // ---------------------------------------------------------------------------
  // 6) Approval decisions evidence
  // ---------------------------------------------------------------------------
  if (state.approvalPosture.data.pendingCount > 0 || state.approvalPosture.data.expiredCount > 0) {
    records.push({
      id: "evidence:approval:posture",
      type: "approval_decision",
      title: `${state.approvalPosture.data.pendingCount} pending · ${state.approvalPosture.data.expiredCount} expired approvals`,
      summary: `${state.approvalPosture.data.highRiskCount} high-risk. Every decision audited via /api/orchestration/approvals.`,
      sourceSystem: "approval_engine",
      sourceMode: state.approvalPosture.sourceMode as EvidenceSourceMode,
      createdAt: state.generatedAt,
      linkedObjectType: "approval",
      linkedObjectId: "queue",
      retentionStatus: retention,
      exportable: true,
      limitations: state.approvalPosture.limitations,
      evidenceRef: "axiomOS:approvalPosture",
    });
  }

  // ---------------------------------------------------------------------------
  // 7) Trust control evidence
  // ---------------------------------------------------------------------------
  records.push({
    id: "evidence:trust:control_coverage",
    type: "trust_control",
    title: `Trust control coverage · ${Math.round(state.trustScore * 100)}%`,
    summary: `${state.evidencePosture.data.totalRecords} evidence records · ${state.evidencePosture.data.verifiedRecords} verified · ${Math.round(state.evidencePosture.data.coverageScore * 100)}% coverage.`,
    sourceSystem: "trust_center",
    sourceMode: state.evidencePosture.sourceMode as EvidenceSourceMode,
    createdAt: state.generatedAt,
    linkedObjectType: "trust_center",
    linkedObjectId: "summary",
    retentionStatus: retention,
    exportable: true,
    limitations: state.evidencePosture.limitations,
    evidenceRef: "axiomOS:evidencePosture",
  });

  // ---------------------------------------------------------------------------
  // 8) Audit event evidence (count-only)
  // ---------------------------------------------------------------------------
  records.push({
    id: "evidence:audit:recent_events",
    type: "audit_event",
    title: `${state.auditPosture.data.recentEventCount} recent audit events`,
    summary: state.auditPosture.data.persistent
      ? "Audit log persistent — events durable through restarts."
      : "Audit log in-memory — events lost on restart until DATABASE_URL is set.",
    sourceSystem: "audit_store",
    sourceMode: state.auditPosture.sourceMode as EvidenceSourceMode,
    createdAt: state.generatedAt,
    linkedObjectType: "audit",
    linkedObjectId: "recent",
    retentionStatus: state.auditPosture.data.persistent ? "retained_default" : "pending_persistence",
    exportable: state.auditPosture.data.persistent,
    limitations: state.auditPosture.limitations,
    evidenceRef: "axiomOS:auditPosture",
  });

  // ---------------------------------------------------------------------------
  // Build summary rollup
  // ---------------------------------------------------------------------------
  const byType: Record<EvidenceType, number> = {
    source_posture: 0, scan_result: 0, security_finding: 0, risk_signal: 0,
    remediation_candidate: 0, simulation_result: 0, policy_decision: 0,
    approval_decision: 0, desktop_handoff: 0, trust_control: 0,
    readiness_check: 0, audit_event: 0, integration_health: 0,
  };
  let exportable = 0;
  let ephemeral = 0;
  let retained = 0;
  let pendingPersistence = 0;
  for (const r of records) {
    byType[r.type]++;
    if (r.exportable) exportable++;
    if (r.retentionStatus === "ephemeral_session") ephemeral++;
    if (r.retentionStatus === "retained_default" || r.retentionStatus === "retained_extended") retained++;
    if (r.retentionStatus === "pending_persistence") pendingPersistence++;
  }

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    records,
    summary: {
      total: records.length,
      byType,
      exportable,
      ephemeral,
      retained,
      pendingPersistence,
    },
    safetyContract: "evidence_library_read_only",
    limitations: [
      persistent
        ? "Evidence library is read-only. Export still routes through the existing audited /api/trust/export endpoint."
        : "Persistence not wired — most evidence is ephemeral_session. Setting DATABASE_URL promotes retention to retained_default.",
    ],
    safeNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
  };
}

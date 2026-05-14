/**
 * Execution Graph Builder.
 *
 * Composes the AGI operations graph by reading from canonical typed
 * sources (capability coverage map, validation report, command-center
 * state, release readiness, security scan, planning loop). Every node
 * carries source-mode tags so the UI can render preview/planned/blocked
 * surfaces honestly.
 *
 * This is deliberately a builder. It never invents data — every node
 * has a real upstream owner.
 */

import "server-only";

import {
  GraphBuilder,
  type ExecutionGraph,
  type ExecutionGraphNode,
  type GraphRiskLevel,
  type GraphSourceMode,
} from "@/lib/agent/executionGraph";
import { buildCoverageOverview, type CoverageStatus } from "@/lib/cloud/capabilityCoverageMap";
import { runAutonomousValidationLoop } from "@/lib/validation/autonomousValidationLoop";
import { runAutonomousPlanningLoop } from "@/lib/agent/autonomousPlanningLoop";
import { getCommandCenterState } from "@/lib/platform/getCommandCenterState";
import { currentContext } from "@/lib/auth/currentContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string { return new Date().toISOString(); }

function coverageToRisk(status: CoverageStatus): GraphRiskLevel {
  switch (status) {
    case "blocked":   return "high";
    case "planned":   return "medium";
    case "expanding": return "low";
    case "preview":   return "low";
    case "live":      return "informational";
  }
}

function coverageToSourceMode(status: CoverageStatus): GraphSourceMode {
  switch (status) {
    case "live":      return "live";
    case "preview":   return "preview";
    case "expanding": return "preview";
    case "planned":   return "planned";
    case "blocked":   return "blocked";
  }
}

function normaliseRisk(raw: string): GraphRiskLevel {
  switch (raw) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
    default:         return "informational";
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildExecutionGraph(): Promise<ExecutionGraph> {
  const ctx = await currentContext();
  const state     = await getCommandCenterState();
  const coverage  = buildCoverageOverview();
  const validation = await runAutonomousValidationLoop();
  const planning  = await runAutonomousPlanningLoop();
  const tenantId  = ctx.organizationId ? String(ctx.organizationId) : undefined;

  const b = new GraphBuilder();

  // ── observation node ────────────────────────────────────────────────
  const observation: ExecutionGraphNode = {
    id: "obs.platform",
    type: "observation",
    title: "Platform observation",
    status: "completed",
    risk: "informational",
    sourceModule: "lib/agent/executionGraphBuilder.ts",
    evidence: [
      { label: "coverage rows", ref: `${coverage.rows.length}` },
      { label: "validation probes", ref: `${validation.probes.length}` },
      { label: "planning candidates", ref: `${planning.candidates.length}` },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    confidence: 0.9,
    sourceMode: "live",
    tenantId,
    detail: state.headline,
  };
  b.addNode(observation);

  // ── provider_connection nodes (AWS / Azure / GCP / GitHub) ──────────
  for (const row of coverage.rows.filter((r) => r.area === "connection")) {
    const node = b.addNode({
      id: `conn.${row.id}`,
      type: "provider_connection",
      title: row.title,
      status: row.status === "live" ? "completed" : row.status === "blocked" ? "blocked" : "pending",
      risk: coverageToRisk(row.status),
      provider: (row.domain === "aws" || row.domain === "azure" || row.domain === "gcp") ? row.domain : "platform",
      sourceModule: row.sourceModules.join(", "),
      evidence: [{ label: row.id, ref: row.id }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: row.status === "live" ? 0.95 : 0.6,
      sourceMode: coverageToSourceMode(row.status),
      tenantId,
      detail: row.userExplanation,
    });
    b.addEdge({ kind: "produced_by", from: node.id, to: observation.id });
  }

  // ── validation_result nodes (one per failing / preview probe) ────────
  for (const probe of validation.probes) {
    if (probe.status === "pass") continue;
    const node = b.addNode({
      id: `val.${probe.id}`,
      type: "validation_result",
      title: probe.title,
      status: probe.status === "fail" ? "failed" : probe.status === "blocked" ? "blocked" : "preview",
      risk:   probe.status === "fail" ? "high" : probe.status === "blocked" ? "high" : "low",
      sourceModule: "lib/validation/autonomousValidationLoop.ts",
      evidence: [{ label: probe.id, ref: probe.id }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: 0.85,
      sourceMode: probe.status === "preview" ? "preview" : probe.status === "blocked" ? "blocked" : "live",
      tenantId,
      detail: probe.detail,
    });
    b.addEdge({ kind: "produced_by", from: node.id, to: observation.id });
  }

  // ── security_scan node ──────────────────────────────────────────────
  const securitySource = state.posture.security.source;
  const securityScan = b.addNode({
    id: "scan.security",
    type: "security_scan",
    title: "Security scan",
    status: securitySource === "real" ? "completed" : "preview",
    risk: "informational",
    sourceModule: "lib/securityScanner/securityScanner.ts",
    evidence: [{ label: "source", ref: securitySource }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    confidence: securitySource === "real" ? 0.85 : 0.6,
    sourceMode: securitySource === "real" ? "live" : "preview",
    tenantId,
  });
  b.addEdge({ kind: "produced_by", from: securityScan.id, to: observation.id });

  // ── cloud_snapshot nodes (one per provider slice) ───────────────────
  const slices = state.multiCloud.data.slices;
  for (const slice of slices) {
    const node = b.addNode({
      id: `snapshot.${slice.provider}`,
      type: "cloud_snapshot",
      title: `${slice.provider.toUpperCase()} snapshot`,
      status: slice.source === "live" ? "completed" : "preview",
      risk: slice.totals.findings >= 5 ? "high" : slice.totals.findings >= 1 ? "medium" : "informational",
      provider: slice.provider,
      sourceModule: `lib/cloud/${slice.provider}/`,
      evidence: [
        { label: "resources", ref: `${slice.totals.resources}` },
        { label: "findings",  ref: `${slice.totals.findings}` },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: slice.source === "live" ? 0.9 : 0.5,
      sourceMode: slice.source === "live" ? "live" : "preview",
      tenantId,
      detail: slice.headline,
    });
    b.addEdge({ kind: "produced_by", from: node.id, to: observation.id });
    b.addEdge({ kind: "depends_on", from: securityScan.id, to: node.id });

    // Top finding as a graph node, linked to the snapshot.
    if (slice.topFinding) {
      const tf = slice.topFinding;
      const finding = b.addNode({
        id: `finding.${slice.provider}.top`,
        type: "finding",
        title: `${tf.ruleCode} · ${tf.resourceRef}`,
        status: "ready",
        risk: normaliseRisk(tf.risk),
        provider: slice.provider,
        sourceModule: `lib/cloud/${slice.provider}/${slice.provider}PreviewScanner.ts`,
        evidence: [
          { label: "ruleCode",    ref: tf.ruleCode },
          { label: "resourceRef", ref: tf.resourceRef },
          { label: "risk",        ref: tf.risk },
        ],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        confidence: 0.7,
        sourceMode: slice.source === "live" ? "live" : "preview",
        tenantId,
      });
      b.addEdge({ kind: "produced_by", from: finding.id, to: node.id });
      b.addEdge({ kind: "explains",    from: securityScan.id, to: finding.id });
    }
  }

  // ── releaseops_signal nodes (one per blocker) ───────────────────────
  const readiness = state.releaseOps.data.readiness;
  for (const blocker of readiness.blockers) {
    const node = b.addNode({
      id: `releaseops.${blocker.id}`,
      type: "releaseops_signal",
      title: blocker.title,
      status: "ready",
      risk: normaliseRisk(blocker.severity),
      provider: "github",
      sourceModule: "lib/releaseops/releaseReadiness.ts",
      evidence: [{ label: "repo", ref: blocker.repoId }, { label: "kind", ref: blocker.kind }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: 0.8,
      sourceMode: state.releaseOps.data.source === "live" ? "live" : "preview",
      tenantId,
      detail: blocker.detail,
    });
    b.addEdge({ kind: "produced_by", from: node.id, to: observation.id });
  }

  // ── recommendation nodes (from planning candidates) ─────────────────
  for (const cand of planning.candidates) {
    const rec = b.addNode({
      id: `rec.${cand.id}`,
      type: "recommendation",
      title: cand.title,
      status: "ready",
      risk: (cand.impact === "critical" ? "critical" : cand.impact === "high" ? "high" : cand.impact === "medium" ? "medium" : "low"),
      sourceModule: "lib/agent/autonomousPlanningLoop.ts",
      evidence: cand.sourceIds.map((id) => ({ label: "source", ref: id })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: 0.7,
      sourceMode: "preview",
      tenantId,
      detail: cand.rationale,
    });
    b.addEdge({ kind: "produced_by", from: rec.id, to: observation.id });

    // Approval gating edge.
    if (cand.policyRequirement === "approver_required" || cand.policyRequirement === "two_approvers") {
      const approval = b.addNode({
        id: `approval.${cand.id}`,
        type: "approval_request",
        title: `Approval required for ${cand.title}`,
        status: "pending",
        risk: rec.risk,
        sourceModule: "lib/agent/autonomousPlanningLoop.ts",
        evidence: [{ label: "candidate", ref: cand.id }],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        confidence: 0.9,
        sourceMode: "live",
        tenantId,
      });
      b.addEdge({ kind: "requires_approval", from: rec.id, to: approval.id });
    }

    // Policy decision edge (always-on for governance visibility).
    const policy = b.addNode({
      id: `policy.${cand.id}`,
      type: "policy_decision",
      title: `Policy verdict for ${cand.title}`,
      status: cand.policyRequirement === "policy_blocked" ? "blocked" : "completed",
      risk: cand.policyRequirement === "policy_blocked" ? "high" : "informational",
      sourceModule: "lib/agent/autonomousPlanningLoop.ts",
      evidence: [{ label: "policy", ref: cand.policyRequirement }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: 1.0,
      sourceMode: "live",
      tenantId,
    });
    b.addEdge({ kind: "governed_by", from: rec.id, to: policy.id });
  }

  // ── desktop_handoff node (one canonical node, eligibility from coverage) ─
  const desktopRow = coverage.rows.find((r) => r.id === "desktop.handoff_inbox");
  if (desktopRow) {
    const desktop = b.addNode({
      id: "desktop.handoff_inbox",
      type: "desktop_handoff",
      title: desktopRow.title,
      status: desktopRow.status === "live" ? "ready" : desktopRow.status === "blocked" ? "blocked" : "preview",
      risk: "low",
      provider: "desktop",
      sourceModule: desktopRow.sourceModules.join(", "),
      evidence: [{ label: desktopRow.id, ref: desktopRow.id }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: desktopRow.status === "live" ? 0.95 : 0.6,
      sourceMode: coverageToSourceMode(desktopRow.status),
      tenantId,
      detail: desktopRow.userExplanation,
    });
    // Each recommendation is "ready_for" desktop review when policy permits.
    for (const recId of b.nodeIds("recommendation")) {
      b.addEdge({ kind: "ready_for", from: recId, to: desktop.id, reason: "Plans can be exported to desktop for local review." });
    }
  }

  // ── next_action nodes (1-3 highest-leverage) ────────────────────────
  for (let i = 0; i < Math.min(3, planning.candidates.length); i++) {
    const cand = planning.candidates[i];
    const na = b.addNode({
      id: `next.${i}`,
      type: "next_action",
      title: cand.title,
      status: "ready",
      risk: i === 0 ? "medium" : "low",
      sourceModule: "lib/agent/autonomousPlanningLoop.ts",
      evidence: [{ label: "candidate", ref: cand.id }, { label: "href", ref: cand.safeAction.href ?? "" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confidence: 0.85,
      sourceMode: "live",
      tenantId,
      detail: cand.rationale,
    });
    b.addEdge({ kind: "triggers", from: na.id, to: `rec.${cand.id}` });
  }

  // ── audit_event node (umbrella for this build) ──────────────────────
  const audit = b.addNode({
    id: "audit.graph_build",
    type: "audit_event",
    title: "Execution graph build",
    status: "completed",
    risk: "informational",
    sourceModule: "lib/agent/executionGraphBuilder.ts",
    evidence: [
      { label: "tenant",      ref: tenantId ?? "anonymous" },
      { label: "nodes_total", ref: `${b.nodeIds("observation").length + b.nodeIds("validation_result").length + b.nodeIds("recommendation").length}` },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    confidence: 1.0,
    sourceMode: "live",
    tenantId,
  });
  b.addEdge({ kind: "produced_by", from: audit.id, to: observation.id });

  return b.build();
}

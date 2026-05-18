/**
 * Closed-Loop Remediation builder.
 *
 * Composes the canonical ClosedLoopReport. Until the autonomy loop
 * actually executes (which requires paired desktop runtime + policy
 * + boundary all green), the records are derived from the autonomy
 * cycle transcripts and end at the "approved" or "executed" phase
 * with verification probes in "pending" / "preview" state.
 *
 * When a paired desktop runtime emits an execution-complete event
 * and a telemetry source emits an after-state metric breach
 * resolution, the same record advances to verified_success /
 * verified_failure automatically — no schema change required.
 *
 * Hard literal contract — TS prevents drift.
 */

import "server-only";

import { runAutonomousLoopCycle } from "@/lib/autonomy/autonomousLoopRunner";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  ClosedLoopPhase,
  ClosedLoopRecord,
  ClosedLoopReport,
  ClosedLoopSourceMode,
  VerificationOutcome,
  VerificationProbe,
} from "./closedLoopModel";

export interface BuildClosedLoopInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildClosedLoop(input: BuildClosedLoopInput): Promise<ClosedLoopReport> {
  const [state, autonomyCycle] = await Promise.all([
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    runAutonomousLoopCycle({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // Translate each autonomy candidate into a closed-loop record.
  const records: ClosedLoopRecord[] = autonomyCycle.candidates.map((c, idx) => {
    const reachedExecute = c.stages.find((s) => s.stage === "execute")?.status === "passed";
    const reachedApprove = c.stages.find((s) => s.stage === "approve")?.status === "passed";
    const reachedSimulate = c.stages.find((s) => s.stage === "simulate")?.status === "passed";
    const reachedPolicy = c.stages.find((s) => s.stage === "policy_gate")?.status === "passed";

    const phase: ClosedLoopPhase =
      c.outcome === "errored" ? "errored" :
      reachedExecute ? "verifying" :
      reachedApprove ? "approved" :
      reachedPolicy ? "policy_decided" :
      reachedSimulate ? "simulated" :
      "input_captured";

    // Build canonical verification probes — currently all pending/preview
    // until telemetry connectors flip live.
    const probes: VerificationProbe[] = [
      {
        id: `${c.id}:probe:telemetry`,
        kind: "telemetry_metric",
        description: "Independent telemetry metric reverts to baseline after execution.",
        outcome: "pending",
        evidenceRef: "telemetry:after_state",
        sourceMode: "preview",
      },
      {
        id: `${c.id}:probe:incident`,
        kind: "incident_pager_closed",
        description: "Originating pager is auto-resolved by the incident provider.",
        outcome: "pending",
        evidenceRef: "incident:after_state",
        sourceMode: "preview",
      },
      {
        id: `${c.id}:probe:operating_loop`,
        kind: "operating_loop_pass",
        description: "Next operating-loop pass shows the priority demoted or removed.",
        outcome: "pending",
        evidenceRef: "operating_loop:next_cycle",
        sourceMode: "partial_live",
      },
    ];

    return {
      id: `closedloop:${c.id}`,
      inputSource: "priority",
      inputId: c.linkedPriorityId ?? c.id,
      title: c.title,
      intentSummary: c.proposedIntent,
      phase,
      sourceMode: reachedExecute ? "partial_live" : "preview",
      startedAt: state.generatedAt,
      finishedAt: c.outcome === "verified_complete" ? state.generatedAt : undefined,
      linkedPriorityId: c.linkedPriorityId,
      linkedApprovalPacketId: c.linkedApprovalPacketId,
      linkedAutonomyCandidateId: c.id,
      probes,
      verificationOutcome: probes.every((p) => p.outcome === "success") ? "success" :
                           probes.some((p) => p.outcome === "failure") ? "failure" :
                           probes.every((p) => p.outcome === "preview" || p.outcome === "skipped") ? "preview" :
                           "pending",
      auditEventIds: [`audit:autonomy:${c.id}:cycle`],
      limitations: [
        "Verification probes are typed and ready. Live telemetry / incident outcome wiring lands once those connectors flip from preview.",
      ],
      safeNextAction: { label: "Open Autonomy Cockpit", href: "/dashboard/autonomy" },
    };
  });

  // Summary rollup
  const byPhase: Record<ClosedLoopPhase, number> = {
    input_captured: 0, simulated: 0, policy_decided: 0, approved: 0,
    executed: 0, verifying: 0, verified_success: 0, verified_failure: 0,
    rolled_back: 0, audited: 0, errored: 0,
  };
  for (const r of records) byPhase[r.phase]++;

  let totalMs = 0; let durationCount = 0;
  for (const r of records) {
    if (r.durationMs) { totalMs += r.durationMs; durationCount++; }
  }

  const overallSourceMode: ClosedLoopSourceMode = records.every((r) => r.sourceMode === "live")
    ? "live"
    : records.some((r) => r.sourceMode === "partial_live")
      ? "partial_live"
      : "preview";

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    records,
    summary: {
      total: records.length,
      byPhase,
      verifiedSuccess: records.filter((r) => r.verificationOutcome === "success").length,
      verifiedFailure: records.filter((r) => r.verificationOutcome === "failure").length,
      pendingVerification: records.filter((r) => r.verificationOutcome === "pending").length,
      rolledBack: records.filter((r) => r.phase === "rolled_back").length,
      averageDurationMs: durationCount > 0 ? Math.round(totalMs / durationCount) : undefined,
    },
    overallSourceMode,
    safetyContract: "closed_loop_remediation_gated",
    limitations: [
      "Closed-loop is the typed bridge between every adjacent system. Verification probes are pending until telemetry + incident connectors flip live.",
      "Verification is always independent telemetry — the same agent that proposed the change never marks it verified.",
    ],
    safeNextAction: { label: "Open AGI Cockpit", href: "/dashboard/agi" },
  };
}

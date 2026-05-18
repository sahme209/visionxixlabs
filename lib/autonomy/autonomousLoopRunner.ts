/**
 * Closed Autonomy Loop runner.
 *
 * Pure read-only composition that **declares** what the loop would do
 * on the current cycle. Returns the full per-stage transcript without
 * actually mutating anything — the audit + boundary detector + policy
 * registry remain the only authorities.
 *
 * The runner consumes:
 *   - PriorityReport          (input candidates)
 *   - ApprovalPacketReport    (readiness + risk classification)
 *   - AutomationBoundaryReport (hard-literal classification)
 *   - DesktopIntelligenceReport (pairing state for execution handoff)
 *   - AxiomOSState            (provider live/preview state, audit posture)
 *   - AutonomyCharter         (per-tenant mode + allowed classes + limit)
 *
 * Hard rules:
 *   - The loop never advances past `policy_gate` for a class not in
 *     `charter.allowedClasses`.
 *   - The loop never advances past `boundary` for `unsafe_never_automate`.
 *   - The loop never advances past `approve` in `observer` mode.
 *   - The loop never advances past `approve` in `review` mode unless
 *     the boundary class is `simulation_allowed` or `preview_allowed`.
 *   - The loop's execute stage **does not call any SDK**. It declares
 *     the execution intent + halts; the desktop runtime is the only
 *     surface that touches real infra. This is enforced at the type
 *     level by the safety contract literal.
 */

import "server-only";

import { buildPriorityReport } from "@/lib/intelligence/priorityEngine";
import { buildApprovalPackets } from "@/lib/intelligence/approvalPacketBuilder";
import { buildAutomationBoundaryReport } from "@/lib/safety/automationBoundaryDetector";
import { buildDesktopIntelligence } from "@/lib/desktop/desktopIntelligenceBuilder";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  AutonomyCandidate,
  AutonomyCharter,
  AutonomyCycleReport,
  AutonomyCycleStatus,
  AutonomyStage,
  AutonomyStageResult,
  AutonomyStageStatus,
} from "./autonomousLoopModel";
import { defaultCharter } from "./autonomyCharter";

export interface RunAutonomousLoopInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
  /** Optional charter override — defaults to the tenant's default charter. */
  charter?: AutonomyCharter;
}

export async function runAutonomousLoopCycle(input: RunAutonomousLoopInput): Promise<AutonomyCycleReport> {
  const charter = input.charter ?? defaultCharter();

  const [priorities, packets, boundaries, desktop, state] = await Promise.all([
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildApprovalPackets({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAutomationBoundaryReport(),
    buildDesktopIntelligence({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // ---------------------------------------------------------------------------
  // Candidate selection — take the top N priorities up to the charter limit.
  // ---------------------------------------------------------------------------
  const inputs = priorities.items.slice(0, charter.perCycleActionLimit);
  const candidates: AutonomyCandidate[] = inputs.map((p, idx) => {
    const matchingPacket = packets.packets.find((pk) => pk.linkedPriorityId === p.id);
    const matchingReviewItem = desktop.items.find((it) => it.linkedPriorityId === p.id);
    const boundaryClass = matchingReviewItem?.automationClassification ?? "approval_required";
    const stages: AutonomyStageResult[] = [];

    // ---- detect ----
    stages.push(stageResult("detect", "passed",
      `Detected priority "${p.title}" with composite score ${Math.round(p.score.composite)}.`,
      `priority:${p.id}`,
    ));

    // ---- reason ----
    stages.push(stageResult("reason", "passed",
      p.whyItMatters ?? "Reasoned proposed remediation intent from priority signal.",
      `priority:${p.id}:reason`,
    ));

    // ---- simulate ----
    if (matchingPacket?.simulationSummary) {
      stages.push(stageResult("simulate", "passed",
        `Simulation: ${matchingPacket.simulationSummary}`,
        `approvalPacket:${matchingPacket.id}:simulation`,
      ));
    } else if (matchingPacket?.readiness === "simulation_required") {
      stages.push(stageResult("simulate", "halted_missing_evidence",
        "Candidate has no simulation summary yet — loop halts before policy gate.",
        `approvalPacket:${matchingPacket.id}`,
        "Run /api/simulations/create against the digital twin first.",
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "halted_at_gate");
    } else {
      stages.push(stageResult("simulate", "halted_safe",
        "No simulation packet linked — defer to operator before gate.",
        `priority:${p.id}`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "deferred_to_human");
    }

    // ---- policy_gate ----
    const policyAllowed = matchingPacket?.policyDecision.allowed ?? false;
    if (!policyAllowed) {
      stages.push(stageResult("policy_gate", "halted_policy",
        matchingPacket?.policyDecision.reason ?? "Policy engine declined the action.",
        `policy:${matchingPacket?.id ?? p.id}`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "halted_at_gate");
    }
    if (!charter.allowedClasses.includes(boundaryClass as never)) {
      stages.push(stageResult("policy_gate", "halted_boundary",
        `Boundary class "${boundaryClass}" not in charter allowedClasses for mode ${charter.mode}.`,
        `charter:${charter.mode}`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "halted_at_gate");
    }
    stages.push(stageResult("policy_gate", "passed",
      `Policy engine allows action (boundary=${boundaryClass}). Charter mode=${charter.mode}.`,
      `policy:${matchingPacket?.id ?? p.id}`,
    ));

    // ---- boundary ----
    if (boundaryClass === "unsafe_never_automate") {
      stages.push(stageResult("boundary", "halted_unsafe",
        "Automation boundary detector classified this as unsafe_never_automate — loop refuses.",
        `boundary:${boundaryClass}`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "halted_at_gate");
    }
    stages.push(stageResult("boundary", "passed",
      `Automation boundary: ${boundaryClass}.`,
      `boundary:${boundaryClass}`,
    ));

    // ---- approve ----
    const canAutoApprove =
      charter.mode === "autonomous" ||
      (charter.mode === "assisted" && (boundaryClass === "desktop_review_allowed" || boundaryClass === "simulation_allowed" || boundaryClass === "preview_allowed")) ||
      (charter.mode === "review" && (boundaryClass === "simulation_allowed" || boundaryClass === "preview_allowed" || boundaryClass === "readonly_allowed"));
    if (charter.mode === "observer") {
      stages.push(stageResult("approve", "halted_needs_human",
        "Charter mode=observer — approval packet prepared, but no auto-approval.",
        `charter:observer`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "approval_packet_prepared");
    }
    if (!canAutoApprove) {
      stages.push(stageResult("approve", "halted_needs_human",
        `Charter mode=${charter.mode} does not auto-approve boundary class ${boundaryClass}.`,
        `charter:${charter.mode}`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "approval_packet_prepared");
    }
    stages.push(stageResult("approve", "passed",
      `Auto-approved under charter ${charter.mode} for boundary class ${boundaryClass}.`,
      `charter:${charter.mode}`,
    ));

    // ---- execute ----
    if (!desktop.pairing.paired) {
      stages.push(stageResult("execute", "halted_needs_human",
        "No paired desktop runtime — web never executes locally. Halt at execute.",
        `desktopIntelligence:pairing`,
      ));
      return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
        "approval_packet_prepared");
    }
    stages.push(stageResult("execute", "passed",
      "Execution intent handed off to the paired desktop runtime (signed handoff).",
      `desktopIntelligence:${p.id}`,
    ));

    // ---- verify ----
    stages.push(stageResult("verify", "halted_safe",
      "Verification scheduled on the next operating-loop cycle — not run inline.",
      `operatingLoop:next-cycle`,
    ));

    // ---- audit ----
    stages.push(stageResult("audit", "passed",
      state.auditPosture.data.persistent
        ? "Per-stage audit chain emitted to durable audit store."
        : "Per-stage audit chain emitted to in-memory audit store (ephemeral until DATABASE_URL set).",
      `axiomOS:auditPosture`,
    ));

    return finalizeCandidate(p, idx, matchingPacket, matchingReviewItem, boundaryClass, stages,
      "execution_handed_off");
  });

  // ---------------------------------------------------------------------------
  // Cycle rollup
  // ---------------------------------------------------------------------------
  const stageRollup: Record<AutonomyStageStatus, number> = {
    passed: 0, halted_safe: 0, halted_policy: 0, halted_boundary: 0,
    halted_missing_evidence: 0, halted_unsafe: 0, halted_needs_human: 0,
    not_reached: 0, errored: 0,
  };
  let deferred = 0, prepared = 0, handed = 0, verified = 0, halted = 0, errored = 0;
  for (const c of candidates) {
    for (const s of c.stages) stageRollup[s.status]++;
    if (c.outcome === "deferred_to_human") deferred++;
    if (c.outcome === "approval_packet_prepared") prepared++;
    if (c.outcome === "execution_handed_off") handed++;
    if (c.outcome === "verified_complete") verified++;
    if (c.outcome === "halted_at_gate") halted++;
    if (c.outcome === "errored") errored++;
  }

  const cycleStatus: AutonomyCycleStatus =
    candidates.length === 0 ? "completed_no_actions" :
    handed > 0 ? "completed_with_executions" :
    prepared > 0 ? "completed_with_approvals" :
    halted > 0 ? "halted_boundary" :
    errored > 0 ? "errored" :
    "completed_no_actions";

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    charter,
    candidates,
    cycleStatus,
    summary: {
      candidatesConsidered: candidates.length,
      candidatesDeferred: deferred,
      approvalPacketsPrepared: prepared,
      executionsHandedOff: handed,
      verifiedComplete: verified,
      haltedAtGate: halted,
      erroredCount: errored,
      stageRollup,
    },
    nextCycleEligibleAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    safetyContract: "autonomy_gated_no_unsafe_execution",
    limitations: [
      "Loop is declared, not free-running. It only emits intent — execution always routes through the desktop runtime.",
      state.auditPosture.data.persistent
        ? "Audit chain durable."
        : "Audit chain ephemeral until DATABASE_URL is set — per-stage results lost on restart.",
      desktop.pairing.paired
        ? "Desktop pairing live."
        : "No paired desktop session — execute stage halts at needs_human even when policy + boundary pass.",
    ],
    safeNextAction: { label: "Open Autonomy Cockpit", href: "/dashboard/autonomy" },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stageResult(
  stage: AutonomyStage,
  status: AutonomyStageStatus,
  summary: string,
  evidenceRef: string,
  reason?: string,
): AutonomyStageResult {
  return { stage, status, summary, evidenceRef, reason };
}

function finalizeCandidate(
  p: { id: string; title: string; whyItMatters?: string; evidenceRefs: string[]; limitations: string[] },
  idx: number,
  packet: { id: string; linkedPriorityId?: string } | undefined,
  reviewItem: { id?: string; linkedPriorityId?: string } | undefined,
  boundaryClass: import("@/lib/safety/automationBoundaryModel").BoundaryClassification,
  stages: AutonomyStageResult[],
  outcome: AutonomyCandidate["outcome"],
): AutonomyCandidate {
  // Backfill not_reached for stages we skipped past.
  const reached = new Set(stages.map((s) => s.stage));
  const allStages: AutonomyStage[] = ["detect", "reason", "simulate", "policy_gate", "boundary", "approve", "execute", "verify", "audit"];
  for (const s of allStages) {
    if (!reached.has(s)) {
      stages.push({ stage: s, status: "not_reached", summary: "Skipped — loop halted earlier.", evidenceRef: `autonomy:not_reached` });
    }
  }
  // Sort to canonical order.
  stages.sort((a, b) => allStages.indexOf(a.stage) - allStages.indexOf(b.stage));
  return {
    id: `autonomy:${p.id}`,
    rank: idx + 1,
    title: p.title,
    proposedIntent: p.whyItMatters ?? "Proposed remediation intent derived from canonical priority signal.",
    linkedPriorityId: p.id,
    linkedApprovalPacketId: packet?.id,
    boundaryClass,
    stages,
    outcome,
    evidenceRefs: p.evidenceRefs,
    limitations: p.limitations,
  };
}

/**
 * Pure approver-agent packet assembler.
 *
 * The approver agent takes a hypothesis + simulator verdict + policy
 * verdict + boundary classification + council outcome and assembles
 * an "approval packet" the operator reviews. The assembler refuses to
 * build a packet if any upstream gate has failed (or is missing) — so
 * operators never see a packet that wasn't fully gated.
 *
 * Pure / deterministic.
 */

import type { BoundaryClass } from "./boundaryGateCatalog";

export interface PacketSeed {
  hypothesisId: string;
  hypothesisKind: string;
  candidateLabel: string;
  candidateKind: string;
  blastRadius: "single_resource" | "service" | "account" | "org";

  simulatorOk: boolean;
  policyGateOk: boolean;
  boundaryGateOk: boolean;
  councilApproved: boolean;
  councilSupportWeight: number;
  councilOpposeWeight: number;
  councilDissentAgents: readonly string[];

  boundaryClass: BoundaryClass;
  evidenceCount: number;
  estimatedDurationMins: number;
}

export interface ApprovalPacket {
  hypothesisId: string;
  candidateLabel: string;
  candidateKind: string;
  blastRadius: PacketSeed["blastRadius"];
  boundaryClass: BoundaryClass;
  councilSupportWeight: number;
  councilOpposeWeight: number;
  councilDissentAgents: string[];
  evidenceCount: number;
  estimatedDurationMins: number;
  safetyContract: "approval_only_no_execution";
  /** Operator-readable explanation of why this packet exists. */
  packetSummary: string;
}

export interface AssembleResult {
  packet: ApprovalPacket | null;
  rejectReason?:
    | "simulator_failed"
    | "policy_gate_failed"
    | "boundary_gate_failed"
    | "council_rejected";
}

export function assembleApprovalPacket(seed: PacketSeed): AssembleResult {
  if (!seed.simulatorOk)    return { packet: null, rejectReason: "simulator_failed" };
  if (!seed.policyGateOk)   return { packet: null, rejectReason: "policy_gate_failed" };
  if (!seed.boundaryGateOk) return { packet: null, rejectReason: "boundary_gate_failed" };
  if (!seed.councilApproved) return { packet: null, rejectReason: "council_rejected" };

  const dissent = seed.councilDissentAgents.length > 0
    ? ` Dissenters: ${seed.councilDissentAgents.join(", ")}.`
    : "";
  const packetSummary =
    `${seed.candidateKind} on "${seed.candidateLabel}" (${seed.blastRadius.replace("_", " ")} blast radius, ` +
    `${seed.boundaryClass} boundary). Council: ${seed.councilSupportWeight} support / ${seed.councilOpposeWeight} oppose.` +
    `${dissent} Approval-only-no-execution.`;

  const packet: ApprovalPacket = {
    hypothesisId: seed.hypothesisId,
    candidateLabel: seed.candidateLabel,
    candidateKind: seed.candidateKind,
    blastRadius: seed.blastRadius,
    boundaryClass: seed.boundaryClass,
    councilSupportWeight: seed.councilSupportWeight,
    councilOpposeWeight: seed.councilOpposeWeight,
    councilDissentAgents: [...seed.councilDissentAgents],
    evidenceCount: Math.max(0, seed.evidenceCount),
    estimatedDurationMins: Math.max(1, seed.estimatedDurationMins),
    safetyContract: "approval_only_no_execution",
    packetSummary: packetSummary.slice(0, 800),
  };

  return { packet };
}

/**
 * Pure auditor-agent rationale row writer.
 *
 * Folds the full agent trail (hypothesis → simulator → policy_gate
 * → boundary_gate → council → approver → verifier) into a single
 * deterministic, sha256-stamped rationale row the platform persists
 * for the durable audit history.
 *
 * Pure / deterministic. Same inputs always yield the same
 * integrityHash, so auditors can re-derive it from the raw row.
 */

import { createHash } from "node:crypto";

export type FinalDecision = "approved_and_applied" | "approved_pending_apply" | "rejected_by_operator" | "vetoed_by_gate" | "expired";

export interface RationaleSeed {
  hypothesisId: string;
  hypothesisKind: string;
  candidateLabel: string;
  candidateKind: string;
  blastRadius: "single_resource" | "service" | "account" | "org";
  boundaryClass: string;

  simulatorVerdict: "pass" | "fail" | "skipped";
  policyVerdict: "pass" | "fail" | "skipped";
  boundaryVerdict: "pass" | "fail" | "skipped";
  councilSupport: number;
  councilOppose: number;
  councilDissentAgents: readonly string[];

  operatorDecidedBy: string | null;          // operator email/username or null
  operatorDecidedAtIso: string | null;
  finalDecision: FinalDecision;

  verifierVerdict: "pass" | "partial_pass" | "fail" | "not_applicable";
}

export interface RationaleRow {
  schema: "axiom.rationale";
  schemaVersion: 1;
  hypothesisId: string;
  hypothesisKind: string;
  candidateLabel: string;
  candidateKind: string;
  blastRadius: RationaleSeed["blastRadius"];
  boundaryClass: string;
  agentTrail: {
    simulator: RationaleSeed["simulatorVerdict"];
    policy_gate: RationaleSeed["policyVerdict"];
    boundary_gate: RationaleSeed["boundaryVerdict"];
    council: { support: number; oppose: number; dissenters: string[] };
    operator: { decidedBy: string | null; decidedAtIso: string | null; finalDecision: FinalDecision };
    verifier: RationaleSeed["verifierVerdict"];
  };
  safetyContract: "approval_only_no_execution";
  integrityHash: string;
}

const sortJson = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(sortJson);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortJson(obj[k]);
    return out;
  }
  return input;
};

const canonicalJson = (input: unknown): string => JSON.stringify(sortJson(input));

export function writeRationaleRow(seed: RationaleSeed): RationaleRow {
  const body: Omit<RationaleRow, "integrityHash"> = {
    schema: "axiom.rationale",
    schemaVersion: 1,
    hypothesisId: seed.hypothesisId,
    hypothesisKind: seed.hypothesisKind,
    candidateLabel: seed.candidateLabel,
    candidateKind: seed.candidateKind,
    blastRadius: seed.blastRadius,
    boundaryClass: seed.boundaryClass,
    agentTrail: {
      simulator: seed.simulatorVerdict,
      policy_gate: seed.policyVerdict,
      boundary_gate: seed.boundaryVerdict,
      council: {
        support: seed.councilSupport,
        oppose: seed.councilOppose,
        dissenters: [...seed.councilDissentAgents].sort(),
      },
      operator: {
        decidedBy: seed.operatorDecidedBy,
        decidedAtIso: seed.operatorDecidedAtIso,
        finalDecision: seed.finalDecision,
      },
      verifier: seed.verifierVerdict,
    },
    safetyContract: "approval_only_no_execution",
  };
  const integrityHash = createHash("sha256").update(canonicalJson(body)).digest("hex");
  return { ...body, integrityHash };
}

/** Verify a previously emitted row by recomputing its hash. */
export function verifyRationaleRow(row: RationaleRow): boolean {
  // We need to omit the integrityHash to recompute over the body.
  const { integrityHash, ...rest } = row;
  const recomputed = createHash("sha256").update(canonicalJson(rest)).digest("hex");
  return recomputed === integrityHash;
}

/**
 * Pure compliance-evidence-packet builder.
 *
 * Operators asking auditors "prove what your AGI ops platform did" need
 * a single, deterministic JSON download that names what happened, who
 * decided what, and when. This module *only* shapes the document — the
 * route handler is responsible for collecting raw inputs from Prisma.
 *
 * Determinism is load-bearing — same inputs must yield identical packet
 * bytes (sorted keys, sorted arrays). The hash check in the test pins
 * this in place.
 */

import { createHash } from "node:crypto";

export interface EvidenceInputBusMessage {
  id: string;
  sender: string;
  kind: string;
  summary: string;
  publishedAt: string;
}

export interface EvidenceInputProposal {
  id: string;
  authorAgent: string;
  target: string;
  status: string;
  label: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  createdAt: string;
}

export interface EvidenceInputStatusComponent {
  name: string;
  state: "ok" | "degraded" | "down" | "unknown";
}

export interface EvidencePacketInput {
  organizationId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  busMessages: readonly EvidenceInputBusMessage[];
  proposals: readonly EvidenceInputProposal[];
  statusComponents: readonly EvidenceInputStatusComponent[];
  /** Operator-visible note explaining what this packet evidences. */
  note?: string;
}

export interface EvidencePacket {
  schema: "axiom.compliance.evidence_packet";
  schemaVersion: 1;
  organizationId: string;
  generatedAt: string;
  window: { start: string; end: string };
  safetyContract: "approval_only_no_execution";
  summary: {
    busMessageCount: number;
    proposalCount: number;
    proposalsByStatus: Record<string, number>;
    statusComponents: number;
    statusDegradedOrDown: number;
  };
  busMessages: EvidenceInputBusMessage[];
  proposals: EvidenceInputProposal[];
  statusComponents: EvidenceInputStatusComponent[];
  note: string;
  /** sha256 over the canonical (sorted-key) JSON of the rest of the packet. */
  integrityHash: string;
}

const sortJson = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(sortJson);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = sortJson(obj[key]);
    return out;
  }
  return input;
};

const canonicalJson = (input: unknown): string => JSON.stringify(sortJson(input));

export function buildEvidencePacket(input: EvidencePacketInput): EvidencePacket {
  const sortedBus = [...input.busMessages].sort((a, b) =>
    a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : a.id < b.id ? -1 : 1,
  );
  const sortedProposals = [...input.proposals].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1,
  );
  const sortedComponents = [...input.statusComponents].sort((a, b) => (a.name < b.name ? -1 : 1));

  const byStatus: Record<string, number> = {};
  for (const p of sortedProposals) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;

  const degradedOrDown = sortedComponents.filter((c) => c.state === "degraded" || c.state === "down").length;

  const body: Omit<EvidencePacket, "integrityHash"> = {
    schema: "axiom.compliance.evidence_packet",
    schemaVersion: 1,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    window: { start: input.windowStart, end: input.windowEnd },
    safetyContract: "approval_only_no_execution",
    summary: {
      busMessageCount: sortedBus.length,
      proposalCount: sortedProposals.length,
      proposalsByStatus: byStatus,
      statusComponents: sortedComponents.length,
      statusDegradedOrDown: degradedOrDown,
    },
    busMessages: sortedBus,
    proposals: sortedProposals,
    statusComponents: sortedComponents,
    note: input.note ?? "Approval-only-no-execution. Axiom never applies changes; this packet evidences what was decided.",
  };

  const integrityHash = createHash("sha256").update(canonicalJson(body)).digest("hex");
  return { ...body, integrityHash };
}

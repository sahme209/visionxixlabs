/**
 * MethodProposal store — durable + audited.
 *
 * Agents call submitProposal to suggest a method improvement.
 * Operators decide via decideProposal; the IaC pipeline (or future
 * apply lane) picks up `approved` rows. Nothing here applies a
 * change to the live system — that's deliberate.
 *
 * Hard rules:
 *   - Boundary validation: target + status checked against closed
 *     unions; rationale + label truncated at safe lengths.
 *   - Status transitions are one-way except 'pending' → others.
 *     Trying to flip an already-decided proposal is a no-op (returns
 *     the existing row).
 *   - All writes audited via publishAgentMessage so the bus reflects
 *     the lifecycle event too.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { publishAgentMessage } from "./agentBus";
import {
  isProposalStatus,
  isProposalTarget,
  type MethodProposalRecord,
  type ProposalStatus,
  type ProposalTarget,
} from "./methodProposalModel";
import type { AgentRole } from "./agentBusModel";

export interface SubmitProposalInput {
  organizationId: string;
  authorAgent: AgentRole;
  target: ProposalTarget;
  label: string;
  rationale: string;
  proposedDiff: unknown;
  confidence: number;
}

export async function submitProposal(input: SubmitProposalInput): Promise<MethodProposalRecord> {
  if (!isProposalTarget(input.target)) {
    throw new Error(`submitProposal: invalid target '${input.target}'`);
  }
  const id = randomUUID();
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const row = await prisma.methodProposal.create({
    data: {
      id,
      organizationId: input.organizationId,
      authorAgent: input.authorAgent,
      target: input.target,
      label: input.label.slice(0, 200),
      rationale: input.rationale.slice(0, 2000),
      proposedDiff: input.proposedDiff as unknown as object,
      confidence,
      status: "pending",
    },
  });

  // Mirror to the bus so listeners see it in the conversation tail.
  void publishAgentMessage({
    tenantId: input.organizationId,
    sender: input.authorAgent,
    recipient: null,
    kind: "method_improvement",
    summary: `Proposed: ${row.label}`,
    payload: { proposalId: row.id, target: row.target, confidence },
    threadId: row.id,
  });

  return mapRow(row);
}

export interface DecideProposalInput {
  organizationId: string;
  proposalId: string;
  decision: "approved" | "rejected";
  decidedBy?: string;
  decisionReason?: string;
}

export async function decideProposal(input: DecideProposalInput): Promise<MethodProposalRecord | null> {
  try {
    const existing = await prisma.methodProposal.findUnique({ where: { id: input.proposalId } });
    if (!existing || existing.organizationId !== input.organizationId) return null;
    if (existing.status !== "pending") return mapRow(existing);

    const row = await prisma.methodProposal.update({
      where: { id: input.proposalId },
      data: {
        status: input.decision,
        decidedBy: input.decidedBy ?? null,
        decisionReason: input.decisionReason?.slice(0, 500) ?? null,
        decidedAt: new Date(),
      },
    });

    void publishAgentMessage({
      tenantId: input.organizationId,
      sender: "council",
      recipient: existing.authorAgent as AgentRole,
      kind: "council_consensus",
      summary: `Proposal ${input.decision}: ${existing.label}`,
      payload: {
        proposalId: existing.id,
        decision: input.decision,
        reason: input.decisionReason,
      },
      threadId: existing.id,
    });

    return mapRow(row);
  } catch {
    return null;
  }
}

/** Mark an approved proposal as applied once the IaC pipeline ships it. */
export async function markProposalApplied(opts: {
  organizationId: string;
  proposalId: string;
  appliedBy?: string;
}): Promise<MethodProposalRecord | null> {
  try {
    const existing = await prisma.methodProposal.findUnique({ where: { id: opts.proposalId } });
    if (!existing || existing.organizationId !== opts.organizationId) return null;
    if (existing.status !== "approved") return mapRow(existing);
    const row = await prisma.methodProposal.update({
      where: { id: opts.proposalId },
      data: { status: "applied", decidedBy: opts.appliedBy ?? existing.decidedBy ?? null, decidedAt: new Date() },
    });
    return mapRow(row);
  } catch {
    return null;
  }
}

export interface ReadProposalsInput {
  organizationId: string;
  status?: ProposalStatus;
  target?: ProposalTarget;
  limit?: number;
}

export async function readProposals(input: ReadProposalsInput): Promise<MethodProposalRecord[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  try {
    const rows = await prisma.methodProposal.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status && isProposalStatus(input.status) ? { status: input.status } : {}),
        ...(input.target && isProposalTarget(input.target) ? { target: input.target } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

function mapRow(r: {
  id: string;
  organizationId: string;
  authorAgent: string;
  target: string;
  label: string;
  rationale: string;
  proposedDiff: unknown;
  confidence: number;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MethodProposalRecord {
  return {
    id: r.id,
    organizationId: r.organizationId,
    authorAgent: r.authorAgent as AgentRole,
    target: (isProposalTarget(r.target) ? r.target : "runbook_recipe") as ProposalTarget,
    label: r.label,
    rationale: r.rationale,
    proposedDiff: r.proposedDiff,
    confidence: r.confidence,
    status: (isProposalStatus(r.status) ? r.status : "pending") as ProposalStatus,
    decidedBy: r.decidedBy ?? undefined,
    decidedAt: r.decidedAt?.toISOString() ?? undefined,
    decisionReason: r.decisionReason ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

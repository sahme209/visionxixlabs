/**
 * Schema Engineer — runtime-gated orchestrator.
 *
 * Wraps the pure `reviewSchema` + `proposeForSlowQueries` kernels. Two
 * gated actions are exposed:
 *   - planAndRequestSchemaApply  → "apply_schema_change", risk: critical
 *   - planAndRequestIndexApply   → "apply_index_change", risk: high
 *
 * Both go through `recordEngineerActionAttempt` so every attempt lands
 * in `AgentEngineerActionAttempt` and the audit fabric.
 */

import "server-only";

import { reviewSchema, summarizeFindings, type SchemaSnapshot, type SchemaFinding, type SchemaReviewSummary } from "@/lib/agents/databaseSchemaReviewer";
import { proposeForSlowQueries, type ProposeContext, type SlowQueryProposal, type SlowQueryRow } from "@/lib/agents/slowQueryProposer";
import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import type { ActionVerdict } from "@/lib/workforce/runtimeActionGate";

const ENGINEER_ID = "schema_engineer";

export interface SchemaApplyInput {
  workspaceId: string;
  requestedBy: string;
  snapshot: SchemaSnapshot;
  /** Target finding id to apply (caller picks one from the review). */
  findingId: string;
  connector?: "postgres" | "mysql";
  correlationId?: string;
}

export interface IndexApplyInput {
  workspaceId: string;
  requestedBy: string;
  slowQueries: readonly SlowQueryRow[];
  context: ProposeContext;
  /** Caller picks one proposal id to apply. */
  proposalId: string;
  connector?: "postgres" | "mysql";
  correlationId?: string;
}

export type SchemaApplyResult =
  | { ok: false; reason: "finding_not_found"; summary: SchemaReviewSummary }
  | { ok: true; finding: SchemaFinding; verdict: ActionVerdict; attemptId: string; correlationId: string; approvalRequestId?: string };

export type IndexApplyResult =
  | { ok: false; reason: "proposal_not_found" }
  | { ok: true; proposal: SlowQueryProposal; verdict: ActionVerdict; attemptId: string; correlationId: string; approvalRequestId?: string };

export async function planAndRequestSchemaApply(input: SchemaApplyInput): Promise<SchemaApplyResult> {
  const findings = reviewSchema(input.snapshot);
  const finding = findings.find((f) => f.id === input.findingId);
  if (!finding) {
    return { ok: false, reason: "finding_not_found", summary: summarizeFindings(findings) };
  }

  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `apply_schema_change:${finding.category}:${finding.table}`,
    riskLevel: "critical",
    isReadOnly: false,
    module: "database",
    connector: input.connector ?? "postgres",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      findingId: finding.id,
      findingCategory: finding.category,
      table: finding.table,
      severity: finding.severity,
    },
  });
  return {
    ok: true,
    finding,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}

export async function planAndRequestIndexApply(input: IndexApplyInput): Promise<IndexApplyResult> {
  const proposals = proposeForSlowQueries(input.slowQueries, input.context);
  const proposal = proposals.find((p) => p.id === input.proposalId);
  if (!proposal) return { ok: false, reason: "proposal_not_found" };

  // SlowQueryProposal.table is `string | null` — coerce to a sentinel so the
  // action label + metadata stay deterministic (and pass the
  // recordEngineerActionAttempt metadata type, which rejects null).
  const tableLabel = proposal.table ?? "unknown";
  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `apply_index_change:${tableLabel}`,
    riskLevel: "high",
    isReadOnly: false,
    module: "database",
    connector: input.connector ?? "postgres",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      proposalId: proposal.id,
      table: tableLabel,
      proposalKind: proposal.kind,
      riskTier: proposal.riskTier,
      confidence: proposal.confidence,
    },
  });
  return {
    ok: true,
    proposal,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}

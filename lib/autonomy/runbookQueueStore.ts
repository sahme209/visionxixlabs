/**
 * Staged-runbook queue store.
 *
 * Operators stage runbooks from /dashboard/runbooks into this queue,
 * then approve or reject. Approval here NEVER triggers a mutation —
 * it records the human decision so the IaC pipeline (or a future
 * apply lane) can pick it up.
 *
 * Backed by Prisma's StagedRemediationRunbook table.
 *
 * Hard rules:
 *   - Read-only effect surface — staging + decisions are pure audit.
 *   - decision ∈ "approve" | "reject" only.
 *   - status ∈ "staged" | "approved" | "rejected" | "expired".
 *   - "expired" is set lazily during reads when stagedAt > 7 days.
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type { RemediationRunbook } from "./remediationRunbookGenerator";

export type StagedStatus = "staged" | "approved" | "rejected" | "expired";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface StagedRunbookRow {
  id: string;
  runbookId: string;
  sourceEventId: string;
  eventName: string;
  severity: string;
  rootCause: string;
  affectedResource: string;
  reversalLabel: string;
  reversalRisk: string;
  reversalApi?: string | null;
  hardeningLabel: string;
  hardeningApi?: string | null;
  confidence: number;
  evidenceRefs: string[];
  status: StagedStatus;
  decision?: string | null;
  stagedBy?: string | null;
  stagedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
}

export interface StagedQueueReport {
  totalStaged: number;
  totalApproved: number;
  totalRejected: number;
  totalExpired: number;
  rows: StagedRunbookRow[];
}

export async function stageRunbook(opts: {
  organizationId: string;
  runbook: RemediationRunbook;
  stagedBy?: string;
}): Promise<StagedRunbookRow> {
  const rb = opts.runbook;
  const row = await prisma.stagedRemediationRunbook.create({
    data: {
      id: randomUUID(),
      organizationId: opts.organizationId,
      runbookId: rb.id,
      sourceEventId: rb.sourceEventId,
      eventName: rb.eventName,
      severity: rb.severity,
      rootCause: rb.rootCauseHypothesis.slice(0, 1500),
      affectedResource: rb.affectedResource,
      reversalLabel: rb.reversal.label,
      reversalRisk: rb.reversal.risk,
      reversalApi: rb.reversal.suggestedApi ?? null,
      hardeningLabel: rb.hardening.label,
      hardeningApi: rb.hardening.suggestedApi ?? null,
      confidence: rb.confidence,
      evidenceRefs: rb.evidenceRefs.slice(0, 20),
      status: "staged",
      stagedBy: opts.stagedBy ?? null,
    },
  });
  return mapRow(row);
}

export async function decideRunbook(opts: {
  organizationId: string;
  rowId: string;
  decision: "approve" | "reject";
  decidedBy?: string;
}): Promise<StagedRunbookRow | null> {
  try {
    const row = await prisma.stagedRemediationRunbook.update({
      where: { id: opts.rowId },
      data: {
        status: opts.decision === "approve" ? "approved" : "rejected",
        decision: opts.decision,
        decidedAt: new Date(),
        decidedBy: opts.decidedBy ?? null,
      },
    });
    if (row.organizationId !== opts.organizationId) return null; // tenant cross-talk guard
    return mapRow(row);
  } catch {
    return null;
  }
}

export async function readStagedQueue(opts: {
  organizationId: string;
  limit?: number;
}): Promise<StagedQueueReport> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 200));
  try {
    const rows = await prisma.stagedRemediationRunbook.findMany({
      where: { organizationId: opts.organizationId },
      orderBy: { stagedAt: "desc" },
      take: limit,
    });
    const now = Date.now();
    let totalStaged = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalExpired = 0;

    const mapped: StagedRunbookRow[] = rows.map((r) => {
      let status: StagedStatus = (r.status as StagedStatus);
      if (status === "staged" && now - r.stagedAt.getTime() > EXPIRY_MS) {
        status = "expired";
      }
      if (status === "staged") totalStaged++;
      else if (status === "approved") totalApproved++;
      else if (status === "rejected") totalRejected++;
      else if (status === "expired") totalExpired++;
      return { ...mapRow(r), status };
    });

    return { totalStaged, totalApproved, totalRejected, totalExpired, rows: mapped };
  } catch {
    return { totalStaged: 0, totalApproved: 0, totalRejected: 0, totalExpired: 0, rows: [] };
  }
}

function mapRow(r: {
  id: string;
  runbookId: string;
  sourceEventId: string;
  eventName: string;
  severity: string;
  rootCause: string;
  affectedResource: string;
  reversalLabel: string;
  reversalRisk: string;
  reversalApi: string | null;
  hardeningLabel: string;
  hardeningApi: string | null;
  confidence: number;
  evidenceRefs: string[];
  status: string;
  decision: string | null;
  stagedBy: string | null;
  stagedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
}): StagedRunbookRow {
  return {
    id: r.id,
    runbookId: r.runbookId,
    sourceEventId: r.sourceEventId,
    eventName: r.eventName,
    severity: r.severity,
    rootCause: r.rootCause,
    affectedResource: r.affectedResource,
    reversalLabel: r.reversalLabel,
    reversalRisk: r.reversalRisk,
    reversalApi: r.reversalApi,
    hardeningLabel: r.hardeningLabel,
    hardeningApi: r.hardeningApi,
    confidence: r.confidence,
    evidenceRefs: r.evidenceRefs,
    status: r.status as StagedStatus,
    decision: r.decision,
    stagedBy: r.stagedBy,
    stagedAt: r.stagedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedBy: r.decidedBy,
  };
}

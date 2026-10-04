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
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
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
  // Phase 114 — Slack/Teams stage notification so the chat thread has the
  // full lifecycle (stage → approve/reject). Fire-and-forget.
  void sendOutboundNotification({
    dedupeKey: `runbook-staged:${row.id}`,
    kind: "approval_packet_ready",
    severity: rb.severity === "critical" ? "critical" : rb.severity === "high" ? "high" : "medium",
    tenantId: opts.organizationId,
    headline: `Runbook staged for review: ${rb.eventName}`,
    body: `*Source:* ${rb.rootCauseHypothesis}\n\n*Reversal (${rb.reversal.risk}):* ${rb.reversal.label}\n*Hardening:* ${rb.hardening.label}\n*Confidence:* ${Math.round(rb.confidence * 100)}%\n\nStaged by ${opts.stagedBy ?? "unknown"}. Open the queue to approve or reject.`,
    safeNextAction: { label: "Open Runbook Queue", href: "/dashboard/runbooks/queue" },
    evidenceRefs: [`runbook:${rb.id}`, `cloudtrail:event:${rb.sourceEventId}`],
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
    // Tenant filter lives in the WHERE of the write itself (updateMany,
    // not update) — id alone is not a safe unique-scope key here, since
    // update() would write to any tenant's row and only the subsequent
    // check would reject the response, after the cross-tenant row was
    // already mutated.
    const result = await prisma.stagedRemediationRunbook.updateMany({
      where: { id: opts.rowId, organizationId: opts.organizationId },
      data: {
        status: opts.decision === "approve" ? "approved" : "rejected",
        decision: opts.decision,
        decidedAt: new Date(),
        decidedBy: opts.decidedBy ?? null,
      },
    });
    if (result.count === 0) return null;
    const row = await prisma.stagedRemediationRunbook.findUnique({ where: { id: opts.rowId } });
    if (!row) return null;
    const mapped = mapRow(row);
    // Fire-and-forget outbound notification — never block the API.
    void sendOutboundNotification({
      dedupeKey: `runbook-decision:${row.id}:${opts.decision}`,
      kind: "approval_packet_ready",
      severity: opts.decision === "approve" ? "high" : "medium",
      tenantId: opts.organizationId,
      headline: `Runbook ${opts.decision}d: ${row.eventName}`,
      body: `*Decision:* ${opts.decision}\n*Decided by:* ${opts.decidedBy ?? "—"}\n\n*Reversal:* ${row.reversalLabel}\n*Hardening:* ${row.hardeningLabel}\n*Confidence:* ${Math.round(row.confidence * 100)}%\n\nThe IaC pipeline picks up approved runbooks; Axiom records the human decision only.`,
      safeNextAction: { label: "Open Runbook Queue", href: "/dashboard/runbooks/queue" },
      evidenceRefs: [`runbook:${row.runbookId}`, `cloudtrail:event:${row.sourceEventId}`],
    });
    return mapped;
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

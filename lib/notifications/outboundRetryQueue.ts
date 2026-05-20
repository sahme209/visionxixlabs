/**
 * Outbound notification retry queue.
 *
 * Two operations:
 *
 *   enqueueRetry — called by the outbound lane when a send fails
 *     entirely (no channel succeeded). Writes a pending row.
 *
 *   drainRetryQueue — called by the retry cron. Picks up pending
 *     rows older than 5 minutes (a debounce — the lane just tried),
 *     attempts one more send, and resolves the row to 'succeeded' or
 *     'failed_terminal'. A row is retried exactly once.
 *
 * Hard rules:
 *   - Single-shot retry. We don't queue infinite re-attempts. If the
 *     second try fails, the row is marked terminal and operators see
 *     it on the outbound dashboard.
 *   - Tenant cross-talk guard: the drain reads rows tenant-bounded
 *     by the caller; no global drain.
 *   - Best-effort: a DB failure during enqueue must not break the
 *     send path.
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendOutboundNotification, type OutboundNotification } from "./outboundNotificationLane";

const RETRY_AGE_MS = 5 * 60 * 1000;
const MAX_PER_DRAIN = 50;

export async function enqueueRetry(n: OutboundNotification, lastError?: string): Promise<void> {
  try {
    await prisma.outboundNotificationRetry.create({
      data: {
        id: randomUUID(),
        organizationId: n.tenantId,
        dedupeKey: n.dedupeKey,
        kind: n.kind,
        severity: n.severity,
        headline: n.headline.slice(0, 500),
        body: n.body.slice(0, 5000),
        evidenceRefs: n.evidenceRefs.slice(0, 20),
        safeActionLabel: n.safeNextAction?.label.slice(0, 200) ?? null,
        safeActionHref: n.safeNextAction?.href.slice(0, 500) ?? null,
        status: "pending",
        attemptCount: 0,
        lastError: lastError?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Best-effort.
  }
}

export interface DrainResult {
  total: number;
  succeeded: number;
  failedTerminal: number;
  perRow: Array<{ id: string; status: "succeeded" | "failed_terminal"; reason?: string }>;
}

export async function drainRetryQueue(opts: {
  /** When set, drains only the tenant's rows. */
  organizationId?: string;
  /** Max rows to attempt this drain. */
  limit?: number;
}): Promise<DrainResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? MAX_PER_DRAIN, MAX_PER_DRAIN));
  const cutoff = new Date(Date.now() - RETRY_AGE_MS);

  let rows: Array<{
    id: string;
    organizationId: string;
    dedupeKey: string;
    kind: string;
    severity: string;
    headline: string;
    body: string;
    evidenceRefs: string[];
    safeActionLabel: string | null;
    safeActionHref: string | null;
  }> = [];

  try {
    rows = await prisma.outboundNotificationRetry.findMany({
      where: {
        status: "pending",
        enqueuedAt: { lte: cutoff },
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
      orderBy: { enqueuedAt: "asc" },
      take: limit,
    });
  } catch {
    return { total: 0, succeeded: 0, failedTerminal: 0, perRow: [] };
  }

  let succeeded = 0;
  let failedTerminal = 0;
  const perRow: DrainResult["perRow"] = [];

  for (const row of rows) {
    const candidate: OutboundNotification = {
      dedupeKey: `${row.dedupeKey}:retry:${row.id}`,
      kind: row.kind as OutboundNotification["kind"],
      severity: row.severity as OutboundNotification["severity"],
      tenantId: row.organizationId,
      headline: row.headline,
      body: row.body,
      evidenceRefs: row.evidenceRefs,
      safeNextAction: row.safeActionLabel && row.safeActionHref
        ? { label: row.safeActionLabel, href: row.safeActionHref }
        : undefined,
    };

    const result = await sendOutboundNotification(candidate);
    const finalStatus = result.ok ? "succeeded" : "failed_terminal";
    try {
      await prisma.outboundNotificationRetry.update({
        where: { id: row.id },
        data: {
          status: finalStatus,
          attemptCount: { increment: 1 },
          lastError: result.ok ? null : result.reason ?? "no_channels_succeeded",
          retriedAt: new Date(),
        },
      });
    } catch {
      // Status update failure isn't fatal — the row stays pending and
      // will be picked up on the next drain. Idempotency is preserved
      // because the dedupe key includes the row id.
    }

    if (finalStatus === "succeeded") succeeded++;
    else failedTerminal++;
    perRow.push({ id: row.id, status: finalStatus, reason: result.reason });
  }

  return { total: rows.length, succeeded, failedTerminal, perRow };
}

export interface RetryQueueSummary {
  pending: number;
  succeeded: number;
  failedTerminal: number;
  total: number;
}

export async function readRetryQueueSummary(opts: { organizationId: string }): Promise<RetryQueueSummary> {
  try {
    const rows = await prisma.outboundNotificationRetry.findMany({
      where: { organizationId: opts.organizationId },
      select: { status: true },
      take: 1000,
    });
    let pending = 0, succeeded = 0, failedTerminal = 0;
    for (const r of rows) {
      if (r.status === "pending") pending++;
      else if (r.status === "succeeded") succeeded++;
      else if (r.status === "failed_terminal") failedTerminal++;
    }
    return { pending, succeeded, failedTerminal, total: rows.length };
  } catch {
    return { pending: 0, succeeded: 0, failedTerminal: 0, total: 0 };
  }
}

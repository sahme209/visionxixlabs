/**
 * Outbound notification durability store.
 *
 * Persists every send (success / fail / dedupe / skip) into Postgres
 * via Prisma's OutboundNotificationRecord. Replaces the in-memory
 * dedupe map's "history" role — the dedupe map still owns the
 * fast-path duplicate check, but operators can audit weeks of sends
 * here without paying the in-memory cost.
 *
 * Hard rules:
 *   - Writes are best-effort. A DB failure must never break the
 *     outbound send path — the caller wraps this with `void`.
 *   - We persist the REDACTED body — secrets never reach the DB.
 *   - Schema lives in prisma/schema.prisma (OutboundNotificationRecord).
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { redactPayload } from "@/lib/api/redaction";
import type { OutboundNotification, OutboundSendResult } from "./outboundNotificationLane";

export type PersistedOutcome = "ok" | "deduped" | "failed" | "skipped";

export async function persistOutboundNotificationRecord(
  n: OutboundNotification,
  result: OutboundSendResult,
  outcome: PersistedOutcome,
): Promise<void> {
  try {
    const redacted = redactPayload(n);
    await prisma.outboundNotificationRecord.create({
      data: {
        id: randomUUID(),
        organizationId: n.tenantId,
        dedupeKey: n.dedupeKey,
        kind: n.kind,
        severity: n.severity,
        headline: redacted.headline.slice(0, 500),
        body: redacted.body.slice(0, 5000),
        outcome,
        channelsSucceeded: result.channelsSucceeded,
        channelsSkipped: result.channelsSkipped.map(
          (s) => `${s.channel}:${s.reason}`.slice(0, 200),
        ),
        evidenceRefs: n.evidenceRefs.slice(0, 20),
        correlationId: null,
      },
    });
  } catch {
    // Best-effort. Database is not the source of truth for delivery.
  }
}

export interface OutboundHistoryRow {
  id: string;
  dedupeKey: string;
  kind: string;
  severity: string;
  headline: string;
  outcome: string;
  channelsSucceeded: string[];
  channelsSkipped: string[];
  createdAt: string;
}

export interface OutboundHistoryReport {
  totalRows: number;
  rows: OutboundHistoryRow[];
  perOutcome: Record<string, number>;
  perSeverity: Record<string, number>;
}

export async function readOutboundNotificationHistory(opts: {
  organizationId: string;
  limit?: number;
}): Promise<OutboundHistoryReport> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  try {
    const rows = await prisma.outboundNotificationRecord.findMany({
      where: { organizationId: opts.organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        dedupeKey: true,
        kind: true,
        severity: true,
        headline: true,
        outcome: true,
        channelsSucceeded: true,
        channelsSkipped: true,
        createdAt: true,
      },
    });
    const perOutcome: Record<string, number> = {};
    const perSeverity: Record<string, number> = {};
    for (const r of rows) {
      perOutcome[r.outcome] = (perOutcome[r.outcome] ?? 0) + 1;
      perSeverity[r.severity] = (perSeverity[r.severity] ?? 0) + 1;
    }
    return {
      totalRows: rows.length,
      rows: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      perOutcome,
      perSeverity,
    };
  } catch {
    return { totalRows: 0, rows: [], perOutcome: {}, perSeverity: {} };
  }
}

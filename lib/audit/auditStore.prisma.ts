/**
 * Prisma-backed implementation of SecureAuditStore.
 *
 * Persists audit records into the SecureAuditRecord table. Brought to life
 * via the store factory at lib/platform/storeFactory.ts when DATABASE_URL
 * is set.
 *
 * The table is *additive* — once written, audit rows are never updated or
 * deleted by this adapter. Retention is a separate concern handled by the
 * audit export pipeline.
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { SecureAuditStore, AuditRecord, AuditAction, AuditOutcome } from "./secureAudit";
import { id } from "@/lib/domain/ids";
import type { OrganizationId, UserId, CorrelationId, AuditEventId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";

type AuditRow = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorKind: string;
  action: string;
  outcome: string;
  entityRef: string | null;
  correlationId: string;
  source: string;
  occurredAt: Date;
  detail: unknown;
  errorCode: string | null;
};

function fromRow(row: AuditRow): AuditRecord {
  return {
    id: row.id as AuditEventId,
    organizationId: row.organizationId as OrganizationId,
    actorUserId: row.actorUserId ? id.user(row.actorUserId) as UserId : undefined,
    actorKind: row.actorKind as AuditRecord["actorKind"],
    action: row.action as AuditAction,
    outcome: row.outcome as AuditOutcome,
    entityRef: row.entityRef ?? undefined,
    correlationId: row.correlationId as CorrelationId,
    source: row.source as DataSource,
    occurredAt: row.occurredAt.toISOString(),
    detail: (row.detail as AuditRecord["detail"]) ?? undefined,
    errorCode: row.errorCode ?? undefined,
  };
}

export const prismaAuditStore: SecureAuditStore = {
  async append(record) {
    // Prisma client model accessor (camelCased from SecureAuditRecord).
    await (prisma as unknown as { secureAuditRecord: { create: (args: unknown) => Promise<unknown> } }).secureAuditRecord.create({
      data: {
        id: record.id,
        organizationId: record.organizationId,
        actorUserId: record.actorUserId ?? null,
        actorKind: record.actorKind,
        action: record.action,
        outcome: record.outcome,
        entityRef: record.entityRef ?? null,
        correlationId: record.correlationId,
        source: record.source,
        occurredAt: new Date(record.occurredAt),
        detail: record.detail ?? null,
        errorCode: record.errorCode ?? null,
      },
    });
  },

  async query({ organizationId, action, sinceIso, limit }) {
    const where: Record<string, unknown> = { organizationId };
    if (action) where.action = action;
    if (sinceIso) where.occurredAt = { gte: new Date(sinceIso) };
    const take = Math.min(limit ?? 200, 1000);

    const rows = await (prisma as unknown as {
      secureAuditRecord: { findMany: (args: unknown) => Promise<AuditRow[]> };
    }).secureAuditRecord.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take,
    });
    return rows.map(fromRow);
  },
};

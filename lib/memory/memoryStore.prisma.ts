/**
 * Prisma-backed implementation of MemoryStore.
 *
 * Persists operational memory records into the OperationalMemoryRecord
 * table. Brought to life via the store factory at
 * lib/platform/storeFactory.ts when DATABASE_URL is set.
 */

import "server-only";

import { prisma } from "@/lib/db";
import type {
  MemoryStore,
  MemoryRecord,
  MemoryRecordKind,
  MemoryOutcome,
  MemoryImpact,
} from "./operationalMemory";
import type { CloudProvider } from "@/lib/connectors/interface";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

type MemoryRow = {
  id: string;
  organizationId: string;
  actorId: string;
  kind: string;
  provider: string | null;
  resources: unknown;
  summary: string;
  evidence: unknown;
  outcome: string;
  impact: unknown;
  links: unknown;
  nextAction: unknown;
  occurredAt: Date;
  recordedAt: Date;
};

function fromRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorId: row.actorId,
    kind: row.kind as MemoryRecordKind,
    provider: (row.provider ?? undefined) as CloudProvider | undefined,
    resources: (row.resources as ResourceRef[]) ?? [],
    summary: row.summary,
    evidence: (row.evidence as MemoryRecord["evidence"]) ?? [],
    outcome: row.outcome as MemoryOutcome,
    impact: (row.impact as MemoryImpact) ?? {},
    links: (row.links as MemoryRecord["links"]) ?? {},
    nextAction: (row.nextAction as MemoryRecord["nextAction"]) ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
  };
}

type PrismaMemoryModel = {
  create: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<MemoryRow[]>;
  count: (args: unknown) => Promise<number>;
};

function memoryModel(): PrismaMemoryModel {
  return (prisma as unknown as { operationalMemoryRecord: PrismaMemoryModel }).operationalMemoryRecord;
}

export const prismaMemoryStore: MemoryStore = {
  async insert(record) {
    await memoryModel().create({
      data: {
        id: record.id,
        organizationId: record.organizationId,
        actorId: record.actorId,
        kind: record.kind,
        provider: record.provider ?? null,
        resources: record.resources,
        summary: record.summary,
        evidence: record.evidence,
        outcome: record.outcome,
        impact: record.impact,
        links: record.links,
        nextAction: record.nextAction ?? null,
        occurredAt: new Date(record.occurredAt),
        recordedAt: new Date(record.recordedAt),
      },
    });
  },

  async query(opts) {
    const where: Record<string, unknown> = { organizationId: opts.organizationId };
    if (opts.kinds && opts.kinds.length > 0) where.kind = { in: opts.kinds };
    if (opts.provider) where.provider = opts.provider;
    if (opts.outcome) where.outcome = opts.outcome;
    if (opts.sinceISO) where.occurredAt = { gte: new Date(opts.sinceISO) };

    const take = Math.min(opts.limit ?? 200, 1000);
    const rows = await memoryModel().findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take,
    });
    let records = rows.map(fromRow);
    // Resource-id filter is best done in TS because resources is stored as JSON.
    if (opts.resourceIds && opts.resourceIds.length > 0) {
      const set = new Set(opts.resourceIds);
      records = records.filter((r) => r.resources.some((res) => set.has(res.id)));
    }
    return records;
  },

  async recurringForResource({ organizationId, resourceId, kind }) {
    // No SQL-level filter on JSON resources — fetch the kind+org slice and
    // count matches in TS. Bounded by recent rows.
    const rows = await memoryModel().findMany({
      where: { organizationId, kind },
      orderBy: { occurredAt: "desc" },
      take: 500,
    });
    return rows
      .map(fromRow)
      .filter((r) => r.resources.some((res) => res.id === resourceId)).length;
  },

  async confidenceTrend({ organizationId, resourceKind, days }) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await memoryModel().findMany({
      where: { organizationId, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    });
    const records = rows
      .map(fromRow)
      .filter((r) => r.resources.some((res) => res.id.includes(resourceKind)));
    if (records.length === 0) return 0;
    const sum = records.reduce((s, r) => s + (r.impact.confidenceDelta ?? 0), 0);
    return sum / records.length;
  },
};

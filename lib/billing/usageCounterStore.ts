/**
 * Per-tenant per-day usage counter store.
 *
 * Powers the tier-cap enforcer (Phase 145): the scheduler asks
 * "how many autonomy cycles ran for this tenant today?", increments
 * after each cycle, and the enforcer denies the next cycle once
 * the cap is hit.
 *
 * Hard rules:
 *   - dateKey = UTC YYYY-MM-DD so rollover is deterministic across
 *     deployment regions.
 *   - All writes are upserts on the composite PK — duplicate inserts
 *     become idempotent increments.
 *   - DB failure on read returns 0 so caps fail-open during outages
 *     (we'd rather over-allow than wedge the loop).
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { CapName } from "./tierCapEnforcer";

export function todayUtcKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function readUsageCount(opts: {
  organizationId: string;
  capName: CapName;
  dateKey?: string;
}): Promise<number> {
  const dateKey = opts.dateKey ?? todayUtcKey();
  try {
    const row = await prisma.tenantUsageCounter.findUnique({
      where: {
        organizationId_capName_dateKey: {
          organizationId: opts.organizationId,
          capName: opts.capName,
          dateKey,
        },
      },
    });
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementUsageCount(opts: {
  organizationId: string;
  capName: CapName;
  by?: number;
  dateKey?: string;
}): Promise<number> {
  const dateKey = opts.dateKey ?? todayUtcKey();
  const by = Math.max(1, opts.by ?? 1);
  try {
    const row = await prisma.tenantUsageCounter.upsert({
      where: {
        organizationId_capName_dateKey: {
          organizationId: opts.organizationId,
          capName: opts.capName,
          dateKey,
        },
      },
      update: { count: { increment: by } },
      create: {
        organizationId: opts.organizationId,
        capName: opts.capName,
        dateKey,
        count: by,
      },
    });
    return row.count;
  } catch {
    // Cap enforcement fails open on DB outage.
    return 0;
  }
}

export interface DailyUsageSnapshot {
  organizationId: string;
  dateKey: string;
  counts: Record<string, number>;
}

export async function readDailyUsage(opts: {
  organizationId: string;
  dateKey?: string;
}): Promise<DailyUsageSnapshot> {
  const dateKey = opts.dateKey ?? todayUtcKey();
  const counts: Record<string, number> = {};
  try {
    const rows = await prisma.tenantUsageCounter.findMany({
      where: { organizationId: opts.organizationId, dateKey },
    });
    for (const r of rows) counts[r.capName] = r.count;
  } catch {
    /* empty snapshot */
  }
  return { organizationId: opts.organizationId, dateKey, counts };
}

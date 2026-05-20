/**
 * Help-query analytics store.
 *
 * Records every /api/help/ask call so operators can see which
 * topics drive traffic and where the knowledge base is silently
 * failing (no_match verdicts cluster around real gaps).
 *
 * Hard rules:
 *   - Best-effort writes — DB failure must NEVER break the search
 *     hot path (callers wrap with `void`).
 *   - Reads are tenant-scoped + bounded by a hard limit.
 *   - The verbatim query is stored (already passed through length
 *     clamp at the route layer).
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export interface HelpQueryWrite {
  organizationId?: string;
  query: string;
  totalTokens: number;
  verdict: string;
  primaryEntryId?: string;
  topHitScore?: number;
}

export interface HelpQueryReadRow {
  id: string;
  query: string;
  totalTokens: number;
  verdict: string;
  primaryEntryId?: string | null;
  topHitScore?: number | null;
  createdAt: string;
}

export interface HelpQueryAnalytics {
  total: number;
  perVerdict: Record<string, number>;
  topQueries: { query: string; count: number }[];
  topNoMatchQueries: { query: string; count: number }[];
  recent: HelpQueryReadRow[];
}

const MAX_LIMIT = 500;
const TOP_N = 10;

export async function persistHelpQuery(opts: HelpQueryWrite): Promise<void> {
  try {
    await prisma.helpQueryRecord.create({
      data: {
        id: randomUUID(),
        organizationId: opts.organizationId ?? null,
        query: opts.query.slice(0, 500),
        totalTokens: opts.totalTokens,
        verdict: opts.verdict.slice(0, 32),
        primaryEntryId: opts.primaryEntryId ?? null,
        topHitScore: opts.topHitScore ?? null,
      },
    });
  } catch {
    // Best-effort: never break the search hot path.
  }
}

export async function readHelpQueryAnalytics(opts: {
  organizationId?: string;
  limit?: number;
}): Promise<HelpQueryAnalytics> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, MAX_LIMIT));
  try {
    const rows = await prisma.helpQueryRecord.findMany({
      where: opts.organizationId ? { organizationId: opts.organizationId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const perVerdict: Record<string, number> = {};
    const counter = new Map<string, number>();
    const noMatchCounter = new Map<string, number>();
    for (const r of rows) {
      perVerdict[r.verdict] = (perVerdict[r.verdict] ?? 0) + 1;
      const key = r.query.trim().toLowerCase();
      counter.set(key, (counter.get(key) ?? 0) + 1);
      if (r.verdict === "no_match") {
        noMatchCounter.set(key, (noMatchCounter.get(key) ?? 0) + 1);
      }
    }

    return {
      total: rows.length,
      perVerdict,
      topQueries: topN(counter),
      topNoMatchQueries: topN(noMatchCounter),
      recent: rows.slice(0, 50).map((r) => ({
        id: r.id,
        query: r.query,
        totalTokens: r.totalTokens,
        verdict: r.verdict,
        primaryEntryId: r.primaryEntryId,
        topHitScore: r.topHitScore,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return { total: 0, perVerdict: {}, topQueries: [], topNoMatchQueries: [], recent: [] };
  }
}

function topN(m: Map<string, number>): { query: string; count: number }[] {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([query, count]) => ({ query, count }));
}

/**
 * GET /api/cron/workforce-daily-digest — Phase 627 · daily.
 *
 * Once per day, walks active workspaces and rolls up the last 24h
 * of workforce signals into a per-workspace digest row. The digest
 * is the surface external consumers (Slack, email, exec dashboard)
 * subscribe to instead of polling individual engineer rows.
 *
 * Auth: CRON_SECRET bearer when set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildDailyDigest, persistDailyDigest } from "@/lib/workforce/domains/dailyDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const HARD_DEADLINE_MS = 110_000;
const ACTIVE_WINDOW_DAYS = 30;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let activeOrgRows: Array<{ organizationId: string }> = [];
  try {
    const grouped = await prisma.cloudAccount.groupBy({
      by: ["organizationId"],
      where: { connectedAt: { gte: since } },
      _count: { _all: true },
    });
    activeOrgRows = grouped as unknown as typeof activeOrgRows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, digested: 0, migrationPending: true });
    }
    throw err;
  }

  if (activeOrgRows.length === 0) {
    return NextResponse.json({ ok: true, digested: 0, workspaces: 0, digestedAt: new Date().toISOString() });
  }

  let digested = 0;
  let failed = 0;
  for (const org of activeOrgRows) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) break;
    try {
      const counts = await buildDailyDigest(org.organizationId);
      await persistDailyDigest(org.organizationId, counts);
      digested += 1;
    } catch (err) {
      console.warn("[workforce-daily-digest]", org.organizationId, "failed:", err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    workspaces: activeOrgRows.length,
    digested,
    failed,
    durationMs: Date.now() - startedAt,
    digestedAt: new Date().toISOString(),
  });
}

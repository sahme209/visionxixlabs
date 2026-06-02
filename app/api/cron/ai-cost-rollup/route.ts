/**
 * GET /api/cron/ai-cost-rollup — Phase 581 · hourly cron.
 *
 * Daily-cadence accumulator. Each tick:
 *
 *   1. Walks distinct organizationIds from the last 25 hours of
 *      AiCallLog (25 so we comfortably overlap the prior tick with
 *      no gap, and the rollup is idempotent — see step 3).
 *   2. For each workspace, samples the last 25h of calls and
 *      computes provider cost via the canonical rollupAiCallCost
 *      bridge (Phase 580).
 *   3. Upserts WorkspaceUsageSummary keyed (organizationId, YYYY-MM).
 *      The aiCostCents column accumulates additively — so we MUST
 *      avoid double-counting. We track lastRolledUpAt in a separate
 *      AutonomousTickLog-style record so each tick only adds the
 *      delta since the previous rollup.
 *
 * For now this hourly tick uses a simpler discipline: it REBUILDS
 * the month's aiCostCents from a 30-day window every hour. Idempotent,
 * eventually consistent, easy to reason about. When call volume grows
 * we'll switch to incremental deltas with a watermark — for now,
 * one full month walk per workspace per hour is cheap.
 *
 * Auth: CRON_SECRET bearer when set, matching every other watchdog.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rollupAiCallCost } from "@/lib/billing/aiCallCostAttribution";
import { loadAiBillingMargin, applyMargin } from "@/lib/billing/aiBillingMargin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;
const ACTIVE_WINDOW_HOURS = 25;
const MONTH_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const margin = loadAiBillingMargin();
  const recentCutoff = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000);
  const monthCutoff = new Date(Date.now() - MONTH_WINDOW_MS);

  // Distinct workspaces that touched AiCallLog in the active window.
  let activeRows: Array<{ organizationId: string | null; _count: { _all: number } }> = [];
  try {
    const grouped = await prisma.aiCallLog.groupBy({
      by: ["organizationId"],
      where: { startedAt: { gte: recentCutoff } },
      _count: { _all: true },
    });
    activeRows = grouped as unknown as typeof activeRows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, rolledUp: 0, migrationPending: true });
    }
    throw err;
  }

  const orgs = activeRows
    .map((r) => r.organizationId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  if (orgs.length === 0) {
    return NextResponse.json({ ok: true, rolledUp: 0, sweptAt: new Date().toISOString() });
  }

  const counts = { rolledUp: 0, errored: 0, skipped_deadline: 0 };
  const period = monthKey(new Date());

  for (const orgId of orgs) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      counts.skipped_deadline = orgs.length - (counts.rolledUp + counts.errored);
      break;
    }
    try {
      // Sample THE WHOLE MONTH'S calls for this workspace. Cap 5000
      // rows — far above realistic AGI volume but bounded so a
      // misconfigured tenant can't blow up the cron.
      const monthRows = await prisma.aiCallLog.findMany({
        where: { organizationId: orgId, startedAt: { gte: monthCutoff } },
        select: { model: true, promptTokens: true, completionTokens: true },
        take: 5000,
      });

      const cost = await rollupAiCallCost(monthRows);

      // Token totals for the workspace summary. Use BigInt() ctor
      // instead of `0n` literal — the project's tsconfig target is
      // below ES2020 and rejects bigint literal syntax at compile
      // time.
      let inputTokens = BigInt(0);
      let outputTokens = BigInt(0);
      for (const r of monthRows) {
        inputTokens += BigInt(r.promptTokens ?? 0);
        outputTokens += BigInt(r.completionTokens ?? 0);
      }

      const billedCents = applyMargin(cost.totalCents, margin);

      await prisma.workspaceUsageSummary.upsert({
        where: { organizationId_periodMonth: { organizationId: orgId, periodMonth: period } },
        create: {
          organizationId: orgId,
          periodMonth: period,
          totalCostCents: billedCents,
          aiCostCents: cost.totalCents,
          aiInvocationCount: cost.attributedCallCount,
          aiInputTokens: inputTokens,
          aiOutputTokens: outputTokens,
          lastRebuiltAt: new Date(),
        },
        update: {
          totalCostCents: billedCents,
          aiCostCents: cost.totalCents,
          aiInvocationCount: cost.attributedCallCount,
          aiInputTokens: inputTokens,
          aiOutputTokens: outputTokens,
          lastRebuiltAt: new Date(),
        },
      });
      counts.rolledUp += 1;
    } catch (err) {
      console.warn("[ai-cost-rollup]", orgId, "failed:", err instanceof Error ? err.message : err);
      counts.errored += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    period,
    margin,
    activeWorkspaces: orgs.length,
    durationMs: Date.now() - startedAt,
    result: counts,
    sweptAt: new Date().toISOString(),
  });
}

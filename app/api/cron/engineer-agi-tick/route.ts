/**
 * GET /api/cron/engineer-agi-tick — Phase 562 · every 30 minutes.
 *
 * Keeps every workforce's specialty rationales fresh without
 * requiring an operator to click 'Run AGI for all'. Each tick:
 *
 *   1. Walks the active workspaces — distinct organizationId values
 *      across CloudAccount, the canonical "this tenant has set up
 *      something" signal we don't fabricate.
 *
 *   2. For each workspace, picks the 5 engineers with the oldest /
 *      missing engineer_specialty rationale. Missing rows sort first
 *      (no updatedAt), then by updatedAt ascending. Operators with a
 *      brand-new workspace get the full workforce populated over
 *      successive ticks.
 *
 *   3. Runs the canonical Phase 557 flow + persists, deadline-bounded
 *      so a single workspace can't starve the others.
 *
 * The instrumented fetcher absorbs provider failures via the circuit
 * breaker — a sick tenant or sick engine never breaks the sweep.
 *
 * Auth: CRON_SECRET bearer when set, matching every other watchdog.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { runEngineerAgi, persistEngineerAgiResult } from "@/lib/workforce/engineerAgi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;
const PER_WORKSPACE_BUDGET = 5;
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

  // Active workspaces: those with a CloudAccount row connected in
  // the last 30 days. Avoids hammering long-dormant orgs.
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
      return NextResponse.json({ ok: true, ran: 0, migrationPending: true });
    }
    throw err;
  }

  if (activeOrgRows.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, workspaces: 0, sweptAt: new Date().toISOString() });
  }

  const clientEngineerIds = new Set(
    AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client").map((e) => e.id),
  );
  const engineerLookup = new Map(AGENT_WORKFORCE_REGISTRY.map((e) => [e.id, e]));

  const perWorkspace: Record<string, { picked: number; ai_generated: number; fallback_rules: number; error: number }> = {};
  let totalRan = 0;

  outer: for (const org of activeOrgRows) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) break;
    const orgId = org.organizationId;

    // Existing rationales for this workspace's engineer_specialty rows.
    const existing = await prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: orgId,
        targetKind: "engineer_specialty",
      },
      select: { targetId: true, updatedAt: true },
    }).catch(() => [] as Array<{ targetId: string; updatedAt: Date }>);
    const updatedAtById = new Map(existing.map((e) => [e.targetId, e.updatedAt]));

    // Sort engineers: missing rationale first, then oldest first.
    const sortedEngineers = Array.from(clientEngineerIds)
      .map((id) => engineerLookup.get(id))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((e) => ({ engineer: e, updatedAt: updatedAtById.get(e.id) ?? null }))
      .sort((a, b) => {
        if (a.updatedAt === null && b.updatedAt === null) return 0;
        if (a.updatedAt === null) return -1;
        if (b.updatedAt === null) return 1;
        return a.updatedAt.getTime() - b.updatedAt.getTime();
      })
      .slice(0, PER_WORKSPACE_BUDGET);

    const stats = { picked: sortedEngineers.length, ai_generated: 0, fallback_rules: 0, error: 0 };
    for (const { engineer } of sortedEngineers) {
      if (Date.now() - startedAt > HARD_DEADLINE_MS) {
        perWorkspace[orgId] = stats;
        break outer;
      }
      try {
        const result = await runEngineerAgi(engineer, orgId);
        await persistEngineerAgiResult(engineer, orgId, result);
        stats[result.outcome] += 1;
        totalRan += 1;
      } catch (err) {
        console.warn("[engineer-agi-tick]", orgId, engineer.id, "failed:", err instanceof Error ? err.message : err);
        stats.error += 1;
      }
    }
    perWorkspace[orgId] = stats;
  }

  return NextResponse.json({
    ok: true,
    workspaces: activeOrgRows.length,
    perWorkspaceBudget: PER_WORKSPACE_BUDGET,
    totalRan,
    durationMs: Date.now() - startedAt,
    perWorkspace,
    sweptAt: new Date().toISOString(),
  });
}

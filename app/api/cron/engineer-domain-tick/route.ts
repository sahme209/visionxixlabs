/**
 * GET /api/cron/engineer-domain-tick — Phase 611 · hourly sweep.
 *
 * Activates the no-input domain engineers across all active
 * workspaces without requiring an operator to click "Run" per
 * engineer. Each tick:
 *
 *   1. Walks active workspaces (distinct organizationId across
 *      CloudAccount in last 30 days).
 *
 *   2. For each workspace, picks the K domain engineers whose
 *      AiRationaleEnrichment report row is oldest or missing.
 *      Missing rows sort first, then by updatedAt ascending.
 *
 *   3. Sorts picks by sweepPriority so chains run in the right
 *      order within a tick:
 *        per-domain engineers (10) → meta_reasoner (20) →
 *        council (21) → improvement (22) → memory_consolidator (25)
 *
 *   4. Calls each runner's runAndPersist() — deadline-bounded so a
 *      sick engineer can't starve the sweep.
 *
 * Operator-input engineers (requiresInput: true) are skipped — they
 * can't fire without form payload.
 *
 * Auth: CRON_SECRET bearer when set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ENGINEER_DOMAIN_IMPLEMENTATIONS } from "@/lib/workforce/domains";
import { DOMAIN_RUNNERS, type DomainRunner, type DomainOutcome } from "@/lib/workforce/domains/runners";
import { persistTickSummary } from "@/lib/workforce/domains/tickLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;
const PER_WORKSPACE_BUDGET = 4;
const ACTIVE_WINDOW_DAYS = 30;

type Stats = { picked: number; ai_generated: number; fallback_rules: number; error: number };

interface SweepableRunner {
  runner: DomainRunner;
  reportTargetKind: string;
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
      return NextResponse.json({ ok: true, ran: 0, migrationPending: true });
    }
    throw err;
  }

  if (activeOrgRows.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, workspaces: 0, sweptAt: new Date().toISOString() });
  }

  // Resolve sweepable runners once. Skip operator-input engineers and
  // runners without a registry entry.
  const sweepable: SweepableRunner[] = [];
  for (const runner of DOMAIN_RUNNERS) {
    const reg = ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === runner.engineerId);
    if (!reg || reg.requiresInput) continue;
    sweepable.push({ runner, reportTargetKind: reg.reportTargetKind });
  }
  const sweepableKinds = sweepable.map((s) => s.reportTargetKind);

  if (sweepable.length === 0) {
    return NextResponse.json({
      ok: true,
      ran: 0,
      workspaces: activeOrgRows.length,
      reason: "no_sweepable_runners",
      sweptAt: new Date().toISOString(),
    });
  }

  const perWorkspace: Record<string, Stats> = {};
  let totalRan = 0;

  outer: for (const org of activeOrgRows) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) break;
    const orgId = org.organizationId;

    const existing = await prisma.aiRationaleEnrichment.findMany({
      where: { organizationId: orgId, targetKind: { in: sweepableKinds } },
      select: { targetKind: true, updatedAt: true },
    }).catch(() => [] as Array<{ targetKind: string; updatedAt: Date }>);
    const updatedAtByKind = new Map(existing.map((e) => [e.targetKind, e.updatedAt]));

    // Phase 618: respect workspace-level engineer opt-outs. An
    // engineer with AgentEngineerRecord.isEnabled = false is skipped
    // entirely by the sweep — operators can quiet a noisy engineer
    // without losing the rest of the workforce.
    const disabledSet = new Set<string>();
    try {
      const disabledRows = await prisma.agentEngineerRecord.findMany({
        where: { organizationId: orgId, isEnabled: false },
        select: { engineerId: true },
      });
      for (const r of disabledRows) disabledSet.add(r.engineerId);
    } catch {
      // migration-pending or transient — fall through with empty set.
    }

    // Phase 626: honor per-engineer cadence floors. An engineer
    // whose persisted row is younger than its minIntervalMinutes
    // floor is skipped this tick — composition engineers (meta,
    // council, etc.) don't need to fire hourly when they summarize
    // engineers that update less often.
    const nowMs = Date.now();

    // Pick K oldest-or-missing among engineers that aren't disabled
    // AND are past their cadence floor, then re-sort the picks by
    // sweepPriority so chains land in the right order this tick.
    const ranked = sweepable
      .filter((s) => !disabledSet.has(s.runner.engineerId))
      .filter((s) => {
        const updatedAt = updatedAtByKind.get(s.reportTargetKind);
        if (!updatedAt) return true; // never run → always eligible.
        const ageMs = nowMs - updatedAt.getTime();
        const floorMs = s.runner.minIntervalMinutes * 60_000;
        return ageMs >= floorMs;
      })
      .map((s) => ({ ...s, updatedAt: updatedAtByKind.get(s.reportTargetKind) ?? null }))
      .sort((a, b) => {
        if (a.updatedAt === null && b.updatedAt === null) return 0;
        if (a.updatedAt === null) return -1;
        if (b.updatedAt === null) return 1;
        return a.updatedAt.getTime() - b.updatedAt.getTime();
      })
      .slice(0, PER_WORKSPACE_BUDGET)
      .sort((a, b) => a.runner.sweepPriority - b.runner.sweepPriority);

    const stats: Stats = { picked: ranked.length, ai_generated: 0, fallback_rules: 0, error: 0 };
    const wsStartMs = Date.now();
    const ranEngineerIds: string[] = [];
    for (const { runner } of ranked) {
      if (Date.now() - startedAt > HARD_DEADLINE_MS) {
        perWorkspace[orgId] = stats;
        break outer;
      }
      try {
        const result = await runner.runAndPersist(orgId);
        const bucket: DomainOutcome = result.outcome;
        stats[bucket] += 1;
        ranEngineerIds.push(runner.engineerId);
        totalRan += 1;
      } catch (err) {
        console.warn(
          "[engineer-domain-tick]",
          orgId,
          runner.engineerId,
          "failed:",
          err instanceof Error ? err.message : err,
        );
        stats.error += 1;
      }
    }
    perWorkspace[orgId] = stats;
    // Phase 622: persist the per-workspace tick summary so the
    // sweep-health badge + future degraded-state alerts have a real
    // source of truth, not just freshness inference.
    await persistTickSummary(orgId, {
      trigger: "cron",
      picked: stats.picked,
      skippedDisabled: disabledSet.size,
      aiGenerated: stats.ai_generated,
      fallbackRules: stats.fallback_rules,
      error: stats.error,
      durationMs: Date.now() - wsStartMs,
      engineerIds: ranEngineerIds,
    });
  }

  return NextResponse.json({
    ok: true,
    workspaces: activeOrgRows.length,
    sweepableRunners: sweepable.length,
    perWorkspaceBudget: PER_WORKSPACE_BUDGET,
    totalRan,
    durationMs: Date.now() - startedAt,
    perWorkspace,
    sweptAt: new Date().toISOString(),
  });
}

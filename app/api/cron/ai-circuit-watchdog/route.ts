/**
 * GET /api/cron/ai-circuit-watchdog — Phase 538 · every 15 minutes.
 *
 * Resumes the Phase 521-537 AGI Cockpit / AI Call Log arc by adding
 * proactive notification: when an AI engine's circuit breaker trips
 * open (or settles into half_open), operators get a Slack/Teams ping
 * — they no longer have to refresh /dashboard/ai-call-log to notice.
 *
 * Each tick:
 *   1. Picks the distinct engines that emitted at least one call in
 *      the last 60 minutes (only "active" engines — a long-dormant
 *      engine with stale failures shouldn't keep alerting).
 *   2. For each, computes circuit state via the canonical
 *      lookupCircuitState helper.
 *   3. Fires one outbound notification per (engine, day, state) when
 *      state ∈ {open, half_open}. Dedupe key naturally suppresses
 *      repeat fires inside the same UTC day.
 *
 * Notifications are platform-scoped (tenantId === "platform") because
 * the AI provider call is platform-wide infrastructure — failures
 * affect every tenant equally.
 *
 * Auth: CRON_SECRET bearer when set, matching every other watchdog.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { lookupCircuitState, type AiCallLogRepo } from "@/lib/releaseops/aiCallLogResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1h

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

  // Distinct engines with recent activity. We groupBy because a raw
  // findMany would return up to all rows in window just to dedupe.
  // Prisma's strict groupBy return type fights any upfront `let:
  // Array<...>` annotation, so we infer the type from the call and
  // shape-coerce inline.
  let activeRows: Array<{ engineName: string; _count: { _all: number } }> = [];
  try {
    const grouped = await prisma.aiCallLog.groupBy({
      by: ["engineName"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    });
    activeRows = grouped as unknown as typeof activeRows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, alerted: 0, migrationPending: true });
    }
    throw err;
  }

  if (activeRows.length === 0) {
    return NextResponse.json({ ok: true, alerted: 0, activeEngines: 0, sweptAt: new Date().toISOString() });
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const repo = prisma as unknown as AiCallLogRepo;
  let alerted = 0;
  const states: Record<string, string> = {};
  for (const row of activeRows) {
    let state: "closed" | "open" | "half_open" = "closed";
    try {
      state = await lookupCircuitState(repo, row.engineName, now);
    } catch (err) {
      console.warn("[ai-circuit-watchdog] lookup failed:", row.engineName, err instanceof Error ? err.message : err);
      continue;
    }
    states[row.engineName] = state;
    if (state === "closed") continue;

    try {
      await sendOutboundNotification({
        dedupeKey: `ai_circuit:${row.engineName}:${day}:${state}`,
        kind: "critical_telemetry_signal",
        severity: state === "open" ? "critical" : "high",
        headline: `AI engine circuit ${state} · ${row.engineName}`,
        body: [
          `Circuit breaker on engine "${row.engineName}" is currently ${state}.`,
          `Recent activity: ${row._count._all} call${row._count._all === 1 ? "" : "s"} in the last hour.`,
          ``,
          state === "open"
            ? `The breaker tripped because the recent window crossed the failure threshold. Calls to this engine are short-circuiting until the cooldown elapses.`
            : `The breaker is in half-open recovery — one probe call is allowed through to test provider health.`,
          ``,
          `Inspect the per-engine surface for latency percentiles and top-error breakdown.`,
        ].join("\n"),
        tenantId: "platform",
        safeNextAction: {
          label: "Inspect engine",
          href: `/dashboard/ai-call-log/${encodeURIComponent(row.engineName)}`,
        },
        evidenceRefs: [`ai_engine:${row.engineName}`, `circuit_state:${state}`],
      });
      alerted++;
    } catch (err) {
      console.warn("[ai-circuit-watchdog] send failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    activeEngines: activeRows.length,
    states,
    alerted,
    sweptAt: now.toISOString(),
  });
}

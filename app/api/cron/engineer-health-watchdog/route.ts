/**
 * GET /api/cron/engineer-health-watchdog — hourly cron.
 *
 * Surfaces silently-degrading engineers. Walks the last 24 hours of
 * AgentEngineerActionAttempt grouped by engineerId + runtimeDecision,
 * flags engineers with:
 *   · at least MIN_ATTEMPTS samples (so a single bad attempt doesn't
 *     wake the operator at 3am), AND
 *   · a block rate above BLOCK_RATE_THRESHOLD
 *
 * One outbound notification per offending (engineerId, dayBucket) so
 * the hourly tick alerts at most once per UTC day per engineer.
 *
 * Auth: CRON_SECRET bearer when set (matches the other watchdogs).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_ATTEMPTS = 5;
const BLOCK_RATE_THRESHOLD = 0.5;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  let rows: Array<{
    organizationId: string;
    engineerId: string;
    runtimeDecision: string;
    _count: { _all: number };
  }> = [];
  try {
    rows = await prisma.agentEngineerActionAttempt.groupBy({
      by: ["organizationId", "engineerId", "runtimeDecision"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, alerted: 0, migrationPending: true });
    }
    throw err;
  }

  type Bucket = { total: number; blocked: number };
  const byTenantEngineer = new Map<string, Bucket>();
  for (const r of rows) {
    const key = `${r.organizationId}:${r.engineerId}`;
    const b = byTenantEngineer.get(key) ?? { total: 0, blocked: 0 };
    b.total += r._count._all;
    if (r.runtimeDecision === "blocked") b.blocked += r._count._all;
    byTenantEngineer.set(key, b);
  }

  const engineerLookup = new Map(AGENT_WORKFORCE_REGISTRY.map((e) => [e.id, e]));
  const day = new Date().toISOString().slice(0, 10);
  let alerted = 0;
  let skippedBelowFloor = 0;
  let skippedHealthy = 0;
  for (const [key, b] of byTenantEngineer) {
    if (b.total < MIN_ATTEMPTS) { skippedBelowFloor++; continue; }
    const rate = b.blocked / b.total;
    if (rate <= BLOCK_RATE_THRESHOLD) { skippedHealthy++; continue; }

    const [orgId, engineerId] = key.split(":", 2);
    const engineer = engineerLookup.get(engineerId);
    const displayName = engineer?.displayName ?? engineerId;
    const ratePct = Math.round(rate * 100);
    try {
      await sendOutboundNotification({
        dedupeKey: `engineer_health:${orgId}:${engineerId}:${day}`,
        kind: "release_blocker",
        severity: rate > 0.8 ? "critical" : "high",
        headline: `${displayName} block rate · ${ratePct}% (24h)`,
        body: [
          `${b.blocked} of ${b.total} attempts blocked in the last 24h.`,
          ``,
          `Block-rate watchdog fires when an engineer crosses ${Math.round(BLOCK_RATE_THRESHOLD * 100)}% with at least ${MIN_ATTEMPTS} samples. Common causes: connector disconnect, policy tighten, tool-access matrix change.`,
          ``,
          `Open the detail page to inspect recent attempts and the top-actions breakdown for diagnosis.`,
        ].join("\n"),
        tenantId: orgId,
        safeNextAction: { label: "Inspect engineer", href: `/dashboard/workforce/${engineerId}` },
        evidenceRefs: [`engineer:${engineerId}`, `tenant:${orgId}`],
      });
      alerted++;
    } catch (err) {
      console.warn("[engineer-health-watchdog] send failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: byTenantEngineer.size,
    alerted,
    skippedBelowFloor,
    skippedHealthy,
    threshold: BLOCK_RATE_THRESHOLD,
    minAttempts: MIN_ATTEMPTS,
    sweptAt: new Date().toISOString(),
  });
}

/**
 * POST /api/workforce/sweep-now — Phase 614 · operator-triggered domain sweep.
 *
 * Mirrors the cron logic in engineer-domain-tick but scoped to the
 * caller's workspace only. Lets an operator force-refresh every
 * no-input domain engineer in one click without waiting for the
 * next hourly tick.
 *
 * Identical sweepPriority ordering as the cron so the manual click
 * produces the same chain effect (meta_reasoner before council, etc).
 *
 * Returns 303 → /dashboard/workforce so the operator lands back on
 * the workforce overview with fresh reports populated.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ENGINEER_DOMAIN_IMPLEMENTATIONS } from "@/lib/workforce/domains";
import { DOMAIN_RUNNERS } from "@/lib/workforce/domains/runners";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `sweep_now_${Date.now().toString(36)}` as CorrelationId;

  const startedAt = Date.now();

  // Phase 618: respect workspace-level engineer opt-outs. An engineer
  // with AgentEngineerRecord.isEnabled = false is skipped entirely.
  const disabledSet = new Set<string>();
  try {
    const rows = await prisma.agentEngineerRecord.findMany({
      where: { organizationId: org, isEnabled: false },
      select: { engineerId: true },
    });
    for (const r of rows) disabledSet.add(r.engineerId);
  } catch {
    // migration-pending — fall through with empty set, no skips.
  }

  const ranked = DOMAIN_RUNNERS
    .filter((runner) => {
      const reg = ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === runner.engineerId);
      return reg && !reg.requiresInput && !disabledSet.has(runner.engineerId);
    })
    .slice()
    .sort((a, b) => a.sweepPriority - b.sweepPriority);

  const stats = { picked: ranked.length, ai_generated: 0, fallback_rules: 0, error: 0 };
  for (const runner of ranked) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) break;
    try {
      const result = await runner.runAndPersist(org);
      stats[result.outcome] += 1;
    } catch (err) {
      console.warn("[sweep-now]", org, runner.engineerId, "failed:", err instanceof Error ? err.message : err);
      stats.error += 1;
    }
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: stats.error > 0 ? "partial_failure" : "success",
    entityRef: "workforce:sweep-now",
    correlationId,
    detail: {
      action: "workforce.sweep_now",
      picked: stats.picked,
      skippedDisabled: disabledSet.size,
      ai_generated: stats.ai_generated,
      fallback_rules: stats.fallback_rules,
      error: stats.error,
      durationMs: Date.now() - startedAt,
    },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce", req.url), 303);
}

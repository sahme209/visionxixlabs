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
import { persistTickSummary } from "@/lib/workforce/domains/tickLog";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
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

  // Phase 628: gate on workspace AI credit pool before a manual
  // sweep fires up to 14 AI calls sequentially. Estimated ~100¢
  // for a full sweep on Sonnet-class (conservative buffer).
  let creditDecision;
  try {
    creditDecision = await checkWorkspaceAICredits(org, 100, { failClosedOnUsageReadError: true });
  } catch (err) {
    // Fail closed, not crash: a transient usage-read failure must not
    // surface as an uncaught 500 — degrade to the same blocked response
    // the route already gives for an exhausted credit pool.
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "workforce:sweep-now",
      correlationId,
      detail: {
        action: "workforce.sweep_now",
        reason: "credit_meter_unavailable",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce?blocked=credits_exhausted", req.url),
      303,
    );
  }
  if (creditDecision.kind === "block") {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "workforce:sweep-now",
      correlationId,
      detail: {
        action: "workforce.sweep_now",
        reason: creditDecision.reason,
        threshold: creditDecision.threshold,
        remainingCents: creditDecision.remainingCents,
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce?blocked=credits_exhausted", req.url),
      303,
    );
  }

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

  // Manual sweep intentionally bypasses the per-engineer cadence
  // floor (Phase 626) — the operator explicitly clicked "now"
  // signaling they want fresh data regardless of the hourly cron's
  // composition-engineer throttle.
  const ranked = DOMAIN_RUNNERS
    .filter((runner) => {
      const reg = ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === runner.engineerId);
      return reg && !reg.requiresInput && !disabledSet.has(runner.engineerId);
    })
    .slice()
    .sort((a, b) => a.sweepPriority - b.sweepPriority);

  const stats = { picked: ranked.length, ai_generated: 0, fallback_rules: 0, error: 0 };
  const ranEngineerIds: string[] = [];
  for (const runner of ranked) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) break;
    try {
      const result = await runner.runAndPersist(org);
      stats[result.outcome] += 1;
      ranEngineerIds.push(runner.engineerId);
    } catch (err) {
      console.warn("[sweep-now]", org, runner.engineerId, "failed:", err instanceof Error ? err.message : err);
      stats.error += 1;
    }
  }

  // Phase 622: persist the tick summary so the sweep-health badge
  // and future history surfaces have the same source of truth as
  // the cron path.
  await persistTickSummary(org, {
    trigger: "manual",
    picked: stats.picked,
    skippedDisabled: disabledSet.size,
    aiGenerated: stats.ai_generated,
    fallbackRules: stats.fallback_rules,
    error: stats.error,
    durationMs: Date.now() - startedAt,
    engineerIds: ranEngineerIds,
  });

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: stats.error > 0 ? "failure" : "success",
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

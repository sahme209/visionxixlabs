/**
 * Live AI credit pre-flight — Phase 382.
 *
 * DB-backed wrapper around preflightAICreditCheck(). Sums MTD
 * UsageEvent.costCents directly (NOT from WorkspaceUsageSummary —
 * the summary is rebuilt nightly and could be up to 24h stale).
 *
 * Reads:
 *   - TenantBillingPlan → tier (via readBillingPlan)
 *   - UsageEvent _sum on costCents for (organizationId, current month)
 *
 * A usage-read failure remains fail-open for legacy workflow callers, but
 * general-purpose generation can opt into fail-closed metering. That keeps
 * a temporary database fault from silently producing unmetered AI calls.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { readBillingPlan } from "./tenantBillingStore";
import { planForStripeTier } from "./planRegistry";
import { preflightAICreditCheck, type PreflightDecision } from "./preflightAICreditCheck";
import { effectiveEntitlements } from "./effectiveEntitlements";

const periodStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export async function checkWorkspaceAICredits(
  organizationId: string,
  expectedAdditionalCostCents = 0,
  options?: { failClosedOnUsageReadError?: boolean },
): Promise<PreflightDecision> {
  let plan;
  try {
    const billing = await readBillingPlan(organizationId);
    plan = planForStripeTier(billing.tier);
  } catch {
    // Plan read failed — fall back to Starter (the safest, lowest-trust default).
    plan = planForStripeTier("starter");
  }

  let currentAICostCents = 0;
  try {
    const sum = await prisma.usageEvent.aggregate({
      where: {
        organizationId,
        eventKind: "ai_invocation",
        createdAt: { gte: periodStart(new Date()) },
      },
      _sum: { costCents: true },
    });
    currentAICostCents = sum._sum.costCents ?? 0;
  } catch {
    if (options?.failClosedOnUsageReadError) {
      throw new Error("ai_credit_meter_unavailable");
    }
    // Aggregate failed — treat as fresh month. Soft check; downstream
    // gates still enforce.
    currentAICostCents = 0;
  }

  // Phase 386 — fold paid AI-credit add-ons into the effective pool
  // before the gate runs. Permanent + current-month purchases both
  // count via effectiveEntitlements().
  const eff = await effectiveEntitlements(organizationId, plan);
  const effectivePlan: typeof plan = {
    ...plan,
    entitlements: {
      ...plan.entitlements,
      includedAICreditsCents: eff.includedAICreditsCents,
    },
  };

  return preflightAICreditCheck({
    plan: effectivePlan,
    currentAICostCents,
    expectedAdditionalCostCents,
  });
}

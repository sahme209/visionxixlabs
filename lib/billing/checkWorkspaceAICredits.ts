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
 * Fails open: if either read errors, returns an allow decision with
 * threshold "below_70" so a Prisma blip doesn't take down the AI
 * coding loop. This is a soft check; the DB unique constraints and
 * gates downstream still enforce correctness.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { readBillingPlan } from "./tenantBillingStore";
import { planForStripeTier } from "./planRegistry";
import { preflightAICreditCheck, type PreflightDecision } from "./preflightAICreditCheck";

const periodStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export async function checkWorkspaceAICredits(
  organizationId: string,
  expectedAdditionalCostCents = 0,
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
    // Aggregate failed — treat as fresh month. Soft check; downstream
    // gates still enforce.
    currentAICostCents = 0;
  }

  return preflightAICreditCheck({
    plan,
    currentAICostCents,
    expectedAdditionalCostCents,
  });
}

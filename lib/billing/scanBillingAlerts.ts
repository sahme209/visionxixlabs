/**
 * Billing alert scan — Phase 385.
 *
 * Walks every workspace that has any UsageEvent activity this month,
 * computes its current ratio for each tracked dimension, and inserts
 * BillingAlert rows for any 70/90/100% thresholds that haven't fired
 * yet this period.
 *
 * Idempotent — the unique (workspace, dimension, threshold,
 * periodMonth) index swallows re-insert attempts. The cron can run
 * as often as desired; rows only land when something has changed.
 *
 * Two dimensions are tracked today:
 *   - ai_credits  (vs plan.entitlements.includedAICreditsCents)
 *   - agent_runs_per_month
 * Future: extend the loop with more entitlement dimensions.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { readBillingPlan } from "./tenantBillingStore";
import { planForStripeTier, type PricingPlan } from "./planRegistry";
import { whichAlertsToFire, type AlertThreshold } from "./whichAlertsToFire";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const periodStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

interface DimensionProbe {
  dimension: string;
  /** Pull the current usage count and the limit from the plan. */
  read: (orgId: string, plan: PricingPlan, periodStartDate: Date) =>
    Promise<{ current: number; limit: number | null }>;
}

const DIMENSIONS: ReadonlyArray<DimensionProbe> = [
  {
    dimension: "ai_credits",
    async read(orgId, plan, start) {
      try {
        const agg = await prisma.usageEvent.aggregate({
          where: { organizationId: orgId, eventKind: "ai_invocation", createdAt: { gte: start } },
          _sum: { costCents: true },
        });
        return {
          current: agg._sum.costCents ?? 0,
          limit: plan.entitlements.includedAICreditsCents > 0 ? plan.entitlements.includedAICreditsCents : null,
        };
      } catch {
        return { current: 0, limit: plan.entitlements.includedAICreditsCents };
      }
    },
  },
  {
    dimension: "agent_runs_per_month",
    async read(orgId, plan, start) {
      try {
        const count = await prisma.usageEvent.count({
          where: { organizationId: orgId, eventKind: "agent_run", createdAt: { gte: start } },
        });
        return { current: count, limit: plan.entitlements.monthlyAgentRuns };
      } catch {
        return { current: 0, limit: plan.entitlements.monthlyAgentRuns };
      }
    },
  },
  {
    dimension: "automation_runs_per_month",
    async read(orgId, plan, start) {
      try {
        const count = await prisma.usageEvent.count({
          where: { organizationId: orgId, eventKind: "automation_run", createdAt: { gte: start } },
        });
        return { current: count, limit: plan.entitlements.monthlyAutomationRuns };
      } catch {
        return { current: 0, limit: plan.entitlements.monthlyAutomationRuns };
      }
    },
  },
];

export interface ScanBillingAlertsResult {
  periodMonth: string;
  workspacesScanned: number;
  alertsFired: number;
  alertsByThreshold: { 70: number; 90: number; 100: number };
}

export async function scanBillingAlerts(now: Date = new Date()): Promise<ScanBillingAlertsResult> {
  const period = periodKey(now);
  const start = periodStart(now);

  // Find every workspace with any UsageEvent activity this period.
  const orgs = await prisma.usageEvent.groupBy({
    by: ["organizationId"],
    where: { createdAt: { gte: start } },
    _count: { _all: true },
  }).catch(() => [] as Array<{ organizationId: string; _count: { _all: number } }>);

  const result: ScanBillingAlertsResult = {
    periodMonth: period,
    workspacesScanned: 0,
    alertsFired: 0,
    alertsByThreshold: { 70: 0, 90: 0, 100: 0 },
  };

  for (const org of orgs) {
    result.workspacesScanned++;

    let plan: PricingPlan;
    try {
      const billing = await readBillingPlan(org.organizationId);
      plan = planForStripeTier(billing.tier);
    } catch {
      plan = planForStripeTier("starter");
    }

    // Pull existing alerts for this period in one query to avoid N+1.
    const existing = await prisma.billingAlert.findMany({
      where: { organizationId: org.organizationId, periodMonth: period },
      select: { dimension: true, threshold: true },
    }).catch(() => [] as Array<{ dimension: string; threshold: number }>);

    const firedSet = new Set(existing.map((e) => `${e.dimension}:${e.threshold}`));

    for (const probe of DIMENSIONS) {
      const { current, limit } = await probe.read(org.organizationId, plan, start);
      // Skip dimensions with custom/unlimited (null) limits — Enterprise.
      if (limit == null || limit <= 0) continue;
      const ratio = current / limit;
      const alreadyFired = ([70, 90, 100] as AlertThreshold[]).filter(
        (t) => firedSet.has(`${probe.dimension}:${t}`),
      );
      const toFire = whichAlertsToFire({ currentRatio: ratio, alreadyFired });

      for (const threshold of toFire) {
        const correlationId = `billing_alert_${org.organizationId}_${probe.dimension}_${threshold}_${period}`;
        try {
          await prisma.billingAlert.create({
            data: {
              organizationId: org.organizationId,
              dimension: probe.dimension,
              threshold,
              periodMonth: period,
              planTier: plan.tier,
              ratioAtTrigger: ratio,
              limitAtTrigger: limit,
              currentAtTrigger: current,
              correlationId,
              deliveryChannel: "dashboard",
            },
          });
          result.alertsFired++;
          result.alertsByThreshold[threshold]++;

          try {
            await recordAudit({
              organizationId: idFactory.organization(org.organizationId),
              actorKind: "system",
              action: "billing.alert_fired",
              outcome: "success",
              entityRef: `billing_alert:${probe.dimension}:${threshold}`,
              correlationId: idFactory.correlation(correlationId),
              source: "live",
              detail: {
                dimension: probe.dimension,
                threshold,
                ratio,
                current,
                limit,
                planTier: plan.tier,
                periodMonth: period,
              },
            });
          } catch { /* best-effort */ }

          // Phase 397: fire billing webhook events. At 70/90% we send
          // billing.threshold_crossed (heads-up). At 100% we additionally
          // send billing.quota_exhausted so PagerDuty/Slack integrators
          // can route the harder severity separately.
          try {
            await dispatchWebhookEvent({
              organizationId: org.organizationId,
              eventKind: "billing.threshold_crossed",
              data: {
                dimension: probe.dimension,
                threshold,
                ratio,
                current,
                limit,
                planTier: plan.tier,
                periodMonth: period,
              },
              correlationId,
            });
          } catch { /* best-effort */ }

          if (threshold === 100) {
            try {
              await dispatchWebhookEvent({
                organizationId: org.organizationId,
                eventKind: "billing.quota_exhausted",
                data: {
                  dimension: probe.dimension,
                  ratio,
                  current,
                  limit,
                  planTier: plan.tier,
                  periodMonth: period,
                },
                correlationId,
              });
            } catch { /* best-effort */ }
          }
        } catch {
          // Race: another concurrent cron tick already fired this threshold.
          // The unique index swallowed our insert. Safe to ignore.
        }
      }
    }
  }

  return result;
}

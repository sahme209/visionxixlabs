/**
 * AWS Cost Explorer Summary — read-only.
 * Queries last 30 days (current) and the prior 30 days (days 31-60) for comparison.
 * Returns range, total, previousRange, previousTotal, delta, topServices, notes,
 * and advisory recommendations. Always requires dryRun=true.
 */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandOutput,
} from "@aws-sdk/client-cost-explorer";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

/** Returns start/end dates for a window: [today - daysBack - windowDays, today - daysBack) */
function getDateRange(daysBack: number, windowDays: number): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - daysBack);
  const start = new Date(end);
  start.setDate(start.getDate() - windowDays);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Sum UnblendedCost across all ResultsByTime groups. */
function sumCostResults(result: GetCostAndUsageCommandOutput): { amount: number; unit: string } {
  let amount = 0;
  let unit = "USD";
  for (const r of result.ResultsByTime ?? []) {
    for (const g of r.Groups ?? []) {
      const m = g.Metrics?.UnblendedCost;
      amount += Number(m?.Amount ?? 0) || 0;
      if (m?.Unit) unit = m.Unit;
    }
  }
  return { amount, unit };
}

async function run(
  _input: Record<string, unknown>,
  ctx: ExecutionPluginContext
): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("cost-explorer-summary started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Cost Explorer summary is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const creds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!creds) {
    return {
      ok: false,
      error: "AWS connector not linked or validated. Connect your AWS account in Connectors first.",
      summary: "AWS connector required.",
    };
  }

  // Cost Explorer API is global — us-east-1 is the required endpoint.
  const client = new CostExplorerClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  const currentRange = getDateRange(0, 30);   // last 30 days
  const previousRange = getDateRange(30, 30); // days 31–60 back

  try {
    // Run both periods in parallel, grouped by SERVICE.
    const [currentResult, previousResult] = await Promise.all([
      client.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: currentRange.start, End: currentRange.end },
          Granularity: "MONTHLY",
          Metrics: ["UnblendedCost"],
          GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
        })
      ),
      client.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: previousRange.start, End: previousRange.end },
          Granularity: "MONTHLY",
          Metrics: ["UnblendedCost"],
          GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
        })
      ),
    ]);

    // Aggregate totals across all monthly buckets (handles windows that span month boundaries).
    const currentTotal = sumCostResults(currentResult);
    const previousTotal = sumCostResults(previousResult);

    // Build per-service totals for the current period.
    const serviceMap = new Map<string, { amount: number; unit: string }>();
    for (const r of currentResult.ResultsByTime ?? []) {
      for (const g of r.Groups ?? []) {
        const service = g.Keys?.[0] ?? "Unknown";
        const m = g.Metrics?.UnblendedCost;
        const amount = Number(m?.Amount ?? 0) || 0;
        const unit = m?.Unit ?? "USD";
        const existing = serviceMap.get(service);
        if (existing) {
          existing.amount += amount;
        } else {
          serviceMap.set(service, { amount, unit });
        }
      }
    }

    const topServices = Array.from(serviceMap.entries())
      .map(([service, { amount, unit }]) => ({ service, amount, unit }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Delta vs prior period.
    const deltaAmount = currentTotal.amount - previousTotal.amount;
    const deltaPercent =
      previousTotal.amount > 0
        ? (deltaAmount / previousTotal.amount) * 100
        : currentTotal.amount > 0
        ? 100
        : 0;

    // --- Notes ---
    const notes: string[] = [];
    if (deltaPercent > 20) {
      notes.push(
        `AWS spend increased ${deltaPercent.toFixed(1)}% vs the prior 30-day period (+$${deltaAmount.toFixed(2)}).`
      );
    }

    // --- Recommendations ---
    const recommendations: string[] = [];

    // If any single service exceeds 40% of total spend, add a targeted recommendation.
    if (currentTotal.amount > 0) {
      for (const svc of topServices) {
        const pct = (svc.amount / currentTotal.amount) * 100;
        if (pct > 40) {
          if (
            svc.service.includes("EC2") ||
            svc.service.includes("Elastic Compute Cloud")
          ) {
            recommendations.push(
              `EC2 accounts for ${pct.toFixed(1)}% of spend. Review instance rightsizing, Reserved Instances, and Savings Plans.`
            );
          } else if (
            svc.service.includes("S3") ||
            svc.service.includes("Simple Storage Service")
          ) {
            recommendations.push(
              `S3 accounts for ${pct.toFixed(1)}% of spend. Review storage classes, lifecycle policies, and Intelligent-Tiering.`
            );
          } else if (
            svc.service.includes("RDS") ||
            svc.service.includes("Relational Database Service")
          ) {
            recommendations.push(
              `RDS accounts for ${pct.toFixed(1)}% of spend. Evaluate Reserved Instances, Aurora Serverless v2, and instance sizing.`
            );
          } else {
            recommendations.push(
              `${svc.service} accounts for ${pct.toFixed(1)}% of total AWS spend. Review usage and right-sizing opportunities.`
            );
          }
          break; // Only flag the dominant service once.
        }
      }
    }

    // Always include these advisory recommendations.
    recommendations.push(
      "Review EC2 instance utilization and consider Compute Savings Plans for predictable workloads."
    );
    recommendations.push(
      "Evaluate Reserved Instances for steady-state RDS, ElastiCache, and Redshift usage."
    );
    recommendations.push(
      "Review data transfer costs — cross-region and internet egress fees can accumulate significantly."
    );
    recommendations.push(
      "Review RDS and storage provisioning to ensure you are not over-provisioned."
    );

    const sign = deltaPercent >= 0 ? "+" : "";
    const summary = `AWS spend: $${currentTotal.amount.toFixed(2)} (last 30 days). Delta vs prior period: ${sign}${deltaPercent.toFixed(1)}%.`;

    logger.info("cost-explorer-summary completed", {
      total: currentTotal.amount,
      previousTotal: previousTotal.amount,
      deltaPercent: deltaPercent.toFixed(1) + "%",
      topServicesCount: topServices.length,
    });

    return {
      ok: true,
      data: {
        range: { start: currentRange.start, end: currentRange.end },
        total: { amount: currentTotal.amount, unit: currentTotal.unit },
        previousRange: { start: previousRange.start, end: previousRange.end },
        previousTotal: { amount: previousTotal.amount, unit: previousTotal.unit },
        delta: { amount: deltaAmount, percent: deltaPercent },
        topServices,
        notes,
        recommendations,
      },
      summary,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("cost-explorer-summary failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Cost Explorer query failed.",
    };
  }
}

registerExecutionPlugin({
  id: "aws:cost-explorer-summary",
  name: "AWS Cost Explorer Summary",
  description:
    "Query cost and usage for last 30 days vs prior 30 days. Returns total, delta, top services by spend, notes, and optimization recommendations. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  modifiesInfrastructure: false,
  run,
});

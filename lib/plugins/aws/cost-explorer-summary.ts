/**
 * AWS Cost Explorer Summary — read-only.
 * Uses @aws-sdk/client-cost-explorer to query cost for last 30 days.
 * Returns totalCost, top services by spend, estimated optimization opportunities.
 */

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

function getLast30Days(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
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

  const region = "us-east-1"; // Cost Explorer API is global, us-east-1 recommended

  const client = new CostExplorerClient({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  const { start, end } = getLast30Days();

  try {
    // Total cost for the period
    const totalCommand = new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
    });
    const totalResult = await client.send(totalCommand);
    const totalCost =
      Number(totalResult.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount ?? 0) || 0;

    // By service
    const byServiceCommand = new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    });
    const byServiceResult = await client.send(byServiceCommand);
    const groups = byServiceResult.ResultsByTime?.[0]?.Groups ?? [];
    const services = groups
      .map((g) => ({
        service: g.Keys?.[0] ?? "Unknown",
        cost: Number(g.Metrics?.UnblendedCost?.Amount ?? 0) || 0,
      }))
      .filter((s) => s.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 15);

    // Generate basic recommendations from top spenders
    const recommendations: string[] = [];
    const topService = services[0];
    if (topService) {
      if (
        topService.service.includes("EC2") ||
        topService.service.includes("Amazon Elastic Compute Cloud")
      ) {
        recommendations.push("Review EC2 instance rightsizing and Reserved Instances for potential savings.");
      }
      if (
        topService.service.includes("S3") ||
        topService.service.includes("Simple Storage Service")
      ) {
        recommendations.push("Consider S3 Intelligent-Tiering and lifecycle policies for cost optimization.");
      }
      if (
        topService.service.includes("RDS") ||
        topService.service.includes("Relational Database Service")
      ) {
        recommendations.push("Evaluate RDS Reserved Instances and Aurora Serverless v2 for variable workloads.");
      }
    }
    if (totalCost > 100 && recommendations.length === 0) {
      recommendations.push("Review AWS Cost Explorer recommendations in the console for detailed optimization.");
    }

    const summary = `Total: $${totalCost.toFixed(2)} over last 30 days. Top service: ${services[0]?.service ?? "N/A"}`;
    logger.info("cost-explorer-summary completed", { totalCost, servicesCount: services.length });

    return {
      ok: true,
      data: {
        totalCost,
        currency: "USD",
        periodStart: start,
        periodEnd: end,
        services,
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
      summary: "Cost Explorer query failed",
    };
  }
}

registerExecutionPlugin({
  id: "aws:cost-explorer-summary",
  name: "AWS Cost Explorer Summary",
  description: "Query cost and usage for last 30 days. Returns total cost, top services by spend, optimization recommendations. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

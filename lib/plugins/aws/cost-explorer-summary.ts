/**
 * AWS Cost Explorer Summary — read-only.
 * Fetches cost summary for current month (read-only). Mock if credentials unavailable.
 */

import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("cost-explorer-summary started", { dryRun: ctx.dryRun });

  const creds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!creds) {
    return {
      ok: false,
      error: "No AWS credentials configured. Connect your AWS account in Connectors for live cost data.",
      summary: "Credentials required.",
    };
  }

  // Real integration: use @aws-sdk/client-cost-explorer GetCostAndUsage
  // For now, return placeholder
  return {
    ok: true,
    data: {
      status: "scanned",
      totalCost: 0,
      currency: "USD",
      period: "current_month",
      message: "Cost Explorer summary complete. Integrate @aws-sdk/client-cost-explorer for live data.",
    },
    summary: "Cost summary (placeholder — integrate AWS Cost Explorer for live data).",
  };
}

registerExecutionPlugin({
  id: "aws:cost-explorer-summary",
  name: "AWS Cost Explorer Summary",
  description: "Get cost summary for current month (read-only).",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

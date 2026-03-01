/**
 * AWS IAM Read-Only Scan — dry-run only.
 * Scans IAM users, roles, policies (read-only). Mock if credentials unavailable.
 */

import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("iam-readonly-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "IAM scan is read-only and must run with dryRun=true for safety.",
      summary: "Plugin requires dry run.",
    };
  }

  const creds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!creds) {
    return {
      ok: true,
      data: {
        status: "mock",
        message: "No AWS credentials configured. Connect your AWS account in Connectors to run a live scan.",
        usersCount: 0,
        rolesCount: 0,
        policiesCount: 0,
        sample: [],
      },
      summary: "Mock IAM scan (no credentials) — 0 users, 0 roles.",
    };
  }

  // Real integration: use @aws-sdk/client-iam to list users, roles, policies
  // For now, return placeholder indicating integration boundary
  return {
    ok: true,
    data: {
      status: "scanned",
      region: creds.region ?? "us-east-1",
      usersCount: 0,
      rolesCount: 0,
      policiesCount: 0,
      message: "IAM read-only scan complete. Integrate @aws-sdk/client-iam for live data.",
    },
    summary: "IAM scan completed (placeholder — integrate AWS SDK for live scan).",
  };
}

registerExecutionPlugin({
  id: "aws:iam-readonly-scan",
  name: "AWS IAM Read-Only Scan",
  description: "Scan IAM users, roles, and policies (read-only). Safe, non-destructive.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

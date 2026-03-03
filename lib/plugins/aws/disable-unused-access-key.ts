/**
 * AWS Disable Unused Access Key — safe remediation plugin.
 * Only disables keys detected as unused >90 days by IAM scan.
 * Requires explicit user confirmation (dryRun=false / apply=true).
 */

import { IAMClient, UpdateAccessKeyCommand } from "@aws-sdk/client-iam";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

type IAMCreds = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
};

function createIAMClient(creds: IAMCreds): IAMClient {
  const region = creds.region ?? "us-east-1";
  return new IAMClient({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  const accessKeyId = String(input?.accessKeyId ?? "").trim();
  const userName = String(input?.userName ?? "").trim();

  if (!accessKeyId || !userName) {
    return {
      ok: false,
      error: "accessKeyId and userName required. Use findings from IAM scan (UnusedAccessKey).",
      summary: "Invalid input",
    };
  }

  if (!ctx.credentialsKey) {
    return {
      ok: false,
      error: "AWS connector required. Link AWS in Connectors first.",
      summary: "Connector required",
    };
  }

  const creds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!creds) {
    return {
      ok: false,
      error: "AWS connector not linked or validated.",
      summary: "Connector required",
    };
  }

  const rollbackSteps = ["Set key back to Active: IAM Console → Users → Security credentials → Activate access key"];

  if (ctx.dryRun) {
    logger.info("disable-unused-access-key dry run", { accessKeyId: `${accessKeyId.slice(0, 8)}...`, userName });
    return {
      ok: true,
      data: {
        dryRun: true,
        action: "Would disable access key",
        accessKeyId: `${accessKeyId.slice(0, 8)}****`,
        userName,
        rollbackSteps,
      },
      summary: `Dry run: would disable key ${accessKeyId.slice(0, 8)}**** for user ${userName}`,
      rollbackHints: rollbackSteps,
    };
  }

  try {
    const client = createIAMClient(creds);
    await client.send(
      new UpdateAccessKeyCommand({
        UserName: userName,
        AccessKeyId: accessKeyId,
        Status: "Inactive",
      })
    );
    logger.info("disable-unused-access-key success", { accessKeyId: `${accessKeyId.slice(0, 8)}...`, userName });
    return {
      ok: true,
      data: {
        success: true,
        action: "Disabled access key",
        accessKeyId: `${accessKeyId.slice(0, 8)}****`,
        userName,
        status: "Inactive",
        rollbackSteps,
      },
      summary: `Disabled access key for user ${userName}`,
      rollbackHints: rollbackSteps,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("disable-unused-access-key failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Failed to disable access key",
    };
  }
}

registerExecutionPlugin({
  id: "aws:disable-unused-access-key",
  name: "Disable Unused Access Key",
  description: "Disable IAM access key detected as unused >90 days. Requires explicit confirmation.",
  scopesRequired: ["cloud:aws", "cloud:read", "cloud:write"],
  readOnly: false,
  run,
});

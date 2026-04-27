/**
 * Azure Security Scan — read-only security audit.
 * Checks storage accounts for public access and HTTPS-only settings.
 * Checks NSGs for overly permissive inbound rules.
 */

import { StorageManagementClient } from "@azure/arm-storage";
import { NetworkManagementClient } from "@azure/arm-network";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

type Finding = {
  severity: "critical" | "high" | "medium" | "low";
  resource: string;
  resourceType: string;
  issue: string;
};

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("azure:security-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Security scan is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const azureCreds = await getCredentialProvider().getAzureCredentials(ctx.userId, ctx.credentialsKey);
  if (!azureCreds) {
    return {
      ok: false,
      error: "Azure connector not linked. Connect your Azure account first.",
      summary: "Azure connector required.",
    };
  }

  const findings: Finding[] = [];

  try {
    const { credential, subscriptionId } = azureCreds;

    const storageClient = new StorageManagementClient(credential, subscriptionId);
    const networkClient = new NetworkManagementClient(credential, subscriptionId);

    for await (const account of storageClient.storageAccounts.list()) {
      const name = account.name ?? "unknown";

      if (account.allowBlobPublicAccess === true) {
        findings.push({
          severity: "high",
          resource: name,
          resourceType: "StorageAccount",
          issue: "Blob public access is enabled",
        });
      }

      if (account.enableHttpsTrafficOnly === false) {
        findings.push({
          severity: "high",
          resource: name,
          resourceType: "StorageAccount",
          issue: "HTTPS-only traffic is not enforced",
        });
      }

      if (account.minimumTlsVersion && account.minimumTlsVersion !== "TLS1_2") {
        findings.push({
          severity: "medium",
          resource: name,
          resourceType: "StorageAccount",
          issue: `Minimum TLS version is ${account.minimumTlsVersion}, should be TLS1_2`,
        });
      }
    }

    for await (const nsg of networkClient.networkSecurityGroups.listAll()) {
      const nsgName = nsg.name ?? "unknown";
      for (const rule of nsg.securityRules ?? []) {
        if (
          rule.direction === "Inbound" &&
          rule.access === "Allow" &&
          (rule.sourceAddressPrefix === "*" || rule.sourceAddressPrefix === "0.0.0.0/0")
        ) {
          const port = rule.destinationPortRange ?? "any";
          const severity = port === "22" || port === "3389" || port === "*" ? "critical" : "high";
          findings.push({
            severity,
            resource: `${nsgName} / ${rule.name ?? "rule"}`,
            resourceType: "NetworkSecurityGroup",
            issue: `Inbound rule allows traffic from anywhere on port ${port}`,
          });
        }
      }
    }

    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    const medium = findings.filter((f) => f.severity === "medium").length;
    const summary = `Found ${findings.length} finding(s): ${critical} critical, ${high} high, ${medium} medium`;

    logger.info("azure:security-scan completed", { findingsCount: findings.length });

    return {
      ok: true,
      data: { findings, summary, findingsCount: findings.length },
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("azure:security-scan failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Azure security scan failed",
    };
  }
}

registerExecutionPlugin({
  id: "azure:security-scan",
  name: "Azure Security Scan",
  description: "Scan Storage Accounts and NSGs for security misconfigurations. Read-only.",
  scopesRequired: ["cloud:azure", "cloud:read"],
  readOnly: true,
  run,
});

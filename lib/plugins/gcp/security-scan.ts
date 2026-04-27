/**
 * GCP Security Scan — read-only security audit.
 * Checks storage buckets for public access (allUsers / allAuthenticatedUsers).
 * Checks firewall rules for overly permissive ingress.
 */

import { Storage } from "@google-cloud/storage";
import { FirewallsClient } from "@google-cloud/compute";
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
  logger.info("gcp:security-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Security scan is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const gcpCreds = await getCredentialProvider().getGCPCredentials(ctx.userId, ctx.credentialsKey);
  if (!gcpCreds) {
    return {
      ok: false,
      error: "GCP connector not linked. Connect your GCP account first.",
      summary: "GCP connector required.",
    };
  }

  const findings: Finding[] = [];

  try {
    const { credentials, projectId } = gcpCreds;

    const storage = new Storage({ credentials, projectId });
    const firewallsClient = new FirewallsClient({ credentials });

    const [buckets] = await storage.getBuckets({ project: projectId });
    for (const bucket of buckets ?? []) {
      try {
        const [policy] = await bucket.iam.getPolicy();
        for (const binding of policy.bindings ?? []) {
          const members = binding.members ?? [];
          if (members.includes("allUsers")) {
            findings.push({
              severity: "critical",
              resource: bucket.name,
              resourceType: "StorageBucket",
              issue: `Bucket is publicly accessible (allUsers has ${binding.role})`,
            });
          }
          if (members.includes("allAuthenticatedUsers")) {
            findings.push({
              severity: "high",
              resource: bucket.name,
              resourceType: "StorageBucket",
              issue: `Bucket accessible to all authenticated users (${binding.role})`,
            });
          }
        }
      } catch {
        // IAM policy may not be readable; skip bucket
      }
    }

    const [firewallsResponse] = await firewallsClient.list({ project: projectId });
    for (const rule of firewallsResponse ?? []) {
      if (rule.direction !== "INGRESS" || rule.disabled) continue;

      const hasOpenSource = (rule.sourceRanges ?? []).includes("0.0.0.0/0");
      if (!hasOpenSource) continue;

      for (const allowed of rule.allowed ?? []) {
        const protocol = allowed.IPProtocol ?? "unknown";
        const ports = allowed.ports ?? ["all"];

        for (const port of ports) {
          const isSsh = port === "22" || port === "all";
          const isRdp = port === "3389" || port === "all";
          const severity = isSsh || isRdp ? "critical" : "high";
          findings.push({
            severity,
            resource: rule.name ?? "unknown",
            resourceType: "FirewallRule",
            issue: `Ingress from 0.0.0.0/0 on ${protocol}:${port}`,
          });
        }
      }
    }

    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    const medium = findings.filter((f) => f.severity === "medium").length;
    const summary = `Found ${findings.length} finding(s): ${critical} critical, ${high} high, ${medium} medium`;

    logger.info("gcp:security-scan completed", { findingsCount: findings.length });

    return {
      ok: true,
      data: { findings, summary, findingsCount: findings.length },
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("gcp:security-scan failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "GCP security scan failed",
    };
  }
}

registerExecutionPlugin({
  id: "gcp:security-scan",
  name: "GCP Security Scan",
  description: "Scan Storage Buckets and Firewall Rules for security misconfigurations. Read-only.",
  scopesRequired: ["cloud:gcp", "cloud:read"],
  readOnly: true,
  run,
});

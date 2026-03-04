/**
 * AWS S3 Public Bucket Scan — read-only.
 * Lists all S3 buckets, checks public access block, ACLs, and policies.
 * Identifies buckets that allow public access.
 */

import {
  S3Client,
  ListBucketsCommand,
  GetPublicAccessBlockCommand,
  GetBucketAclCommand,
  GetBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

function hasPublicAcl(grants: Array<{ Grantee?: { Type?: string; URI?: string }; Permission?: string }>): boolean {
  if (!Array.isArray(grants)) return false;
  const publicUris = [
    "http://acs.amazonaws.com/groups/global/AllUsers",
    "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
  ];
  for (const g of grants) {
    const uri = g.Grantee?.URI?.toLowerCase?.();
    if (uri && publicUris.some((u) => uri.includes("allusers") || uri.includes("authenticatedusers"))) {
      return true;
    }
  }
  return false;
}

function policyAllowsPublicAccess(policyJson: string | undefined): boolean {
  if (!policyJson || typeof policyJson !== "string") return false;
  try {
    const policy = JSON.parse(policyJson) as { Statement?: Array<{ Principal?: unknown }> };
    const statements = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement];
    for (const stmt of statements) {
      if (!stmt?.Principal) continue;
      const p = stmt.Principal;
      if (p === "*") return true;
      if (typeof p === "object" && p !== null) {
        const obj = p as Record<string, unknown>;
        if (obj.AWS === "*" || (Array.isArray(obj.AWS) && obj.AWS.includes("*"))) return true;
      }
    }
  } catch {
    // invalid JSON
  }
  return false;
}

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("s3-public-bucket-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "S3 public bucket scan is read-only and must run with dryRun=true.",
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

  const region = creds.region ?? "us-east-1";
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  try {
    const listRes = await client.send(new ListBucketsCommand({}));
    const buckets = listRes.Buckets ?? [];
    const bucketsScanned = buckets.length;
    const publicBuckets: Array<{ name: string; reason: string }> = [];
    const recommendations: string[] = [];

    for (const b of buckets) {
      const name = b.Name;
      if (!name) continue;

      let blockPublicAcls = true;
      let blockPublicPolicy = true;
      let aclPublic = false;
      let policyPublic = false;

      // GetPublicAccessBlock — may not be configured
      try {
        const blockRes = await client.send(new GetPublicAccessBlockCommand({ Bucket: name }));
        const config = blockRes.PublicAccessBlockConfiguration;
        blockPublicAcls = config?.BlockPublicAcls ?? true;
        blockPublicPolicy = config?.BlockPublicPolicy ?? true;
      } catch {
        // NoSuchPublicAccessBlockConfiguration — bucket has no block, treat as potentially public
        blockPublicAcls = false;
        blockPublicPolicy = false;
      }

      // GetBucketAcl
      try {
        const aclRes = await client.send(new GetBucketAclCommand({ Bucket: name }));
        aclPublic = hasPublicAcl(aclRes.Grants ?? []);
      } catch {
        // Access denied or other error — skip ACL check
      }

      // GetBucketPolicy
      try {
        const policyRes = await client.send(new GetBucketPolicyCommand({ Bucket: name }));
        policyPublic = policyAllowsPublicAccess(policyRes.Policy);
      } catch {
        // No policy or access denied
      }

      const isPublic =
        (!blockPublicAcls && aclPublic) || (!blockPublicPolicy && policyPublic);
      if (isPublic) {
        const reasons: string[] = [];
        if (!blockPublicAcls && aclPublic) reasons.push("public ACL");
        if (!blockPublicPolicy && policyPublic) reasons.push("public policy");
        publicBuckets.push({ name, reason: reasons.join(", ") });
      }
    }

    if (publicBuckets.length > 0) {
      recommendations.push(`Enable Block Public Access on ${publicBuckets.length} bucket(s) with public access.`);
      recommendations.push("Review bucket ACLs and policies to remove AllUsers/AuthenticatedUsers grants.");
    } else if (bucketsScanned > 0) {
      recommendations.push("All scanned buckets have public access blocked. Keep Block Public Access enabled.");
    }

    const summary =
      publicBuckets.length > 0
        ? `Scanned ${bucketsScanned} buckets. Found ${publicBuckets.length} with public access.`
        : `Scanned ${bucketsScanned} buckets. No public buckets found.`;

    logger.info("s3-public-bucket-scan completed", { bucketsScanned, publicCount: publicBuckets.length });

    return {
      ok: true,
      data: {
        bucketsScanned,
        publicBuckets,
        recommendations,
      },
      summary,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("s3-public-bucket-scan failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "S3 public bucket scan failed",
    };
  }
}

registerExecutionPlugin({
  id: "aws:s3-public-bucket-scan",
  name: "AWS S3 Public Bucket Scan",
  description: "List S3 buckets, check public access block, ACLs, and policies. Identify buckets allowing public access. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

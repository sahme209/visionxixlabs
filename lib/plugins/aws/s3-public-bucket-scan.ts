/**
 * AWS S3 Public Bucket Scan — read-only.
 * For each bucket: checks ACL grants, policy public status (GetBucketPolicyStatusCommand),
 * and Public Access Block configuration.
 * Returns a risk-rated result per flagged bucket.
 * Always requires dryRun=true.
 */

import {
  S3Client,
  ListBucketsCommand,
  GetBucketAclCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

type PublicBucketResult = {
  name: string;
  aclPublic: boolean;
  policyPublic: boolean;
  publicAccessBlockEnabled: boolean;
  riskLevel: "low" | "medium" | "high";
  notes: string[];
};

const PUBLIC_ACL_URIS = [
  "http://acs.amazonaws.com/groups/global/allusers",
  "http://acs.amazonaws.com/groups/global/authenticatedusers",
];

function isAclPublic(
  grants: Array<{ Grantee?: { Type?: string; URI?: string }; Permission?: string }>
): boolean {
  return grants.some((g) => {
    const uri = g.Grantee?.URI?.toLowerCase();
    return uri ? PUBLIC_ACL_URIS.includes(uri) : false;
  });
}

function computeRiskLevel(
  aclPublic: boolean,
  policyPublic: boolean,
  publicAccessBlockEnabled: boolean
): "low" | "medium" | "high" {
  // High: actively exposed via policy or ACL without block protection
  if (policyPublic || (aclPublic && !publicAccessBlockEnabled)) return "high";
  // Medium: no block config — latently risky even without direct exposure
  if (!publicAccessBlockEnabled) return "medium";
  // Low: ACL technically public but Block Public Access is shielding it
  return "low";
}

async function run(
  _input: Record<string, unknown>,
  ctx: ExecutionPluginContext
): Promise<PluginResult> {
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
    const publicBuckets: PublicBucketResult[] = [];

    for (const b of buckets) {
      const name = b.Name;
      if (!name) continue;

      let aclPublic = false;
      let policyPublic = false;
      let publicAccessBlockEnabled = false;
      const notes: string[] = [];

      // 1. Check Public Access Block configuration
      try {
        const blockRes = await client.send(new GetPublicAccessBlockCommand({ Bucket: name }));
        const c = blockRes.PublicAccessBlockConfiguration;
        publicAccessBlockEnabled =
          (c?.BlockPublicAcls ?? false) &&
          (c?.IgnorePublicAcls ?? false) &&
          (c?.BlockPublicPolicy ?? false) &&
          (c?.RestrictPublicBuckets ?? false);

        if (!publicAccessBlockEnabled) {
          const disabled = [
            !c?.BlockPublicAcls && "BlockPublicAcls",
            !c?.IgnorePublicAcls && "IgnorePublicAcls",
            !c?.BlockPublicPolicy && "BlockPublicPolicy",
            !c?.RestrictPublicBuckets && "RestrictPublicBuckets",
          ].filter(Boolean) as string[];
          notes.push(`Public Access Block incomplete — disabled settings: ${disabled.join(", ")}.`);
        }
      } catch {
        // NoSuchPublicAccessBlockConfiguration — no block config at all
        publicAccessBlockEnabled = false;
        notes.push("No Public Access Block configuration found on this bucket.");
      }

      // 2. Check ACL grants
      try {
        const aclRes = await client.send(new GetBucketAclCommand({ Bucket: name }));
        aclPublic = isAclPublic(aclRes.Grants ?? []);
        if (aclPublic) {
          notes.push("ACL grants access to AllUsers or AuthenticatedUsers (public group).");
        }
      } catch {
        // Access denied or unsupported — skip ACL check for this bucket
      }

      // 3. Check bucket policy public status via AWS-native determination
      try {
        const policyStatusRes = await client.send(
          new GetBucketPolicyStatusCommand({ Bucket: name })
        );
        policyPublic = policyStatusRes.PolicyStatus?.IsPublic ?? false;
        if (policyPublic) {
          notes.push("Bucket policy is determined to be public by AWS.");
        }
      } catch {
        // NoSuchBucketPolicy or access denied — no policy exists or inaccessible
      }

      // Flag bucket if any risk signal is present
      const flagged = policyPublic || aclPublic || !publicAccessBlockEnabled;
      if (flagged) {
        publicBuckets.push({
          name,
          aclPublic,
          policyPublic,
          publicAccessBlockEnabled,
          riskLevel: computeRiskLevel(aclPublic, policyPublic, publicAccessBlockEnabled),
          notes,
        });
      }
    }

    // Recommendations
    const highCount = publicBuckets.filter((b) => b.riskLevel === "high").length;
    const recommendations: string[] = [];

    if (highCount > 0) {
      recommendations.push(
        `Immediately enable S3 Block Public Access on ${highCount} high-risk bucket(s) that are actively exposed.`
      );
    }
    recommendations.push(
      "Enable S3 Block Public Access at the account level to prevent future public exposure across all buckets."
    );
    recommendations.push(
      "Review bucket ACLs and remove AllUsers or AuthenticatedUsers grants unless the bucket is intentionally public."
    );
    recommendations.push(
      "Restrict anonymous access in bucket policies — only allow public access if the bucket serves a public website or static assets."
    );

    const flaggedCount = publicBuckets.length;
    const summary =
      flaggedCount > 0
        ? `Scanned ${bucketsScanned} bucket(s). ${flaggedCount} flagged (${highCount} high risk).`
        : `Scanned ${bucketsScanned} bucket(s). No public or risky buckets found.`;

    logger.info("s3-public-bucket-scan completed", {
      bucketsScanned,
      flaggedCount,
      highCount,
    });

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
      summary: "S3 public bucket scan failed.",
    };
  }
}

registerExecutionPlugin({
  id: "aws:s3-public-bucket-scan",
  name: "AWS S3 Public Bucket Scan",
  description:
    "List S3 buckets and check each for public ACLs, public bucket policy status, and Public Access Block configuration. Returns risk-rated results per bucket. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  modifiesInfrastructure: false,
  run,
});

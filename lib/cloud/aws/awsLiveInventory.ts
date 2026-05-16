/**
 * AWS live read-only inventory.
 *
 * Assumes the customer's role via the broker, then makes a minimal set of
 * read-only API calls — EC2 instances/VPCs/SecurityGroups, S3 buckets +
 * public-access-block, RDS instances. Returns a snapshot in the same shape
 * as the preview scanner so the rest of the pipeline doesn't branch.
 *
 * Hard rules:
 *  - Read-only. No `Run*`, `Create*`, `Modify*`, `Delete*`, or `Put*` calls.
 *  - Every call has a per-call timeout (default 8 s) and is wrapped in
 *    try/catch — partial inventory is preferred over total failure.
 *  - Permission errors record a typed `limitation` instead of throwing.
 *  - No raw AWS data is logged. Errors redact ARNs.
 *  - Single-region today (the region from the connection input). Multi-
 *    region expansion comes next once we have a happy single-region path.
 *
 * Server-only.
 */

import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";
import { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";

import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId, SnapshotId } from "@/lib/domain/ids";
import { id } from "@/lib/domain/ids";
import type { PreviewSnapshot, PreviewFinding, PreviewRecommendation, PreviewScanOutcome } from "./awsPreviewScanner";

// Broaden the source tag on snapshot/finding/recommendation so this module
// can emit live values alongside preview without breaking callers.
export type AwsLiveSourceTag = "live" | "partial" | "preview";

export interface AwsLiveInventoryInput {
  organizationId: OrganizationId;
  roleArn: string;
  externalId: string;
  region: string;
  /** Default 8000ms per AWS call. */
  perCallTimeoutMs?: number;
}

export interface AwsLiveInventoryResult extends PreviewScanOutcome {
  source: AwsLiveSourceTag;
  /** Permission gaps + skipped calls — UI surfaces these honestly. */
  limitations: string[];
  /** Account id returned by GetCallerIdentity (or undefined if STS failed). */
  accountId?: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export async function runLiveAwsInventory(input: AwsLiveInventoryInput): Promise<AwsLiveInventoryResult> {
  const env = loadAppEnv();
  const start = Date.now();
  const limitations: string[] = [];

  if (!env.awsBrokerConfigured) {
    return emptyOutcome(input, start, ["AWS broker credentials are not configured — cannot perform live read."]);
  }
  if (env.awsScanMode !== "live") {
    return emptyOutcome(input, start, [`AWS scan mode is ${env.awsScanMode}, not "live".`]);
  }

  // 1) Assume the customer role.
  const broker = new STSClient({
    region: input.region,
    credentials: {
      accessKeyId: process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY!,
    },
  });
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;
  let sessionToken: string | undefined;
  try {
    const assumed = await withTimeout(
      broker.send(new AssumeRoleCommand({
        RoleArn: input.roleArn,
        RoleSessionName: `axiom-inventory-${Date.now()}`,
        ExternalId: input.externalId,
        DurationSeconds: 900,
      })),
      input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      "sts.assume_role",
    );
    accessKeyId = assumed.Credentials?.AccessKeyId;
    secretAccessKey = assumed.Credentials?.SecretAccessKey;
    sessionToken = assumed.Credentials?.SessionToken;
  } catch (err) {
    return emptyOutcome(input, start, [`AssumeRole failed: ${redact(errMessage(err))}`]);
  }

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    return emptyOutcome(input, start, ["AssumeRole returned no credentials."]);
  }

  const credentials = { accessKeyId, secretAccessKey, sessionToken };
  const ec2 = new EC2Client({ region: input.region, credentials });
  const s3 = new S3Client({ region: input.region, credentials });
  const rds = new RDSClient({ region: input.region, credentials });

  const snapshotId = id.snapshot(`snp_live_${Date.now().toString(36)}`);
  const resources: PreviewSnapshot["resources"] = [];
  const findings: PreviewFinding[] = [];
  const recommendations: PreviewRecommendation[] = [];

  // 2) EC2 instances
  let ec2Count = 0;
  try {
    const out = await withTimeout(ec2.send(new DescribeInstancesCommand({ MaxResults: 100 })), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "ec2.describe_instances");
    for (const reservation of out.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        if (!instance.InstanceId) continue;
        ec2Count += 1;
        resources.push({
          id: instance.InstanceId,
          kind: "ec2",
          region: input.region,
          tag: instance.Tags?.find((t) => t.Key === "Name")?.Value,
        });
      }
    }
  } catch (err) {
    limitations.push(`EC2 DescribeInstances failed: ${classify(err)}.`);
  }

  // 3) VPCs
  let vpcCount = 0;
  try {
    const out = await withTimeout(ec2.send(new DescribeVpcsCommand({})), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "ec2.describe_vpcs");
    for (const vpc of out.Vpcs ?? []) {
      if (!vpc.VpcId) continue;
      vpcCount += 1;
      resources.push({ id: vpc.VpcId, kind: "vpc", region: input.region });
    }
  } catch (err) {
    limitations.push(`EC2 DescribeVpcs failed: ${classify(err)}.`);
  }

  // 4) Security groups — produce findings for any 0.0.0.0/0 ingress
  try {
    const out = await withTimeout(ec2.send(new DescribeSecurityGroupsCommand({ MaxResults: 200 })), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "ec2.describe_security_groups");
    for (const sg of out.SecurityGroups ?? []) {
      if (!sg.GroupId) continue;
      const openIngress = (sg.IpPermissions ?? []).find((p) =>
        (p.IpRanges ?? []).some((r) => r.CidrIp === "0.0.0.0/0"),
      );
      if (openIngress) {
        const port = openIngress.FromPort ?? -1;
        const sev: PreviewFinding["risk"] = port === 22 || port === 3389 ? "high" : "medium";
        findings.push({
          id: `find_sg_open_${sg.GroupId}`,
          snapshotId,
          ruleCode: port === 22 ? "ec2.sg_ssh_any" : port === 3389 ? "ec2.sg_rdp_any" : "ec2.sg_public",
          title: `Security group ${sg.GroupId} open to 0.0.0.0/0`,
          description: `Inbound ${openIngress.IpProtocol ?? "all"}/${port} open to the world.`,
          risk: sev,
          resourceRef: sg.GroupId,
          source: "live",
        });
        recommendations.push({
          id: `rec_sg_open_${sg.GroupId}`,
          findingId: `find_sg_open_${sg.GroupId}`,
          title: `Restrict ingress on ${sg.GroupId}`,
          description: "Limit the ingress rule to the bastion CIDR or an internal security group.",
          actionClass: "security_remediation",
          source: "live",
        });
      }
    }
  } catch (err) {
    limitations.push(`EC2 DescribeSecurityGroups failed: ${classify(err)}.`);
  }

  // 5) S3 buckets + public-access block (best-effort)
  let s3Count = 0;
  try {
    const buckets = await withTimeout(s3.send(new ListBucketsCommand({})), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "s3.list_buckets");
    for (const b of buckets.Buckets ?? []) {
      if (!b.Name) continue;
      s3Count += 1;
      resources.push({ id: b.Name, kind: "s3", region: input.region });

      try {
        const pab = await withTimeout(s3.send(new GetPublicAccessBlockCommand({ Bucket: b.Name })), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "s3.get_pab");
        const cfg = pab.PublicAccessBlockConfiguration;
        const allBlocked = Boolean(
          cfg?.BlockPublicAcls && cfg?.BlockPublicPolicy && cfg?.IgnorePublicAcls && cfg?.RestrictPublicBuckets,
        );
        if (!allBlocked) {
          findings.push({
            id: `find_s3_pab_${b.Name}`,
            snapshotId,
            ruleCode: "s3.public_access_block_incomplete",
            title: `S3 bucket ${b.Name} not fully blocked from public access`,
            description: "BlockPublicAcls / BlockPublicPolicy / IgnorePublicAcls / RestrictPublicBuckets are not all true.",
            risk: "high",
            resourceRef: b.Name,
            source: "live",
          });
          recommendations.push({
            id: `rec_s3_pab_${b.Name}`,
            findingId: `find_s3_pab_${b.Name}`,
            title: `Enable full public access block on ${b.Name}`,
            description: "Set every PublicAccessBlock flag to true unless explicit public hosting is required.",
            actionClass: "security_remediation",
            source: "live",
          });
        }
      } catch (err) {
        // 404 NoSuchPublicAccessBlockConfiguration → bucket has no block at all.
        if (errCode(err) === "NoSuchPublicAccessBlockConfiguration") {
          findings.push({
            id: `find_s3_pab_${b.Name}`,
            snapshotId,
            ruleCode: "s3.public_access_block_missing",
            title: `S3 bucket ${b.Name} has no public-access block configured`,
            description: "No PublicAccessBlockConfiguration exists for this bucket.",
            risk: "high",
            resourceRef: b.Name,
            source: "live",
          });
          recommendations.push({
            id: `rec_s3_pab_${b.Name}`,
            findingId: `find_s3_pab_${b.Name}`,
            title: `Apply public-access block to ${b.Name}`,
            description: "Apply a PublicAccessBlockConfiguration with all four flags = true.",
            actionClass: "security_remediation",
            source: "live",
          });
        } else if (errCode(err) === "AccessDenied") {
          limitations.push(`S3 GetPublicAccessBlock denied on ${b.Name}.`);
        }
      }
    }
  } catch (err) {
    limitations.push(`S3 ListBuckets failed: ${classify(err)}.`);
  }

  // 6) RDS
  let rdsCount = 0;
  try {
    const out = await withTimeout(rds.send(new DescribeDBInstancesCommand({})), input.perCallTimeoutMs ?? DEFAULT_TIMEOUT_MS, "rds.describe_db_instances");
    for (const db of out.DBInstances ?? []) {
      if (!db.DBInstanceIdentifier) continue;
      rdsCount += 1;
      resources.push({ id: db.DBInstanceIdentifier, kind: "rds", region: input.region });
      if (db.PubliclyAccessible) {
        findings.push({
          id: `find_rds_public_${db.DBInstanceIdentifier}`,
          snapshotId,
          ruleCode: "rds.publicly_accessible",
          title: `RDS instance ${db.DBInstanceIdentifier} is publicly accessible`,
          description: "Public network exposure on a primary RDS instance is a common breach vector.",
          risk: "critical",
          resourceRef: db.DBInstanceIdentifier,
          source: "live",
        });
        recommendations.push({
          id: `rec_rds_public_${db.DBInstanceIdentifier}`,
          findingId: `find_rds_public_${db.DBInstanceIdentifier}`,
          title: `Disable public accessibility on ${db.DBInstanceIdentifier}`,
          description: "Set PubliclyAccessible=false and route via the VPC.",
          actionClass: "security_remediation",
          source: "live",
        });
      }
    }
  } catch (err) {
    limitations.push(`RDS DescribeDBInstances failed: ${classify(err)}.`);
  }

  const snapshot: PreviewSnapshot & { source: AwsLiveSourceTag } = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "aws",
    region: input.region,
    generatedAt: new Date().toISOString(),
    source: limitations.length === 0 ? "live" : "partial",
    resourceCounts: {
      ec2: ec2Count,
      s3: s3Count,
      rds: rdsCount,
      iamRoles: 0, // IAM call deferred — needs additional permissions
      vpcs: vpcCount,
    },
    resources,
  } as PreviewSnapshot & { source: AwsLiveSourceTag };

  return {
    snapshot: snapshot as PreviewSnapshot,
    findings,
    recommendations,
    durationMs: Date.now() - start,
    source: snapshot.source,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyOutcome(input: AwsLiveInventoryInput, start: number, limitations: string[]): AwsLiveInventoryResult {
  const snapshotId = id.snapshot(`snp_live_empty_${Date.now().toString(36)}`);
  const empty: PreviewSnapshot = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "aws",
    region: input.region,
    generatedAt: new Date().toISOString(),
    source: "preview" as const, // honest — we couldn't see anything
    resourceCounts: { ec2: 0, s3: 0, rds: 0, iamRoles: 0, vpcs: 0 },
    resources: [],
  };
  return {
    snapshot: empty,
    findings: [],
    recommendations: [],
    durationMs: Date.now() - start,
    source: "partial",
    limitations,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "name" in err) return String((err as { name?: string }).name);
  if (err && typeof err === "object" && "Code" in err) return String((err as { Code?: string }).Code);
  return undefined;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function classify(err: unknown): string {
  const code = errCode(err);
  if (code === "AccessDenied" || code === "UnauthorizedOperation") return "permission denied";
  if (code === "Throttling" || code === "RequestLimitExceeded") return "throttled";
  if (code === "ExpiredToken") return "expired credentials";
  return code ?? "error";
}

function redact(s: string): string {
  return s
    .replace(/arn:aws[a-zA-Z-]*:[a-z0-9-]+::\d+:[A-Za-z0-9/_-]+/g, "arn:aws:***")
    .replace(/AKIA[0-9A-Z]{16}/g, "AKIA***")
    .replace(/ASIA[0-9A-Z]{16}/g, "ASIA***");
}

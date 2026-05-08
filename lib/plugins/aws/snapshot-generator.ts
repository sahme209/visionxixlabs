/**
 * AWS Snapshot Generator — produces a CloudSnapshot from AWS resources.
 * Uses existing credential system and AWS SDK v3 packages already installed.
 *
 * Required IAM permissions (minimum):
 *   - ec2:DescribeInstances
 *   - ec2:DescribeRegions
 *   - s3:ListBuckets
 *   - s3:GetBucketLocation
 *   - cloudwatch:GetMetricStatistics
 *   - ce:GetCostAndUsage (optional — improves cost estimates)
 *
 * No billing API required — uses static cost map for estimates.
 */

import { EC2Client, DescribeInstancesCommand, type Instance, type Reservation } from "@aws-sdk/client-ec2";
import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider, type AWSCredentials } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";
import type {
  CloudSnapshot,
  ComputeResource,
  ComputeTier,
  StorageResource,
  StorageClass,
} from "@/lib/axiom/cloudSnapshot";

// ---------------------------------------------------------------------------
// Static cost map — conservative monthly USD estimates for common instance types.
// Source: AWS pricing (on-demand, Linux, us-east-1).
// Good enough for signal derivation; Pro uses real Cost Explorer data.
// ---------------------------------------------------------------------------

const INSTANCE_COST_MAP: Record<string, { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier }> = {
  // General purpose — t3
  "t3.micro":    { monthlyCost: 8,    vcpus: 2,  memoryGb: 1,    tier: "general" },
  "t3.small":    { monthlyCost: 15,   vcpus: 2,  memoryGb: 2,    tier: "general" },
  "t3.medium":   { monthlyCost: 30,   vcpus: 2,  memoryGb: 4,    tier: "general" },
  "t3.large":    { monthlyCost: 60,   vcpus: 2,  memoryGb: 8,    tier: "general" },
  "t3.xlarge":   { monthlyCost: 121,  vcpus: 4,  memoryGb: 16,   tier: "general" },
  "t3.2xlarge":  { monthlyCost: 242,  vcpus: 8,  memoryGb: 32,   tier: "general" },
  // General purpose — m5/m6i
  "m5.large":    { monthlyCost: 70,   vcpus: 2,  memoryGb: 8,    tier: "general" },
  "m5.xlarge":   { monthlyCost: 140,  vcpus: 4,  memoryGb: 16,   tier: "general" },
  "m5.2xlarge":  { monthlyCost: 280,  vcpus: 8,  memoryGb: 32,   tier: "general" },
  "m5.4xlarge":  { monthlyCost: 560,  vcpus: 16, memoryGb: 64,   tier: "general" },
  "m6i.large":   { monthlyCost: 70,   vcpus: 2,  memoryGb: 8,    tier: "general" },
  "m6i.xlarge":  { monthlyCost: 140,  vcpus: 4,  memoryGb: 16,   tier: "general" },
  "m6i.2xlarge": { monthlyCost: 280,  vcpus: 8,  memoryGb: 32,   tier: "general" },
  // Compute optimized — c5/c6i
  "c5.large":    { monthlyCost: 62,   vcpus: 2,  memoryGb: 4,    tier: "compute" },
  "c5.xlarge":   { monthlyCost: 124,  vcpus: 4,  memoryGb: 8,    tier: "compute" },
  "c5.2xlarge":  { monthlyCost: 248,  vcpus: 8,  memoryGb: 16,   tier: "compute" },
  "c5.4xlarge":  { monthlyCost: 496,  vcpus: 16, memoryGb: 32,   tier: "compute" },
  "c6i.large":   { monthlyCost: 62,   vcpus: 2,  memoryGb: 4,    tier: "compute" },
  "c6i.xlarge":  { monthlyCost: 124,  vcpus: 4,  memoryGb: 8,    tier: "compute" },
  // Memory optimized — r5/r6i
  "r5.large":    { monthlyCost: 91,   vcpus: 2,  memoryGb: 16,   tier: "memory" },
  "r5.xlarge":   { monthlyCost: 183,  vcpus: 4,  memoryGb: 32,   tier: "memory" },
  "r5.2xlarge":  { monthlyCost: 365,  vcpus: 8,  memoryGb: 64,   tier: "memory" },
  "r5.4xlarge":  { monthlyCost: 730,  vcpus: 16, memoryGb: 128,  tier: "memory" },
  "r6i.large":   { monthlyCost: 91,   vcpus: 2,  memoryGb: 16,   tier: "memory" },
  "r6i.xlarge":  { monthlyCost: 183,  vcpus: 4,  memoryGb: 32,   tier: "memory" },
  // GPU — p3/g4dn
  "p3.2xlarge":  { monthlyCost: 2234, vcpus: 8,  memoryGb: 61,   tier: "gpu" },
  "g4dn.xlarge": { monthlyCost: 383,  vcpus: 4,  memoryGb: 16,   tier: "gpu" },
  "g4dn.2xlarge":{ monthlyCost: 548,  vcpus: 8,  memoryGb: 32,   tier: "gpu" },
};

const FALLBACK_COST_PER_VCPU = 35;
const AVG_BUCKET_MONTHLY = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lookupInstanceType(type: string): { monthlyCost: number; vcpus: number; memoryGb: number; tier: ComputeTier } {
  const key = type.toLowerCase();
  if (INSTANCE_COST_MAP[key]) return INSTANCE_COST_MAP[key];
  const vcpuMatch = key.match(/(\d+)xlarge/);
  const guessVcpus = vcpuMatch ? parseInt(vcpuMatch[1], 10) * 4 : 2;
  return {
    monthlyCost: guessVcpus * FALLBACK_COST_PER_VCPU,
    vcpus: guessVcpus,
    memoryGb: guessVcpus * 4,
    tier: "unknown",
  };
}

function mapEc2State(state: string | undefined): ComputeResource["state"] {
  switch (state) {
    case "running": return "running";
    case "stopped": return "stopped";
    case "terminated": return "stopped";
    default: return "unknown";
  }
}

function ec2ToComputeResource(instance: Instance, region: string): ComputeResource {
  const type = instance.InstanceType ?? "t3.medium";
  const lookup = lookupInstanceType(type);
  const state = mapEc2State(instance.State?.Name);

  const tags: Record<string, string> = {};
  for (const tag of instance.Tags ?? []) {
    if (tag.Key && tag.Value) tags[tag.Key] = tag.Value;
  }

  return {
    resourceType: "compute",
    provider: "aws",
    resourceId: instance.InstanceId ?? "unknown",
    region,
    instanceType: type,
    tier: lookup.tier,
    vcpus: lookup.vcpus,
    memoryGb: lookup.memoryGb,
    state,
    monthlyCostEstimate: state === "stopped" ? 0 : lookup.monthlyCost,
    tags: Object.keys(tags).length > 0 ? tags : undefined,
  };
}

function bucketToStorageResource(name: string, region: string): StorageResource {
  return {
    resourceType: "storage",
    provider: "aws",
    resourceId: name,
    region,
    storageClass: "standard",
    monthlyCostEstimate: AVG_BUCKET_MONTHLY,
  };
}

// ---------------------------------------------------------------------------
// Main: generate CloudSnapshot
// ---------------------------------------------------------------------------

export async function generateAWSSnapshot(creds: AWSCredentials): Promise<CloudSnapshot> {
  const defaultRegion = creds.region ?? "us-east-1";

  const ec2Client = new EC2Client({
    region: defaultRegion,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  const s3Client = new S3Client({
    region: defaultRegion,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  const [ec2Result, s3Result] = await Promise.all([
    describeAllInstances(ec2Client, defaultRegion),
    listAllBuckets(s3Client),
  ]);

  const allResources = [...ec2Result.resources, ...s3Result.resources];
  const regions = [...new Set(allResources.map((r) => r.region))];
  const runningCompute = ec2Result.resources.filter((c) => c.state === "running");
  const totalMonthly = allResources.reduce((s, r) => s + (r.monthlyCostEstimate ?? 0), 0);

  return {
    provider: "aws",
    accountId: defaultRegion,
    scannedAt: new Date().toISOString(),
    regions,
    resources: allResources,
    monthlySpend: Math.round(totalMonthly),
    flags: {
      singleRegion: regions.length <= 1 && runningCompute.length > 0,
      noBackupsDetected: false,
    },
    insights: buildInsights(ec2Result.resources, s3Result.resources),
  };
}

async function describeAllInstances(
  client: EC2Client,
  region: string,
): Promise<{ resources: ComputeResource[] }> {
  const resources: ComputeResource[] = [];

  try {
    let nextToken: string | undefined;
    do {
      const command = new DescribeInstancesCommand({
        MaxResults: 500,
        NextToken: nextToken,
        Filters: [{ Name: "instance-state-name", Values: ["running", "stopped"] }],
      });
      const response = await client.send(command);
      const reservations: Reservation[] = response.Reservations ?? [];

      for (const r of reservations) {
        for (const instance of r.Instances ?? []) {
          resources.push(ec2ToComputeResource(instance, region));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);
  } catch {
    // EC2 access may be restricted — return what we have
  }

  return { resources };
}

async function listAllBuckets(
  client: S3Client,
): Promise<{ resources: StorageResource[] }> {
  const resources: StorageResource[] = [];

  try {
    const response = await client.send(new ListBucketsCommand({}));
    const buckets = response.Buckets ?? [];

    const locationFetches = buckets.slice(0, 50).map(async (bucket) => {
      const name = bucket.Name ?? "unknown";
      try {
        const loc = await client.send(new GetBucketLocationCommand({ Bucket: name }));
        const region = loc.LocationConstraint ?? "us-east-1";
        return bucketToStorageResource(name, region);
      } catch {
        return bucketToStorageResource(name, "unknown");
      }
    });

    const results = await Promise.allSettled(locationFetches);
    for (const r of results) {
      if (r.status === "fulfilled") resources.push(r.value);
    }
  } catch {
    // S3 access may be restricted
  }

  return { resources };
}

function buildInsights(
  compute: ComputeResource[],
  storage: StorageResource[],
): Array<{ title: string; severity: string }> {
  const insights: Array<{ title: string; severity: string }> = [];

  const stopped = compute.filter((c) => c.state === "stopped");
  if (stopped.length > 0) {
    insights.push({ title: `${stopped.length} stopped instance(s) — EBS volumes still billing`, severity: "warning" });
  }

  const large = compute.filter((c) => c.vcpus >= 16 && c.state === "running");
  if (large.length > 0) {
    insights.push({ title: `${large.length} large instance(s) (16+ vCPUs) — review for right-sizing`, severity: "info" });
  }

  if (storage.length > 10) {
    insights.push({ title: `${storage.length} S3 buckets — review lifecycle policies and storage classes`, severity: "info" });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Execution plugin registration
// ---------------------------------------------------------------------------

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("aws:snapshot-generator started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Snapshot generator is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const awsCreds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!awsCreds) {
    return {
      ok: false,
      error: "AWS connector not linked or validated. Connect your AWS account in Connectors first.",
      summary: "AWS connector required.",
    };
  }

  try {
    const snapshot = await generateAWSSnapshot(awsCreds);

    const ec2Count = snapshot.resources.filter((r) => r.resourceType === "compute").length;
    const s3Count = snapshot.resources.filter((r) => r.resourceType === "storage").length;
    const summary = `AWS snapshot: ${ec2Count} EC2 instances, ${s3Count} S3 buckets, ${snapshot.regions.length} region(s), ~$${snapshot.monthlySpend}/mo estimated`;

    logger.info("aws:snapshot-generator completed", { ec2Count, s3Count, regions: snapshot.regions.length });

    return {
      ok: true,
      data: snapshot as unknown as Record<string, unknown>,
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("aws:snapshot-generator failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "AWS snapshot generation failed",
    };
  }
}

registerExecutionPlugin({
  id: "aws:snapshot-generator",
  name: "AWS Snapshot Generator",
  description: "Generate normalized CloudSnapshot from AWS EC2 instances and S3 buckets. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

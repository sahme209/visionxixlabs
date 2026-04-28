import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { getCredentialProvider } from "@/lib/plugins/credentials";
import { EC2Client, DescribeInstancesCommand, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export interface AWSInsight {
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  impact: string;
  actions: string[];
}

export interface ServiceScanResult {
  success: boolean;
  count: number;
  error?: string;
}

export interface AWSSnapshot {
  accountId: string;
  callerArn: string;
  regions: string[];
  ec2InstanceCount: number;
  s3BucketCount: number;
  ec2: ServiceScanResult;
  s3: ServiceScanResult;
  flags: {
    singleRegion: boolean;
    noBackupsDetected: boolean;
  };
  insights: AWSInsight[];
  scannedAt: string;
}

function deriveInsights(snapshot: {
  regions: string[];
  ec2InstanceCount: number;
  s3BucketCount: number;
}): AWSInsight[] {
  const insights: AWSInsight[] = [];

  if (snapshot.regions.length <= 1) {
    insights.push({
      title: "Single-Region Risk",
      message:
        "All your infrastructure runs in one AWS region. If that region has an outage, your entire application goes down.",
      severity: "high",
      impact: "A single AWS region outage means complete downtime for all your users until the region recovers.",
      actions: [
        "Launch a copy of your critical workloads in a second region (e.g. us-west-2)",
        "Set up Route 53 health checks with DNS failover between regions",
      ],
    });
  } else if (snapshot.regions.length >= 2 && snapshot.ec2InstanceCount > 0) {
    insights.push({
      title: "Multi-Region — Verify Failover",
      message: `You have ${snapshot.regions.length} regions enabled, but that alone doesn't mean failover works.`,
      severity: "medium",
      impact: "If failover isn't tested, you'll discover it doesn't work during the actual outage — when it's too late.",
      actions: [
        "Test that traffic actually shifts if one region goes down",
        "Confirm your load balancer or DNS is configured for automatic failover",
      ],
    });
  }

  if (snapshot.ec2InstanceCount > 0 && snapshot.s3BucketCount === 0) {
    insights.push({
      title: "No Backup Storage Detected",
      message:
        "You have EC2 instances but no S3 buckets. If an instance fails, data on its local disk is gone.",
      severity: "high",
      impact: "A terminated or failed instance means permanent data loss with no way to recover.",
      actions: [
        "Create an S3 bucket and set up automated backups for your instances",
        "Enable EBS snapshots on a daily schedule for each volume",
      ],
    });
  }

  if (snapshot.ec2InstanceCount === 0 && snapshot.s3BucketCount === 0) {
    insights.push({
      title: "Empty Account",
      message:
        "No EC2 instances or S3 buckets found in the home region. This account may be new or resources may live in a different region.",
      severity: "low",
      impact: "No immediate risk — but if resources exist in other regions, they aren't being monitored here.",
      actions: [
        "Check other regions in the AWS console to see if resources exist there",
      ],
    });
  }

  if (snapshot.ec2InstanceCount >= 20 && snapshot.regions.length <= 1) {
    insights.push({
      title: "Large Fleet, No Redundancy",
      message: `You have ${snapshot.ec2InstanceCount} instances in a single region. A regional outage takes everything down.`,
      severity: "high",
      impact: `All ${snapshot.ec2InstanceCount} instances go offline at once — at this scale, recovery takes hours, not minutes.`,
      actions: [
        "Spread instances across at least two regions using an Auto Scaling group per region",
        "Put a Global Accelerator or Route 53 failover in front of both regions",
      ],
    });
  }

  if (snapshot.s3BucketCount >= 50) {
    insights.push({
      title: "S3 Bucket Sprawl",
      message: `${snapshot.s3BucketCount} buckets detected. Unused buckets add cost and increase attack surface.`,
      severity: "medium",
      impact: "Forgotten buckets with public access or stale data are a common source of security incidents and surprise bills.",
      actions: [
        "Audit buckets and delete any that are empty or no longer used",
        "Enable S3 Intelligent-Tiering on remaining buckets to cut storage costs",
      ],
    });
  }

  return insights.slice(0, 3);
}

/**
 * GET /api/cloud-operator/aws-snapshot?token=XXX
 *
 * Runs a minimal real AWS read-only scan using the user's linked credentials.
 * Returns live infrastructure counts — proves we can actually read their AWS.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
    const aws = connectors.aws;
    if (!aws || aws.status !== "linked") {
      return NextResponse.json({ error: "AWS not connected" }, { status: 400 });
    }

    const creds = await getCredentialProvider().getAWSCredentials(
      result.leadId,
      result.leadId
    );
    if (!creds) {
      return NextResponse.json(
        { error: "Could not assume role. Check that the IAM role still exists and the trust policy is correct." },
        { status: 502 }
      );
    }

    const credConfig = {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
    const region = creds.region || "us-east-1";

    // 1. STS: GetCallerIdentity — prove we're in their account
    const sts = new STSClient({ region, credentials: credConfig });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account ?? "unknown";
    const callerArn = identity.Arn ?? "unknown";

    // 2. EC2: DescribeRegions — find which regions have opt-in enabled
    const ec2 = new EC2Client({ region, credentials: credConfig });
    let regionNames: string[] = [];
    try {
      const regionsResult = await ec2.send(new DescribeRegionsCommand({ AllRegions: false }));
      regionNames = (regionsResult.Regions ?? [])
        .map((r) => r.RegionName)
        .filter((n): n is string => !!n);
    } catch {
      regionNames = [region];
    }

    // 3. EC2: DescribeInstances — count running/stopped instances in home region
    let ec2InstanceCount = 0;
    let ec2Result: ServiceScanResult = { success: false, count: 0, error: "Not attempted" };
    try {
      const instances = await ec2.send(new DescribeInstancesCommand({ MaxResults: 500 }));
      for (const reservation of instances.Reservations ?? []) {
        ec2InstanceCount += (reservation.Instances ?? []).length;
      }
      ec2Result = { success: true, count: ec2InstanceCount };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      console.warn("[aws-snapshot] DescribeInstances failed:", err.name);
      ec2Result = { success: false, count: 0, error: `Missing permission: ec2:DescribeInstances (${err.name ?? "unknown"})` };
    }

    // 4. S3: ListBuckets — count buckets (global, not regional)
    let s3BucketCount = 0;
    let s3Result: ServiceScanResult = { success: false, count: 0, error: "Not attempted" };
    try {
      const s3 = new S3Client({ region, credentials: credConfig });
      const buckets = await s3.send(new ListBucketsCommand({}));
      s3BucketCount = (buckets.Buckets ?? []).length;
      s3Result = { success: true, count: s3BucketCount };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      console.warn("[aws-snapshot] ListBuckets failed:", err.name);
      s3Result = { success: false, count: 0, error: `Missing permission: s3:ListAllMyBuckets (${err.name ?? "unknown"})` };
    }

    // 5. Compute simple risk flags + insights
    const usedRegions = regionNames.length > 0 ? regionNames : [region];
    const singleRegion = usedRegions.length <= 1;
    const noBackupsDetected = ec2InstanceCount > 0 && s3BucketCount === 0;

    const insights = deriveInsights({ regions: usedRegions, ec2InstanceCount, s3BucketCount });

    const snapshot: AWSSnapshot = {
      accountId,
      callerArn,
      regions: usedRegions,
      ec2InstanceCount,
      s3BucketCount,
      ec2: ec2Result,
      s3: s3Result,
      flags: {
        singleRegion,
        noBackupsDetected,
      },
      insights,
      scannedAt: new Date().toISOString(),
    };

    // 6. Store snapshot on the lead
    const updatedPayload = { ...payload, awsSnapshot: snapshot } as Record<string, unknown>;
    await prisma.lead.update({
      where: { id: result.leadId },
      data: { fullPayload: updatedPayload as Parameters<typeof prisma.lead.update>[0]["data"]["fullPayload"] },
    });

    return NextResponse.json(snapshot);
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const code = err?.name ?? "UNKNOWN";
    const msg = (err?.message ?? "").replace(
      /\b(AKIA[A-Z0-9]{16}|[A-Za-z0-9/+=]{40})\b/g,
      "[REDACTED]"
    );
    console.error("[aws-snapshot]", code, msg);
    return NextResponse.json(
      { error: `AWS scan failed: ${code}` },
      { status: 502 }
    );
  }
}

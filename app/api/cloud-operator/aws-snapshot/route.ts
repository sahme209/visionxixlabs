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
}

export interface AWSSnapshot {
  accountId: string;
  callerArn: string;
  regions: string[];
  ec2InstanceCount: number;
  s3BucketCount: number;
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
        "All your infrastructure runs in one AWS region. If that region has an outage, your entire application goes down. Deploy critical workloads across at least two regions.",
      severity: "high",
    });
  } else if (snapshot.regions.length >= 2 && snapshot.ec2InstanceCount > 0) {
    insights.push({
      title: "Multi-Region — Verify Failover",
      message: `You have ${snapshot.regions.length} regions enabled, but that alone doesn't mean failover works. Confirm you have load balancing or DNS failover configured between regions.`,
      severity: "medium",
    });
  }

  if (snapshot.ec2InstanceCount > 0 && snapshot.s3BucketCount === 0) {
    insights.push({
      title: "No Backup Storage Detected",
      message:
        "You have EC2 instances but no S3 buckets. This often means no off-instance backups. If an instance fails, data on its local disk is gone. Set up S3 or EBS snapshots.",
      severity: "high",
    });
  }

  if (snapshot.ec2InstanceCount === 0 && snapshot.s3BucketCount === 0) {
    insights.push({
      title: "Empty Account",
      message:
        "No EC2 instances or S3 buckets found in the home region. This account may be new, unused, or resources may live in a different region.",
      severity: "low",
    });
  }

  if (snapshot.ec2InstanceCount >= 20 && snapshot.regions.length <= 1) {
    insights.push({
      title: "Large Fleet, No Redundancy",
      message: `You have ${snapshot.ec2InstanceCount} instances in a single region. At this scale, a regional outage has significant blast radius. Distribute workloads across regions.`,
      severity: "high",
    });
  }

  if (snapshot.s3BucketCount >= 50) {
    insights.push({
      title: "S3 Bucket Sprawl",
      message: `${snapshot.s3BucketCount} buckets detected. Review whether all are still needed — unused buckets can accumulate cost and increase attack surface.`,
      severity: "medium",
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
    try {
      const instances = await ec2.send(new DescribeInstancesCommand({ MaxResults: 500 }));
      for (const reservation of instances.Reservations ?? []) {
        ec2InstanceCount += (reservation.Instances ?? []).length;
      }
    } catch {
      // ReadOnlyAccess may not include ec2:DescribeInstances in some cases
    }

    // 4. S3: ListBuckets — count buckets (global, not regional)
    let s3BucketCount = 0;
    try {
      const s3 = new S3Client({ region, credentials: credConfig });
      const buckets = await s3.send(new ListBucketsCommand({}));
      s3BucketCount = (buckets.Buckets ?? []).length;
    } catch {
      // May fail if S3 permissions missing
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

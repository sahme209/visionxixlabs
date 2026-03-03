/**
 * AWS Infrastructure Discovery — read-only inventory.
 * Uses AWS SDK v3: EC2, S3, RDS, VPC.
 * Collects counts and service summaries, saves to ExecutionLog.
 */

import { EC2Client, DescribeInstancesCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

export type InfraDiscoveryResult = {
  ec2Count: number;
  s3Count: number;
  rdsCount: number;
  vpcCount: number;
  services: Array<{
    type: "ec2" | "s3" | "rds" | "vpc";
    count: number;
    region?: string;
  }>;
};

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("infrastructure-discovery started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Infrastructure discovery is read-only and must run with dryRun=true.",
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

  const sharedConfig = {
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  };

  let ec2Count = 0;
  let s3Count = 0;
  let rdsCount = 0;
  let vpcCount = 0;

  try {
    const ec2 = new EC2Client(sharedConfig);
    const s3 = new S3Client(sharedConfig);
    const rds = new RDSClient(sharedConfig);

    const [ec2Res, s3Res, rdsRes, vpcRes] = await Promise.all([
      ec2.send(new DescribeInstancesCommand({})),
      s3.send(new ListBucketsCommand({})),
      rds.send(new DescribeDBInstancesCommand({})),
      ec2.send(new DescribeVpcsCommand({})),
    ]);

    ec2Count =
      ec2Res.Reservations?.reduce(
        (sum, r) => sum + (r.Instances?.filter((i) => i.InstanceId).length ?? 0),
        0
      ) ?? 0;
    s3Count = s3Res.Buckets?.length ?? 0;
    rdsCount = rdsRes.DBInstances?.length ?? 0;
    vpcCount = vpcRes.Vpcs?.length ?? 0;

    const services = [
      { type: "ec2" as const, count: ec2Count, region },
      { type: "s3" as const, count: s3Count },
      { type: "rds" as const, count: rdsCount, region },
      { type: "vpc" as const, count: vpcCount, region },
    ];

    const summary = `EC2: ${ec2Count}, S3: ${s3Count}, RDS: ${rdsCount}, VPC: ${vpcCount}`;

    logger.info("infrastructure-discovery completed", {
      ec2Count,
      s3Count,
      rdsCount,
      vpcCount,
    });

    return {
      ok: true,
      data: {
        ec2Count,
        s3Count,
        rdsCount,
        vpcCount,
        services,
        summary,
        region,
      },
      summary,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("infrastructure-discovery failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Infrastructure discovery failed",
    };
  }
}

registerExecutionPlugin({
  id: "aws:infra-discovery",
  name: "AWS Infrastructure Discovery",
  description: "Discover EC2 instances, S3 buckets, RDS databases, and VPCs. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});

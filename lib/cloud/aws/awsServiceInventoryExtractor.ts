/**
 * AWS Service Inventory live extractor.
 *
 * One consolidated SDK traversal that pulls:
 *   - Lambda functions (ListFunctions)
 *   - RDS instances (DescribeDBInstances)
 *   - IAM users + roles + MFA + last-used (ListUsers + ListMFADevices
 *     + ListAttachedUserPolicies + ListRoles + GetRole for AssumeRolePolicy)
 *   - S3 buckets (ListBuckets + GetPublicAccessBlock +
 *     GetBucketEncryption)
 *
 * Each section runs in parallel. A failure in one section doesn't
 * cascade — the others still populate. Per-call timeout 8s.
 *
 * Hard rules:
 *   - Only runs when AWS mode = live + AWS_INVENTORY_EXTRACT_ENABLED.
 *   - Never modifies anything.
 *   - All counts are real or zero — never fabricated.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "./awsConfig";
import { resolveAwsCredentials } from "./awsCredentialResolver";
import {
  classifyLambdaRuntime,
  isDeprecatedLambdaRuntime,
  LAMBDA_RUNTIME_FAMILIES,
  type AcmCertificateSummary,
  type AcmStatus,
  type AwsServiceInventoryReport,
  type BackupVaultSummary,
  type CloudWatchLogGroupSummary,
  type Ec2InstanceSummary,
  type GuardDutyFindingSeverity,
  type GuardDutyFindingSummary,
  type IamRoleSummary,
  type IamUserSummary,
  type LambdaFunctionSummary,
  type LambdaRuntimeFamily,
  type LoadBalancerSummary,
  type PatchComplianceStatus,
  type RdsInstanceSummary,
  type S3BucketSummary,
  type SecretSummary,
  type SecurityGroupSummary,
  type SnsTopicSummary,
  type SqsQueueSummary,
  type SsmInstancePatchSummary,
  type VpcSummary,
} from "./awsServiceInventoryModel";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ITEMS = 100;

export interface BuildAwsServiceInventoryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildAwsServiceInventory(input: BuildAwsServiceInventoryInput): Promise<AwsServiceInventoryReport> {
  const env = loadAppEnv();
  const generatedAt = new Date().toISOString();
  const blank = emptyReport(generatedAt, String(input.tenantId));

  if (!env.awsInventoryExtractEnabled) {
    return withGlobalNote(blank, "AWS_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getAwsConfig();
  if (cfg.mode !== "live") {
    return withGlobalNote(blank, "AWS mode is not live — extractor returned honest preview.");
  }

  const resolved = await resolveAwsCredentials({ sessionLabel: "inventory" });
  if (resolved.mode !== "ok") {
    return withGlobalNote(blank, resolved.reason);
  }
  const { credentials, region } = resolved;
  blank.region = region;

  // ---------------------------------------------------------------------------
  // Run all 10 sections in parallel; each catches its own errors.
  // ---------------------------------------------------------------------------
  const [lambda, rds, iam, s3, ec2, network, loadBalancers, messaging, patchCompliance, logGroups, certificates, threats, secrets, backups] = await Promise.all([
    runLambda(credentials, region),
    runRds(credentials, region),
    runIam(credentials, region),
    runS3(credentials, region),
    runEc2(credentials, region),
    runNetwork(credentials, region),
    runLoadBalancers(credentials, region),
    runMessaging(credentials, region),
    runPatchCompliance(credentials, region),
    runLogGroups(credentials, region),
    runCertificates(credentials, region),
    runGuardDuty(credentials, region),
    runSecrets(credentials, region),
    runBackups(credentials, region),
  ]);

  blank.lambda = lambda;
  blank.rds = rds;
  blank.iam = iam;
  blank.s3 = s3;
  blank.ec2 = ec2;
  blank.network = network;
  blank.loadBalancers = loadBalancers;
  blank.messaging = messaging;
  blank.patchCompliance = patchCompliance;
  blank.logGroups = logGroups;
  blank.certificates = certificates;
  blank.threats = threats;
  blank.secrets = secrets;
  blank.backups = backups;

  const modes = [lambda.mode, rds.mode, iam.mode, s3.mode, ec2.mode, network.mode, loadBalancers.mode, messaging.mode, patchCompliance.mode, logGroups.mode, certificates.mode, threats.mode, secrets.mode, backups.mode];
  const anyLive = modes.some((m) => m === "live");
  blank.overallSourceMode = anyLive ? "live" : "preview";

  return blank;
}

// ---------------------------------------------------------------------------
// Per-service extractors
// ---------------------------------------------------------------------------

async function runLambda(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["lambda"]> {
  try {
    const { LambdaClient, ListFunctionsCommand } = await import("@aws-sdk/client-lambda");
    const c = new LambdaClient({ region, credentials });
    const res = await withTimeout(c.send(new ListFunctionsCommand({ MaxItems: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "lambda.list");
    const functions = (res.Functions ?? []).map((f): LambdaFunctionSummary => ({
      name: f.FunctionName ?? "unknown",
      runtime: f.Runtime ?? undefined,
      runtimeFamily: classifyLambdaRuntime(f.Runtime ?? undefined),
      memoryMb: f.MemorySize ?? undefined,
      timeoutSeconds: f.Timeout ?? undefined,
      lastModified: f.LastModified ?? undefined,
      deprecatedRuntime: isDeprecatedLambdaRuntime(f.Runtime ?? undefined),
      arn: f.FunctionArn ?? undefined,
    }));
    const runtimeBreakdown: Record<LambdaRuntimeFamily, number> = Object.fromEntries(LAMBDA_RUNTIME_FAMILIES.map((k) => [k, 0])) as Record<LambdaRuntimeFamily, number>;
    for (const f of functions) runtimeBreakdown[f.runtimeFamily]++;
    return {
      mode: "live",
      total: functions.length,
      deprecatedRuntimeCount: functions.filter((f) => f.deprecatedRuntime).length,
      runtimeBreakdown,
      functions,
      limitations: [],
    };
  } catch (err) {
    return blankLambda(`Lambda list failed: ${redact(errMessage(err))}`);
  }
}

async function runRds(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["rds"]> {
  try {
    const { RDSClient, DescribeDBInstancesCommand, DescribeDBSnapshotsCommand } = await import("@aws-sdk/client-rds");
    const c = new RDSClient({ region, credentials });
    const res = await withTimeout(c.send(new DescribeDBInstancesCommand({ MaxRecords: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "rds.list");

    // Pull recent snapshots once and lookup per instance.
    let snapshotsByIdentifier: Map<string, Date> = new Map();
    try {
      const snapsRes = await withTimeout(
        c.send(new DescribeDBSnapshotsCommand({ SnapshotType: "manual", MaxRecords: MAX_ITEMS })),
        DEFAULT_TIMEOUT_MS,
        "rds.snapshots",
      );
      for (const s of snapsRes.DBSnapshots ?? []) {
        const dbId = s.DBInstanceIdentifier ?? "";
        const when = s.SnapshotCreateTime ?? null;
        if (!dbId || !when) continue;
        const ts = new Date(when);
        const existing = snapshotsByIdentifier.get(dbId);
        if (!existing || ts > existing) snapshotsByIdentifier.set(dbId, ts);
      }
    } catch {
      // snapshot read is best-effort; absence means daysSinceLastSnapshot stays undefined
    }

    const instances = (res.DBInstances ?? []).map((i): RdsInstanceSummary => {
      const id = i.DBInstanceIdentifier ?? "unknown";
      const retention = i.BackupRetentionPeriod;
      const lastSnap = snapshotsByIdentifier.get(id);
      const daysSinceLastSnapshot = lastSnap
        ? Math.floor((Date.now() - lastSnap.getTime()) / 86_400_000)
        : undefined;
      return {
        identifier: id,
        engine: i.Engine ?? undefined,
        engineVersion: i.EngineVersion ?? undefined,
        instanceClass: i.DBInstanceClass ?? undefined,
        storageGb: i.AllocatedStorage ?? undefined,
        multiAz: !!i.MultiAZ,
        encrypted: !!i.StorageEncrypted,
        publiclyAccessible: !!i.PubliclyAccessible,
        status: i.DBInstanceStatus ?? undefined,
        endpoint: i.Endpoint?.Address ?? undefined,
        backupRetentionDays: retention,
        backupsDisabled: (retention ?? 0) === 0,
        deletionProtection: !!i.DeletionProtection,
        performanceInsightsEnabled: !!i.PerformanceInsightsEnabled,
        isReadReplica: !!i.ReadReplicaSourceDBInstanceIdentifier,
        readReplicaSourceArn: i.ReadReplicaSourceDBInstanceIdentifier ?? undefined,
        autoMinorVersionUpgrade: !!i.AutoMinorVersionUpgrade,
        daysSinceLastSnapshot,
      };
    });
    return {
      mode: "live",
      total: instances.length,
      unencryptedCount: instances.filter((i) => !i.encrypted).length,
      publiclyAccessibleCount: instances.filter((i) => i.publiclyAccessible).length,
      multiAzCount: instances.filter((i) => i.multiAz).length,
      backupsDisabledCount: instances.filter((i) => i.backupsDisabled).length,
      noDeletionProtectionCount: instances.filter((i) => !i.deletionProtection).length,
      noPerformanceInsightsCount: instances.filter((i) => !i.performanceInsightsEnabled).length,
      staleSnapshotCount: instances.filter((i) => i.daysSinceLastSnapshot !== undefined && i.daysSinceLastSnapshot > 30).length,
      instances,
      limitations: [],
    };
  } catch (err) {
    return blankRds(`RDS describe failed: ${redact(errMessage(err))}`);
  }
}

async function runIam(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  _region: string,
): Promise<AwsServiceInventoryReport["iam"]> {
  try {
    const { IAMClient, ListUsersCommand, ListRolesCommand, ListMFADevicesCommand, ListAttachedUserPoliciesCommand, ListAccessKeysCommand, GetRoleCommand } = await import("@aws-sdk/client-iam");
    const c = new IAMClient({ region: "us-east-1", credentials });
    const limitations: string[] = [];

    // Users
    const usersRes = await withTimeout(c.send(new ListUsersCommand({ MaxItems: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "iam.list_users");
    const rawUsers = usersRes.Users ?? [];
    const users: IamUserSummary[] = await Promise.all(rawUsers.slice(0, 50).map(async (u): Promise<IamUserSummary> => {
      const userName = u.UserName ?? "unknown";
      let mfaEnabled = false;
      let hasActiveAccessKey = false;
      let hasAdminLikePolicy = false;
      try {
        const mfa = await withTimeout(c.send(new ListMFADevicesCommand({ UserName: userName })), DEFAULT_TIMEOUT_MS, "iam.mfa");
        mfaEnabled = (mfa.MFADevices?.length ?? 0) > 0;
      } catch { /* skip */ }
      try {
        const keys = await withTimeout(c.send(new ListAccessKeysCommand({ UserName: userName })), DEFAULT_TIMEOUT_MS, "iam.keys");
        hasActiveAccessKey = (keys.AccessKeyMetadata ?? []).some((k) => k.Status === "Active");
      } catch { /* skip */ }
      try {
        const pols = await withTimeout(c.send(new ListAttachedUserPoliciesCommand({ UserName: userName })), DEFAULT_TIMEOUT_MS, "iam.policies");
        hasAdminLikePolicy = (pols.AttachedPolicies ?? []).some((p) => /AdministratorAccess|FullAccess|PowerUser/i.test(p.PolicyName ?? ""));
      } catch { /* skip */ }
      const lastUsed = u.PasswordLastUsed ? new Date(u.PasswordLastUsed) : undefined;
      const passwordLastUsedDaysAgo = lastUsed
        ? Math.floor((Date.now() - lastUsed.getTime()) / 86_400_000)
        : undefined;
      return {
        userName,
        arn: u.Arn ?? undefined,
        createDate: u.CreateDate ? new Date(u.CreateDate).toISOString() : undefined,
        passwordLastUsedDaysAgo,
        mfaEnabled,
        hasActiveAccessKey,
        hasAdminLikePolicy,
      };
    }));
    if (rawUsers.length > 50) limitations.push(`Capped at 50 users for IAM enrichment (total: ${rawUsers.length}).`);

    // Roles
    const rolesRes = await withTimeout(c.send(new ListRolesCommand({ MaxItems: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "iam.list_roles");
    const rawRoles = rolesRes.Roles ?? [];
    const roles: IamRoleSummary[] = await Promise.all(rawRoles.slice(0, 50).map(async (r): Promise<IamRoleSummary> => {
      const roleName = r.RoleName ?? "unknown";
      let wildcardTrust = false;
      try {
        const detail = await withTimeout(c.send(new GetRoleCommand({ RoleName: roleName })), DEFAULT_TIMEOUT_MS, "iam.get_role");
        const trustPolicy = decodeURIComponent(detail.Role?.AssumeRolePolicyDocument ?? "");
        wildcardTrust = /"Principal"\s*:\s*"\*"|"AWS"\s*:\s*"\*"/.test(trustPolicy);
      } catch { /* skip */ }
      const lastUsedDate = r.RoleLastUsed?.LastUsedDate ? new Date(r.RoleLastUsed.LastUsedDate) : undefined;
      const lastUsedDaysAgo = lastUsedDate
        ? Math.floor((Date.now() - lastUsedDate.getTime()) / 86_400_000)
        : undefined;
      return {
        roleName,
        arn: r.Arn ?? undefined,
        createDate: r.CreateDate ? new Date(r.CreateDate).toISOString() : undefined,
        lastUsedDaysAgo,
        wildcardTrust,
      };
    }));
    if (rawRoles.length > 50) limitations.push(`Capped at 50 roles for IAM enrichment (total: ${rawRoles.length}).`);

    return {
      mode: "live",
      totalUsers: rawUsers.length,
      totalRoles: rawRoles.length,
      usersWithoutMfaCount: users.filter((u) => !u.mfaEnabled).length,
      usersWithAdminPolicyCount: users.filter((u) => u.hasAdminLikePolicy).length,
      rolesWithWildcardTrustCount: roles.filter((r) => r.wildcardTrust).length,
      staleUsersCount: users.filter((u) => u.passwordLastUsedDaysAgo !== undefined && u.passwordLastUsedDaysAgo > 90).length,
      users,
      roles,
      limitations,
    };
  } catch (err) {
    return blankIam(`IAM list failed: ${redact(errMessage(err))}`);
  }
}

async function runS3(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["s3"]> {
  try {
    const { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketLocationCommand } = await import("@aws-sdk/client-s3");
    const c = new S3Client({ region, credentials });
    const listRes = await withTimeout(c.send(new ListBucketsCommand({})), DEFAULT_TIMEOUT_MS, "s3.list");
    const rawBuckets = listRes.Buckets ?? [];
    const limitations: string[] = [];
    const buckets: S3BucketSummary[] = await Promise.all(rawBuckets.slice(0, 100).map(async (b): Promise<S3BucketSummary> => {
      const name = b.Name ?? "unknown";
      let publicAccessBlocked = false;
      let defaultEncryption = false;
      let bucketRegion: string | undefined;
      try {
        const loc = await withTimeout(c.send(new GetBucketLocationCommand({ Bucket: name })), DEFAULT_TIMEOUT_MS, "s3.location");
        bucketRegion = loc.LocationConstraint ?? "us-east-1";
      } catch { /* skip */ }
      try {
        const pab = await withTimeout(c.send(new GetPublicAccessBlockCommand({ Bucket: name })), DEFAULT_TIMEOUT_MS, "s3.pab");
        const cfg = pab.PublicAccessBlockConfiguration;
        publicAccessBlocked = !!cfg && !!cfg.BlockPublicAcls && !!cfg.IgnorePublicAcls && !!cfg.BlockPublicPolicy && !!cfg.RestrictPublicBuckets;
      } catch { /* missing PAB = not fully blocked */ }
      try {
        await withTimeout(c.send(new GetBucketEncryptionCommand({ Bucket: name })), DEFAULT_TIMEOUT_MS, "s3.enc");
        defaultEncryption = true;
      } catch { /* no default encryption */ }
      return {
        name,
        region: bucketRegion,
        publicAccessBlocked,
        defaultEncryption,
        createdAt: b.CreationDate ? new Date(b.CreationDate).toISOString() : undefined,
      };
    }));
    if (rawBuckets.length > 100) limitations.push(`Capped at 100 buckets for S3 enrichment (total: ${rawBuckets.length}).`);

    return {
      mode: "live",
      total: rawBuckets.length,
      publiclyExposedCount: buckets.filter((b) => !b.publicAccessBlocked).length,
      unencryptedCount: buckets.filter((b) => !b.defaultEncryption).length,
      buckets,
      limitations,
    };
  } catch (err) {
    return blankS3(`S3 list failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// EC2 (Phase 71)
// ---------------------------------------------------------------------------

async function runEc2(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["ec2"]> {
  try {
    const { EC2Client, DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
    const c = new EC2Client({ region, credentials });
    const res = await withTimeout(c.send(new DescribeInstancesCommand({ MaxResults: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "ec2.list");
    const instances: Ec2InstanceSummary[] = [];
    for (const r of res.Reservations ?? []) {
      for (const i of r.Instances ?? []) {
        instances.push({
          id: i.InstanceId ?? "unknown",
          instanceType: i.InstanceType ?? undefined,
          state: i.State?.Name ?? undefined,
          publicIp: i.PublicIpAddress ?? undefined,
          privateIp: i.PrivateIpAddress ?? undefined,
          imageId: i.ImageId ?? undefined,
          imdsv2Required: i.MetadataOptions?.HttpTokens === "required",
          launchTime: i.LaunchTime ? new Date(i.LaunchTime).toISOString() : undefined,
        });
      }
    }
    return {
      mode: "live",
      total: instances.length,
      runningCount: instances.filter((i) => i.state === "running").length,
      stoppedCount: instances.filter((i) => i.state === "stopped").length,
      publicIpCount: instances.filter((i) => !!i.publicIp).length,
      imdsv2Count: instances.filter((i) => i.imdsv2Required).length,
      instances,
      limitations: [],
    };
  } catch (err) {
    return blankEc2(`EC2 describe failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// VPC + Security Groups (Phase 71)
// ---------------------------------------------------------------------------

async function runNetwork(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["network"]> {
  try {
    const { EC2Client, DescribeVpcsCommand, DescribeSecurityGroupsCommand } = await import("@aws-sdk/client-ec2");
    const c = new EC2Client({ region, credentials });
    const [vpcsRes, sgsRes] = await Promise.all([
      withTimeout(c.send(new DescribeVpcsCommand({ MaxResults: 100 })), DEFAULT_TIMEOUT_MS, "vpc.list"),
      withTimeout(c.send(new DescribeSecurityGroupsCommand({ MaxResults: 100 })), DEFAULT_TIMEOUT_MS, "sg.list"),
    ]);
    const vpcs: VpcSummary[] = (vpcsRes.Vpcs ?? []).map((v) => ({
      id: v.VpcId ?? "unknown",
      cidrBlock: v.CidrBlock ?? undefined,
      isDefault: !!v.IsDefault,
    }));
    const securityGroups: SecurityGroupSummary[] = (sgsRes.SecurityGroups ?? []).map((sg) => {
      const inbound = sg.IpPermissions ?? [];
      let wideOpen = false;
      let wideOpenAdmin = false;
      for (const rule of inbound) {
        for (const range of rule.IpRanges ?? []) {
          if (range.CidrIp === "0.0.0.0/0") {
            wideOpen = true;
            const from = rule.FromPort ?? -1;
            const to = rule.ToPort ?? -1;
            if (from === -1 || (from <= 22 && to >= 22) || (from <= 3389 && to >= 3389)) {
              wideOpenAdmin = true;
            }
          }
        }
      }
      return {
        id: sg.GroupId ?? "unknown",
        name: sg.GroupName ?? undefined,
        description: sg.Description ?? undefined,
        vpcId: sg.VpcId ?? undefined,
        hasWideOpenIngress: wideOpen,
        hasWideOpenAdminPort: wideOpenAdmin,
      };
    });
    return {
      mode: "live",
      vpcCount: vpcs.length,
      securityGroupCount: securityGroups.length,
      wideOpenIngressCount: securityGroups.filter((g) => g.hasWideOpenIngress).length,
      wideOpenAdminPortCount: securityGroups.filter((g) => g.hasWideOpenAdminPort).length,
      vpcs,
      securityGroups,
      limitations: [],
    };
  } catch (err) {
    return blankNetwork(`VPC/SG describe failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// Load Balancers v2 (ALB / NLB) (Phase 71)
// ---------------------------------------------------------------------------

async function runLoadBalancers(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["loadBalancers"]> {
  try {
    const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } = await import("@aws-sdk/client-elastic-load-balancing-v2");
    const c = new ElasticLoadBalancingV2Client({ region, credentials });
    const res = await withTimeout(c.send(new DescribeLoadBalancersCommand({ PageSize: 100 })), DEFAULT_TIMEOUT_MS, "elb.list");
    const items: LoadBalancerSummary[] = (res.LoadBalancers ?? []).map((lb) => ({
      arn: lb.LoadBalancerArn ?? "unknown",
      name: lb.LoadBalancerName ?? undefined,
      type: lb.Type ?? undefined,
      scheme: lb.Scheme ?? undefined,
      state: lb.State?.Code ?? undefined,
      publiclyExposed: lb.Scheme === "internet-facing",
    }));
    return {
      mode: "live",
      total: items.length,
      publicCount: items.filter((lb) => lb.publiclyExposed).length,
      items,
      limitations: [],
    };
  } catch (err) {
    return blankLoadBalancers(`ELB describe failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// Messaging — SNS + SQS (Phase 71)
// ---------------------------------------------------------------------------

async function runMessaging(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["messaging"]> {
  const limitations: string[] = [];
  let snsTopics: SnsTopicSummary[] = [];
  let sqsQueues: SqsQueueSummary[] = [];
  try {
    const { SNSClient, ListTopicsCommand } = await import("@aws-sdk/client-sns");
    const c = new SNSClient({ region, credentials });
    const res = await withTimeout(c.send(new ListTopicsCommand({})), DEFAULT_TIMEOUT_MS, "sns.list");
    snsTopics = (res.Topics ?? []).slice(0, MAX_ITEMS).map((t) => ({
      arn: t.TopicArn ?? "unknown",
      name: (t.TopicArn ?? "").split(":").pop() ?? "unknown",
    }));
  } catch (err) {
    limitations.push(`SNS list failed: ${redact(errMessage(err))}`);
  }
  try {
    const { SQSClient, ListQueuesCommand } = await import("@aws-sdk/client-sqs");
    const c = new SQSClient({ region, credentials });
    const res = await withTimeout(c.send(new ListQueuesCommand({ MaxResults: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "sqs.list");
    sqsQueues = (res.QueueUrls ?? []).map((url) => ({
      url,
      name: url.split("/").pop() ?? "unknown",
    }));
  } catch (err) {
    limitations.push(`SQS list failed: ${redact(errMessage(err))}`);
  }
  // If both succeeded (no limitations from either), mode = live; else if at
  // least one succeeded, still live.
  const mode = (snsTopics.length + sqsQueues.length > 0) || limitations.length === 0 ? "live" : "blocked";
  return {
    mode: mode === "blocked" ? "blocked" : "live",
    snsTopicCount: snsTopics.length,
    sqsQueueCount: sqsQueues.length,
    snsTopics,
    sqsQueues,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// SSM Patch Compliance (Phase 75 — sysadmin replacement)
// ---------------------------------------------------------------------------

async function runPatchCompliance(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["patchCompliance"]> {
  try {
    const { SSMClient, DescribeInstancePatchStatesCommand, DescribeInstanceInformationCommand } = await import("@aws-sdk/client-ssm");
    const c = new SSMClient({ region, credentials });

    // First list instances managed by SSM.
    const infoRes = await withTimeout(
      c.send(new DescribeInstanceInformationCommand({ MaxResults: 50 })),
      DEFAULT_TIMEOUT_MS,
      "ssm.instance_info",
    );
    const managed = infoRes.InstanceInformationList ?? [];
    if (managed.length === 0) {
      return {
        mode: "live",
        totalInstances: 0,
        compliantCount: 0,
        nonCompliantCount: 0,
        totalMissingPatches: 0,
        instances: [],
        limitations: ["No SSM-managed EC2 instances in this region."],
      };
    }

    const instanceIds = managed.map((m) => m.InstanceId).filter((id): id is string => !!id);
    const platformByInstance = new Map<string, { platformType?: string; platformName?: string; osVersion?: string }>();
    for (const m of managed) {
      if (m.InstanceId) {
        platformByInstance.set(m.InstanceId, {
          platformType: m.PlatformType,
          platformName: m.PlatformName,
          osVersion: m.PlatformVersion,
        });
      }
    }

    // Patch states for those instances (cap 50).
    const patchRes = await withTimeout(
      c.send(new DescribeInstancePatchStatesCommand({ InstanceIds: instanceIds.slice(0, 50) })),
      DEFAULT_TIMEOUT_MS,
      "ssm.patch_states",
    );
    const states = patchRes.InstancePatchStates ?? [];

    const instances: SsmInstancePatchSummary[] = states.map((s): SsmInstancePatchSummary => {
      const platform = s.InstanceId ? platformByInstance.get(s.InstanceId) ?? {} : {};
      const missing = s.MissingCount ?? 0;
      const failed = s.FailedCount ?? 0;
      const installed = s.InstalledCount ?? 0;
      let status: PatchComplianceStatus = "unspecified";
      if (missing === 0 && failed === 0 && installed > 0) status = "compliant";
      else if (missing > 0 || failed > 0) status = "non_compliant";
      else status = "unknown";
      return {
        instanceId: s.InstanceId ?? "unknown",
        platformType: platform.platformType,
        platformName: platform.platformName,
        osVersion: platform.osVersion,
        patchGroup: s.PatchGroup ?? undefined,
        installedCount: installed,
        installedPendingRebootCount: s.InstalledPendingRebootCount ?? undefined,
        missingCount: missing,
        failedCount: failed,
        status,
        lastNoRebootInstallOperationTime: s.LastNoRebootInstallOperationTime
          ? new Date(s.LastNoRebootInstallOperationTime).toISOString()
          : undefined,
      };
    });
    const compliantCount = instances.filter((i) => i.status === "compliant").length;
    const nonCompliantCount = instances.filter((i) => i.status === "non_compliant").length;
    const totalMissingPatches = instances.reduce((s, i) => s + (i.missingCount ?? 0), 0);
    return {
      mode: "live",
      totalInstances: instances.length,
      compliantCount,
      nonCompliantCount,
      totalMissingPatches,
      instances,
      limitations: [],
    };
  } catch (err) {
    return blankPatchCompliance(`SSM patch state failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// CloudWatch Log Groups (Phase 76 — app dev replacement)
// ---------------------------------------------------------------------------

async function runLogGroups(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["logGroups"]> {
  try {
    const { CloudWatchLogsClient, DescribeLogGroupsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
    const c = new CloudWatchLogsClient({ region, credentials });
    const res = await withTimeout(c.send(new DescribeLogGroupsCommand({ limit: 50 })), DEFAULT_TIMEOUT_MS, "logs.list");
    const raw = res.logGroups ?? [];
    const groups: CloudWatchLogGroupSummary[] = raw.map((g): CloudWatchLogGroupSummary => ({
      name: g.logGroupName ?? "unknown",
      arn: g.arn ?? undefined,
      storedBytes: g.storedBytes ?? undefined,
      retentionInDays: g.retentionInDays ?? undefined,
      retentionUnbounded: g.retentionInDays === undefined,
      kmsEncrypted: !!g.kmsKeyId,
      createdAt: g.creationTime ? new Date(g.creationTime).toISOString() : undefined,
    }));
    const totalStoredBytes = groups.reduce((s, g) => s + (g.storedBytes ?? 0), 0);
    return {
      mode: "live",
      total: groups.length,
      totalStoredBytes,
      retentionUnboundedCount: groups.filter((g) => g.retentionUnbounded).length,
      unencryptedCount: groups.filter((g) => !g.kmsEncrypted).length,
      groups,
      limitations: [],
    };
  } catch (err) {
    return blankLogGroups(`Logs DescribeLogGroups failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// ACM Certificates (Phase 77)
// ---------------------------------------------------------------------------

async function runCertificates(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["certificates"]> {
  try {
    const { ACMClient, ListCertificatesCommand, DescribeCertificateCommand } = await import("@aws-sdk/client-acm");
    const c = new ACMClient({ region, credentials });
    const listRes = await withTimeout(c.send(new ListCertificatesCommand({ MaxItems: 100 })), DEFAULT_TIMEOUT_MS, "acm.list");
    const summaries = listRes.CertificateSummaryList ?? [];
    const items: AcmCertificateSummary[] = await Promise.all(summaries.slice(0, 50).map(async (s) => {
      try {
        const detail = await withTimeout(c.send(new DescribeCertificateCommand({ CertificateArn: s.CertificateArn })), DEFAULT_TIMEOUT_MS, "acm.describe");
        const d = detail.Certificate;
        const notAfter = d?.NotAfter ? new Date(d.NotAfter) : undefined;
        const daysUntilExpiry = notAfter
          ? Math.floor((notAfter.getTime() - Date.now()) / 86_400_000)
          : undefined;
        const status: AcmStatus = (d?.Status as AcmStatus) ?? "unknown";
        return {
          arn: s.CertificateArn ?? "unknown",
          domainName: d?.DomainName ?? s.DomainName ?? undefined,
          status,
          notAfter: notAfter?.toISOString(),
          daysUntilExpiry,
          expiringSoon: daysUntilExpiry !== undefined && daysUntilExpiry <= 30 && daysUntilExpiry >= 0,
          inUseBy: d?.InUseBy?.length ?? 0,
        };
      } catch {
        return {
          arn: s.CertificateArn ?? "unknown",
          domainName: s.DomainName,
          status: "unknown" as const,
          notAfter: undefined,
          daysUntilExpiry: undefined,
          expiringSoon: false,
          inUseBy: 0,
        };
      }
    }));
    return {
      mode: "live",
      total: items.length,
      issuedCount: items.filter((i) => i.status === "ISSUED").length,
      expiredCount: items.filter((i) => i.status === "EXPIRED" || (i.daysUntilExpiry !== undefined && i.daysUntilExpiry < 0)).length,
      expiringSoonCount: items.filter((i) => i.expiringSoon).length,
      items,
      limitations: [],
    };
  } catch (err) {
    return blankCertificates(`ACM list failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// GuardDuty (Phase 78)
// ---------------------------------------------------------------------------

async function runGuardDuty(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["threats"]> {
  try {
    const { GuardDutyClient, ListDetectorsCommand, ListFindingsCommand, GetFindingsCommand } = await import("@aws-sdk/client-guardduty");
    const c = new GuardDutyClient({ region, credentials });
    const detRes = await withTimeout(c.send(new ListDetectorsCommand({})), DEFAULT_TIMEOUT_MS, "guardduty.list_detectors");
    const detectorId = (detRes.DetectorIds ?? [])[0];
    if (!detectorId) {
      return {
        mode: "live",
        detectorEnabled: false,
        totalFindings: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        findings: [],
        limitations: ["No GuardDuty detector in this region."],
      };
    }
    const listRes = await withTimeout(
      c.send(new ListFindingsCommand({ DetectorId: detectorId, MaxResults: 50 })),
      DEFAULT_TIMEOUT_MS,
      "guardduty.list_findings",
    );
    const findingIds = listRes.FindingIds ?? [];
    if (findingIds.length === 0) {
      return {
        mode: "live",
        detectorEnabled: true,
        totalFindings: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        findings: [],
        limitations: [],
      };
    }
    const detail = await withTimeout(
      c.send(new GetFindingsCommand({ DetectorId: detectorId, FindingIds: findingIds.slice(0, 50) })),
      DEFAULT_TIMEOUT_MS,
      "guardduty.get_findings",
    );
    const findings: GuardDutyFindingSummary[] = (detail.Findings ?? []).map((f): GuardDutyFindingSummary => {
      const score = f.Severity ?? 0;
      const severity: GuardDutyFindingSeverity = score >= 7 ? "high" : score >= 4 ? "medium" : score > 0 ? "low" : "unknown";
      return {
        id: f.Id ?? "unknown",
        title: f.Title ?? undefined,
        type: f.Type ?? undefined,
        severityScore: score,
        severity,
        resourceType: f.Resource?.ResourceType ?? undefined,
        region: f.Region ?? region,
        updatedAt: f.UpdatedAt ?? undefined,
      };
    });
    return {
      mode: "live",
      detectorEnabled: true,
      totalFindings: findings.length,
      highCount: findings.filter((f) => f.severity === "high").length,
      mediumCount: findings.filter((f) => f.severity === "medium").length,
      lowCount: findings.filter((f) => f.severity === "low").length,
      findings,
      limitations: [],
    };
  } catch (err) {
    return blankThreats(`GuardDuty failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// Secrets Manager (Phase 79)
// ---------------------------------------------------------------------------

async function runSecrets(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["secrets"]> {
  try {
    const { SecretsManagerClient, ListSecretsCommand } = await import("@aws-sdk/client-secrets-manager");
    const c = new SecretsManagerClient({ region, credentials });
    const res = await withTimeout(c.send(new ListSecretsCommand({ MaxResults: 100 })), DEFAULT_TIMEOUT_MS, "secrets.list");
    const items: SecretSummary[] = (res.SecretList ?? []).map((s): SecretSummary => {
      const lastChanged = s.LastChangedDate ? new Date(s.LastChangedDate) : undefined;
      const daysSinceRotation = lastChanged
        ? Math.floor((Date.now() - lastChanged.getTime()) / 86_400_000)
        : undefined;
      const rotationEnabled = !!s.RotationEnabled;
      const staleRotation = !rotationEnabled || (daysSinceRotation !== undefined && daysSinceRotation > 90);
      return {
        arn: s.ARN ?? "unknown",
        name: s.Name ?? "unknown",
        rotationEnabled,
        daysSinceRotation,
        lastChangedDate: lastChanged?.toISOString(),
        staleRotation,
      };
    });
    return {
      mode: "live",
      total: items.length,
      rotationDisabledCount: items.filter((i) => !i.rotationEnabled).length,
      staleRotationCount: items.filter((i) => i.staleRotation).length,
      items,
      limitations: [],
    };
  } catch (err) {
    return blankSecrets(`Secrets Manager list failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// AWS Backup (Phase 80)
// ---------------------------------------------------------------------------

async function runBackups(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  region: string,
): Promise<AwsServiceInventoryReport["backups"]> {
  try {
    const { BackupClient, ListBackupVaultsCommand } = await import("@aws-sdk/client-backup");
    const c = new BackupClient({ region, credentials });
    const res = await withTimeout(c.send(new ListBackupVaultsCommand({ MaxResults: 100 })), DEFAULT_TIMEOUT_MS, "backup.list_vaults");
    const vaults: BackupVaultSummary[] = (res.BackupVaultList ?? []).map((v): BackupVaultSummary => {
      const count = v.NumberOfRecoveryPoints ?? 0;
      return {
        name: v.BackupVaultName ?? "unknown",
        arn: v.BackupVaultArn ?? undefined,
        recoveryPointCount: count,
        encryptionKeyArn: v.EncryptionKeyArn ?? undefined,
        hasRecentRecoveryPoint: count > 0,
      };
    });
    return {
      mode: "live",
      vaultCount: vaults.length,
      totalRecoveryPoints: vaults.reduce((s, v) => s + v.recoveryPointCount, 0),
      emptyVaultCount: vaults.filter((v) => v.recoveryPointCount === 0).length,
      vaults,
      limitations: [],
    };
  } catch (err) {
    return blankBackups(`Backup vault list failed: ${redact(errMessage(err))}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyReport(generatedAt: string, tenantId: string): AwsServiceInventoryReport {
  return {
    generatedAt,
    tenantId,
    region: undefined,
    accountIdLastFour: undefined,
    lambda: blankLambda("Not extracted."),
    rds: blankRds("Not extracted."),
    iam: blankIam("Not extracted."),
    s3: blankS3("Not extracted."),
    ec2: blankEc2("Not extracted."),
    network: blankNetwork("Not extracted."),
    loadBalancers: blankLoadBalancers("Not extracted."),
    messaging: blankMessaging("Not extracted."),
    patchCompliance: blankPatchCompliance("Not extracted."),
    logGroups: blankLogGroups("Not extracted."),
    certificates: blankCertificates("Not extracted."),
    threats: blankThreats("Not extracted."),
    secrets: blankSecrets("Not extracted."),
    backups: blankBackups("Not extracted."),
    overallSourceMode: "preview",
    safetyContract: "aws_service_inventory_read_only",
    limitations: [],
    safeNextAction: { label: "Open Sources", href: "/dashboard/sources" },
  };
}

function blankLambda(note: string): AwsServiceInventoryReport["lambda"] {
  const runtimeBreakdown: Record<LambdaRuntimeFamily, number> = Object.fromEntries(LAMBDA_RUNTIME_FAMILIES.map((k) => [k, 0])) as Record<LambdaRuntimeFamily, number>;
  return { mode: "blocked", total: 0, deprecatedRuntimeCount: 0, runtimeBreakdown, functions: [], limitations: [note] };
}
function blankRds(note: string): AwsServiceInventoryReport["rds"] {
  return {
    mode: "blocked",
    total: 0,
    unencryptedCount: 0,
    publiclyAccessibleCount: 0,
    multiAzCount: 0,
    backupsDisabledCount: 0,
    noDeletionProtectionCount: 0,
    noPerformanceInsightsCount: 0,
    staleSnapshotCount: 0,
    instances: [],
    limitations: [note],
  };
}
function blankIam(note: string): AwsServiceInventoryReport["iam"] {
  return { mode: "blocked", totalUsers: 0, totalRoles: 0, usersWithoutMfaCount: 0, usersWithAdminPolicyCount: 0, rolesWithWildcardTrustCount: 0, staleUsersCount: 0, users: [], roles: [], limitations: [note] };
}
function blankS3(note: string): AwsServiceInventoryReport["s3"] {
  return { mode: "blocked", total: 0, publiclyExposedCount: 0, unencryptedCount: 0, buckets: [], limitations: [note] };
}
function blankEc2(note: string): AwsServiceInventoryReport["ec2"] {
  return { mode: "blocked", total: 0, runningCount: 0, stoppedCount: 0, publicIpCount: 0, imdsv2Count: 0, instances: [], limitations: [note] };
}
function blankNetwork(note: string): AwsServiceInventoryReport["network"] {
  return { mode: "blocked", vpcCount: 0, securityGroupCount: 0, wideOpenIngressCount: 0, wideOpenAdminPortCount: 0, vpcs: [], securityGroups: [], limitations: [note] };
}
function blankLoadBalancers(note: string): AwsServiceInventoryReport["loadBalancers"] {
  return { mode: "blocked", total: 0, publicCount: 0, items: [], limitations: [note] };
}
function blankMessaging(note: string): AwsServiceInventoryReport["messaging"] {
  return { mode: "blocked", snsTopicCount: 0, sqsQueueCount: 0, snsTopics: [], sqsQueues: [], limitations: [note] };
}
function blankPatchCompliance(note: string): AwsServiceInventoryReport["patchCompliance"] {
  return { mode: "blocked", totalInstances: 0, compliantCount: 0, nonCompliantCount: 0, totalMissingPatches: 0, instances: [], limitations: [note] };
}
function blankLogGroups(note: string): AwsServiceInventoryReport["logGroups"] {
  return { mode: "blocked", total: 0, totalStoredBytes: 0, retentionUnboundedCount: 0, unencryptedCount: 0, groups: [], limitations: [note] };
}
function blankCertificates(note: string): AwsServiceInventoryReport["certificates"] {
  return { mode: "blocked", total: 0, issuedCount: 0, expiredCount: 0, expiringSoonCount: 0, items: [], limitations: [note] };
}
function blankThreats(note: string): AwsServiceInventoryReport["threats"] {
  return { mode: "blocked", detectorEnabled: false, totalFindings: 0, highCount: 0, mediumCount: 0, lowCount: 0, findings: [], limitations: [note] };
}
function blankSecrets(note: string): AwsServiceInventoryReport["secrets"] {
  return { mode: "blocked", total: 0, rotationDisabledCount: 0, staleRotationCount: 0, items: [], limitations: [note] };
}
function blankBackups(note: string): AwsServiceInventoryReport["backups"] {
  return { mode: "blocked", vaultCount: 0, totalRecoveryPoints: 0, emptyVaultCount: 0, vaults: [], limitations: [note] };
}
function withGlobalNote(r: AwsServiceInventoryReport, note: string): AwsServiceInventoryReport {
  r.limitations.push(note);
  return r;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}

// Re-export for the route consumers.
export type { AwsServiceInventoryReport };

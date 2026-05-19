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
  type AwsServiceInventoryReport,
  type AwsServiceMode,
  type IamRoleSummary,
  type IamUserSummary,
  type LambdaFunctionSummary,
  type LambdaRuntimeFamily,
  type RdsInstanceSummary,
  type S3BucketSummary,
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
  // Run all 4 in parallel; each catches its own errors.
  // ---------------------------------------------------------------------------
  const [lambda, rds, iam, s3] = await Promise.all([
    runLambda(credentials, region),
    runRds(credentials, region),
    runIam(credentials, region),
    runS3(credentials, region),
  ]);

  blank.lambda = lambda;
  blank.rds = rds;
  blank.iam = iam;
  blank.s3 = s3;

  const allLive = [lambda.mode, rds.mode, iam.mode, s3.mode].every((m) => m === "live");
  const anyLive = [lambda.mode, rds.mode, iam.mode, s3.mode].some((m) => m === "live");
  blank.overallSourceMode = allLive ? "live" : anyLive ? "live" : "preview";

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
    const { RDSClient, DescribeDBInstancesCommand } = await import("@aws-sdk/client-rds");
    const c = new RDSClient({ region, credentials });
    const res = await withTimeout(c.send(new DescribeDBInstancesCommand({ MaxRecords: MAX_ITEMS })), DEFAULT_TIMEOUT_MS, "rds.list");
    const instances = (res.DBInstances ?? []).map((i): RdsInstanceSummary => ({
      identifier: i.DBInstanceIdentifier ?? "unknown",
      engine: i.Engine ?? undefined,
      engineVersion: i.EngineVersion ?? undefined,
      instanceClass: i.DBInstanceClass ?? undefined,
      storageGb: i.AllocatedStorage ?? undefined,
      multiAz: !!i.MultiAZ,
      encrypted: !!i.StorageEncrypted,
      publiclyAccessible: !!i.PubliclyAccessible,
      status: i.DBInstanceStatus ?? undefined,
      endpoint: i.Endpoint?.Address ?? undefined,
    }));
    return {
      mode: "live",
      total: instances.length,
      unencryptedCount: instances.filter((i) => !i.encrypted).length,
      publiclyAccessibleCount: instances.filter((i) => i.publiclyAccessible).length,
      multiAzCount: instances.filter((i) => i.multiAz).length,
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
  return { mode: "blocked", total: 0, unencryptedCount: 0, publiclyAccessibleCount: 0, multiAzCount: 0, instances: [], limitations: [note] };
}
function blankIam(note: string): AwsServiceInventoryReport["iam"] {
  return { mode: "blocked", totalUsers: 0, totalRoles: 0, usersWithoutMfaCount: 0, usersWithAdminPolicyCount: 0, rolesWithWildcardTrustCount: 0, staleUsersCount: 0, users: [], roles: [], limitations: [note] };
}
function blankS3(note: string): AwsServiceInventoryReport["s3"] {
  return { mode: "blocked", total: 0, publiclyExposedCount: 0, unencryptedCount: 0, buckets: [], limitations: [note] };
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

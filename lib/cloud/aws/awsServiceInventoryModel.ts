/**
 * AWS Service Inventory — typed contract.
 *
 * Canonical model for every read-only AWS service surface the
 * platform can enumerate. Each section is independent — when one
 * SDK fails the others still populate. All counts are real or zero;
 * nothing is ever fabricated.
 *
 * safetyContract literal 'aws_service_inventory_read_only'.
 */

export type AwsServiceMode = "live" | "preview" | "blocked" | "disabled" | "unknown";

// ---------------------------------------------------------------------------
// Lambda
// ---------------------------------------------------------------------------

export type LambdaRuntimeFamily = "nodejs" | "python" | "java" | "go" | "ruby" | "dotnet" | "custom" | "unknown";

export interface LambdaFunctionSummary {
  name: string;
  runtime?: string;
  runtimeFamily: LambdaRuntimeFamily;
  memoryMb?: number;
  timeoutSeconds?: number;
  lastModified?: string;
  /** True when the function ARN includes layers that are EOL or unsupported. */
  deprecatedRuntime: boolean;
  arn?: string;
}

// ---------------------------------------------------------------------------
// RDS
// ---------------------------------------------------------------------------

export interface RdsInstanceSummary {
  identifier: string;
  engine?: string;
  engineVersion?: string;
  instanceClass?: string;
  storageGb?: number;
  multiAz: boolean;
  encrypted: boolean;
  publiclyAccessible: boolean;
  status?: string;
  endpoint?: string;
  /** Backup retention period in days. 0 = backups effectively disabled. */
  backupRetentionDays?: number;
  /** True when automated backups are off (retention === 0). */
  backupsDisabled: boolean;
  /** True when deletion protection is enabled. */
  deletionProtection: boolean;
  /** True when Performance Insights is enabled. */
  performanceInsightsEnabled: boolean;
  /** True when this is a read replica. */
  isReadReplica: boolean;
  /** ARN of the source DB when this is a replica. */
  readReplicaSourceArn?: string;
  /** True when minor version auto-upgrades are enabled. */
  autoMinorVersionUpgrade: boolean;
  /** Days since last manual snapshot. null when never snapshotted. */
  daysSinceLastSnapshot?: number;
}

// ---------------------------------------------------------------------------
// IAM
// ---------------------------------------------------------------------------

export interface IamUserSummary {
  userName: string;
  arn?: string;
  createDate?: string;
  /** Days since password was last used (null when never). */
  passwordLastUsedDaysAgo?: number;
  /** True when MFA device(s) attached. */
  mfaEnabled: boolean;
  /** True when at least one active access key exists. */
  hasActiveAccessKey: boolean;
  /** True when the user has admin-like policies attached. */
  hasAdminLikePolicy: boolean;
}

export interface IamRoleSummary {
  roleName: string;
  arn?: string;
  createDate?: string;
  /** Days since the role was last used (null when never). */
  lastUsedDaysAgo?: number;
  /** True when the trust policy contains a wildcard principal. */
  wildcardTrust: boolean;
}

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

export interface S3BucketSummary {
  name: string;
  region?: string;
  /** True when the bucket has Public Access Block fully configured. */
  publicAccessBlocked: boolean;
  /** True when default encryption is enabled. */
  defaultEncryption: boolean;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// EC2 (Phase 71)
// ---------------------------------------------------------------------------

export interface Ec2InstanceSummary {
  id: string;
  instanceType?: string;
  state?: string;
  publicIp?: string;
  privateIp?: string;
  imageId?: string;
  /** True when the instance metadata service is IMDSv2-required. */
  imdsv2Required: boolean;
  launchTime?: string;
}

// ---------------------------------------------------------------------------
// VPC + Security Groups (Phase 71)
// ---------------------------------------------------------------------------

export interface SecurityGroupSummary {
  id: string;
  name?: string;
  description?: string;
  vpcId?: string;
  /** True when at least one inbound rule allows 0.0.0.0/0 on any port. */
  hasWideOpenIngress: boolean;
  /** True when a wide-open rule allows SSH (22) or RDP (3389). */
  hasWideOpenAdminPort: boolean;
}

export interface VpcSummary {
  id: string;
  cidrBlock?: string;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// ELB v2 (ALB / NLB) (Phase 71)
// ---------------------------------------------------------------------------

export interface LoadBalancerSummary {
  arn: string;
  name?: string;
  type?: "application" | "network" | "gateway" | string;
  scheme?: "internet-facing" | "internal" | string;
  state?: string;
  /** True when the LB is internet-facing. */
  publiclyExposed: boolean;
}

// ---------------------------------------------------------------------------
// SNS + SQS (Phase 71)
// ---------------------------------------------------------------------------

export interface SnsTopicSummary {
  arn: string;
  name: string;
}

export interface SqsQueueSummary {
  url: string;
  name: string;
}

// ---------------------------------------------------------------------------
// SSM Patch Manager (Phase 75 — sysadmin replacement)
// ---------------------------------------------------------------------------

export type PatchComplianceStatus = "compliant" | "non_compliant" | "unspecified" | "unknown";

export interface SsmInstancePatchSummary {
  instanceId: string;
  platformType?: string;
  platformName?: string;
  osVersion?: string;
  patchGroup?: string;
  /** Number of missing critical / security patches. */
  installedCount?: number;
  installedPendingRebootCount?: number;
  missingCount?: number;
  failedCount?: number;
  /** Overall compliance. */
  status: PatchComplianceStatus;
  /** When the instance was last scanned. */
  lastNoRebootInstallOperationTime?: string;
}

// ---------------------------------------------------------------------------
// CloudWatch Logs Insights (Phase 76 — app dev replacement)
// ---------------------------------------------------------------------------

export interface CloudWatchLogGroupSummary {
  name: string;
  arn?: string;
  storedBytes?: number;
  retentionInDays?: number;
  /** True when retention is unset (logs never expire) — usually a config gap. */
  retentionUnbounded: boolean;
  /** True when the log group is encrypted with a KMS key. */
  kmsEncrypted: boolean;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// ACM Certificates (Phase 77)
// ---------------------------------------------------------------------------

export type AcmStatus = "ISSUED" | "EXPIRED" | "PENDING_VALIDATION" | "FAILED" | "REVOKED" | "VALIDATION_TIMED_OUT" | "INACTIVE" | "unknown";

export interface AcmCertificateSummary {
  arn: string;
  domainName?: string;
  status: AcmStatus;
  notAfter?: string;
  /** Days until expiry. Negative when already expired. */
  daysUntilExpiry?: number;
  /** True when the cert expires in ≤30 days. */
  expiringSoon: boolean;
  inUseBy: number;
}

// ---------------------------------------------------------------------------
// GuardDuty Findings (Phase 78)
// ---------------------------------------------------------------------------

export type GuardDutyFindingSeverity = "low" | "medium" | "high" | "unknown";

export interface GuardDutyFindingSummary {
  id: string;
  title?: string;
  type?: string;
  severityScore: number;
  severity: GuardDutyFindingSeverity;
  resourceType?: string;
  region?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Secrets Manager (Phase 79)
// ---------------------------------------------------------------------------

export interface SecretSummary {
  arn: string;
  name: string;
  rotationEnabled: boolean;
  /** Days since the secret last rotated. null when never rotated. */
  daysSinceRotation?: number;
  lastChangedDate?: string;
  /** True when rotation is disabled OR last rotation was >90 days ago. */
  staleRotation: boolean;
}

// ---------------------------------------------------------------------------
// AWS Backup (Phase 80)
// ---------------------------------------------------------------------------

export interface BackupVaultSummary {
  name: string;
  arn?: string;
  recoveryPointCount: number;
  encryptionKeyArn?: string;
  /** True when the vault has a recovery point. */
  hasRecentRecoveryPoint: boolean;
}

// ---------------------------------------------------------------------------
// WAF v2 (Phase 88)
// ---------------------------------------------------------------------------

export type WafScope = "CLOUDFRONT" | "REGIONAL";

export interface WebAclSummary {
  arn: string;
  name: string;
  scope: WafScope;
  /** Number of rules attached (managed + custom). */
  ruleCount: number;
  /** Default action when no rule matches. */
  defaultAction: "Allow" | "Block" | "unknown";
  /** True when CloudWatch metrics are enabled. */
  metricsEnabled: boolean;
  /** Resource ARNs associated with this Web ACL (CloudFront / ALB / API GW). */
  associatedResourceCount: number;
}

// ---------------------------------------------------------------------------
// Top-level report
// ---------------------------------------------------------------------------

export interface AwsServiceInventoryReport {
  generatedAt: string;
  tenantId?: string;
  region?: string;
  accountIdLastFour?: string;

  lambda: {
    mode: AwsServiceMode;
    total: number;
    deprecatedRuntimeCount: number;
    runtimeBreakdown: Record<LambdaRuntimeFamily, number>;
    functions: LambdaFunctionSummary[];
    limitations: string[];
  };

  rds: {
    mode: AwsServiceMode;
    total: number;
    unencryptedCount: number;
    publiclyAccessibleCount: number;
    multiAzCount: number;
    /** Instances with retention === 0. */
    backupsDisabledCount: number;
    /** Instances with deletion protection disabled. */
    noDeletionProtectionCount: number;
    /** Instances with Performance Insights off. */
    noPerformanceInsightsCount: number;
    /** Instances with no snapshot in the last 30 days. */
    staleSnapshotCount: number;
    instances: RdsInstanceSummary[];
    limitations: string[];
  };

  iam: {
    mode: AwsServiceMode;
    totalUsers: number;
    totalRoles: number;
    usersWithoutMfaCount: number;
    usersWithAdminPolicyCount: number;
    rolesWithWildcardTrustCount: number;
    staleUsersCount: number; // password not used in >90d
    users: IamUserSummary[];
    roles: IamRoleSummary[];
    limitations: string[];
  };

  s3: {
    mode: AwsServiceMode;
    total: number;
    publiclyExposedCount: number;
    unencryptedCount: number;
    buckets: S3BucketSummary[];
    limitations: string[];
  };

  ec2: {
    mode: AwsServiceMode;
    total: number;
    runningCount: number;
    stoppedCount: number;
    publicIpCount: number;
    imdsv2Count: number;
    instances: Ec2InstanceSummary[];
    limitations: string[];
  };

  network: {
    mode: AwsServiceMode;
    vpcCount: number;
    securityGroupCount: number;
    wideOpenIngressCount: number;
    wideOpenAdminPortCount: number;
    vpcs: VpcSummary[];
    securityGroups: SecurityGroupSummary[];
    limitations: string[];
  };

  loadBalancers: {
    mode: AwsServiceMode;
    total: number;
    publicCount: number;
    items: LoadBalancerSummary[];
    limitations: string[];
  };

  messaging: {
    mode: AwsServiceMode;
    snsTopicCount: number;
    sqsQueueCount: number;
    snsTopics: SnsTopicSummary[];
    sqsQueues: SqsQueueSummary[];
    limitations: string[];
  };

  patchCompliance: {
    mode: AwsServiceMode;
    totalInstances: number;
    compliantCount: number;
    nonCompliantCount: number;
    totalMissingPatches: number;
    instances: SsmInstancePatchSummary[];
    limitations: string[];
  };

  logGroups: {
    mode: AwsServiceMode;
    total: number;
    /** Total stored bytes across every group. */
    totalStoredBytes: number;
    retentionUnboundedCount: number;
    unencryptedCount: number;
    groups: CloudWatchLogGroupSummary[];
    limitations: string[];
  };

  certificates: {
    mode: AwsServiceMode;
    total: number;
    issuedCount: number;
    expiredCount: number;
    expiringSoonCount: number;
    items: AcmCertificateSummary[];
    limitations: string[];
  };

  threats: {
    mode: AwsServiceMode;
    detectorEnabled: boolean;
    totalFindings: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    findings: GuardDutyFindingSummary[];
    limitations: string[];
  };

  secrets: {
    mode: AwsServiceMode;
    total: number;
    rotationDisabledCount: number;
    staleRotationCount: number;
    items: SecretSummary[];
    limitations: string[];
  };

  backups: {
    mode: AwsServiceMode;
    vaultCount: number;
    totalRecoveryPoints: number;
    emptyVaultCount: number;
    vaults: BackupVaultSummary[];
    limitations: string[];
  };

  waf: {
    mode: AwsServiceMode;
    total: number;
    blockDefaultCount: number;
    associatedResourceCount: number;
    items: WebAclSummary[];
    limitations: string[];
  };

  overallSourceMode: AwsServiceMode;
  /** Hard literal. */
  safetyContract: "aws_service_inventory_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const LAMBDA_RUNTIME_FAMILIES: LambdaRuntimeFamily[] = ["nodejs", "python", "java", "go", "ruby", "dotnet", "custom", "unknown"];

export function classifyLambdaRuntime(runtime: string | undefined): LambdaRuntimeFamily {
  if (!runtime) return "unknown";
  const r = runtime.toLowerCase();
  if (r.startsWith("nodejs")) return "nodejs";
  if (r.startsWith("python")) return "python";
  if (r.startsWith("java"))   return "java";
  if (r.startsWith("go"))     return "go";
  if (r.startsWith("ruby"))   return "ruby";
  if (r.startsWith("dotnet")) return "dotnet";
  if (r === "provided" || r === "provided.al2" || r === "provided.al2023") return "custom";
  return "unknown";
}

/** AWS-deprecated Lambda runtimes as of 2026-05. Keep updated. */
const DEPRECATED_LAMBDA_RUNTIMES = new Set([
  "nodejs10.x", "nodejs12.x", "nodejs14.x", "nodejs16.x",
  "python2.7", "python3.6", "python3.7", "python3.8",
  "ruby2.5", "ruby2.7",
  "dotnetcore2.1", "dotnetcore3.1", "dotnet5.0", "dotnet6", "dotnet7",
  "go1.x",
  "java8",
  "provided",
]);

export function isDeprecatedLambdaRuntime(runtime: string | undefined): boolean {
  if (!runtime) return false;
  return DEPRECATED_LAMBDA_RUNTIMES.has(runtime.toLowerCase());
}

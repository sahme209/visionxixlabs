/**
 * Unified cross-cloud inventory builder.
 *
 * Calls every per-cloud extractor in parallel, then folds them into a
 * single normalized resource catalog. Three resource families are
 * captured because they're the universal nouns every cloud team
 * thinks about:
 *
 *   • compute   — AWS EC2 instances + Azure VMs + GCP Compute instances
 *   • storage   — AWS S3 buckets + Azure storage accounts + GCP buckets
 *   • databases — AWS RDS instances (Azure SQL + Cloud SQL when wired)
 *
 * Plus first-class posture rollups (public exposure, encryption,
 * MFA-less IAM) per cloud and a combined "headline risk" count.
 *
 * Why one builder: every cross-cloud surface (dashboard, copilot,
 * autonomy reasoner) reads from this single typed result instead of
 * juggling 3 cloud APIs and trying to merge themselves.
 *
 * Hard rules:
 *   - Read-only. Never mutates a resource.
 *   - Per-cloud failures isolated — Azure can blow up and AWS data
 *     still flows.
 *   - All counts are real or zero. No fabricated numbers, ever.
 */

import "server-only";

import { buildAwsServiceInventory } from "./aws/awsServiceInventoryExtractor";
import { extractAzureLiveInventory } from "./azure/azureLiveInventory";
import { extractAzureStorageAccounts } from "./azure/azureStorageExtractor";
import { extractGcpLiveInventory } from "./gcp/gcpLiveInventory";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type CloudId = "aws" | "azure" | "gcp";
export type ResourceFamily = "compute" | "storage" | "database";

export interface UnifiedResourceTotals {
  compute: number;
  storage: number;
  database: number;
}

export interface UnifiedCloudSection {
  cloud: CloudId;
  mode: "live" | "preview" | "blocked" | "disabled" | "partial";
  /** Tenant/account/subscription/project id when available. */
  scopeId?: string;
  totals: UnifiedResourceTotals;
  /** Public-facing exposure indicators rolled up per cloud. */
  publicExposureCount: number;
  /** Plaintext / unencrypted resource count (S3 + Azure storage + RDS). */
  unencryptedCount: number;
  /** Identity / access weakness count (MFA-less users, etc). */
  identityWeaknessCount: number;
  /** Headline numbers shown in the dashboard ribbon for this cloud. */
  headline: { label: string; value: string }[];
  limitations: string[];
}

export interface UnifiedInventoryReport {
  generatedAt: string;
  durationMs: number;
  totals: UnifiedResourceTotals;
  totalResources: number;
  totalPublicExposure: number;
  totalUnencrypted: number;
  totalIdentityWeakness: number;
  sections: UnifiedCloudSection[];
  limitations: string[];
}

export interface BuildUnifiedInventoryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildUnifiedInventory(input: BuildUnifiedInventoryInput): Promise<UnifiedInventoryReport> {
  const start = Date.now();

  const [awsR, azureR, azureStorageR, gcpR] = await Promise.allSettled([
    buildAwsServiceInventory({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    extractAzureLiveInventory(),
    extractAzureStorageAccounts(),
    extractGcpLiveInventory(),
  ]);

  const sections: UnifiedCloudSection[] = [];
  const limitations: string[] = [];

  // AWS section
  if (awsR.status === "fulfilled") {
    const r = awsR.value;
    const compute = r.ec2.total;
    const storage = r.s3.total;
    const database = r.rds.total;
    const publicExposure = r.ec2.publicIpCount + r.s3.publiclyExposedCount + r.rds.publiclyAccessibleCount + r.loadBalancers.publicCount;
    const unencrypted = r.s3.unencryptedCount + r.rds.unencryptedCount;
    const identityWeakness = r.iam.usersWithoutMfaCount + r.iam.rolesWithWildcardTrustCount;
    sections.push({
      cloud: "aws",
      mode: deriveAwsMode(r),
      scopeId: r.accountIdLastFour ? `***${r.accountIdLastFour}` : undefined,
      totals: { compute, storage, database },
      publicExposureCount: publicExposure,
      unencryptedCount: unencrypted,
      identityWeaknessCount: identityWeakness,
      headline: [
        { label: "EC2", value: String(compute) },
        { label: "S3", value: String(storage) },
        { label: "RDS", value: String(database) },
        { label: "Lambda", value: String(r.lambda.total) },
        { label: "Public IPs", value: String(r.ec2.publicIpCount) },
        { label: "IAM users", value: String(r.iam.totalUsers) },
      ],
      limitations: collectAwsLimitations(r),
    });
  } else {
    sections.push(emptySection("aws", `AWS extractor crashed: ${errMessage(awsR.reason)}`));
    limitations.push(`AWS: ${errMessage(awsR.reason)}`);
  }

  // Azure section — merge live inventory + storage deep posture.
  const azureLiveOk = azureR.status === "fulfilled" ? azureR.value : null;
  const azureStorageOk = azureStorageR.status === "fulfilled" ? azureStorageR.value : null;
  if (azureLiveOk || azureStorageOk) {
    const compute = azureLiveOk?.counts.vmCount ?? 0;
    const storage = azureStorageOk?.total ?? azureLiveOk?.counts.storageAccountCount ?? 0;
    const database = 0; // Azure SQL extractor not yet wired into this builder.
    const publicExposure = (azureLiveOk?.publicIpExposedVmCount ?? 0)
      + (azureStorageOk?.publicBlobAccessCount ?? 0)
      + (azureStorageOk?.publicNetworkCount ?? 0);
    const unencrypted = (azureLiveOk?.unencryptedStorageCount ?? 0)
      + (azureStorageOk?.nonHttpsCount ?? 0);
    const identityWeakness = azureStorageOk?.weakTlsCount ?? 0;
    sections.push({
      cloud: "azure",
      mode: deriveAzureMode(azureLiveOk?.mode, azureStorageOk?.mode),
      scopeId: azureLiveOk?.subscriptionId,
      totals: { compute, storage, database },
      publicExposureCount: publicExposure,
      unencryptedCount: unencrypted,
      identityWeaknessCount: identityWeakness,
      headline: [
        { label: "VMs", value: String(compute) },
        { label: "Storage", value: String(storage) },
        { label: "Public blob", value: String(azureStorageOk?.publicBlobAccessCount ?? 0) },
        { label: "Weak TLS", value: String(azureStorageOk?.weakTlsCount ?? 0) },
        { label: "VNets", value: String(azureLiveOk?.counts.vnetCount ?? 0) },
        { label: "NSGs", value: String(azureLiveOk?.counts.nsgCount ?? 0) },
      ],
      limitations: [
        ...(azureLiveOk?.limitations ?? []),
        ...(azureStorageOk?.limitations ?? []),
      ],
    });
  } else {
    sections.push(emptySection("azure", `Azure extractors crashed: ${errMessage((azureR as PromiseRejectedResult).reason)}`));
    limitations.push(`Azure: ${errMessage((azureR as PromiseRejectedResult).reason)}`);
  }

  // GCP section
  if (gcpR.status === "fulfilled") {
    const r = gcpR.value;
    sections.push({
      cloud: "gcp",
      mode: r.mode === "live" ? "live" : r.mode,
      scopeId: r.projectId,
      totals: {
        compute: r.counts.instanceCount,
        storage: r.counts.bucketCount,
        database: 0,
      },
      publicExposureCount: r.publicBucketCount + r.allOpenFirewallCount,
      unencryptedCount: 0,
      identityWeaknessCount: 0,
      headline: [
        { label: "Instances", value: String(r.counts.instanceCount) },
        { label: "Buckets", value: String(r.counts.bucketCount) },
        { label: "Firewalls", value: String(r.counts.firewallRuleCount) },
        { label: "Public buckets", value: String(r.publicBucketCount) },
        { label: "0.0.0.0/0 FW", value: String(r.allOpenFirewallCount) },
      ],
      limitations: r.limitations,
    });
  } else {
    sections.push(emptySection("gcp", `GCP extractor crashed: ${errMessage(gcpR.reason)}`));
    limitations.push(`GCP: ${errMessage(gcpR.reason)}`);
  }

  const totals = sections.reduce<UnifiedResourceTotals>(
    (acc, s) => ({
      compute: acc.compute + s.totals.compute,
      storage: acc.storage + s.totals.storage,
      database: acc.database + s.totals.database,
    }),
    { compute: 0, storage: 0, database: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    totals,
    totalResources: totals.compute + totals.storage + totals.database,
    totalPublicExposure: sections.reduce((n, s) => n + s.publicExposureCount, 0),
    totalUnencrypted: sections.reduce((n, s) => n + s.unencryptedCount, 0),
    totalIdentityWeakness: sections.reduce((n, s) => n + s.identityWeaknessCount, 0),
    sections,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptySection(cloud: CloudId, note: string): UnifiedCloudSection {
  return {
    cloud,
    mode: "blocked",
    totals: { compute: 0, storage: 0, database: 0 },
    publicExposureCount: 0,
    unencryptedCount: 0,
    identityWeaknessCount: 0,
    headline: [],
    limitations: [note],
  };
}

function deriveAwsMode(r: Awaited<ReturnType<typeof buildAwsServiceInventory>>): UnifiedCloudSection["mode"] {
  // If any of the major sections is live, consider AWS at least "partial".
  const modes = [r.ec2.mode, r.s3.mode, r.rds.mode, r.iam.mode, r.lambda.mode];
  if (modes.every((m) => m === "live")) return "live";
  if (modes.some((m) => m === "live")) return "partial";
  if (modes.every((m) => m === "blocked")) return "blocked";
  if (modes.some((m) => m === "preview")) return "preview";
  return "blocked";
}

function deriveAzureMode(a?: string, b?: string): UnifiedCloudSection["mode"] {
  const xs = [a, b].filter(Boolean) as string[];
  if (xs.length === 0) return "blocked";
  if (xs.every((m) => m === "live")) return "live";
  if (xs.some((m) => m === "live")) return "partial";
  if (xs.every((m) => m === "blocked")) return "blocked";
  if (xs.some((m) => m === "preview")) return "preview";
  return "blocked";
}

function collectAwsLimitations(r: Awaited<ReturnType<typeof buildAwsServiceInventory>>): string[] {
  const out: string[] = [];
  for (const key of ["lambda", "rds", "iam", "s3", "ec2", "network", "loadBalancers", "messaging"] as const) {
    const section = r[key] as { limitations?: string[] };
    if (section?.limitations?.length) out.push(...section.limitations.map((m) => `${key}: ${m}`));
  }
  return out;
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

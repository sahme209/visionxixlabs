/**
 * Unified cross-cloud inventory builder.
 *
 * Reads tenant-bound AWS inventory and explicitly blocks unwired clouds in a
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

  const [awsR] = await Promise.allSettled([
    buildAwsServiceInventory({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
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

  // Legacy Azure extractors use deployment credentials, not tenant authority.
  sections.push(emptySection("azure", "Tenant-scoped Azure inventory is not wired to this view. Use the verified desktop Azure connection."));

  // Host-scoped GCP credentials do not authorize this tenant's inventory.
  // Keep the separately server-owned extractor outside this request path.
  sections.push(emptySection("gcp", "gcp.tenant_connection_required: GCP inventory needs a verified workspace connection bound to the selected project. No inventory was read."));

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

function collectAwsLimitations(r: Awaited<ReturnType<typeof buildAwsServiceInventory>>): string[] {
  const out: string[] = [];
  for (const key of ["lambda", "rds", "iam", "s3", "ec2", "network", "loadBalancers", "messaging"] as const) {
    const section = r[key] as { limitations?: string[] };
    if (section?.limitations?.length) out.push(...section.limitations.map((m) => `${key}: ${m}`));
  }
  return out;
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

/**
 * Honest preview AWS scanner.
 *
 * When live STS isn't configured (or live mode is intentionally disabled),
 * the pipeline calls this scanner. It produces deterministic preview
 * snapshots, findings, and recommendations clearly tagged `source:
 * "preview"` so every downstream surface labels the data correctly.
 *
 * No real STS / EC2 / S3 / RDS calls — purely typed output for the
 * onboarding-to-Command-Center flow to feel coherent before live mode is
 * configured.
 */

import "server-only";
import type { OrganizationId, SnapshotId } from "@/lib/domain/ids";
import { id } from "@/lib/domain/ids";

export interface PreviewSnapshot {
  snapshotId: SnapshotId;
  organizationId: OrganizationId;
  provider: "aws";
  region: string;
  generatedAt: string;
  source: "live" | "partial" | "preview";
  resourceCounts: {
    ec2: number;
    s3: number;
    rds: number;
    iamRoles: number;
    vpcs: number;
  };
  /** Lightly anonymised set of resources so the UI has structure to render. */
  resources: { id: string; kind: string; region: string; tag?: string }[];
}

export interface PreviewFinding {
  id: string;
  snapshotId: SnapshotId;
  ruleCode: string;
  title: string;
  description: string;
  risk: "info" | "low" | "medium" | "high" | "critical";
  resourceRef: string;
  source: "live" | "preview";
}

export interface PreviewRecommendation {
  id: string;
  findingId: string;
  title: string;
  description: string;
  actionClass: "cost_optimization" | "security_remediation" | "drift_correction" | "scaling" | "iam_modification";
  monthlySavingsUsd?: number;
  source: "live" | "preview";
}

export interface PreviewScanOutcome {
  snapshot: PreviewSnapshot;
  findings: PreviewFinding[];
  recommendations: PreviewRecommendation[];
  /** Wall-clock duration we report — kept small (~120 ms) so the UI feels real. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Deterministic preview data
// ---------------------------------------------------------------------------

export interface PreviewScanInput {
  organizationId: OrganizationId;
  region?: string;
}

export async function runPreviewAwsScan(input: PreviewScanInput): Promise<PreviewScanOutcome> {
  // Small async pause so traces don't look implausibly instant.
  await new Promise((r) => setTimeout(r, 120));

  const region = input.region ?? "us-east-1";
  const snapshotId = id.snapshot(`snp_preview_${Date.now().toString(36)}`);

  const snapshot: PreviewSnapshot = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "aws",
    region,
    generatedAt: new Date().toISOString(),
    source: "preview",
    resourceCounts: { ec2: 6, s3: 4, rds: 2, iamRoles: 9, vpcs: 1 },
    resources: [
      { id: "i-0a1b2c3d", kind: "ec2",  region, tag: "web-prod" },
      { id: "i-0a1b2c4e", kind: "ec2",  region, tag: "web-staging" },
      { id: "i-0a1b2c5f", kind: "ec2",  region, tag: "worker-prod" },
      { id: "vol-001",   kind: "ebs",  region, tag: "web-prod-root" },
      { id: "vpc-001",   kind: "vpc",  region, tag: "default" },
      { id: "bkt-public-uploads",  kind: "s3", region, tag: "uploads" },
      { id: "bkt-private-backups", kind: "s3", region, tag: "backups" },
      { id: "rds-payments-prod",   kind: "rds", region, tag: "payments" },
      { id: "rds-analytics-stg",   kind: "rds", region, tag: "analytics" },
    ],
  };

  const findings: PreviewFinding[] = [
    {
      id: `find_${snapshotId}_s3_pub`,
      snapshotId,
      ruleCode: "s3.public_bucket",
      title: "S3 bucket has public read access",
      description: "bkt-public-uploads grants public read; review whether intentional.",
      risk: "high",
      resourceRef: "bkt-public-uploads",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_ec2_idle`,
      snapshotId,
      ruleCode: "ec2.idle_instance",
      title: "EC2 instance with low utilisation",
      description: "i-0a1b2c4e shows < 5% average CPU over 14 days — candidate for rightsizing.",
      risk: "medium",
      resourceRef: "i-0a1b2c4e",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_rds_old_engine`,
      snapshotId,
      ruleCode: "rds.engine_outdated",
      title: "RDS engine version behind current minor",
      description: "rds-analytics-stg running an older minor version with known CVE.",
      risk: "medium",
      resourceRef: "rds-analytics-stg",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_iam_wildcard`,
      snapshotId,
      ruleCode: "iam.policy_wildcard",
      title: "IAM role uses wildcard action",
      description: "Action: '*' grants more than needed — narrow to specific service:Action pairs.",
      risk: "high",
      resourceRef: "role/AdminLikeAccess",
      source: "preview",
    },
  ];

  const recommendations: PreviewRecommendation[] = [
    {
      id: `rec_${snapshotId}_close_s3`,
      findingId: findings[0].id,
      title: "Block public access on bkt-public-uploads",
      description: "Apply S3 Block Public Access at the bucket and account level.",
      actionClass: "security_remediation",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_rightsize_ec2`,
      findingId: findings[1].id,
      title: "Rightsize idle EC2 to t3.small",
      description: "Switch from t3.large to t3.small — saves ~$520/mo with no observed impact.",
      actionClass: "cost_optimization",
      monthlySavingsUsd: 520,
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_patch_rds`,
      findingId: findings[2].id,
      title: "Apply minor RDS version upgrade",
      description: "Schedule a maintenance window for the next minor upgrade.",
      actionClass: "drift_correction",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_tighten_iam`,
      findingId: findings[3].id,
      title: "Replace wildcard IAM action with explicit list",
      description: "Use IAM Access Analyzer to derive least-privilege action set.",
      actionClass: "iam_modification",
      source: "preview",
    },
  ];

  return { snapshot, findings, recommendations, durationMs: 120 };
}

/**
 * Honest GCP preview scanner — mirrors AWS + Azure preview scanners.
 */

import "server-only";
import { id } from "@/lib/domain/ids";
import type { OrganizationId, SnapshotId } from "@/lib/domain/ids";

export interface GcpPreviewSnapshot {
  snapshotId: SnapshotId;
  organizationId: OrganizationId;
  provider: "gcp";
  region: string;
  generatedAt: string;
  source: "preview";
  resourceCounts: {
    computeInstance: number;
    storageBucket: number;
    cloudSql: number;
    vpc: number;
    firewall: number;
  };
  resources: { id: string; kind: string; region: string; tag?: string }[];
}

export interface GcpPreviewFinding {
  id: string;
  snapshotId: SnapshotId;
  ruleCode: string;
  title: string;
  description: string;
  risk: "info" | "low" | "medium" | "high" | "critical";
  resourceRef: string;
  source: "preview";
}

export interface GcpPreviewRecommendation {
  id: string;
  findingId: string;
  title: string;
  description: string;
  actionClass: "cost_optimization" | "security_remediation" | "drift_correction";
  monthlySavingsUsd?: number;
  source: "preview";
}

export interface GcpPreviewOutcome {
  snapshot: GcpPreviewSnapshot;
  findings: GcpPreviewFinding[];
  recommendations: GcpPreviewRecommendation[];
  durationMs: number;
}

export interface GcpPreviewInput {
  organizationId: OrganizationId;
  region?: string;
}

export async function runPreviewGcpScan(input: GcpPreviewInput): Promise<GcpPreviewOutcome> {
  await new Promise((r) => setTimeout(r, 120));
  const region = input.region ?? "us-central1";
  const snapshotId = id.snapshot(`snp_gcp_preview_${Date.now().toString(36)}`);

  const snapshot: GcpPreviewSnapshot = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "gcp",
    region,
    generatedAt: new Date().toISOString(),
    source: "preview",
    resourceCounts: { computeInstance: 4, storageBucket: 3, cloudSql: 1, vpc: 1, firewall: 3 },
    resources: [
      { id: "instance-web-prod-01", kind: "compute_instance", region, tag: "web-prod" },
      { id: "instance-web-prod-02", kind: "compute_instance", region, tag: "web-prod" },
      { id: "instance-job-prod-01", kind: "compute_instance", region, tag: "job-prod" },
      { id: "bkt-public-uploads",   kind: "storage_bucket",   region, tag: "uploads" },
      { id: "bkt-private-logs",     kind: "storage_bucket",   region, tag: "logs" },
      { id: "sql-payments-prod",    kind: "cloud_sql",        region, tag: "payments" },
      { id: "vpc-default",          kind: "vpc",              region, tag: "default" },
      { id: "fw-allow-22",          kind: "firewall_rule",    region, tag: "ssh-any" },
    ],
  };

  const findings: GcpPreviewFinding[] = [
    {
      id: `find_${snapshotId}_bkt_public`,
      snapshotId,
      ruleCode: "gcp.bucket.public",
      title: "Cloud Storage bucket is allUsers readable",
      description: "bkt-public-uploads grants allUsers:objectViewer.",
      risk: "high",
      resourceRef: "bkt-public-uploads",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_fw_22_any`,
      snapshotId,
      ruleCode: "gcp.firewall.ssh_any",
      title: "Firewall rule allows SSH from 0.0.0.0/0",
      description: "fw-allow-22 permits inbound 22 from any source.",
      risk: "critical",
      resourceRef: "fw-allow-22",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_sql_no_backup`,
      snapshotId,
      ruleCode: "gcp.sql.no_backup",
      title: "Cloud SQL instance has automated backups disabled",
      description: "sql-payments-prod has no automated daily backup configured.",
      risk: "high",
      resourceRef: "sql-payments-prod",
      source: "preview",
    },
  ];

  const recommendations: GcpPreviewRecommendation[] = [
    {
      id: `rec_${snapshotId}_lock_bucket`,
      findingId: findings[0].id,
      title: "Remove allUsers binding on bkt-public-uploads",
      description: "Bind to a specific service account or signed URL flow instead.",
      actionClass: "security_remediation",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_narrow_fw`,
      findingId: findings[1].id,
      title: "Narrow fw-allow-22 to IAP source range",
      description: "Use Google's IAP source range 35.235.240.0/20 instead of 0.0.0.0/0.",
      actionClass: "security_remediation",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_enable_backup`,
      findingId: findings[2].id,
      title: "Enable Cloud SQL automated backups",
      description: "7-day retention with PITR is the recommended default.",
      actionClass: "drift_correction",
      source: "preview",
    },
  ];

  return { snapshot, findings, recommendations, durationMs: 120 };
}

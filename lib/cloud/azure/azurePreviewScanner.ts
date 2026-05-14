/**
 * Honest Azure preview scanner — mirrors the AWS preview scanner shape so
 * the multi-cloud pipeline can branch on provider without per-provider
 * UI code.
 */

import "server-only";
import { id } from "@/lib/domain/ids";
import type { OrganizationId, SnapshotId } from "@/lib/domain/ids";

export interface AzurePreviewSnapshot {
  snapshotId: SnapshotId;
  organizationId: OrganizationId;
  provider: "azure";
  location: string;
  generatedAt: string;
  source: "preview";
  resourceCounts: {
    vm: number;
    storage: number;
    sql: number;
    vnet: number;
    nsg: number;
  };
  resources: { id: string; kind: string; location: string; tag?: string }[];
}

export interface AzurePreviewFinding {
  id: string;
  snapshotId: SnapshotId;
  ruleCode: string;
  title: string;
  description: string;
  risk: "info" | "low" | "medium" | "high" | "critical";
  resourceRef: string;
  source: "preview";
}

export interface AzurePreviewRecommendation {
  id: string;
  findingId: string;
  title: string;
  description: string;
  actionClass: "cost_optimization" | "security_remediation" | "drift_correction" | "scaling";
  monthlySavingsUsd?: number;
  source: "preview";
}

export interface AzurePreviewOutcome {
  snapshot: AzurePreviewSnapshot;
  findings: AzurePreviewFinding[];
  recommendations: AzurePreviewRecommendation[];
  durationMs: number;
}

export interface AzurePreviewInput {
  organizationId: OrganizationId;
  location?: string;
}

export async function runPreviewAzureScan(input: AzurePreviewInput): Promise<AzurePreviewOutcome> {
  await new Promise((r) => setTimeout(r, 120));
  const location = input.location ?? "eastus";
  const snapshotId = id.snapshot(`snp_az_preview_${Date.now().toString(36)}`);

  const snapshot: AzurePreviewSnapshot = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "azure",
    location,
    generatedAt: new Date().toISOString(),
    source: "preview",
    resourceCounts: { vm: 5, storage: 3, sql: 1, vnet: 1, nsg: 4 },
    resources: [
      { id: "vm-web-prod-01",    kind: "vm",      location, tag: "web-prod" },
      { id: "vm-web-prod-02",    kind: "vm",      location, tag: "web-prod" },
      { id: "vm-worker-stg-01",  kind: "vm",      location, tag: "worker-staging" },
      { id: "stuploads",         kind: "storage", location, tag: "uploads" },
      { id: "stbackups",         kind: "storage", location, tag: "backups" },
      { id: "sqldb-payments",    kind: "sql",     location, tag: "payments" },
      { id: "vnet-prod",         kind: "vnet",    location, tag: "prod" },
      { id: "nsg-web-public",    kind: "nsg",     location, tag: "web" },
    ],
  };

  const findings: AzurePreviewFinding[] = [
    {
      id: `find_${snapshotId}_storage_pub`,
      snapshotId,
      ruleCode: "azure.storage.public",
      title: "Storage account allows public blob access",
      description: "stuploads has public blob access enabled. Disable unless intentional.",
      risk: "high",
      resourceRef: "stuploads",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_nsg_open`,
      snapshotId,
      ruleCode: "azure.nsg.allow_any",
      title: "NSG allows inbound any/any",
      description: "nsg-web-public has an inbound rule allowing 0.0.0.0/0 on port 22.",
      risk: "critical",
      resourceRef: "nsg-web-public",
      source: "preview",
    },
    {
      id: `find_${snapshotId}_vm_idle`,
      snapshotId,
      ruleCode: "azure.vm.idle",
      title: "VM with low utilisation",
      description: "vm-worker-stg-01 < 6% CPU over 14 days. Candidate for downsize.",
      risk: "medium",
      resourceRef: "vm-worker-stg-01",
      source: "preview",
    },
  ];

  const recommendations: AzurePreviewRecommendation[] = [
    {
      id: `rec_${snapshotId}_close_storage`,
      findingId: findings[0].id,
      title: "Disable public blob access on stuploads",
      description: "Set `allowBlobPublicAccess = false` at the storage account level.",
      actionClass: "security_remediation",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_tighten_nsg`,
      findingId: findings[1].id,
      title: "Restrict NSG inbound 22 to bastion subnet",
      description: "Replace 0.0.0.0/0 source with the bastion subnet CIDR.",
      actionClass: "security_remediation",
      source: "preview",
    },
    {
      id: `rec_${snapshotId}_resize_vm`,
      findingId: findings[2].id,
      title: "Resize vm-worker-stg-01 from D2 to B2",
      description: "Saves ~$340/mo with no observed performance impact.",
      actionClass: "cost_optimization",
      monthlySavingsUsd: 340,
      source: "preview",
    },
  ];

  return { snapshot, findings, recommendations, durationMs: 120 };
}

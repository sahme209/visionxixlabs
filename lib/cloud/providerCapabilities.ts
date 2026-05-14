/**
 * Normalised multi-cloud capability map.
 *
 * Axiom reasons across providers using equivalent concepts: an AWS EC2
 * instance, an Azure VM, and a GCP Compute Engine instance are all
 * "compute". A single capability table lets the reasoner, UI, and audit
 * layer treat them the same.
 */

import type { CloudProvider } from "@/lib/domain/provider";

export type CapabilityCategory =
  | "compute"
  | "storage_object"
  | "storage_block"
  | "database"
  | "network_vpc"
  | "network_firewall"
  | "identity"
  | "pipeline"
  | "cost"
  | "monitoring";

export type CapabilityStatus = "live" | "preview" | "expanding" | "planned";

export interface ProviderCapability {
  category: CapabilityCategory;
  /** Provider-native term ("EC2 instance", "Azure VM"). */
  providerName: string;
  /** Honest current state per provider. */
  status: CapabilityStatus;
  /** Scanner module that ships data for this capability today. */
  scannerModule?: string;
}

export interface ProviderCapabilityTable {
  provider: CloudProvider;
  capabilities: ProviderCapability[];
}

// ---------------------------------------------------------------------------
// Per-provider tables
// ---------------------------------------------------------------------------

export const CAPABILITY_TABLES: ProviderCapabilityTable[] = [
  {
    provider: "aws",
    capabilities: [
      { category: "compute",          providerName: "EC2 instance",      status: "preview", scannerModule: "lib/cloud/aws/awsPreviewScanner.ts" },
      { category: "storage_object",   providerName: "S3 bucket",         status: "preview", scannerModule: "lib/cloud/aws/awsPreviewScanner.ts" },
      { category: "storage_block",    providerName: "EBS volume",        status: "preview", scannerModule: "lib/cloud/aws/awsPreviewScanner.ts" },
      { category: "database",         providerName: "RDS instance",      status: "preview", scannerModule: "lib/cloud/aws/awsPreviewScanner.ts" },
      { category: "network_vpc",      providerName: "VPC",               status: "preview", scannerModule: "lib/cloud/aws/awsPreviewScanner.ts" },
      { category: "network_firewall", providerName: "Security group",    status: "preview" },
      { category: "identity",         providerName: "IAM role/policy",   status: "preview" },
      { category: "cost",             providerName: "Cost Explorer",     status: "planned" },
      { category: "monitoring",       providerName: "CloudWatch",        status: "planned" },
    ],
  },
  {
    provider: "azure",
    capabilities: [
      { category: "compute",          providerName: "Virtual Machine",       status: "preview", scannerModule: "lib/cloud/azure/azurePreviewScanner.ts" },
      { category: "storage_object",   providerName: "Blob Storage",          status: "preview", scannerModule: "lib/cloud/azure/azurePreviewScanner.ts" },
      { category: "storage_block",    providerName: "Managed Disk",          status: "expanding" },
      { category: "database",         providerName: "Azure SQL Database",    status: "preview", scannerModule: "lib/cloud/azure/azurePreviewScanner.ts" },
      { category: "network_vpc",      providerName: "Virtual Network",       status: "preview", scannerModule: "lib/cloud/azure/azurePreviewScanner.ts" },
      { category: "network_firewall", providerName: "Network Security Group", status: "preview", scannerModule: "lib/cloud/azure/azurePreviewScanner.ts" },
      { category: "identity",         providerName: "Entra ID / RBAC",       status: "expanding" },
      { category: "cost",             providerName: "Cost Management",       status: "planned" },
      { category: "monitoring",       providerName: "Azure Monitor",         status: "planned" },
    ],
  },
  {
    provider: "gcp",
    capabilities: [
      { category: "compute",          providerName: "Compute Engine",      status: "preview", scannerModule: "lib/cloud/gcp/gcpPreviewScanner.ts" },
      { category: "storage_object",   providerName: "Cloud Storage",       status: "preview", scannerModule: "lib/cloud/gcp/gcpPreviewScanner.ts" },
      { category: "storage_block",    providerName: "Persistent Disk",     status: "expanding" },
      { category: "database",         providerName: "Cloud SQL",           status: "preview", scannerModule: "lib/cloud/gcp/gcpPreviewScanner.ts" },
      { category: "network_vpc",      providerName: "VPC",                 status: "preview", scannerModule: "lib/cloud/gcp/gcpPreviewScanner.ts" },
      { category: "network_firewall", providerName: "Firewall Rule",       status: "preview", scannerModule: "lib/cloud/gcp/gcpPreviewScanner.ts" },
      { category: "identity",         providerName: "IAM",                 status: "expanding" },
      { category: "cost",             providerName: "Billing Reports",     status: "planned" },
      { category: "monitoring",       providerName: "Cloud Monitoring",    status: "planned" },
    ],
  },
];

export function capabilitiesFor(provider: CloudProvider): ProviderCapability[] {
  return CAPABILITY_TABLES.find((t) => t.provider === provider)?.capabilities ?? [];
}

export function capabilityAcrossProviders(category: CapabilityCategory): { provider: CloudProvider; capability: ProviderCapability | undefined }[] {
  return CAPABILITY_TABLES.map((t) => ({
    provider: t.provider,
    capability: t.capabilities.find((c) => c.category === category),
  }));
}

// ---------------------------------------------------------------------------
// Aggregate summary
// ---------------------------------------------------------------------------

export interface CapabilitySummary {
  total: number;
  live: number;
  preview: number;
  expanding: number;
  planned: number;
}

export function summarizeCapabilities(): Record<CloudProvider, CapabilitySummary> {
  const out: Record<string, CapabilitySummary> = {};
  for (const t of CAPABILITY_TABLES) {
    const s: CapabilitySummary = { total: t.capabilities.length, live: 0, preview: 0, expanding: 0, planned: 0 };
    for (const c of t.capabilities) {
      if (c.status === "live") s.live++;
      else if (c.status === "preview") s.preview++;
      else if (c.status === "expanding") s.expanding++;
      else s.planned++;
    }
    out[t.provider] = s;
  }
  return out as Record<CloudProvider, CapabilitySummary>;
}

export const CATEGORY_LABEL: Record<CapabilityCategory, string> = {
  compute:          "Compute",
  storage_object:   "Object storage",
  storage_block:    "Block storage",
  database:         "Database",
  network_vpc:      "VPC",
  network_firewall: "Firewall",
  identity:         "Identity",
  pipeline:         "Pipeline",
  cost:             "Cost",
  monitoring:       "Monitoring",
};

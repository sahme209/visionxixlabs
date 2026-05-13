/**
 * Normalized cloud snapshot model — provider-agnostic resource graph.
 *
 * Provider adapters (AWS, Azure, GCP) emit raw resources in provider-specific
 * shapes; this module defines the typed normalized shape every downstream
 * system (signal engine, reasoning, topology, ReleaseOps) reads from.
 *
 * Adding a new provider = implementing snapshot adapters that produce this
 * shape. The rest of the platform doesn't change.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// Common resource types (provider-agnostic)
// ---------------------------------------------------------------------------

export type ResourceKind =
  | "compute.instance"        // EC2 / Azure VM / GCE
  | "compute.serverless"      // Lambda / Functions / Cloud Run
  | "compute.container"       // ECS / AKS / GKE
  | "compute.autoscaling"     // ASG / VMSS / MIG
  | "storage.object"          // S3 / Blob / GCS
  | "storage.block"           // EBS / Managed Disk / Persistent Disk
  | "storage.file"            // EFS / Files / Filestore
  | "database.relational"     // RDS / SQL / Cloud SQL
  | "database.cache"          // ElastiCache / Cache for Redis / Memorystore
  | "database.nosql"          // DynamoDB / Cosmos / Firestore
  | "network.vpc"             // VPC / VNet / VPC
  | "network.subnet"
  | "network.firewall"        // Security Group / NSG / Firewall Rule
  | "network.loadbalancer"    // ELB/ALB / Azure LB / GCLB
  | "network.gateway"         // NAT GW / Transit GW / Cloud NAT
  | "identity.principal"      // IAM User / Service Principal / Service Account
  | "identity.role"           // IAM Role / Custom Role / Custom Role
  | "identity.policy"         // IAM Policy / Role Assignment / IAM Binding
  | "observability.logs"      // Log Group / Log Analytics / Logging
  | "observability.metrics"   // CloudWatch / Monitor / Cloud Monitoring
  | "observability.alarm"     // CloudWatch Alarm / Alert / Alert Policy
  | "secrets.store"           // Secrets Manager / Key Vault / Secret Manager
  | "key.kms"                 // KMS / Key Vault key / KMS key
  | "other";                  // Anything that doesn't fit the taxonomy

/** Generic resource identifier — provider-specific id + provider tag. */
export interface ResourceRef {
  id: string;                 // Provider-specific resource ID
  arn?: string;               // AWS ARN if applicable
  uri?: string;               // GCP/Azure URI if applicable
  provider: CloudProvider;
  region?: string;
  accountId?: string;         // AWS account ID / Azure subscription ID / GCP project ID
}

/** Lifecycle / health state of a resource as observed. */
export type ResourceState = "running" | "stopped" | "terminated" | "creating" | "deleting" | "error" | "unknown";

/** Normalized resource entry — every resource in a snapshot conforms to this shape. */
export interface NormalizedResource {
  ref: ResourceRef;
  kind: ResourceKind;
  /** Human-friendly name (Name tag, displayName, etc.) */
  name?: string;
  state: ResourceState;
  createdAt?: string;
  /** Tags / labels, normalized. */
  tags: Record<string, string>;
  /** Provider-specific configuration (size, encryption, network config, etc.) */
  config: Record<string, unknown>;
  /** Monthly cost in USD if known. */
  monthlyCostUsd?: number;
  /** Risk classification, populated by the signal engine. */
  risks: ResourceRisk[];
  /** Resource references this resource depends on (parent VPC, IAM role, etc.) */
  dependencies?: ResourceRef[];
}

/** A risk attached to a resource — populated by the signal engine, not the adapter. */
export interface ResourceRisk {
  category: "cost" | "security" | "drift" | "performance" | "compliance" | "resilience";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  evidence: string;
  monthlyCostImpactUsd?: number;
}

/** Account / subscription / project metadata. */
export interface AccountMeta {
  id: string;
  displayName?: string;
  provider: CloudProvider;
  regions: string[];
  /** When this snapshot was collected from this account. */
  collectedAt: string;
  /** How long the scan took. */
  scanDurationMs?: number;
}

/** Top-level snapshot envelope — what a scan produces. */
export interface CloudSnapshot {
  id: string;
  organizationId: string;
  userId: string;
  /** One snapshot can span multiple accounts (multi-cloud or multi-account orgs). */
  accounts: AccountMeta[];
  resources: NormalizedResource[];
  /** Snapshot creation timestamp. */
  capturedAt: string;
  /** Snapshot diff against the prior snapshot (if any). */
  diff?: SnapshotDiff;
  /** Source: real scan vs synthetic demo data. UI surfaces this honestly. */
  source: "live" | "demo";
}

/** Diff between two snapshots — what was added, modified, removed. */
export interface SnapshotDiff {
  added: ResourceRef[];
  modified: { ref: ResourceRef; changedFields: string[] }[];
  removed: ResourceRef[];
  /** When the prior snapshot was captured. */
  baselineCapturedAt: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Group resources by kind. */
export function groupByKind(snapshot: CloudSnapshot): Record<ResourceKind, NormalizedResource[]> {
  const out = {} as Record<ResourceKind, NormalizedResource[]>;
  for (const r of snapshot.resources) {
    (out[r.kind] ??= []).push(r);
  }
  return out;
}

/** Group resources by provider. */
export function groupByProvider(snapshot: CloudSnapshot): Record<CloudProvider, NormalizedResource[]> {
  return snapshot.resources.reduce(
    (acc, r) => {
      (acc[r.ref.provider] ??= []).push(r);
      return acc;
    },
    {} as Record<CloudProvider, NormalizedResource[]>
  );
}

/** Total monthly cost across all resources with a cost assigned. */
export function totalMonthlyCost(snapshot: CloudSnapshot): number {
  return snapshot.resources.reduce((s, r) => s + (r.monthlyCostUsd ?? 0), 0);
}

/** Count risks across all resources, grouped by severity. */
export function summarizeRisks(snapshot: CloudSnapshot): Record<ResourceRisk["severity"], number> {
  const out: Record<ResourceRisk["severity"], number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of snapshot.resources) {
    for (const risk of r.risks) out[risk.severity]++;
  }
  return out;
}

/** Filter resources by kind prefix (e.g., "compute" matches all compute.* kinds). */
export function filterByKindPrefix(snapshot: CloudSnapshot, prefix: string): NormalizedResource[] {
  return snapshot.resources.filter((r) => r.kind.startsWith(prefix));
}

/** Map a NormalizedResource back to a stable string key suitable for React lists. */
export function resourceKey(r: NormalizedResource): string {
  return r.ref.arn ?? r.ref.uri ?? `${r.ref.provider}:${r.ref.accountId ?? "_"}:${r.ref.region ?? "_"}:${r.ref.id}`;
}

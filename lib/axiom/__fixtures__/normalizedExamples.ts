/**
 * Normalized snapshot examples for all three providers.
 * Used for testing the normalizer, cost signal derivation, and execution plan generation.
 */

import type {
  AwsSnapshotInput,
  AzureSnapshotInput,
  GcpSnapshotInput,
  NormalizedSnapshot,
} from "../normalizer";
import {
  normalizeAwsSnapshot,
  normalizeAzureSnapshot,
  normalizeGcpSnapshot,
} from "../normalizer";

// ---------------------------------------------------------------------------
// AWS — 2 EC2 instances + 2 S3 buckets, CloudWatch metrics on one instance
// ---------------------------------------------------------------------------

export const rawAwsInput: AwsSnapshotInput = {
  provider: "aws",
  accountId: "123456789012",
  scannedAt: "2026-05-08T10:00:00Z",
  regions: ["us-east-1", "us-west-2"],
  monthlySpend: 2400,
  flags: { singleRegion: false, noBackupsDetected: false },
  insights: [
    { title: "1 instance under 15% avg CPU — right-sizing candidate", severity: "warning" },
    { title: "2 S3 buckets on Standard — review for Intelligent-Tiering", severity: "info" },
  ],
  resources: [
    {
      resourceType: "compute",
      provider: "aws",
      resourceId: "i-0a1b2c3d4e5f",
      region: "us-east-1",
      instanceType: "m5.2xlarge",
      tier: "general",
      vcpus: 8,
      memoryGb: 32,
      state: "running",
      usage: { cpuAvgPct: 12, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
      tags: { Name: "api-prod-01", env: "production" },
    },
    {
      resourceType: "compute",
      provider: "aws",
      resourceId: "i-0f6e7d8c9b0a",
      region: "us-west-2",
      instanceType: "c5.xlarge",
      tier: "compute",
      vcpus: 4,
      memoryGb: 8,
      state: "running",
      // No CPU metrics — CloudWatch agent not installed
      monthlyCostEstimate: 124,
      tags: { Name: "batch-worker-01", env: "production" },
    },
    {
      resourceType: "storage",
      provider: "aws",
      resourceId: "logs-prod",
      region: "us-east-1",
      storageClass: "standard",
      sizeGb: 420,
      objectCount: 12_000_000,
      lastAccessedDaysAgo: 45,
      monthlyCostEstimate: 9.66,
    },
    {
      resourceType: "storage",
      provider: "aws",
      resourceId: "assets-cdn",
      region: "us-east-1",
      storageClass: "standard",
      sizeGb: 85,
      objectCount: 340_000,
      monthlyCostEstimate: 1.96,
    },
  ],
};

export const normalizedAws: NormalizedSnapshot = normalizeAwsSnapshot(rawAwsInput);

// ---------------------------------------------------------------------------
// Azure — 3 VMs + 1 storage account, Azure Monitor metrics on 2 VMs,
//          resource groups + blob containers attached
// ---------------------------------------------------------------------------

export const rawAzureInput: AzureSnapshotInput = {
  provider: "azure",
  accountId: "sub-a1b2c3d4-e5f6-7890",
  scannedAt: "2026-05-08T10:00:00Z",
  regions: ["eastus"],
  monthlySpend: 1800,
  flags: { singleRegion: true, noBackupsDetected: true },
  insights: [
    { title: "1 VM under 15% avg CPU — right-sizing candidate", severity: "warning" },
    { title: "1 deallocated VM — managed disks still billing", severity: "info" },
    { title: "No Recovery Services vault detected", severity: "critical" },
  ],
  resources: [
    {
      resourceType: "compute",
      provider: "azure",
      resourceId: "vm-api-prod-01",
      region: "eastus",
      instanceType: "Standard_D4s_v3",
      tier: "general",
      vcpus: 4,
      memoryGb: 16,
      state: "running",
      usage: { cpuAvgPct: 22, memoryAvgPct: 41, sampleWindowHours: 168 },
      monthlyCostEstimate: 140,
      tags: { environment: "production", team: "platform" },
    },
    {
      resourceType: "compute",
      provider: "azure",
      resourceId: "vm-worker-03",
      region: "eastus",
      instanceType: "Standard_D8s_v3",
      tier: "general",
      vcpus: 8,
      memoryGb: 32,
      state: "running",
      usage: { cpuAvgPct: 9, memoryAvgPct: 18, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
      tags: { environment: "production", team: "data" },
    },
    {
      resourceType: "compute",
      provider: "azure",
      resourceId: "vm-staging-01",
      region: "eastus",
      instanceType: "Standard_D2s_v3",
      tier: "general",
      vcpus: 2,
      memoryGb: 8,
      state: "deallocated",
      // No metrics — deallocated
      monthlyCostEstimate: 0,
    },
    {
      resourceType: "storage",
      provider: "azure",
      resourceId: "stprodlogs",
      region: "eastus",
      storageClass: "standard",
      sizeGb: 600,
      monthlyCostEstimate: 12.60,
    },
  ],
  resourceGroups: [
    { name: "rg-production", location: "eastus", provisioningState: "Succeeded" },
    { name: "rg-staging", location: "eastus", provisioningState: "Succeeded" },
  ],
  blobContainers: {
    stprodlogs: [
      { name: "logs", publicAccess: "None", lastModified: "2026-05-07T08:00:00Z" },
      { name: "backups", publicAccess: "None", lastModified: "2026-05-06T02:00:00Z" },
    ],
  },
  partialErrors: [],
};

export const normalizedAzure: NormalizedSnapshot = normalizeAzureSnapshot(rawAzureInput);

// ---------------------------------------------------------------------------
// GCP — 2 Compute Engine instances + 2 Cloud Storage buckets,
//        Cloud Monitoring metrics on both instances, bucket metadata
// ---------------------------------------------------------------------------

export const rawGcpInput: GcpSnapshotInput = {
  provider: "gcp",
  accountId: "my-project-prod-42",
  scannedAt: "2026-05-08T10:00:00Z",
  regions: ["us-central1", "europe-west1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  insights: [
    { title: "1 N1-series instance — consider migrating to N2/E2", severity: "info" },
    { title: "2 buckets on Standard class — review for Nearline/Autoclass", severity: "warning" },
  ],
  resources: [
    {
      resourceType: "compute",
      provider: "gcp",
      resourceId: "api-server-group-a1b2",
      region: "us-central1",
      instanceType: "n2-standard-8",
      tier: "general",
      vcpus: 8,
      memoryGb: 32,
      state: "running",
      usage: { cpuAvgPct: 35, sampleWindowHours: 168 },
      monthlyCostEstimate: 276,
      tags: { env: "production", team: "platform" },
    },
    {
      resourceType: "compute",
      provider: "gcp",
      resourceId: "ml-trainer-c3d4",
      region: "us-central1",
      instanceType: "n1-highmem-16",
      tier: "memory",
      vcpus: 16,
      memoryGb: 104,
      state: "running",
      usage: { cpuAvgPct: 72, sampleWindowHours: 168 },
      monthlyCostEstimate: 524,
      tags: { env: "production", team: "ml" },
    },
    {
      resourceType: "storage",
      provider: "gcp",
      resourceId: "data-lake-raw",
      region: "us-central1",
      storageClass: "standard",
      sizeGb: 2400,
      objectCount: 85_000,
      monthlyCostEstimate: 49.20,
    },
    {
      resourceType: "storage",
      provider: "gcp",
      resourceId: "eu-assets",
      region: "europe-west1",
      storageClass: "standard",
      // No size or object count — permissions missing
      monthlyCostEstimate: 20,
    },
  ],
  bucketMetadata: [
    {
      name: "data-lake-raw",
      location: "us-central1",
      storageClass: "STANDARD",
      objectCount: 85_000,
      totalSizeBytes: 2_576_980_377_600, // ~2400 GB
      lifecycleRules: 0,
      publicAccessPrevention: "enforced",
      versioningEnabled: false,
    },
    {
      name: "eu-assets",
      location: "europe-west1",
      storageClass: "STANDARD",
      objectCount: null,
      totalSizeBytes: null,
      lifecycleRules: 2,
      publicAccessPrevention: "enforced",
      versioningEnabled: true,
    },
  ],
  partialErrors: [],
};

export const normalizedGcp: NormalizedSnapshot = normalizeGcpSnapshot(rawGcpInput);

// ---------------------------------------------------------------------------
// Partial-failure example — GCP with Compute permission denied
// ---------------------------------------------------------------------------

export const rawGcpPartialFailure: GcpSnapshotInput = {
  provider: "gcp",
  accountId: "restricted-project-99",
  scannedAt: "2026-05-08T10:00:00Z",
  regions: ["us-east1"],
  flags: { singleRegion: true, noBackupsDetected: true },
  insights: [],
  resources: [
    {
      resourceType: "storage",
      provider: "gcp",
      resourceId: "app-uploads",
      region: "us-east1",
      storageClass: "standard",
      monthlyCostEstimate: 20,
    },
  ],
  bucketMetadata: [],
  partialErrors: [
    "Compute Engine enumeration failed: Permission 'compute.instances.list' denied. Check roles/compute.viewer.",
  ],
};

export const normalizedGcpPartial: NormalizedSnapshot = normalizeGcpSnapshot(rawGcpPartialFailure);

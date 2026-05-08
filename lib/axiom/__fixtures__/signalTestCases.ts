/**
 * Test fixtures for all 8 signal types across AWS, Azure, and GCP.
 * Each snapshot is crafted to trigger specific signals from deriveCostSignals().
 *
 * Signal types:
 *   1. compute_rightsizing   — oversized / under-utilized instances
 *   2. commitment_discount   — no RI / Reserved VM / CUD detected
 *   3. storage_tiering       — cold data on Standard tier (>5 buckets)
 *   4. single_region_risk    — all compute in one region
 *   5. multi_region_sprawl   — instances spread across >2 regions
 *   6. idle_compute          — <5% CPU over 7d OR stopped with disks
 *   7. public_storage        — buckets with public access tags
 *   8. backup_warning        — noBackupsDetected flag set
 */

import type { CloudSnapshot } from "../cloudSnapshot";
import { deriveCostSignals } from "../costSignals";
import type { SignalType } from "../costSignals";

// ---------------------------------------------------------------------------
// AWS snapshots — one per signal or combined
// ---------------------------------------------------------------------------

export const awsRightsizing: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  monthlySpend: 3000,
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "aws", resourceId: "i-rs01",
      region: "us-east-1", instanceType: "m5.2xlarge", tier: "general",
      vcpus: 8, memoryGb: 32, state: "running",
      usage: { cpuAvgPct: 18, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
    },
    {
      resourceType: "compute", provider: "aws", resourceId: "i-rs02",
      region: "us-east-1", instanceType: "m5.xlarge", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      monthlyCostEstimate: 140,
    },
  ],
};

export const awsCommitment: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: Array.from({ length: 5 }, (_, i) => ({
    resourceType: "compute" as const, provider: "aws" as const,
    resourceId: `i-commit-${i}`, region: "us-east-1",
    instanceType: "m5.xlarge", tier: "general" as const,
    vcpus: 4, memoryGb: 16, state: "running" as const,
    monthlyCostEstimate: 140,
  })),
};

export const awsStorageTiering: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: Array.from({ length: 6 }, (_, i) => ({
    resourceType: "storage" as const, provider: "aws" as const,
    resourceId: `bucket-${i}`, region: "us-east-1",
    storageClass: "standard" as const,
    sizeGb: 200, objectCount: 50000,
    lastAccessedDaysAgo: 60,
    monthlyCostEstimate: 23,
  })),
};

export const awsSingleRegion: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: true, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "aws", resourceId: "i-sr01",
      region: "us-east-1", instanceType: "t3.micro", tier: "general",
      vcpus: 2, memoryGb: 1, state: "running", monthlyCostEstimate: 8,
    },
  ],
};

export const awsMultiRegion: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1", "us-west-2", "eu-west-1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: Array.from({ length: 4 }, (_, i) => ({
    resourceType: "compute" as const, provider: "aws" as const,
    resourceId: `i-mr-${i}`, region: ["us-east-1", "us-west-2", "eu-west-1"][i % 3],
    instanceType: "m5.large", tier: "general" as const,
    vcpus: 2, memoryGb: 8, state: "running" as const,
    monthlyCostEstimate: 70,
  })),
};

export const awsIdleCompute: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "aws", resourceId: "i-idle01",
      region: "us-east-1", instanceType: "m5.xlarge", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 1.2, sampleWindowHours: 336 },
      monthlyCostEstimate: 140,
    },
    {
      resourceType: "compute", provider: "aws", resourceId: "i-stopped01",
      region: "us-east-1", instanceType: "m5.large", tier: "general",
      vcpus: 2, memoryGb: 8, state: "stopped",
      monthlyCostEstimate: 0,
    },
  ],
};

export const awsPublicStorage: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "storage", provider: "aws", resourceId: "public-assets",
      region: "us-east-1", storageClass: "standard",
      sizeGb: 50, monthlyCostEstimate: 1.15,
      tags: { public_access: "true" },
    },
    {
      resourceType: "storage", provider: "aws", resourceId: "logs-private",
      region: "us-east-1", storageClass: "standard",
      sizeGb: 200, monthlyCostEstimate: 4.6,
    },
  ],
};

export const awsBackupWarning: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1"],
  flags: { singleRegion: false, noBackupsDetected: true },
  resources: [
    {
      resourceType: "compute", provider: "aws", resourceId: "i-bk01",
      region: "us-east-1", instanceType: "m5.large", tier: "general",
      vcpus: 2, memoryGb: 8, state: "running", monthlyCostEstimate: 70,
    },
    {
      resourceType: "storage", provider: "aws", resourceId: "data-bucket",
      region: "us-east-1", storageClass: "standard",
      sizeGb: 500, monthlyCostEstimate: 11.5,
    },
  ],
};

// Combined: triggers all 8 signals at once
export const awsAllSignals: CloudSnapshot = {
  provider: "aws",
  accountId: "111111111111",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-east-1", "us-west-2", "eu-west-1"],
  monthlySpend: 5000,
  flags: { singleRegion: false, noBackupsDetected: true },
  resources: [
    // Rightsizing + commitment candidates (running)
    ...Array.from({ length: 4 }, (_, i) => ({
      resourceType: "compute" as const, provider: "aws" as const,
      resourceId: `i-run-${i}`,
      region: ["us-east-1", "us-west-2", "eu-west-1"][i % 3],
      instanceType: "m5.2xlarge", tier: "general" as const,
      vcpus: 8, memoryGb: 32, state: "running" as const,
      usage: { cpuAvgPct: 15, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
    })),
    // Idle compute
    {
      resourceType: "compute", provider: "aws", resourceId: "i-idle-all",
      region: "us-east-1", instanceType: "m5.xlarge", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 2, sampleWindowHours: 336 },
      monthlyCostEstimate: 140,
    },
    // Stopped instance
    {
      resourceType: "compute", provider: "aws", resourceId: "i-stopped-all",
      region: "us-east-1", instanceType: "t3.large", tier: "general",
      vcpus: 2, memoryGb: 8, state: "stopped",
      monthlyCostEstimate: 0,
    },
    // Storage tiering (6 buckets)
    ...Array.from({ length: 6 }, (_, i) => ({
      resourceType: "storage" as const, provider: "aws" as const,
      resourceId: `bucket-all-${i}`,
      region: "us-east-1",
      storageClass: "standard" as const,
      sizeGb: 100, objectCount: 10000,
      lastAccessedDaysAgo: 90,
      monthlyCostEstimate: 23,
    })),
    // Public bucket
    {
      resourceType: "storage", provider: "aws", resourceId: "public-leak",
      region: "us-east-1", storageClass: "standard",
      sizeGb: 30, monthlyCostEstimate: 0.69,
      tags: { public_access: "true" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Azure snapshots
// ---------------------------------------------------------------------------

export const azureRightsizing: CloudSnapshot = {
  provider: "azure",
  accountId: "sub-azure-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["eastus"],
  monthlySpend: 2000,
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-api-01",
      region: "eastus", instanceType: "Standard_D8s_v3", tier: "general",
      vcpus: 8, memoryGb: 32, state: "running",
      usage: { cpuAvgPct: 11, memoryAvgPct: 20, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
    },
  ],
};

export const azureIdleCompute: CloudSnapshot = {
  provider: "azure",
  accountId: "sub-azure-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["eastus"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-idle-01",
      region: "eastus", instanceType: "Standard_D4s_v3", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 3, memoryAvgPct: 8, sampleWindowHours: 240 },
      monthlyCostEstimate: 140,
    },
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-dealloc-01",
      region: "eastus", instanceType: "Standard_D2s_v3", tier: "general",
      vcpus: 2, memoryGb: 8, state: "deallocated",
      monthlyCostEstimate: 0,
    },
  ],
};

export const azurePublicStorage: CloudSnapshot = {
  provider: "azure",
  accountId: "sub-azure-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["eastus"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "storage", provider: "azure", resourceId: "stpublic01",
      region: "eastus", storageClass: "standard",
      sizeGb: 300, monthlyCostEstimate: 6.3,
      tags: { publicAccess: "true" },
    },
  ],
};

export const azureBackupWarning: CloudSnapshot = {
  provider: "azure",
  accountId: "sub-azure-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["eastus"],
  flags: { singleRegion: true, noBackupsDetected: true },
  resources: [
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-nobkup-01",
      region: "eastus", instanceType: "Standard_D4s_v3", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running", monthlyCostEstimate: 140,
    },
    {
      resourceType: "storage", provider: "azure", resourceId: "stnobackup01",
      region: "eastus", storageClass: "standard",
      sizeGb: 500, monthlyCostEstimate: 10.5,
    },
  ],
};

export const azureAllSignals: CloudSnapshot = {
  provider: "azure",
  accountId: "sub-azure-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["eastus", "westus", "northeurope"],
  monthlySpend: 4500,
  flags: { singleRegion: false, noBackupsDetected: true },
  resources: [
    // Running VMs for rightsizing + commitment + multi-region
    ...Array.from({ length: 4 }, (_, i) => ({
      resourceType: "compute" as const, provider: "azure" as const,
      resourceId: `vm-run-${i}`,
      region: ["eastus", "westus", "northeurope"][i % 3],
      instanceType: "Standard_D8s_v3", tier: "general" as const,
      vcpus: 8, memoryGb: 32, state: "running" as const,
      usage: { cpuAvgPct: 20, memoryAvgPct: 30, sampleWindowHours: 168 },
      monthlyCostEstimate: 280,
    })),
    // Idle VM
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-idle-all",
      region: "eastus", instanceType: "Standard_D4s_v3", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 1.5, memoryAvgPct: 5, sampleWindowHours: 336 },
      monthlyCostEstimate: 140,
    },
    // Deallocated VM
    {
      resourceType: "compute", provider: "azure", resourceId: "vm-dealloc-all",
      region: "eastus", instanceType: "Standard_D2s_v3", tier: "general",
      vcpus: 2, memoryGb: 8, state: "deallocated",
      monthlyCostEstimate: 0,
    },
    // Storage tiering (6 accounts)
    ...Array.from({ length: 6 }, (_, i) => ({
      resourceType: "storage" as const, provider: "azure" as const,
      resourceId: `st-tier-${i}`,
      region: "eastus",
      storageClass: "standard" as const,
      sizeGb: 150, objectCount: 20000,
      monthlyCostEstimate: 18,
    })),
    // Public storage
    {
      resourceType: "storage", provider: "azure", resourceId: "st-public-all",
      region: "eastus", storageClass: "standard",
      sizeGb: 50, monthlyCostEstimate: 1.05,
      tags: { publicAccess: "true" },
    },
  ],
};

// ---------------------------------------------------------------------------
// GCP snapshots
// ---------------------------------------------------------------------------

export const gcpRightsizing: CloudSnapshot = {
  provider: "gcp",
  accountId: "my-project-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-central1"],
  monthlySpend: 1800,
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-api-01",
      region: "us-central1", instanceType: "n2-standard-8", tier: "general",
      vcpus: 8, memoryGb: 32, state: "running",
      usage: { cpuAvgPct: 14, sampleWindowHours: 168 },
      monthlyCostEstimate: 276,
    },
  ],
};

export const gcpIdleCompute: CloudSnapshot = {
  provider: "gcp",
  accountId: "my-project-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-central1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-idle-01",
      region: "us-central1", instanceType: "n2-standard-4", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 0.8, sampleWindowHours: 504 },
      monthlyCostEstimate: 138,
    },
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-stopped-01",
      region: "us-central1", instanceType: "e2-medium", tier: "general",
      vcpus: 2, memoryGb: 4, state: "stopped",
      monthlyCostEstimate: 0,
    },
  ],
};

export const gcpPublicStorage: CloudSnapshot = {
  provider: "gcp",
  accountId: "my-project-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-central1"],
  flags: { singleRegion: false, noBackupsDetected: false },
  resources: [
    {
      resourceType: "storage", provider: "gcp", resourceId: "public-bucket",
      region: "us-central1", storageClass: "standard",
      sizeGb: 100, monthlyCostEstimate: 2.3,
      tags: { "public-access-prevention": "inherited" },
    },
  ],
};

export const gcpBackupWarning: CloudSnapshot = {
  provider: "gcp",
  accountId: "my-project-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-central1"],
  flags: { singleRegion: true, noBackupsDetected: true },
  resources: [
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-nobkup-01",
      region: "us-central1", instanceType: "n2-standard-4", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running", monthlyCostEstimate: 138,
    },
    {
      resourceType: "storage", provider: "gcp", resourceId: "data-raw",
      region: "us-central1", storageClass: "standard",
      sizeGb: 1200, monthlyCostEstimate: 24.6,
    },
  ],
};

export const gcpAllSignals: CloudSnapshot = {
  provider: "gcp",
  accountId: "my-project-test",
  scannedAt: "2026-05-08T00:00:00Z",
  regions: ["us-central1", "europe-west1", "asia-east1"],
  monthlySpend: 3800,
  flags: { singleRegion: false, noBackupsDetected: true },
  resources: [
    // Running instances for rightsizing + commitment + multi-region
    ...Array.from({ length: 4 }, (_, i) => ({
      resourceType: "compute" as const, provider: "gcp" as const,
      resourceId: `inst-run-${i}`,
      region: ["us-central1", "europe-west1", "asia-east1"][i % 3],
      instanceType: "n2-standard-8", tier: "general" as const,
      vcpus: 8, memoryGb: 32, state: "running" as const,
      usage: { cpuAvgPct: 22, sampleWindowHours: 168 },
      monthlyCostEstimate: 276,
    })),
    // Idle instance
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-idle-all",
      region: "us-central1", instanceType: "n2-standard-4", tier: "general",
      vcpus: 4, memoryGb: 16, state: "running",
      usage: { cpuAvgPct: 1, sampleWindowHours: 504 },
      monthlyCostEstimate: 138,
    },
    // Stopped instance
    {
      resourceType: "compute", provider: "gcp", resourceId: "inst-stopped-all",
      region: "us-central1", instanceType: "e2-medium", tier: "general",
      vcpus: 2, memoryGb: 4, state: "stopped",
      monthlyCostEstimate: 0,
    },
    // Storage tiering (6 buckets)
    ...Array.from({ length: 6 }, (_, i) => ({
      resourceType: "storage" as const, provider: "gcp" as const,
      resourceId: `bucket-all-${i}`,
      region: "us-central1",
      storageClass: "standard" as const,
      sizeGb: 400, objectCount: 30000,
      monthlyCostEstimate: 20,
    })),
    // Public bucket
    {
      resourceType: "storage", provider: "gcp", resourceId: "public-all",
      region: "us-central1", storageClass: "standard",
      sizeGb: 50, monthlyCostEstimate: 1.15,
      tags: { "public-access-prevention": "inherited" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Verification helper — derives signals and checks expected types are present
// ---------------------------------------------------------------------------

export type SignalTestResult = {
  provider: string;
  snapshotName: string;
  expectedSignals: SignalType[];
  actualSignals: SignalType[];
  pass: boolean;
  missing: SignalType[];
  extra: SignalType[];
};

function checkSignals(
  snapshot: CloudSnapshot,
  name: string,
  expected: SignalType[],
): SignalTestResult {
  const summary = deriveCostSignals(snapshot);
  const actual = summary.signals.map((s) => s.signalType);
  const missing = expected.filter((e) => !actual.includes(e));
  const extra = actual.filter((a) => !expected.includes(a));
  return {
    provider: snapshot.provider,
    snapshotName: name,
    expectedSignals: expected,
    actualSignals: actual,
    pass: missing.length === 0,
    missing,
    extra,
  };
}

export const ALL_TEST_CASES: Array<{
  name: string;
  snapshot: CloudSnapshot;
  expected: SignalType[];
}> = [
  // AWS
  { name: "awsRightsizing", snapshot: awsRightsizing, expected: ["compute_rightsizing", "commitment_discount"] },
  { name: "awsCommitment", snapshot: awsCommitment, expected: ["compute_rightsizing", "commitment_discount"] },
  { name: "awsStorageTiering", snapshot: awsStorageTiering, expected: ["storage_tiering"] },
  { name: "awsSingleRegion", snapshot: awsSingleRegion, expected: ["compute_rightsizing", "single_region_risk"] },
  { name: "awsMultiRegion", snapshot: awsMultiRegion, expected: ["compute_rightsizing", "commitment_discount", "multi_region_sprawl"] },
  { name: "awsIdleCompute", snapshot: awsIdleCompute, expected: ["compute_rightsizing", "idle_compute"] },
  { name: "awsPublicStorage", snapshot: awsPublicStorage, expected: ["public_storage"] },
  { name: "awsBackupWarning", snapshot: awsBackupWarning, expected: ["compute_rightsizing", "backup_warning"] },
  { name: "awsAllSignals", snapshot: awsAllSignals, expected: ["compute_rightsizing", "commitment_discount", "storage_tiering", "multi_region_sprawl", "idle_compute", "public_storage", "backup_warning"] },

  // Azure
  { name: "azureRightsizing", snapshot: azureRightsizing, expected: ["compute_rightsizing"] },
  { name: "azureIdleCompute", snapshot: azureIdleCompute, expected: ["idle_compute"] },
  { name: "azurePublicStorage", snapshot: azurePublicStorage, expected: ["public_storage"] },
  { name: "azureBackupWarning", snapshot: azureBackupWarning, expected: ["compute_rightsizing", "single_region_risk", "backup_warning"] },
  { name: "azureAllSignals", snapshot: azureAllSignals, expected: ["compute_rightsizing", "commitment_discount", "storage_tiering", "multi_region_sprawl", "idle_compute", "public_storage", "backup_warning"] },

  // GCP
  { name: "gcpRightsizing", snapshot: gcpRightsizing, expected: ["compute_rightsizing"] },
  { name: "gcpIdleCompute", snapshot: gcpIdleCompute, expected: ["idle_compute"] },
  { name: "gcpPublicStorage", snapshot: gcpPublicStorage, expected: ["public_storage"] },
  { name: "gcpBackupWarning", snapshot: gcpBackupWarning, expected: ["compute_rightsizing", "single_region_risk", "backup_warning"] },
  { name: "gcpAllSignals", snapshot: gcpAllSignals, expected: ["compute_rightsizing", "commitment_discount", "storage_tiering", "multi_region_sprawl", "idle_compute", "public_storage", "backup_warning"] },
];

export function runAllSignalTests(): SignalTestResult[] {
  return ALL_TEST_CASES.map((tc) => checkSignals(tc.snapshot, tc.name, tc.expected));
}

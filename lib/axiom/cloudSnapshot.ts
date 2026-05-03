// ---------------------------------------------------------------------------
// Unified multi-cloud snapshot schema
// Normalizes AWS, Azure, GCP into a single structure that feeds into
// the existing costSignals.ts derivation engine without rewriting it.
// ---------------------------------------------------------------------------

export type CloudProvider = "aws" | "azure" | "gcp";

export type ResourceType = "compute" | "storage";

// ---- Compute ----

export type ComputeTier = "general" | "compute" | "memory" | "gpu" | "unknown";

export type ComputeResource = {
  resourceType: "compute";
  provider: CloudProvider;
  resourceId: string;              // e.g. "i-0abc123", "vm-prod-01", masked OK
  region: string;                  // normalized: "us-east-1", "eastus", "us-central1"
  instanceType: string;            // e.g. "m5.xlarge", "Standard_D4s_v3", "n2-standard-4"
  tier: ComputeTier;
  vcpus: number;
  memoryGb: number;
  state: "running" | "stopped" | "deallocated" | "unknown";
  usage?: {
    cpuAvgPct?: number;            // 0-100, from CloudWatch / Azure Monitor / Cloud Monitoring
    memoryAvgPct?: number;         // 0-100 — unavailable on AWS without agent
    networkInGbPerDay?: number;
    sampleWindowHours?: number;    // how many hours the averages cover
  };
  monthlyCostEstimate?: number;    // USD, from CUR / Cost Management / Billing API
  tags?: Record<string, string>;
};

// ---- Storage ----

export type StorageClass =
  | "standard"
  | "infrequent"
  | "archive"
  | "intelligent"
  | "cold"
  | "unknown";

export type StorageResource = {
  resourceType: "storage";
  provider: CloudProvider;
  resourceId: string;              // bucket name or container name
  region: string;
  storageClass: StorageClass;
  sizeGb?: number;
  objectCount?: number;
  lastAccessedDaysAgo?: number;    // null if unknown
  monthlyCostEstimate?: number;
  tags?: Record<string, string>;
};

// ---- Unified snapshot ----

export type CloudResource = ComputeResource | StorageResource;

export type CloudSnapshot = {
  provider: CloudProvider;
  accountId: string;               // AWS account, Azure subscription, GCP project
  scannedAt: string;               // ISO 8601
  regions: string[];               // all regions with resources
  resources: CloudResource[];
  monthlySpend?: number;           // total monthly bill if available
  flags: {
    singleRegion: boolean;
    noBackupsDetected: boolean;
  };
  insights?: Array<{ title: string; severity: string }>;
};

// ---------------------------------------------------------------------------
// Note: deriveCostSignals() now accepts CloudSnapshot directly.
// The toSignalInput() adapter below is no longer needed for new code.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provider-specific instance type mapping
// Maps common instance families across clouds for right-sizing comparisons.
// ---------------------------------------------------------------------------

export const INSTANCE_FAMILY_MAP: Record<string, Record<CloudProvider, string>> = {
  "general-2vcpu-8gb":   { aws: "m5.large",       azure: "Standard_D2s_v3",  gcp: "n2-standard-2"  },
  "general-4vcpu-16gb":  { aws: "m5.xlarge",      azure: "Standard_D4s_v3",  gcp: "n2-standard-4"  },
  "general-8vcpu-32gb":  { aws: "m5.2xlarge",     azure: "Standard_D8s_v3",  gcp: "n2-standard-8"  },
  "general-16vcpu-64gb": { aws: "m5.4xlarge",     azure: "Standard_D16s_v3", gcp: "n2-standard-16" },
  "compute-2vcpu-4gb":   { aws: "c5.large",       azure: "Standard_F2s_v2",  gcp: "c2-standard-4"  },
  "compute-4vcpu-8gb":   { aws: "c5.xlarge",      azure: "Standard_F4s_v2",  gcp: "c2-standard-8"  },
  "compute-8vcpu-16gb":  { aws: "c5.2xlarge",     azure: "Standard_F8s_v2",  gcp: "c2-standard-16" },
  "memory-2vcpu-16gb":   { aws: "r5.large",       azure: "Standard_E2s_v3",  gcp: "n2-highmem-2"   },
  "memory-4vcpu-32gb":   { aws: "r5.xlarge",      azure: "Standard_E4s_v3",  gcp: "n2-highmem-4"   },
  "memory-8vcpu-64gb":   { aws: "r5.2xlarge",     azure: "Standard_E8s_v3",  gcp: "n2-highmem-8"   },
};

export const STORAGE_CLASS_MAP: Record<string, Record<CloudProvider, string>> = {
  standard:    { aws: "S3 Standard",              azure: "Hot",                 gcp: "Standard"          },
  infrequent:  { aws: "S3 Standard-IA",           azure: "Cool",                gcp: "Nearline"          },
  archive:     { aws: "S3 Glacier Deep Archive",  azure: "Archive",             gcp: "Coldline/Archive"  },
  intelligent: { aws: "S3 Intelligent-Tiering",   azure: "Cool (auto-tiered)",  gcp: "Autoclass"         },
};

// ---------------------------------------------------------------------------
// Notes on cross-cloud data availability differences
// ---------------------------------------------------------------------------
//
// | Metric                  | AWS                            | Azure                         | GCP                           |
// |-------------------------|--------------------------------|-------------------------------|-------------------------------|
// | CPU avg %               | CloudWatch (free, 5-min)       | Azure Monitor (free, 1-min)   | Cloud Monitoring (free, 1-min)|
// | Memory avg %            | Requires CloudWatch Agent      | VM Insights (free, auto)      | Ops Agent required            |
// | Monthly cost (actual)   | Cost Explorer / CUR            | Cost Management API           | Billing API / BigQuery export |
// | Storage last accessed   | S3 Storage Lens (paid add-on)  | Blob last access tracking     | Not natively available        |
// | Storage object count    | S3 Inventory / ListObjects     | Blob inventory                | gsutil / list                 |
// | Instance state          | DescribeInstances              | VMs - Get                     | instances.list                |
// | Backup detection        | AWS Backup list                | Recovery Services vaults      | Snapshot list                 |
//
// Key gaps:
// - AWS memory metrics require agent install — expect null for most scans
// - GCP has no native "last accessed" for GCS objects — derive from access logs if enabled
// - Azure VM "deallocated" is distinct from "stopped" (no billing) — map to "deallocated"
// - All monthly cost estimates are approximations when billing APIs aren't connected

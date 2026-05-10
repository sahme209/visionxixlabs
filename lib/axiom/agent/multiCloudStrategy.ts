/**
 * Axiom Agent — Multi-Cloud Strategy & Provider Architecture
 *
 * This module defines the provider abstraction layer, per-cloud adapter
 * roadmaps, shared execution interfaces, and the architecture ensuring
 * no provider-specific logic leaks into the agent core.
 *
 * Design principles:
 *   1. Provider adapters are dumb pipes — intelligence is in the core
 *   2. Every provider implements the same interface — no special cases
 *   3. AWS is the reference implementation; Azure/GCP achieve parity
 *   4. Resource normalization happens at the boundary, not in the core
 *   5. Cost estimation, risk scoring, and reasoning are provider-agnostic
 *
 * Current state (2026-05):
 *   AWS: snapshot ✓, apply ✓, rollback ✓, 6 plugins
 *   Azure: snapshot ✓, apply ✗, rollback ✗, 3 plugins
 *   GCP: snapshot ✓, apply ✗, rollback ✗, 3 plugins
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. PROVIDER ABSTRACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type CloudProvider = "aws" | "azure" | "gcp";

export type ProviderCapability =
  | "validate_connection"
  | "collect_snapshot"
  | "estimate_costs"
  | "generate_execution_plan"
  | "apply_action"
  | "verify_action"
  | "rollback_action"
  | "iam_analysis"
  | "cost_optimization"
  | "security_scan"
  | "compliance_check"
  | "terraform_generation"
  | "cli_generation"
  | "event_streaming"
  | "metric_collection";

export type CapabilityStatus = "implemented" | "partial" | "planned" | "not_applicable";

export type ProviderCapabilityMatrix = {
  provider: CloudProvider;
  capabilities: Record<ProviderCapability, CapabilityStatus>;
};

export type ResourceCategory =
  | "compute"
  | "storage"
  | "database"
  | "networking"
  | "containers"
  | "serverless"
  | "iam"
  | "monitoring"
  | "messaging"
  | "cdn";

export type ResourceMapping = {
  category: ResourceCategory;
  aws: string[];
  azure: string[];
  gcp: string[];
  normalizedType: string;
  snapshotFields: string[];
  costModel: string;
};

export type AdapterRoadmapItem = {
  id: string;
  provider: CloudProvider;
  phase: "phase_1" | "phase_2" | "phase_3" | "phase_4";
  category: ResourceCategory | "execution" | "security" | "integration";
  name: string;
  description: string;
  status: "completed" | "in_progress" | "planned" | "research";
  estimateWeeks: number;
  dependencies: string[];
  awsReference: string;            // corresponding AWS implementation to mirror
  providerSpecificNotes: string[];
};

export type AbstractionLayerComponent = {
  name: string;
  purpose: string;
  interfaceSignature: string;
  implementedBy: string[];
  providerInvariant: string;       // what must be true regardless of provider
};

export type SharedInterface = {
  name: string;
  layer: "snapshot" | "execution" | "reasoning" | "monitoring" | "security";
  description: string;
  methods: InterfaceMethod[];
  providerAgnostic: boolean;       // true = no provider-specific input/output
};

export type InterfaceMethod = {
  name: string;
  input: string;
  output: string;
  providerAware: boolean;          // does the implementation differ per provider?
  description: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. PROVIDER CAPABILITY MATRIX
// ═══════════════════════════════════════════════════════════════════════════

export const CAPABILITY_MATRIX: ProviderCapabilityMatrix[] = [
  {
    provider: "aws",
    capabilities: {
      validate_connection: "implemented",
      collect_snapshot: "implemented",
      estimate_costs: "implemented",
      generate_execution_plan: "implemented",
      apply_action: "implemented",
      verify_action: "implemented",
      rollback_action: "implemented",
      iam_analysis: "partial",
      cost_optimization: "implemented",
      security_scan: "implemented",
      compliance_check: "partial",
      terraform_generation: "implemented",
      cli_generation: "implemented",
      event_streaming: "planned",
      metric_collection: "implemented",
    },
  },
  {
    provider: "azure",
    capabilities: {
      validate_connection: "implemented",
      collect_snapshot: "implemented",
      estimate_costs: "implemented",
      generate_execution_plan: "implemented",
      apply_action: "planned",
      verify_action: "implemented",
      rollback_action: "planned",
      iam_analysis: "planned",
      cost_optimization: "planned",
      security_scan: "implemented",
      compliance_check: "planned",
      terraform_generation: "planned",
      cli_generation: "planned",
      event_streaming: "planned",
      metric_collection: "implemented",
    },
  },
  {
    provider: "gcp",
    capabilities: {
      validate_connection: "implemented",
      collect_snapshot: "implemented",
      estimate_costs: "implemented",
      generate_execution_plan: "implemented",
      apply_action: "planned",
      verify_action: "implemented",
      rollback_action: "planned",
      iam_analysis: "planned",
      cost_optimization: "planned",
      security_scan: "implemented",
      compliance_check: "planned",
      terraform_generation: "planned",
      cli_generation: "planned",
      event_streaming: "planned",
      metric_collection: "implemented",
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. RESOURCE NORMALIZATION MAP
// ═══════════════════════════════════════════════════════════════════════════

export const RESOURCE_MAPPINGS: ResourceMapping[] = [
  {
    category: "compute",
    aws: ["EC2 Instance", "Lightsail Instance"],
    azure: ["Virtual Machine", "VM Scale Set"],
    gcp: ["Compute Engine Instance", "Managed Instance Group"],
    normalizedType: "ComputeInstance",
    snapshotFields: ["instanceType", "vcpus", "memoryGb", "state", "cpuAvgPct", "memoryAvgPct", "monthlyCostEstimate"],
    costModel: "hourly_rate * hours_running + storage_attached",
  },
  {
    category: "storage",
    aws: ["S3 Bucket"],
    azure: ["Storage Account", "Blob Container"],
    gcp: ["Cloud Storage Bucket"],
    normalizedType: "ObjectStorage",
    snapshotFields: ["storageSizeGb", "objectCount", "storageClass", "versioning", "encryption", "publicAccess"],
    costModel: "storage_gb * rate_per_gb + requests * rate_per_request + egress",
  },
  {
    category: "database",
    aws: ["RDS Instance", "Aurora Cluster", "DynamoDB Table", "ElastiCache Cluster"],
    azure: ["Azure SQL Database", "Cosmos DB Account", "Azure Database for PostgreSQL"],
    gcp: ["Cloud SQL Instance", "Cloud Spanner", "Firestore", "Bigtable Cluster"],
    normalizedType: "DatabaseInstance",
    snapshotFields: ["engine", "instanceClass", "storageGb", "multiAz", "replicas", "backupRetention", "iops"],
    costModel: "instance_hourly + storage_gb * rate + iops * rate + backup_gb * rate",
  },
  {
    category: "containers",
    aws: ["ECS Service", "ECS Task", "EKS Cluster", "EKS Node Group"],
    azure: ["AKS Cluster", "AKS Node Pool", "Container Instance"],
    gcp: ["GKE Cluster", "GKE Node Pool", "Cloud Run Service"],
    normalizedType: "ContainerWorkload",
    snapshotFields: ["clusterName", "nodeCount", "cpuRequested", "memoryRequested", "replicas", "scalingPolicy"],
    costModel: "node_count * node_hourly + load_balancer + networking",
  },
  {
    category: "serverless",
    aws: ["Lambda Function", "Step Functions State Machine", "API Gateway"],
    azure: ["Azure Functions App", "Logic App", "API Management"],
    gcp: ["Cloud Functions", "Cloud Run", "API Gateway"],
    normalizedType: "ServerlessFunction",
    snapshotFields: ["runtime", "memoryMb", "timeoutSec", "invocationsPerDay", "avgDurationMs", "coldStartPct"],
    costModel: "invocations * rate + duration_gb_seconds * rate",
  },
  {
    category: "networking",
    aws: ["VPC", "Subnet", "Security Group", "NAT Gateway", "Load Balancer", "Transit Gateway"],
    azure: ["Virtual Network", "Subnet", "NSG", "NAT Gateway", "Load Balancer", "ExpressRoute"],
    gcp: ["VPC Network", "Subnet", "Firewall Rule", "Cloud NAT", "Load Balancer", "Cloud Interconnect"],
    normalizedType: "NetworkResource",
    snapshotFields: ["cidrBlock", "availabilityZone", "routeTable", "flowLogsEnabled", "publicIp"],
    costModel: "nat_hourly + data_processed_gb * rate + elastic_ip",
  },
  {
    category: "iam",
    aws: ["IAM User", "IAM Role", "IAM Policy", "IAM Group"],
    azure: ["Azure AD User", "Azure AD Group", "Role Assignment", "Custom Role"],
    gcp: ["IAM Member", "IAM Role", "Service Account", "IAM Policy Binding"],
    normalizedType: "IdentityResource",
    snapshotFields: ["principalType", "attachedPolicies", "lastUsed", "mfaEnabled", "accessKeys"],
    costModel: "free (cost is in what they access)",
  },
  {
    category: "monitoring",
    aws: ["CloudWatch Alarm", "CloudWatch Dashboard", "CloudTrail Trail"],
    azure: ["Azure Monitor Alert", "Azure Monitor Dashboard", "Activity Log"],
    gcp: ["Cloud Monitoring Alert", "Cloud Monitoring Dashboard", "Audit Log"],
    normalizedType: "MonitoringResource",
    snapshotFields: ["alertType", "threshold", "actions", "evaluationPeriod"],
    costModel: "metrics * rate + alarms * rate + logs_ingested_gb * rate",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. PROVIDER ABSTRACTION LAYER
// ═══════════════════════════════════════════════════════════════════════════

export const ABSTRACTION_COMPONENTS: AbstractionLayerComponent[] = [
  {
    name: "ProviderAdapter",
    purpose: "Unified interface for all cloud operations. Every provider implements this exactly.",
    interfaceSignature: `interface ProviderAdapter {
  validateConnection(credentials: ProviderCredentials): Promise<ConnectionValidation>
  collectSnapshot(config: SnapshotConfig): Promise<CloudSnapshot>
  estimateCosts(snapshot: CloudSnapshot): Promise<CostSummary>
  generateExecutionPlan(recommendations: Recommendation[]): Promise<ExecutionPlan>
  applyAction(action: ApprovedAction): Promise<ApplyResult>
  verifyAction(action: AppliedAction): Promise<VerificationResult>
  rollbackAction(action: AppliedAction, preState: ResourceState): Promise<RollbackResult>
}`,
    implementedBy: ["plugins/aws/adapter.ts", "plugins/azure/adapter.ts", "plugins/gcp/adapter.ts"],
    providerInvariant: "All methods return typed results with success/failure/error. No provider-specific types leak through the interface.",
  },
  {
    name: "SnapshotNormalizer",
    purpose: "Converts raw provider responses into the unified CloudSnapshot schema",
    interfaceSignature: `interface SnapshotNormalizer {
  normalizeCompute(raw: ProviderComputeData): ComputeInstance[]
  normalizeStorage(raw: ProviderStorageData): StorageResource[]
  normalizeDatabase(raw: ProviderDatabaseData): DatabaseInstance[]
  assessQuality(snapshot: CloudSnapshot): QualityAssessment
}`,
    implementedBy: ["normalizer.ts", "cloudSnapshot.ts"],
    providerInvariant: "Output schema is identical regardless of source provider. Quality assessment tracks what data is missing per provider.",
  },
  {
    name: "CredentialBroker",
    purpose: "Retrieves and validates provider credentials without exposing them to the agent core",
    interfaceSignature: `interface CredentialBroker {
  getCredentials(accountId: string, provider: CloudProvider): Promise<ProviderCredentials | null>
  validateCredentials(credentials: ProviderCredentials): Promise<CredentialValidation>
  rotateCredentials(accountId: string): Promise<RotationResult>
  revokeCredentials(accountId: string): Promise<void>
}`,
    implementedBy: ["plugins/credentials.ts", "security/credentialVault.ts"],
    providerInvariant: "Credentials never appear in logs, error messages, or API responses. Encryption at rest with AES-256-GCM.",
  },
  {
    name: "CostNormalizer",
    purpose: "Normalizes cost data across providers into USD monthly estimates",
    interfaceSignature: `interface CostNormalizer {
  estimateMonthly(resource: NormalizedResource): CostEstimate
  compareCrossCloud(resource: NormalizedResource): CrossCloudCostComparison
  projectCosts(resource: NormalizedResource, days: number): CostProjection
}`,
    implementedBy: ["cloudSnapshot.ts"],
    providerInvariant: "All costs in USD. Estimates include confidence level (measured | estimated | unknown).",
  },
  {
    name: "ActionTranslator",
    purpose: "Translates provider-agnostic action intents into provider-specific API calls",
    interfaceSignature: `interface ActionTranslator {
  toProviderAction(intent: ActionIntent, provider: CloudProvider): ProviderAction
  toTerraform(intent: ActionIntent, provider: CloudProvider): TerraformBlock
  toCLI(intent: ActionIntent, provider: CloudProvider): CLICommand
  toDryRun(action: ProviderAction): DryRunAction
}`,
    implementedBy: ["toolFramework.ts"],
    providerInvariant: "Action intents are provider-agnostic. Translation happens at the boundary. Core agent never sees provider-specific API calls.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. SHARED EXECUTION INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export const SHARED_INTERFACES: SharedInterface[] = [
  {
    name: "ScanPipeline",
    layer: "snapshot",
    description: "Provider-agnostic scan orchestration: connect → snapshot → normalize → enrich → quality-score",
    providerAgnostic: true,
    methods: [
      { name: "initiateScan", input: "ScanConfig", output: "ScanHandle", providerAware: false, description: "Start a scan for a connected cloud account" },
      { name: "collectSnapshot", input: "ScanHandle", output: "RawSnapshot", providerAware: true, description: "Collect raw resource data from the provider" },
      { name: "normalizeSnapshot", input: "RawSnapshot", output: "CloudSnapshot", providerAware: true, description: "Normalize raw data into unified schema" },
      { name: "enrichSnapshot", input: "CloudSnapshot", output: "EnrichedSnapshot", providerAware: true, description: "Add metrics, costs, and metadata" },
      { name: "scoreQuality", input: "EnrichedSnapshot", output: "QualityAssessment", providerAware: false, description: "Assess data completeness and reliability" },
    ],
  },
  {
    name: "FindingPipeline",
    layer: "reasoning",
    description: "Provider-agnostic finding classification, scoring, and explanation",
    providerAgnostic: true,
    methods: [
      { name: "classifyFindings", input: "CloudSnapshot", output: "Finding[]", providerAware: false, description: "Identify cost, risk, drift, and compliance findings" },
      { name: "scoreFindings", input: "Finding[]", output: "ScoredFinding[]", providerAware: false, description: "Priority-score with org preferences" },
      { name: "explainFindings", input: "ScoredFinding[]", output: "ExplainedFinding[]", providerAware: false, description: "Add evidence and confidence to each finding" },
      { name: "deduplicateFindings", input: "ExplainedFinding[]", output: "ExplainedFinding[]", providerAware: false, description: "Remove duplicates from cross-cloud scans" },
    ],
  },
  {
    name: "ExecutionPipeline",
    layer: "execution",
    description: "Provider-agnostic execution lifecycle: approve → pre-check → dry-run → execute → verify → audit",
    providerAgnostic: false,
    methods: [
      { name: "requestApproval", input: "ActionPlan", output: "ApprovalRequest", providerAware: false, description: "Submit plan for human approval" },
      { name: "preCheck", input: "ApprovedAction", output: "PreCheckResult", providerAware: true, description: "Verify preconditions before execution" },
      { name: "dryRun", input: "ApprovedAction", output: "DryRunResult", providerAware: true, description: "Simulate execution without side effects" },
      { name: "captureState", input: "ResourceRef", output: "ResourceState", providerAware: true, description: "Capture pre-mutation state for rollback" },
      { name: "execute", input: "ApprovedAction", output: "ExecutionResult", providerAware: true, description: "Apply the change to the cloud resource" },
      { name: "verify", input: "ExecutionResult", output: "VerificationResult", providerAware: true, description: "Verify the change achieved the desired state" },
      { name: "rollback", input: "ExecutionResult, ResourceState", output: "RollbackResult", providerAware: true, description: "Restore pre-mutation state" },
      { name: "audit", input: "ExecutionResult", output: "AuditEntry", providerAware: false, description: "Record immutable audit trail entry" },
    ],
  },
  {
    name: "MonitoringPipeline",
    layer: "monitoring",
    description: "Provider-agnostic drift detection and change monitoring",
    providerAgnostic: true,
    methods: [
      { name: "diffSnapshots", input: "CloudSnapshot, CloudSnapshot", output: "SnapshotDelta", providerAware: false, description: "Compute changes between two snapshots" },
      { name: "classifyChanges", input: "SnapshotDelta", output: "ClassifiedChange[]", providerAware: false, description: "Categorize changes by type and severity" },
      { name: "detectDrift", input: "CloudSnapshot, ExecutionPlan", output: "DriftReport", providerAware: false, description: "Detect drift from approved plans" },
      { name: "buildAlerts", input: "ClassifiedChange[]", output: "Alert[]", providerAware: false, description: "Generate alerts with dedup and suppression" },
    ],
  },
  {
    name: "SecurityPipeline",
    layer: "security",
    description: "Provider-agnostic security assessment and policy evaluation",
    providerAgnostic: true,
    methods: [
      { name: "evaluateGovernance", input: "CloudSnapshot, GovernancePolicy[]", output: "GovernanceReport", providerAware: false, description: "Evaluate resources against policies" },
      { name: "analyzeIAM", input: "IAMSnapshot", output: "IAMReport", providerAware: true, description: "Find over-permissioned identities" },
      { name: "checkCompliance", input: "CloudSnapshot, ComplianceFramework", output: "ComplianceReport", providerAware: false, description: "Evaluate against compliance frameworks" },
      { name: "assessRisk", input: "ActionPlan", output: "RiskAssessment", providerAware: false, description: "Compute blast radius and risk score for planned actions" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. AZURE ADAPTER ROADMAP
// ═══════════════════════════════════════════════════════════════════════════

export const AZURE_ROADMAP: AdapterRoadmapItem[] = [
  {
    id: "az-1",
    provider: "azure",
    phase: "phase_1",
    category: "execution",
    name: "Azure VM Apply Actions",
    description: "Implement VM resize, start/stop, deallocate. ARM API calls with pre-state capture and rollback.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "EC2 resize/stop/start in runAgent.ts apply handlers",
    providerSpecificNotes: [
      "Azure has Deallocated vs Stopped — deallocated stops billing, stopped does not",
      "VM resize requires deallocation for some SKU changes",
      "Availability Set constraints may prevent resize",
      "Use Azure Resource Manager REST API, not classic",
    ],
  },
  {
    id: "az-2",
    provider: "azure",
    phase: "phase_1",
    category: "execution",
    name: "Azure Storage Apply Actions",
    description: "Implement storage tier changes, lifecycle rules, access tier management for blob containers.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: [],
    awsReference: "S3 lifecycle and storage class changes",
    providerSpecificNotes: [
      "Azure has Hot/Cool/Cold/Archive tiers (4 vs AWS 6)",
      "Archive rehydration takes hours — must warn users",
      "Storage account vs container vs blob level tiering",
      "Lifecycle management policies are JSON-based",
    ],
  },
  {
    id: "az-3",
    provider: "azure",
    phase: "phase_1",
    category: "execution",
    name: "Azure Rollback Engine",
    description: "Pre-state capture for VMs and storage. Restore VM size, configuration, and storage tier on failure.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: ["az-1", "az-2"],
    awsReference: "AWS rollback in runAgent.ts",
    providerSpecificNotes: [
      "Azure doesn't have EC2-style snapshots for VM config — must capture via API",
      "Storage tier changes may not be immediately reversible (archive)",
      "Resource locks (CanNotDelete, ReadOnly) must be checked before rollback",
    ],
  },
  {
    id: "az-4",
    provider: "azure",
    phase: "phase_2",
    category: "database",
    name: "Azure SQL & Cosmos DB Snapshot",
    description: "Snapshot Azure SQL databases, managed instances, and Cosmos DB accounts with performance metrics.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "aws-1 (RDS/Aurora snapshot)",
    providerSpecificNotes: [
      "Azure SQL has DTU and vCore pricing models — normalize both",
      "Cosmos DB has RU-based pricing — different from relational",
      "Elastic pools may contain multiple databases",
      "Geo-replication configuration affects cost and resilience",
    ],
  },
  {
    id: "az-5",
    provider: "azure",
    phase: "phase_2",
    category: "containers",
    name: "AKS Cluster Snapshot",
    description: "Snapshot AKS clusters: node pools, scaling config, pod counts, resource utilization.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: [],
    awsReference: "aws-2 (ECS/EKS snapshot)",
    providerSpecificNotes: [
      "AKS has system and user node pools — cost model differs",
      "Virtual nodes (ACI) may be part of cluster",
      "Cluster auto-scaler vs HPA vs KEDA",
    ],
  },
  {
    id: "az-6",
    provider: "azure",
    phase: "phase_2",
    category: "security",
    name: "Azure RBAC & Entra ID Analysis",
    description: "Analyze Azure role assignments, custom roles, service principals, managed identities for over-permission.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "aws-7 (IAM policy analysis)",
    providerSpecificNotes: [
      "Azure RBAC is separate from Entra ID (formerly Azure AD)",
      "Scope hierarchy: management group → subscription → resource group → resource",
      "PIM (Privileged Identity Management) adds time-bound access",
      "Service principals vs managed identities vs user assignments",
    ],
  },
  {
    id: "az-7",
    provider: "azure",
    phase: "phase_2",
    category: "integration",
    name: "Azure Terraform Generation",
    description: "Generate azurerm Terraform for VM resize, storage changes, and database right-sizing.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: ["az-1", "az-2"],
    awsReference: "AWS Terraform generation in toolFramework.ts",
    providerSpecificNotes: [
      "azurerm provider has different resource naming than Azure portal",
      "Resource IDs are longer and more complex than AWS ARNs",
      "ARM template alternative for some operations",
    ],
  },
  {
    id: "az-8",
    provider: "azure",
    phase: "phase_3",
    category: "integration",
    name: "Azure Cost Management Integration",
    description: "Deep Azure Cost Management + Billing API integration for cost trends, forecasts, and anomaly detection.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: ["az-4"],
    awsReference: "aws-6 (Cost Explorer integration)",
    providerSpecificNotes: [
      "Azure Cost Management exports vs real-time API have different data freshness",
      "EA (Enterprise Agreement) vs PAYG vs CSP pricing models",
      "Azure Reservations and Savings Plans have different API than AWS",
      "Cost allocation tags = Azure resource tags",
    ],
  },
  {
    id: "az-9",
    provider: "azure",
    phase: "phase_3",
    category: "integration",
    name: "Azure Advisor Integration",
    description: "Pull Azure Advisor recommendations to complement Axiom's own analysis. Deduplicate and enrich.",
    status: "planned",
    estimateWeeks: 1,
    dependencies: [],
    awsReference: "N/A (AWS Trusted Advisor is similar but different API)",
    providerSpecificNotes: [
      "Azure Advisor covers cost, security, reliability, performance, operational excellence",
      "Use as signal input to reasoning engine, not as direct output",
      "Deduplication needed — Advisor may surface same issue as Axiom findings",
    ],
  },
  {
    id: "az-10",
    provider: "azure",
    phase: "phase_4",
    category: "serverless",
    name: "Azure Functions & Logic Apps Snapshot",
    description: "Snapshot Azure Functions apps and Logic Apps with invocation metrics and cost analysis.",
    status: "research",
    estimateWeeks: 2,
    dependencies: ["az-4"],
    awsReference: "aws-3 (Lambda snapshot)",
    providerSpecificNotes: [
      "Consumption vs Premium vs Dedicated hosting plans",
      "Logic Apps have per-connector pricing",
      "Durable Functions add orchestration layer",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. GCP ADAPTER ROADMAP
// ═══════════════════════════════════════════════════════════════════════════

export const GCP_ROADMAP: AdapterRoadmapItem[] = [
  {
    id: "gcp-1",
    provider: "gcp",
    phase: "phase_1",
    category: "execution",
    name: "GCP Compute Engine Apply Actions",
    description: "Implement instance resize (machine type change), start/stop, and disk resize. Uses Compute Engine API.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "EC2 resize/stop/start in runAgent.ts apply handlers",
    providerSpecificNotes: [
      "Machine type change requires instance stop → setMachineType → start",
      "Custom machine types (N1/N2-custom) allow arbitrary CPU/memory",
      "Sole-tenant nodes have different resize constraints",
      "Preemptible/Spot VMs can be reclaimed — resize logic must handle this",
    ],
  },
  {
    id: "gcp-2",
    provider: "gcp",
    phase: "phase_1",
    category: "execution",
    name: "GCP Cloud Storage Apply Actions",
    description: "Implement storage class changes, lifecycle rules, and bucket configuration updates.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: [],
    awsReference: "S3 lifecycle and storage class changes",
    providerSpecificNotes: [
      "GCP has Standard/Nearline/Coldline/Archive (4 tiers)",
      "Object-level vs bucket-level default class",
      "Autoclass feature manages lifecycle automatically — may conflict with manual rules",
      "Early deletion fees for Nearline (30d), Coldline (90d), Archive (365d)",
    ],
  },
  {
    id: "gcp-3",
    provider: "gcp",
    phase: "phase_1",
    category: "execution",
    name: "GCP Rollback Engine",
    description: "Pre-state capture for instances and storage. Restore machine type and storage class on failure.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: ["gcp-1", "gcp-2"],
    awsReference: "AWS rollback in runAgent.ts",
    providerSpecificNotes: [
      "Machine snapshots available for full VM state capture",
      "Persistent disk snapshots provide point-in-time recovery",
      "Storage class changes are per-object — rollback must track which objects changed",
    ],
  },
  {
    id: "gcp-4",
    provider: "gcp",
    phase: "phase_2",
    category: "database",
    name: "Cloud SQL & Spanner Snapshot",
    description: "Snapshot Cloud SQL instances (MySQL, PostgreSQL, SQL Server) and Spanner instances with performance data.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "aws-1 (RDS/Aurora snapshot)",
    providerSpecificNotes: [
      "Cloud SQL has tiers (db-f1-micro through db-custom)",
      "Spanner pricing is by node + storage — different model",
      "Cloud SQL HA uses regional vs zonal instances",
      "Automatic storage increase feature affects cost projections",
    ],
  },
  {
    id: "gcp-5",
    provider: "gcp",
    phase: "phase_2",
    category: "containers",
    name: "GKE Cluster Snapshot",
    description: "Snapshot GKE clusters: node pools, autoscaling, resource quotas, pod-level utilization.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: [],
    awsReference: "aws-2 (ECS/EKS snapshot)",
    providerSpecificNotes: [
      "GKE Autopilot vs Standard mode — fundamentally different cost models",
      "GKE manages control plane (free in Standard, charged differently in Autopilot)",
      "Node auto-provisioning adds new node pools automatically",
      "GKE release channels (Rapid, Regular, Stable) affect cluster versions",
    ],
  },
  {
    id: "gcp-6",
    provider: "gcp",
    phase: "phase_2",
    category: "security",
    name: "GCP IAM & Service Account Analysis",
    description: "Analyze IAM bindings, service accounts, and custom roles for over-permissioning and unused access.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: [],
    awsReference: "aws-7 (IAM policy analysis)",
    providerSpecificNotes: [
      "GCP IAM is policy-binding model (member + role + resource), not policy-attachment",
      "Primitive roles (Owner/Editor/Viewer) are overly broad — flag these",
      "Service account key rotation and unused key detection",
      "Workload Identity Federation replaces service account keys",
      "IAM Recommender API provides Google's own suggestions — use as signal",
    ],
  },
  {
    id: "gcp-7",
    provider: "gcp",
    phase: "phase_2",
    category: "integration",
    name: "GCP Terraform Generation",
    description: "Generate google provider Terraform for instance resize, storage changes, and database right-sizing.",
    status: "planned",
    estimateWeeks: 2,
    dependencies: ["gcp-1", "gcp-2"],
    awsReference: "AWS Terraform generation in toolFramework.ts",
    providerSpecificNotes: [
      "google provider uses different resource naming than GCP console",
      "Project-scoped resources (vs AWS account-scoped)",
      "google-beta provider for newer features",
    ],
  },
  {
    id: "gcp-8",
    provider: "gcp",
    phase: "phase_3",
    category: "integration",
    name: "GCP Billing Integration",
    description: "BigQuery billing export integration for cost analysis, forecasting, and anomaly detection.",
    status: "planned",
    estimateWeeks: 3,
    dependencies: ["gcp-4"],
    awsReference: "aws-6 (Cost Explorer integration)",
    providerSpecificNotes: [
      "GCP billing export goes to BigQuery — requires BigQuery API access",
      "Standard vs detailed billing export (detailed has resource-level cost)",
      "Committed Use Discounts (CUDs) vs Sustained Use Discounts (SUDs) — automatic vs purchased",
      "Billing accounts can span multiple projects",
    ],
  },
  {
    id: "gcp-9",
    provider: "gcp",
    phase: "phase_3",
    category: "integration",
    name: "GCP Recommender API Integration",
    description: "Pull Google Recommender suggestions (cost, security, performance, manageability) as signal input.",
    status: "planned",
    estimateWeeks: 1,
    dependencies: [],
    awsReference: "N/A (closest is AWS Trusted Advisor)",
    providerSpecificNotes: [
      "Recommender covers VM right-sizing, idle resources, IAM, and more",
      "Recommendations include estimated savings — cross-validate with Axiom's own estimates",
      "Insights provide supporting evidence for recommendations",
    ],
  },
  {
    id: "gcp-10",
    provider: "gcp",
    phase: "phase_4",
    category: "serverless",
    name: "Cloud Functions & Cloud Run Snapshot",
    description: "Snapshot Cloud Functions (gen1 and gen2) and Cloud Run services with invocation metrics.",
    status: "research",
    estimateWeeks: 2,
    dependencies: ["gcp-4"],
    awsReference: "aws-3 (Lambda snapshot)",
    providerSpecificNotes: [
      "Cloud Functions gen2 is built on Cloud Run — different pricing",
      "Cloud Run has CPU-always-on vs CPU-only-during-requests",
      "Concurrency settings dramatically affect cost",
      "Cloud Run Jobs for batch workloads",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. ANTI-PATTERN CHECKLIST (WHAT NOT TO DO)
// ═══════════════════════════════════════════════════════════════════════════

export type AntiPattern = {
  name: string;
  description: string;
  consequence: string;
  prevention: string;
};

export const MULTI_CLOUD_ANTI_PATTERNS: AntiPattern[] = [
  {
    name: "Provider logic in core agent",
    description: "if (provider === 'aws') { ... } appearing in reasoning, planning, or recommendation modules",
    consequence: "Core agent becomes untestable without real cloud APIs. Adding a provider requires touching core code.",
    prevention: "All provider-specific logic lives in adapter modules. Core operates on normalized types only.",
  },
  {
    name: "Lowest common denominator abstraction",
    description: "Abstraction only exposes features all three providers support, ignoring unique provider capabilities",
    consequence: "Loses provider-specific value (e.g., AWS Graviton recommendations, Azure Hybrid Benefit, GCP Sustained Use Discounts)",
    prevention: "Normalized schema has optional provider-specific extension fields. Agent can reason about them when available.",
  },
  {
    name: "Duplicated business logic per provider",
    description: "Copy-pasting the same finding classification, scoring, or reasoning logic into each adapter",
    consequence: "Bugs must be fixed in 3 places. Behavior diverges silently across providers.",
    prevention: "Business logic lives once in the agent core. Adapters only translate between provider API and normalized schema.",
  },
  {
    name: "AWS assumptions in data model",
    description: "Database schema using AWS-specific terminology (e.g., 'instanceId' meaning EC2, 'ARN' as universal identifier)",
    consequence: "Azure/GCP resources don't fit the schema. Forced to store data in untyped JSON blobs.",
    prevention: "Schema uses provider-agnostic terms: resourceId, externalAccountId, region. Provider-specific IDs in metadata.",
  },
  {
    name: "Cost comparison without normalization",
    description: "Comparing AWS and Azure costs directly without normalizing for equivalent workload characteristics",
    consequence: "Misleading cross-cloud recommendations. Apples-to-oranges cost comparisons destroy trust.",
    prevention: "CostNormalizer converts all costs to $/vCPU/month and $/GB/month for comparison. Raw costs shown alongside.",
  },
  {
    name: "Testing against mocked providers only",
    description: "Unit tests use mock provider responses that drift from real API behavior over time",
    consequence: "Tests pass but production breaks. Provider API changes go undetected.",
    prevention: "Integration test suite runs against real provider APIs in sandbox accounts on weekly schedule.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 9. CROSS-CLOUD INTELLIGENCE DESIGN
// ═══════════════════════════════════════════════════════════════════════════

export type CrossCloudCapability = {
  name: string;
  description: string;
  status: "implemented" | "partial" | "planned" | "research";
  dependencies: string[];
  valueProposition: string;
};

export const CROSS_CLOUD_CAPABILITIES: CrossCloudCapability[] = [
  {
    name: "Unified Cost Dashboard",
    description: "Single view of costs across all connected cloud providers with normalized categories and trends",
    status: "partial",
    dependencies: ["multiCloudSummary.ts"],
    valueProposition: "No cloud provider shows competitor costs. This is the only place to see total cloud spend.",
  },
  {
    name: "Cross-Cloud Redundancy Detection",
    description: "Identify services running on multiple clouds that could be consolidated (e.g., DNS on both Route53 and Cloud DNS)",
    status: "planned",
    dependencies: ["multiCloudPrioritizer.ts"],
    valueProposition: "Multi-cloud sprawl costs money. Finding redundancies saves without reducing reliability.",
  },
  {
    name: "Migration Feasibility Analysis",
    description: "When a workload is cheaper on another provider, analyze migration complexity, egress costs, and architectural fit",
    status: "research",
    dependencies: [],
    valueProposition: "Honest cross-cloud advice that no provider would ever give. Ultimate trust builder.",
  },
  {
    name: "Resilience Posture Comparison",
    description: "Compare resilience architecture across providers: multi-AZ, multi-region, backup strategies, disaster recovery",
    status: "planned",
    dependencies: [],
    valueProposition: "Ensures consistent resilience posture across all clouds, preventing the weakest-link problem.",
  },
  {
    name: "Security Posture Alignment",
    description: "Ensure IAM policies, encryption settings, and network exposure are consistent across all clouds",
    status: "planned",
    dependencies: [],
    valueProposition: "Security gaps often exist where providers meet. Cross-cloud visibility closes these gaps.",
  },
  {
    name: "Cross-Cloud Governance",
    description: "Apply a single governance policy across AWS, Azure, and GCP. One policy, three providers.",
    status: "partial",
    dependencies: ["governanceEngine.ts"],
    valueProposition: "Enterprises want one compliance standard, not three sets of provider-specific rules.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getProviderCapabilities(provider: CloudProvider): ProviderCapabilityMatrix | undefined {
  return CAPABILITY_MATRIX.find((c) => c.provider === provider);
}

export function getProviderGaps(provider: CloudProvider): string[] {
  const matrix = getProviderCapabilities(provider);
  if (!matrix) return [];
  return Object.entries(matrix.capabilities)
    .filter(([, status]) => status === "planned" || status === "partial")
    .map(([cap]) => cap);
}

export function getProviderParity(): { capability: ProviderCapability; aws: CapabilityStatus; azure: CapabilityStatus; gcp: CapabilityStatus }[] {
  const [aws, azure, gcp] = CAPABILITY_MATRIX;
  const allCaps = Object.keys(aws.capabilities) as ProviderCapability[];
  return allCaps.map((cap) => ({
    capability: cap,
    aws: aws.capabilities[cap],
    azure: azure.capabilities[cap],
    gcp: gcp.capabilities[cap],
  }));
}

export function getAzureRoadmapByPhase(phase: AdapterRoadmapItem["phase"]): AdapterRoadmapItem[] {
  return AZURE_ROADMAP.filter((i) => i.phase === phase);
}

export function getGCPRoadmapByPhase(phase: AdapterRoadmapItem["phase"]): AdapterRoadmapItem[] {
  return GCP_ROADMAP.filter((i) => i.phase === phase);
}

export function getResourceMapping(category: ResourceCategory): ResourceMapping | undefined {
  return RESOURCE_MAPPINGS.find((m) => m.category === category);
}

export function getMultiCloudEstimate(): {
  azureTotalWeeks: number;
  gcpTotalWeeks: number;
  azureCompleted: number;
  gcpCompleted: number;
} {
  return {
    azureTotalWeeks: AZURE_ROADMAP.reduce((sum, i) => sum + i.estimateWeeks, 0),
    gcpTotalWeeks: GCP_ROADMAP.reduce((sum, i) => sum + i.estimateWeeks, 0),
    azureCompleted: AZURE_ROADMAP.filter((i) => i.status === "completed").length,
    gcpCompleted: GCP_ROADMAP.filter((i) => i.status === "completed").length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type MultiCloudTestResult = { name: string; passed: boolean; detail: string };

export function runMultiCloudTests(): MultiCloudTestResult[] {
  const results: MultiCloudTestResult[] = [];

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: All three providers in capability matrix
  assert("all providers present", () => CAPABILITY_MATRIX.length === 3,
    `providers=${CAPABILITY_MATRIX.map((c) => c.provider).join(", ")}`);

  // Test 2: AWS has most capabilities implemented
  const awsCaps = CAPABILITY_MATRIX.find((c) => c.provider === "aws")!;
  const awsImplemented = Object.values(awsCaps.capabilities).filter((s) => s === "implemented").length;
  assert("AWS leads implementation", () => awsImplemented >= 10,
    `implemented=${awsImplemented}`);

  // Test 3: Resource mappings cover core categories
  const mappedCategories = new Set(RESOURCE_MAPPINGS.map((m) => m.category));
  assert("core categories mapped", () =>
    mappedCategories.has("compute") && mappedCategories.has("storage") && mappedCategories.has("database"),
    `categories=${[...mappedCategories].join(", ")}`);

  // Test 4: Every resource mapping has all three providers
  const allMapped = RESOURCE_MAPPINGS.every((m) => m.aws.length > 0 && m.azure.length > 0 && m.gcp.length > 0);
  assert("all providers in resource maps", () => allMapped,
    `count=${RESOURCE_MAPPINGS.length}`);

  // Test 5: Azure roadmap has items
  assert("Azure roadmap exists", () => AZURE_ROADMAP.length >= 5,
    `items=${AZURE_ROADMAP.length}`);

  // Test 6: GCP roadmap has items
  assert("GCP roadmap exists", () => GCP_ROADMAP.length >= 5,
    `items=${GCP_ROADMAP.length}`);

  // Test 7: Roadmap items have unique IDs
  const azIds = AZURE_ROADMAP.map((i) => i.id);
  const gcpIds = GCP_ROADMAP.map((i) => i.id);
  assert("unique Azure IDs", () => new Set(azIds).size === azIds.length, `total=${azIds.length}`);
  assert("unique GCP IDs", () => new Set(gcpIds).size === gcpIds.length, `total=${gcpIds.length}`);

  // Test 8: Anti-patterns defined
  assert("anti-patterns documented", () => MULTI_CLOUD_ANTI_PATTERNS.length >= 5,
    `count=${MULTI_CLOUD_ANTI_PATTERNS.length}`);

  // Test 9: Shared interfaces cover key layers
  const interfaceLayers = new Set(SHARED_INTERFACES.map((i) => i.layer));
  assert("shared interfaces span layers", () =>
    interfaceLayers.has("snapshot") && interfaceLayers.has("execution") && interfaceLayers.has("reasoning"),
    `layers=${[...interfaceLayers].join(", ")}`);

  // Test 10: Provider gaps are queryable
  const azureGaps = getProviderGaps("azure");
  const gcpGaps = getProviderGaps("gcp");
  assert("provider gaps queryable", () => azureGaps.length > 0 && gcpGaps.length > 0,
    `azure gaps=${azureGaps.length}, gcp gaps=${gcpGaps.length}`);

  // Test 11: Cross-cloud capabilities defined
  assert("cross-cloud capabilities exist", () => CROSS_CLOUD_CAPABILITIES.length >= 4,
    `count=${CROSS_CLOUD_CAPABILITIES.length}`);

  // Test 12: Abstraction components defined
  assert("abstraction layer documented", () => ABSTRACTION_COMPONENTS.length >= 4,
    `count=${ABSTRACTION_COMPONENTS.length}`);

  // Test 13: Azure and GCP have matching phases
  const azPhases = new Set(AZURE_ROADMAP.map((i) => i.phase));
  const gcpPhases = new Set(GCP_ROADMAP.map((i) => i.phase));
  assert("parallel phase coverage", () =>
    azPhases.has("phase_1") && azPhases.has("phase_2") && gcpPhases.has("phase_1") && gcpPhases.has("phase_2"),
    `az phases=${[...azPhases].join(",")}, gcp phases=${[...gcpPhases].join(",")}`);

  // Test 14: Multi-cloud estimate computes
  const estimate = getMultiCloudEstimate();
  assert("estimates compute", () => estimate.azureTotalWeeks > 0 && estimate.gcpTotalWeeks > 0,
    `azure=${estimate.azureTotalWeeks}wk, gcp=${estimate.gcpTotalWeeks}wk`);

  // Test 15: Provider parity queryable
  const parity = getProviderParity();
  assert("parity queryable", () => parity.length > 0,
    `capabilities=${parity.length}`);

  return results;
}

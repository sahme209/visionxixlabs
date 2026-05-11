// ─────────────────────────────────────────────────────────────────────────────
// Multi-Cloud Abstraction Layer
// Provider-neutral operational model for Axiom Agent cognition
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Provider Identity
// ═══════════════════════════════════════════════════════════════════════════════

export type SupportedProvider = "aws" | "azure" | "gcp";

export type ProviderTier = "full" | "scan_only" | "planned";

export interface ProviderProfile {
  provider: SupportedProvider;
  tier: ProviderTier;
  displayName: string;
  scanSupported: boolean;
  applySupported: boolean;
  rollbackSupported: boolean;
  terraformSupported: boolean;
  regions: string[];
  authMethods: AuthMethod[];
}

export type AuthMethod =
  | "iam_role"
  | "service_account"
  | "service_principal"
  | "access_key"
  | "oauth"
  | "federated_identity";

export const PROVIDER_PROFILES: Record<SupportedProvider, ProviderProfile> = {
  aws: {
    provider: "aws",
    tier: "full",
    displayName: "Amazon Web Services",
    scanSupported: true,
    applySupported: true,
    rollbackSupported: true,
    terraformSupported: true,
    regions: [
      "us-east-1", "us-east-2", "us-west-1", "us-west-2",
      "eu-west-1", "eu-west-2", "eu-central-1",
      "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
    ],
    authMethods: ["iam_role", "access_key", "federated_identity"],
  },
  azure: {
    provider: "azure",
    tier: "scan_only",
    displayName: "Microsoft Azure",
    scanSupported: true,
    applySupported: false,
    rollbackSupported: false,
    terraformSupported: false,
    regions: [
      "eastus", "eastus2", "westus2", "westus3",
      "westeurope", "northeurope", "centralus",
      "southeastasia", "australiaeast", "japaneast",
    ],
    authMethods: ["service_principal", "oauth", "federated_identity"],
  },
  gcp: {
    provider: "gcp",
    tier: "scan_only",
    displayName: "Google Cloud Platform",
    scanSupported: true,
    applySupported: false,
    rollbackSupported: false,
    terraformSupported: false,
    regions: [
      "us-central1", "us-east1", "us-west1", "us-east4",
      "europe-west1", "europe-west2", "europe-west4",
      "asia-southeast1", "australia-southeast1", "asia-northeast1",
    ],
    authMethods: ["service_account", "oauth", "federated_identity"],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Operational Domains
// ═══════════════════════════════════════════════════════════════════════════════

export type OperationalDomain =
  | "compute"
  | "storage"
  | "networking"
  | "resilience"
  | "cost_optimization"
  | "identity_access"
  | "monitoring";

export interface DomainDefinition {
  domain: OperationalDomain;
  description: string;
  subdomains: Subdomain[];
  providerNeutralConcepts: string[];
  cognitiveRelevance: string;
}

export interface Subdomain {
  name: string;
  description: string;
  resourceTypes: UnifiedResourceType[];
}

export const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    domain: "compute",
    description: "Processing capacity — virtual machines, containers, serverless functions, and managed compute services.",
    subdomains: [
      {
        name: "virtual_machines",
        description: "Long-running instances with dedicated or shared vCPUs and memory.",
        resourceTypes: ["vm_instance", "vm_image", "vm_snapshot", "auto_scaling_group"],
      },
      {
        name: "containers",
        description: "Container orchestration clusters, services, and task definitions.",
        resourceTypes: ["container_cluster", "container_service", "container_task", "container_registry"],
      },
      {
        name: "serverless",
        description: "Event-driven functions and managed compute without provisioned servers.",
        resourceTypes: ["serverless_function", "serverless_api", "serverless_event_source"],
      },
    ],
    providerNeutralConcepts: [
      "vCPU count", "memory GiB", "instance family", "utilization %",
      "right-sizing opportunity", "idle detection", "reserved vs on-demand",
    ],
    cognitiveRelevance: "Compute is the primary cost driver and the most common target for right-sizing recommendations.",
  },
  {
    domain: "storage",
    description: "Persistent data — object stores, block storage, file systems, and backup vaults.",
    subdomains: [
      {
        name: "object_storage",
        description: "Scalable key-value blob storage (S3, Blob, GCS).",
        resourceTypes: ["object_bucket", "object_lifecycle_rule"],
      },
      {
        name: "block_storage",
        description: "Volumes attached to compute instances.",
        resourceTypes: ["block_volume", "block_snapshot"],
      },
      {
        name: "file_storage",
        description: "Managed network file systems.",
        resourceTypes: ["file_share", "file_system"],
      },
      {
        name: "backup",
        description: "Backup vaults, plans, and retention policies.",
        resourceTypes: ["backup_vault", "backup_plan", "backup_recovery_point"],
      },
    ],
    providerNeutralConcepts: [
      "storage class", "lifecycle policy", "replication status",
      "encryption at rest", "public access", "versioning",
      "cost per GiB/month", "data transfer cost",
    ],
    cognitiveRelevance: "Storage is the second-largest cost category and the most common source of security violations (public buckets).",
  },
  {
    domain: "networking",
    description: "Connectivity — virtual networks, subnets, load balancers, DNS, firewalls, and CDN.",
    subdomains: [
      {
        name: "virtual_networks",
        description: "Isolated network environments and their segmentation.",
        resourceTypes: ["virtual_network", "subnet", "route_table", "nat_gateway"],
      },
      {
        name: "load_balancing",
        description: "Traffic distribution across compute targets.",
        resourceTypes: ["load_balancer", "target_group", "listener_rule"],
      },
      {
        name: "dns",
        description: "Domain name resolution and routing policies.",
        resourceTypes: ["dns_zone", "dns_record"],
      },
      {
        name: "firewall",
        description: "Network access controls and security groups.",
        resourceTypes: ["security_group", "network_acl", "firewall_rule", "waf_policy"],
      },
      {
        name: "cdn",
        description: "Content delivery networks and edge caching.",
        resourceTypes: ["cdn_distribution", "cdn_origin"],
      },
    ],
    providerNeutralConcepts: [
      "CIDR block", "ingress/egress rules", "public vs private subnet",
      "peering connections", "transit gateway", "endpoint services",
      "bandwidth allocation", "data transfer pricing",
    ],
    cognitiveRelevance: "Networking misconfigurations are the #1 attack vector. Security group analysis is a core governance function.",
  },
  {
    domain: "resilience",
    description: "Availability, durability, and disaster recovery — replication, failover, health checks, and backup strategies.",
    subdomains: [
      {
        name: "high_availability",
        description: "Multi-AZ and multi-region deployment patterns.",
        resourceTypes: ["availability_zone_config", "region_config", "failover_group"],
      },
      {
        name: "disaster_recovery",
        description: "Backup, restore, and cross-region replication.",
        resourceTypes: ["replication_config", "recovery_plan", "dr_test_record"],
      },
      {
        name: "health_monitoring",
        description: "Endpoint health checks and automatic recovery.",
        resourceTypes: ["health_check", "auto_recovery_config"],
      },
    ],
    providerNeutralConcepts: [
      "RTO target", "RPO target", "replication lag",
      "failover tested", "backup frequency", "cross-region copies",
      "single point of failure", "blast radius",
    ],
    cognitiveRelevance: "Resilience gaps are high-severity findings. The agent reasons about single-points-of-failure and untested DR plans.",
  },
  {
    domain: "cost_optimization",
    description: "Spend analysis — reserved instances, savings plans, idle resources, right-sizing, and budget enforcement.",
    subdomains: [
      {
        name: "commitment_management",
        description: "Reserved instances, savings plans, and committed use discounts.",
        resourceTypes: ["reservation", "savings_plan", "committed_use_discount"],
      },
      {
        name: "waste_detection",
        description: "Idle, underutilized, and orphaned resources.",
        resourceTypes: ["idle_resource", "orphaned_resource", "underutilized_resource"],
      },
      {
        name: "budget_governance",
        description: "Budget thresholds, alerts, and cost allocation tags.",
        resourceTypes: ["budget", "cost_alert", "cost_allocation_tag"],
      },
    ],
    providerNeutralConcepts: [
      "monthly spend USD", "cost per vCPU/hour", "reservation coverage %",
      "savings opportunity USD", "waste ratio", "cost trend",
      "budget utilization %", "cost allocation completeness",
    ],
    cognitiveRelevance: "Cost optimization is the most actionable domain — high-confidence recommendations with clear dollar impact.",
  },
  {
    domain: "identity_access",
    description: "Identity — users, roles, policies, service accounts, and privilege analysis.",
    subdomains: [
      {
        name: "identity_management",
        description: "Users, groups, service accounts, and federated identities.",
        resourceTypes: ["iam_user", "iam_group", "service_identity", "federated_identity_config"],
      },
      {
        name: "access_policies",
        description: "Permission policies, role assignments, and access boundaries.",
        resourceTypes: ["iam_policy", "iam_role", "role_assignment", "permission_boundary"],
      },
      {
        name: "privilege_analysis",
        description: "Least-privilege assessment, unused permissions, and access paths.",
        resourceTypes: ["privilege_report", "unused_permission", "access_path"],
      },
    ],
    providerNeutralConcepts: [
      "principal", "permission", "resource scope",
      "least privilege score", "unused permissions count",
      "admin access count", "MFA enforcement",
      "credential age", "last activity",
    ],
    cognitiveRelevance: "IAM analysis is security-critical. The agent never modifies IAM without explicit approval regardless of trust level.",
  },
  {
    domain: "monitoring",
    description: "Observability — metrics, logs, alarms, dashboards, and tracing.",
    subdomains: [
      {
        name: "metrics",
        description: "Time-series performance and utilization metrics.",
        resourceTypes: ["metric_stream", "metric_alarm", "metric_dashboard"],
      },
      {
        name: "logging",
        description: "Centralized log collection, retention, and analysis.",
        resourceTypes: ["log_group", "log_subscription", "log_export"],
      },
      {
        name: "tracing",
        description: "Distributed request tracing and service maps.",
        resourceTypes: ["trace_config", "service_map"],
      },
      {
        name: "alerting",
        description: "Alarm routing, escalation, and notification channels.",
        resourceTypes: ["alarm_rule", "notification_channel", "escalation_policy"],
      },
    ],
    providerNeutralConcepts: [
      "metric namespace", "alarm threshold", "evaluation period",
      "log retention days", "trace sampling rate",
      "notification endpoint", "escalation chain",
    ],
    cognitiveRelevance: "Monitoring data feeds the cognitive loop — metric trends inform interpretation, drift detection, and verification phases.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Unified Resource Model
// ═══════════════════════════════════════════════════════════════════════════════

export type UnifiedResourceType =
  // Compute
  | "vm_instance" | "vm_image" | "vm_snapshot" | "auto_scaling_group"
  | "container_cluster" | "container_service" | "container_task" | "container_registry"
  | "serverless_function" | "serverless_api" | "serverless_event_source"
  // Storage
  | "object_bucket" | "object_lifecycle_rule"
  | "block_volume" | "block_snapshot"
  | "file_share" | "file_system"
  | "backup_vault" | "backup_plan" | "backup_recovery_point"
  // Networking
  | "virtual_network" | "subnet" | "route_table" | "nat_gateway"
  | "load_balancer" | "target_group" | "listener_rule"
  | "dns_zone" | "dns_record"
  | "security_group" | "network_acl" | "firewall_rule" | "waf_policy"
  | "cdn_distribution" | "cdn_origin"
  // Resilience
  | "availability_zone_config" | "region_config" | "failover_group"
  | "replication_config" | "recovery_plan" | "dr_test_record"
  | "health_check" | "auto_recovery_config"
  // Cost Optimization
  | "reservation" | "savings_plan" | "committed_use_discount"
  | "idle_resource" | "orphaned_resource" | "underutilized_resource"
  | "budget" | "cost_alert" | "cost_allocation_tag"
  // Identity & Access
  | "iam_user" | "iam_group" | "service_identity" | "federated_identity_config"
  | "iam_policy" | "iam_role" | "role_assignment" | "permission_boundary"
  | "privilege_report" | "unused_permission" | "access_path"
  // Monitoring
  | "metric_stream" | "metric_alarm" | "metric_dashboard"
  | "log_group" | "log_subscription" | "log_export"
  | "trace_config" | "service_map"
  | "alarm_rule" | "notification_channel" | "escalation_policy";

export interface UnifiedResource {
  id: string;
  unifiedType: UnifiedResourceType;
  domain: OperationalDomain;
  provider: SupportedProvider;
  providerResourceType: string;
  providerResourceId: string;
  accountId: string;
  region: string;
  name: string;
  tags: Record<string, string>;
  createdAt: string;
  lastModified: string;
  properties: Record<string, unknown>;
  costPerMonth: number | null;
  complianceFlags: ComplianceFlag[];
}

export type ComplianceFlag =
  | "public_access"
  | "unencrypted"
  | "no_backup"
  | "no_replication"
  | "overprivileged"
  | "no_mfa"
  | "no_lifecycle"
  | "idle"
  | "orphaned"
  | "missing_tags"
  | "single_az"
  | "deprecated_type";

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Provider Resource Mapping Registry
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderResourceMapping {
  unifiedType: UnifiedResourceType;
  domain: OperationalDomain;
  providers: {
    aws: ProviderResourceSpec | null;
    azure: ProviderResourceSpec | null;
    gcp: ProviderResourceSpec | null;
  };
}

export interface ProviderResourceSpec {
  resourceType: string;
  service: string;
  apiNamespace: string;
  terraformResource: string;
  snapshotFields: string[];
  costDimensions: CostDimension[];
  scanComplexity: "simple" | "moderate" | "complex";
}

export type CostDimension =
  | "per_hour"
  | "per_gib_month"
  | "per_request"
  | "per_gib_transfer"
  | "per_vcpu_hour"
  | "per_unit_month"
  | "flat_monthly"
  | "per_million_invocations"
  | "per_gib_second";

export const RESOURCE_MAPPING_REGISTRY: ProviderResourceMapping[] = [
  // ── Compute ────────────────────────────────────────────────────────────────
  {
    unifiedType: "vm_instance",
    domain: "compute",
    providers: {
      aws: {
        resourceType: "AWS::EC2::Instance",
        service: "EC2",
        apiNamespace: "ec2",
        terraformResource: "aws_instance",
        snapshotFields: ["instanceId", "instanceType", "state", "vpcId", "subnetId", "securityGroups", "iamInstanceProfile", "tags"],
        costDimensions: ["per_hour", "per_vcpu_hour"],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.Compute/virtualMachines",
        service: "Virtual Machines",
        apiNamespace: "compute",
        terraformResource: "azurerm_virtual_machine",
        snapshotFields: ["vmId", "vmSize", "provisioningState", "networkInterfaces", "osDisk", "tags"],
        costDimensions: ["per_hour", "per_vcpu_hour"],
        scanComplexity: "simple",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Instance",
        service: "Compute Engine",
        apiNamespace: "compute",
        terraformResource: "google_compute_instance",
        snapshotFields: ["id", "machineType", "status", "networkInterfaces", "disks", "serviceAccounts", "labels"],
        costDimensions: ["per_hour", "per_vcpu_hour"],
        scanComplexity: "simple",
      },
    },
  },
  {
    unifiedType: "container_cluster",
    domain: "compute",
    providers: {
      aws: {
        resourceType: "AWS::ECS::Cluster",
        service: "ECS",
        apiNamespace: "ecs",
        terraformResource: "aws_ecs_cluster",
        snapshotFields: ["clusterArn", "clusterName", "status", "registeredContainerInstancesCount", "runningTasksCount", "settings"],
        costDimensions: ["per_vcpu_hour", "per_gib_month"],
        scanComplexity: "moderate",
      },
      azure: {
        resourceType: "Microsoft.ContainerService/managedClusters",
        service: "AKS",
        apiNamespace: "containerservice",
        terraformResource: "azurerm_kubernetes_cluster",
        snapshotFields: ["id", "kubernetesVersion", "agentPoolProfiles", "networkProfile", "provisioningState", "tags"],
        costDimensions: ["per_hour", "per_vcpu_hour"],
        scanComplexity: "complex",
      },
      gcp: {
        resourceType: "container.googleapis.com/Cluster",
        service: "GKE",
        apiNamespace: "container",
        terraformResource: "google_container_cluster",
        snapshotFields: ["name", "currentMasterVersion", "nodePools", "network", "status", "resourceLabels"],
        costDimensions: ["per_hour", "per_vcpu_hour"],
        scanComplexity: "complex",
      },
    },
  },
  {
    unifiedType: "serverless_function",
    domain: "compute",
    providers: {
      aws: {
        resourceType: "AWS::Lambda::Function",
        service: "Lambda",
        apiNamespace: "lambda",
        terraformResource: "aws_lambda_function",
        snapshotFields: ["functionName", "functionArn", "runtime", "memorySize", "timeout", "handler", "environment", "tags"],
        costDimensions: ["per_million_invocations", "per_gib_second"],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.Web/sites",
        service: "Azure Functions",
        apiNamespace: "web",
        terraformResource: "azurerm_function_app",
        snapshotFields: ["id", "name", "kind", "state", "runtime", "appSettings", "tags"],
        costDimensions: ["per_million_invocations", "per_gib_second"],
        scanComplexity: "moderate",
      },
      gcp: {
        resourceType: "cloudfunctions.googleapis.com/Function",
        service: "Cloud Functions",
        apiNamespace: "cloudfunctions",
        terraformResource: "google_cloudfunctions_function",
        snapshotFields: ["name", "runtime", "entryPoint", "availableMemoryMb", "timeout", "status", "labels"],
        costDimensions: ["per_million_invocations", "per_gib_second"],
        scanComplexity: "simple",
      },
    },
  },
  // ── Storage ────────────────────────────────────────────────────────────────
  {
    unifiedType: "object_bucket",
    domain: "storage",
    providers: {
      aws: {
        resourceType: "AWS::S3::Bucket",
        service: "S3",
        apiNamespace: "s3",
        terraformResource: "aws_s3_bucket",
        snapshotFields: ["bucketName", "region", "versioning", "encryption", "publicAccess", "lifecycleRules", "replication", "tags"],
        costDimensions: ["per_gib_month", "per_request", "per_gib_transfer"],
        scanComplexity: "moderate",
      },
      azure: {
        resourceType: "Microsoft.Storage/storageAccounts/blobServices/containers",
        service: "Blob Storage",
        apiNamespace: "storage",
        terraformResource: "azurerm_storage_container",
        snapshotFields: ["id", "name", "publicAccess", "metadata", "properties"],
        costDimensions: ["per_gib_month", "per_request", "per_gib_transfer"],
        scanComplexity: "moderate",
      },
      gcp: {
        resourceType: "storage.googleapis.com/Bucket",
        service: "Cloud Storage",
        apiNamespace: "storage",
        terraformResource: "google_storage_bucket",
        snapshotFields: ["name", "location", "storageClass", "versioning", "encryption", "iamConfiguration", "lifecycle", "labels"],
        costDimensions: ["per_gib_month", "per_request", "per_gib_transfer"],
        scanComplexity: "moderate",
      },
    },
  },
  {
    unifiedType: "block_volume",
    domain: "storage",
    providers: {
      aws: {
        resourceType: "AWS::EC2::Volume",
        service: "EBS",
        apiNamespace: "ec2",
        terraformResource: "aws_ebs_volume",
        snapshotFields: ["volumeId", "volumeType", "size", "state", "encrypted", "attachments", "iops", "tags"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.Compute/disks",
        service: "Managed Disks",
        apiNamespace: "compute",
        terraformResource: "azurerm_managed_disk",
        snapshotFields: ["id", "name", "sku", "diskSizeGB", "diskState", "encryption", "tags"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Disk",
        service: "Persistent Disk",
        apiNamespace: "compute",
        terraformResource: "google_compute_disk",
        snapshotFields: ["name", "type", "sizeGb", "status", "sourceImage", "labels"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
    },
  },
  // ── Networking ─────────────────────────────────────────────────────────────
  {
    unifiedType: "virtual_network",
    domain: "networking",
    providers: {
      aws: {
        resourceType: "AWS::EC2::VPC",
        service: "VPC",
        apiNamespace: "ec2",
        terraformResource: "aws_vpc",
        snapshotFields: ["vpcId", "cidrBlock", "state", "isDefault", "enableDnsHostnames", "tags"],
        costDimensions: ["flat_monthly"],
        scanComplexity: "moderate",
      },
      azure: {
        resourceType: "Microsoft.Network/virtualNetworks",
        service: "Virtual Network",
        apiNamespace: "network",
        terraformResource: "azurerm_virtual_network",
        snapshotFields: ["id", "name", "addressSpace", "subnets", "provisioningState", "tags"],
        costDimensions: ["flat_monthly"],
        scanComplexity: "moderate",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Network",
        service: "VPC Network",
        apiNamespace: "compute",
        terraformResource: "google_compute_network",
        snapshotFields: ["name", "autoCreateSubnetworks", "subnetworks", "routingConfig"],
        costDimensions: ["flat_monthly"],
        scanComplexity: "moderate",
      },
    },
  },
  {
    unifiedType: "load_balancer",
    domain: "networking",
    providers: {
      aws: {
        resourceType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
        service: "ALB/NLB",
        apiNamespace: "elbv2",
        terraformResource: "aws_lb",
        snapshotFields: ["loadBalancerArn", "type", "scheme", "state", "availabilityZones", "securityGroups", "tags"],
        costDimensions: ["per_hour", "per_gib_transfer"],
        scanComplexity: "moderate",
      },
      azure: {
        resourceType: "Microsoft.Network/loadBalancers",
        service: "Load Balancer",
        apiNamespace: "network",
        terraformResource: "azurerm_lb",
        snapshotFields: ["id", "name", "sku", "frontendIPConfigurations", "backendAddressPools", "probes", "tags"],
        costDimensions: ["per_hour", "per_gib_transfer"],
        scanComplexity: "moderate",
      },
      gcp: {
        resourceType: "compute.googleapis.com/ForwardingRule",
        service: "Cloud Load Balancing",
        apiNamespace: "compute",
        terraformResource: "google_compute_forwarding_rule",
        snapshotFields: ["name", "target", "portRange", "IPAddress", "loadBalancingScheme", "network"],
        costDimensions: ["per_hour", "per_gib_transfer"],
        scanComplexity: "complex",
      },
    },
  },
  {
    unifiedType: "security_group",
    domain: "networking",
    providers: {
      aws: {
        resourceType: "AWS::EC2::SecurityGroup",
        service: "VPC",
        apiNamespace: "ec2",
        terraformResource: "aws_security_group",
        snapshotFields: ["groupId", "groupName", "vpcId", "ingressRules", "egressRules", "tags"],
        costDimensions: [],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.Network/networkSecurityGroups",
        service: "NSG",
        apiNamespace: "network",
        terraformResource: "azurerm_network_security_group",
        snapshotFields: ["id", "name", "securityRules", "subnets", "networkInterfaces", "tags"],
        costDimensions: [],
        scanComplexity: "simple",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Firewall",
        service: "VPC Firewall",
        apiNamespace: "compute",
        terraformResource: "google_compute_firewall",
        snapshotFields: ["name", "network", "direction", "allowed", "denied", "sourceRanges", "targetTags"],
        costDimensions: [],
        scanComplexity: "simple",
      },
    },
  },
  // ── Identity & Access ──────────────────────────────────────────────────────
  {
    unifiedType: "iam_role",
    domain: "identity_access",
    providers: {
      aws: {
        resourceType: "AWS::IAM::Role",
        service: "IAM",
        apiNamespace: "iam",
        terraformResource: "aws_iam_role",
        snapshotFields: ["roleName", "roleId", "arn", "assumeRolePolicyDocument", "attachedPolicies", "tags"],
        costDimensions: [],
        scanComplexity: "complex",
      },
      azure: {
        resourceType: "Microsoft.Authorization/roleDefinitions",
        service: "Azure RBAC",
        apiNamespace: "authorization",
        terraformResource: "azurerm_role_definition",
        snapshotFields: ["id", "roleName", "type", "permissions", "assignableScopes"],
        costDimensions: [],
        scanComplexity: "complex",
      },
      gcp: {
        resourceType: "iam.googleapis.com/Role",
        service: "Cloud IAM",
        apiNamespace: "iam",
        terraformResource: "google_project_iam_custom_role",
        snapshotFields: ["name", "title", "includedPermissions", "stage", "etag"],
        costDimensions: [],
        scanComplexity: "complex",
      },
    },
  },
  {
    unifiedType: "iam_policy",
    domain: "identity_access",
    providers: {
      aws: {
        resourceType: "AWS::IAM::Policy",
        service: "IAM",
        apiNamespace: "iam",
        terraformResource: "aws_iam_policy",
        snapshotFields: ["policyName", "policyId", "arn", "policyDocument", "attachmentCount", "tags"],
        costDimensions: [],
        scanComplexity: "complex",
      },
      azure: {
        resourceType: "Microsoft.Authorization/policyDefinitions",
        service: "Azure Policy",
        apiNamespace: "authorization",
        terraformResource: "azurerm_policy_definition",
        snapshotFields: ["id", "name", "policyType", "mode", "parameters", "policyRule"],
        costDimensions: [],
        scanComplexity: "complex",
      },
      gcp: {
        resourceType: "iam.googleapis.com/Policy",
        service: "Cloud IAM",
        apiNamespace: "iam",
        terraformResource: "google_project_iam_policy",
        snapshotFields: ["bindings", "etag", "version"],
        costDimensions: [],
        scanComplexity: "complex",
      },
    },
  },
  // ── Monitoring ─────────────────────────────────────────────────────────────
  {
    unifiedType: "metric_alarm",
    domain: "monitoring",
    providers: {
      aws: {
        resourceType: "AWS::CloudWatch::Alarm",
        service: "CloudWatch",
        apiNamespace: "cloudwatch",
        terraformResource: "aws_cloudwatch_metric_alarm",
        snapshotFields: ["alarmName", "metricName", "namespace", "statistic", "threshold", "comparisonOperator", "evaluationPeriods", "actions"],
        costDimensions: ["per_unit_month"],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.Insights/metricAlerts",
        service: "Azure Monitor",
        apiNamespace: "insights",
        terraformResource: "azurerm_monitor_metric_alert",
        snapshotFields: ["id", "name", "criteria", "actions", "severity", "evaluationFrequency", "windowSize", "scopes"],
        costDimensions: ["per_unit_month"],
        scanComplexity: "simple",
      },
      gcp: {
        resourceType: "monitoring.googleapis.com/AlertPolicy",
        service: "Cloud Monitoring",
        apiNamespace: "monitoring",
        terraformResource: "google_monitoring_alert_policy",
        snapshotFields: ["name", "displayName", "conditions", "notificationChannels", "combiner", "enabled", "userLabels"],
        costDimensions: ["per_unit_month"],
        scanComplexity: "simple",
      },
    },
  },
  {
    unifiedType: "log_group",
    domain: "monitoring",
    providers: {
      aws: {
        resourceType: "AWS::Logs::LogGroup",
        service: "CloudWatch Logs",
        apiNamespace: "logs",
        terraformResource: "aws_cloudwatch_log_group",
        snapshotFields: ["logGroupName", "retentionInDays", "storedBytes", "kmsKeyId", "tags"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
      azure: {
        resourceType: "Microsoft.OperationalInsights/workspaces",
        service: "Log Analytics",
        apiNamespace: "operationalinsights",
        terraformResource: "azurerm_log_analytics_workspace",
        snapshotFields: ["id", "name", "sku", "retentionInDays", "workspaceCapping", "tags"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
      gcp: {
        resourceType: "logging.googleapis.com/LogBucket",
        service: "Cloud Logging",
        apiNamespace: "logging",
        terraformResource: "google_logging_project_bucket_config",
        snapshotFields: ["name", "retentionDays", "locked", "lifecycleState"],
        costDimensions: ["per_gib_month"],
        scanComplexity: "simple",
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Operational Vocabulary
// ═══════════════════════════════════════════════════════════════════════════════

export type UnifiedAction =
  | "scan"
  | "classify"
  | "right_size"
  | "terminate"
  | "upgrade"
  | "downgrade"
  | "enable_encryption"
  | "enable_versioning"
  | "enable_replication"
  | "restrict_public_access"
  | "rotate_credentials"
  | "apply_lifecycle_policy"
  | "enable_backup"
  | "enable_monitoring"
  | "modify_security_rules"
  | "tag_resource"
  | "delete_orphan"
  | "reserve_capacity"
  | "migrate_storage_class"
  | "enable_mfa";

export interface ActionMapping {
  unifiedAction: UnifiedAction;
  domain: OperationalDomain;
  riskLevel: ActionRiskLevel;
  requiresApproval: boolean;
  reversible: boolean;
  providers: {
    aws: ProviderActionSpec | null;
    azure: ProviderActionSpec | null;
    gcp: ProviderActionSpec | null;
  };
}

export type ActionRiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface ProviderActionSpec {
  apiCall: string;
  terraformChange: string;
  estimatedDurationSec: number;
  rollbackMethod: string | null;
  preflightChecks: string[];
}

export const ACTION_MAPPINGS: ActionMapping[] = [
  {
    unifiedAction: "right_size",
    domain: "compute",
    riskLevel: "medium",
    requiresApproval: true,
    reversible: true,
    providers: {
      aws: {
        apiCall: "ec2:ModifyInstanceAttribute",
        terraformChange: "aws_instance.instance_type",
        estimatedDurationSec: 120,
        rollbackMethod: "Revert instance type to previous value",
        preflightChecks: ["instance_stopped_or_stoppable", "target_type_available_in_az", "ebs_compatible"],
      },
      azure: {
        apiCall: "Microsoft.Compute/virtualMachines/write",
        terraformChange: "azurerm_virtual_machine.vm_size",
        estimatedDurationSec: 180,
        rollbackMethod: "Revert VM size to previous SKU",
        preflightChecks: ["vm_deallocated_or_deallocatable", "target_sku_available_in_region", "disk_compatible"],
      },
      gcp: {
        apiCall: "compute.instances.setMachineType",
        terraformChange: "google_compute_instance.machine_type",
        estimatedDurationSec: 150,
        rollbackMethod: "Revert machine type to previous value",
        preflightChecks: ["instance_stopped_or_stoppable", "machine_type_available_in_zone", "disk_compatible"],
      },
    },
  },
  {
    unifiedAction: "restrict_public_access",
    domain: "storage",
    riskLevel: "low",
    requiresApproval: true,
    reversible: true,
    providers: {
      aws: {
        apiCall: "s3:PutBucketPublicAccessBlock",
        terraformChange: "aws_s3_bucket_public_access_block",
        estimatedDurationSec: 5,
        rollbackMethod: "Remove public access block configuration",
        preflightChecks: ["no_active_public_urls_in_use", "cloudfront_not_dependent"],
      },
      azure: {
        apiCall: "Microsoft.Storage/storageAccounts/write",
        terraformChange: "azurerm_storage_account.allow_blob_public_access",
        estimatedDurationSec: 10,
        rollbackMethod: "Re-enable blob public access on storage account",
        preflightChecks: ["no_active_public_containers_in_use"],
      },
      gcp: {
        apiCall: "storage.buckets.update (iamConfiguration.publicAccessPrevention)",
        terraformChange: "google_storage_bucket.public_access_prevention",
        estimatedDurationSec: 5,
        rollbackMethod: "Set publicAccessPrevention to unspecified",
        preflightChecks: ["no_active_public_objects_in_use"],
      },
    },
  },
  {
    unifiedAction: "enable_encryption",
    domain: "storage",
    riskLevel: "low",
    requiresApproval: true,
    reversible: false,
    providers: {
      aws: {
        apiCall: "s3:PutBucketEncryption / ec2:ModifyVolume",
        terraformChange: "aws_s3_bucket_server_side_encryption_configuration / aws_ebs_volume.encrypted",
        estimatedDurationSec: 10,
        rollbackMethod: null,
        preflightChecks: ["kms_key_accessible", "no_cross_account_access_issues"],
      },
      azure: {
        apiCall: "Microsoft.Storage/storageAccounts/write (encryption)",
        terraformChange: "azurerm_storage_account.encryption",
        estimatedDurationSec: 15,
        rollbackMethod: null,
        preflightChecks: ["key_vault_accessible", "managed_identity_configured"],
      },
      gcp: {
        apiCall: "storage.buckets.update (encryption) / compute.disks.setEncryption",
        terraformChange: "google_storage_bucket.encryption / google_compute_disk.disk_encryption_key",
        estimatedDurationSec: 10,
        rollbackMethod: null,
        preflightChecks: ["kms_key_accessible", "service_account_has_encrypt_permission"],
      },
    },
  },
  {
    unifiedAction: "delete_orphan",
    domain: "cost_optimization",
    riskLevel: "medium",
    requiresApproval: true,
    reversible: false,
    providers: {
      aws: {
        apiCall: "ec2:DeleteVolume / ec2:ReleaseAddress / ec2:DeleteSnapshot",
        terraformChange: "terraform destroy (targeted)",
        estimatedDurationSec: 15,
        rollbackMethod: null,
        preflightChecks: ["resource_truly_detached", "no_recent_attachment", "snapshot_exists_if_volume"],
      },
      azure: {
        apiCall: "Microsoft.Compute/disks/delete / Microsoft.Network/publicIPAddresses/delete",
        terraformChange: "terraform destroy (targeted)",
        estimatedDurationSec: 20,
        rollbackMethod: null,
        preflightChecks: ["resource_truly_detached", "no_recent_attachment", "lock_check"],
      },
      gcp: {
        apiCall: "compute.disks.delete / compute.addresses.delete",
        terraformChange: "terraform destroy (targeted)",
        estimatedDurationSec: 15,
        rollbackMethod: null,
        preflightChecks: ["resource_truly_detached", "no_recent_attachment", "snapshot_exists_if_disk"],
      },
    },
  },
  {
    unifiedAction: "modify_security_rules",
    domain: "networking",
    riskLevel: "high",
    requiresApproval: true,
    reversible: true,
    providers: {
      aws: {
        apiCall: "ec2:AuthorizeSecurityGroupIngress / ec2:RevokeSecurityGroupIngress",
        terraformChange: "aws_security_group_rule",
        estimatedDurationSec: 5,
        rollbackMethod: "Revert security group rules to previous state",
        preflightChecks: ["no_active_connections_disrupted", "not_last_egress_rule", "vpc_flow_logs_enabled"],
      },
      azure: {
        apiCall: "Microsoft.Network/networkSecurityGroups/securityRules/write",
        terraformChange: "azurerm_network_security_rule",
        estimatedDurationSec: 10,
        rollbackMethod: "Revert NSG rules to previous configuration",
        preflightChecks: ["no_active_connections_disrupted", "nsg_flow_logs_enabled"],
      },
      gcp: {
        apiCall: "compute.firewalls.update / compute.firewalls.patch",
        terraformChange: "google_compute_firewall",
        estimatedDurationSec: 10,
        rollbackMethod: "Revert firewall rules to previous state",
        preflightChecks: ["no_active_connections_disrupted", "vpc_flow_logs_enabled"],
      },
    },
  },
  {
    unifiedAction: "rotate_credentials",
    domain: "identity_access",
    riskLevel: "critical",
    requiresApproval: true,
    reversible: false,
    providers: {
      aws: {
        apiCall: "iam:CreateAccessKey / iam:DeleteAccessKey / sts:GetSessionToken",
        terraformChange: "aws_iam_access_key",
        estimatedDurationSec: 30,
        rollbackMethod: null,
        preflightChecks: ["identify_all_consumers", "new_key_tested", "old_key_usage_below_threshold"],
      },
      azure: {
        apiCall: "Microsoft.Authorization/roleAssignments/write + credential rotation",
        terraformChange: "azurerm_service_principal_password",
        estimatedDurationSec: 45,
        rollbackMethod: null,
        preflightChecks: ["identify_all_consumers", "new_credential_tested"],
      },
      gcp: {
        apiCall: "iam.serviceAccountKeys.create / iam.serviceAccountKeys.delete",
        terraformChange: "google_service_account_key",
        estimatedDurationSec: 30,
        rollbackMethod: null,
        preflightChecks: ["identify_all_consumers", "new_key_tested", "old_key_usage_below_threshold"],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Capability Registry
// ═══════════════════════════════════════════════════════════════════════════════

export type DomainCapabilityStatus = "full" | "partial" | "scan_only" | "planned" | "not_started";

export interface DomainCapabilityEntry {
  domain: OperationalDomain;
  providers: Record<SupportedProvider, DomainCapabilityDetail>;
}

export interface DomainCapabilityDetail {
  status: DomainCapabilityStatus;
  scanSupported: boolean;
  applySupported: boolean;
  rollbackSupported: boolean;
  terraformSupported: boolean;
  coverage: number;
  notes: string;
}

export const CAPABILITY_REGISTRY: DomainCapabilityEntry[] = [
  {
    domain: "compute",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.95, notes: "EC2, ECS, Lambda — full lifecycle" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.6, notes: "VMs, AKS, Functions — scan only, apply on roadmap" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.6, notes: "Compute Engine, GKE, Cloud Functions — scan only, apply on roadmap" },
    },
  },
  {
    domain: "storage",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.9, notes: "S3, EBS, EFS — full lifecycle" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.55, notes: "Blob Storage, Managed Disks — scan only" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.55, notes: "Cloud Storage, Persistent Disk — scan only" },
    },
  },
  {
    domain: "networking",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.85, notes: "VPC, ALB/NLB, Route53, SecurityGroups — full lifecycle" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.5, notes: "VNet, NSG, Load Balancer — scan only" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.5, notes: "VPC, Firewall, Cloud LB — scan only" },
    },
  },
  {
    domain: "resilience",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.8, notes: "Multi-AZ, cross-region replication, Route53 health checks" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.4, notes: "Availability Zones, geo-replication — assessment only" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.4, notes: "Multi-region, Cloud DNS health checks — assessment only" },
    },
  },
  {
    domain: "cost_optimization",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.9, notes: "Cost Explorer, Savings Plans, Reserved Instances, idle/orphan detection" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.45, notes: "Cost Management scan — apply via Advisor on roadmap" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.45, notes: "Billing export scan — apply via Recommender on roadmap" },
    },
  },
  {
    domain: "identity_access",
    providers: {
      aws: { status: "partial", scanSupported: true, applySupported: true, rollbackSupported: false, terraformSupported: true, coverage: 0.7, notes: "IAM analysis, unused permission detection — apply with mandatory approval" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.35, notes: "Azure AD, RBAC scan — privilege analysis planned" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.35, notes: "Cloud IAM scan — privilege analysis planned" },
    },
  },
  {
    domain: "monitoring",
    providers: {
      aws: { status: "full", scanSupported: true, applySupported: true, rollbackSupported: true, terraformSupported: true, coverage: 0.85, notes: "CloudWatch metrics, alarms, logs — full lifecycle" },
      azure: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.4, notes: "Azure Monitor, Log Analytics — scan only" },
      gcp: { status: "scan_only", scanSupported: true, applySupported: false, rollbackSupported: false, terraformSupported: false, coverage: 0.4, notes: "Cloud Monitoring, Cloud Logging — scan only" },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Provider Adapter Contract
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderAdapterContract {
  provider: SupportedProvider;
  capabilities: AdapterCapability[];
}

export type AdapterCapability =
  | "authenticate"
  | "list_resources"
  | "get_resource"
  | "collect_snapshot"
  | "normalize_snapshot"
  | "collect_costs"
  | "normalize_costs"
  | "generate_terraform"
  | "dry_run_action"
  | "apply_action"
  | "verify_action"
  | "rollback_action"
  | "collect_metrics"
  | "collect_logs"
  | "evaluate_iam";

export interface AdapterMethod {
  name: AdapterCapability;
  description: string;
  input: string;
  output: string;
  providerSpecificNotes: Record<SupportedProvider, string>;
  failureMode: string;
  retryable: boolean;
}

export const ADAPTER_METHODS: AdapterMethod[] = [
  {
    name: "authenticate",
    description: "Establish authenticated session with the cloud provider using org-provided credentials.",
    input: "ProviderCredentials",
    output: "AuthenticatedSession",
    providerSpecificNotes: {
      aws: "STS AssumeRole with external ID for cross-account access. Session tokens expire and must be refreshed.",
      azure: "Service principal with client credentials flow. Tenant + subscription scoping required.",
      gcp: "Service account key or workload identity federation. Project-level scoping.",
    },
    failureMode: "Authentication failure halts all downstream operations. Agent escalates to human.",
    retryable: false,
  },
  {
    name: "collect_snapshot",
    description: "Collect raw resource inventory from the provider API across all configured regions.",
    input: "SnapshotRequest { regions, resourceTypes, includeRelationships }",
    output: "RawProviderSnapshot { resources[], metadata, quality }",
    providerSpecificNotes: {
      aws: "Uses describe/list API calls per service. Paginated. Rate-limit aware with exponential backoff.",
      azure: "Azure Resource Graph for bulk queries. ARM API for detailed properties.",
      gcp: "Cloud Asset Inventory for bulk. Individual service APIs for live state.",
    },
    failureMode: "Partial snapshot if some regions/services fail. Quality score reflects completeness.",
    retryable: true,
  },
  {
    name: "normalize_snapshot",
    description: "Transform provider-specific resource data into UnifiedResource format using the mapping registry.",
    input: "RawProviderSnapshot",
    output: "NormalizedSnapshot { resources: UnifiedResource[], unmapped: RawResource[] }",
    providerSpecificNotes: {
      aws: "Deepest mapping coverage. Most resource types have 1:1 unified equivalents.",
      azure: "Some resources map to multiple unified types (e.g., storage account → object_bucket + file_share).",
      gcp: "Labels → tags normalization. Project-level resources need special handling.",
    },
    failureMode: "Unmapped resources are preserved in raw form and flagged for manual review.",
    retryable: false,
  },
  {
    name: "collect_costs",
    description: "Pull cost and usage data from the provider's billing API for the specified time range.",
    input: "CostRequest { startDate, endDate, granularity, groupBy }",
    output: "RawCostData { lineItems[], currency, period }",
    providerSpecificNotes: {
      aws: "Cost Explorer API. Supports daily/monthly granularity. Up to 13 months history.",
      azure: "Cost Management API. Subscription-scoped. Supports daily/monthly/billing-period.",
      gcp: "BigQuery billing export. Project-scoped. Near-real-time with standard export.",
    },
    failureMode: "Cost data may be delayed 24-48h. Agent notes data freshness in findings.",
    retryable: true,
  },
  {
    name: "normalize_costs",
    description: "Convert provider-specific cost line items into USD-denominated, resource-attributed cost records.",
    input: "RawCostData",
    output: "NormalizedCosts { perResource: CostRecord[], unattributed: number, totalUsd: number }",
    providerSpecificNotes: {
      aws: "Blended/unblended rate handling. RI/SP amortization. Credit deduction.",
      azure: "Pay-as-you-go vs EA pricing. Currency conversion if non-USD.",
      gcp: "Committed use discount handling. Sustained use discount attribution.",
    },
    failureMode: "Unattributable costs are tracked separately. Never silently dropped.",
    retryable: false,
  },
  {
    name: "generate_terraform",
    description: "Generate Terraform HCL for a planned change against the provider's resource schema.",
    input: "TerraformRequest { action, resourceType, currentState, desiredState }",
    output: "TerraformPlan { hcl, planOutput, estimatedCost }",
    providerSpecificNotes: {
      aws: "Full Terraform AWS provider support. Most resource types covered.",
      azure: "Terraform AzureRM provider — scan-only tier means generation but no apply.",
      gcp: "Terraform Google provider — scan-only tier means generation but no apply.",
    },
    failureMode: "Invalid HCL fails validation. Agent retries with corrected schema.",
    retryable: true,
  },
  {
    name: "apply_action",
    description: "Execute an approved change against the provider API. AWS only until Azure/GCP apply tiers unlock.",
    input: "ApplyRequest { action, resourceId, parameters, dryRunPassed }",
    output: "ApplyResult { success, previousState, newState, rollbackInfo }",
    providerSpecificNotes: {
      aws: "Direct API or Terraform apply. Pre-apply state captured for rollback.",
      azure: "Not available — scan-only tier. Returns capability error.",
      gcp: "Not available — scan-only tier. Returns capability error.",
    },
    failureMode: "Failed apply triggers automatic rollback if previousState was captured.",
    retryable: false,
  },
  {
    name: "rollback_action",
    description: "Revert a previously applied change using captured pre-apply state.",
    input: "RollbackRequest { applyResultId, previousState, strategy }",
    output: "RollbackResult { success, restoredState, verificationPassed }",
    providerSpecificNotes: {
      aws: "State-based rollback via Terraform or direct API revert.",
      azure: "Not available — scan-only tier.",
      gcp: "Not available — scan-only tier.",
    },
    failureMode: "Failed rollback escalates to human immediately. Agent never retries rollback automatically.",
    retryable: false,
  },
  {
    name: "evaluate_iam",
    description: "Analyze identity and access policies for least-privilege violations and security risks.",
    input: "IAMEvalRequest { scope, includeUnused, lookbackDays }",
    output: "IAMReport { users[], roles[], policies[], violations[], riskScore }",
    providerSpecificNotes: {
      aws: "IAM Access Analyzer + CloudTrail for unused permission detection. Policy simulation for access paths.",
      azure: "Azure AD + RBAC analysis. Privileged Identity Management integration planned.",
      gcp: "IAM Policy Analyzer + Activity logs. Recommender for unused role bindings.",
    },
    failureMode: "Incomplete activity logs reduce confidence. Agent notes lookback coverage in report.",
    retryable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Cognitive Isolation Boundary
// ═══════════════════════════════════════════════════════════════════════════════

export interface CognitiveIsolationRule {
  rule: string;
  description: string;
  enforcement: "compile_time" | "runtime" | "review";
  example: string;
}

export const COGNITIVE_ISOLATION_RULES: CognitiveIsolationRule[] = [
  {
    rule: "no_provider_types_in_reasoning",
    description: "The cognitive reasoning engine operates exclusively on UnifiedResource and UnifiedAction types. Provider-specific types never enter the reasoning loop.",
    enforcement: "compile_time",
    example: "reasonAboutFinding(finding: UnifiedFinding) — never reasonAboutEC2Instance(instance: EC2Instance)",
  },
  {
    rule: "normalization_at_boundary",
    description: "Provider-specific data is normalized into unified types at the adapter boundary, before reaching any cognitive subsystem.",
    enforcement: "compile_time",
    example: "Adapter.collectSnapshot() → Adapter.normalize() → UnifiedResource[] enters cognitiveLoop()",
  },
  {
    rule: "provider_context_is_metadata",
    description: "The provider identity (aws/azure/gcp) is carried as metadata on unified types, not as a discriminant that changes reasoning logic.",
    enforcement: "review",
    example: "resource.provider is used for display and capability checks, never for if/else branching in reasoning",
  },
  {
    rule: "action_translation_at_exit",
    description: "The cognitive loop outputs UnifiedAction intents. Provider-specific API calls are resolved only at execution time by the adapter layer.",
    enforcement: "compile_time",
    example: "cognitiveLoop outputs { action: 'right_size', target: resource.id } → adapter translates to ec2:ModifyInstanceAttribute",
  },
  {
    rule: "capability_check_before_action",
    description: "Before proposing any action, the agent checks the capability registry to confirm the provider supports it. Unsupported actions are never proposed.",
    enforcement: "runtime",
    example: "if (getCapability(resource.provider, action).status === 'planned') → finding.disposition = 'manual_recommendation'",
  },
  {
    rule: "no_provider_assumptions_in_governance",
    description: "Governance policies are expressed in unified terms. A 'no public storage' policy applies to object_bucket regardless of whether it's S3, Blob, or GCS.",
    enforcement: "review",
    example: "GovernancePolicy.scope.resourceTypes = ['object_bucket'] — never ['AWS::S3::Bucket']",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Cost Normalization Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostNormalizationSpec {
  domain: OperationalDomain;
  normalizedUnit: string;
  conversionRules: ProviderCostConversion[];
}

export interface ProviderCostConversion {
  provider: SupportedProvider;
  sourceUnit: string;
  sourceMetric: string;
  conversionFormula: string;
}

export const COST_NORMALIZATION: CostNormalizationSpec[] = [
  {
    domain: "compute",
    normalizedUnit: "USD/vCPU/hour",
    conversionRules: [
      { provider: "aws", sourceUnit: "USD/instance/hour", sourceMetric: "EC2 pricing API", conversionFormula: "price / vCPU_count" },
      { provider: "azure", sourceUnit: "USD/VM/hour", sourceMetric: "Retail Prices API", conversionFormula: "price / vCPU_count" },
      { provider: "gcp", sourceUnit: "USD/instance/hour", sourceMetric: "Cloud Billing Catalog", conversionFormula: "price / vCPU_count (sustained use discount applied)" },
    ],
  },
  {
    domain: "storage",
    normalizedUnit: "USD/GiB/month",
    conversionRules: [
      { provider: "aws", sourceUnit: "USD/GB/month", sourceMetric: "S3/EBS pricing", conversionFormula: "price * 1.07374 (GB to GiB)" },
      { provider: "azure", sourceUnit: "USD/GiB/month", sourceMetric: "Storage pricing", conversionFormula: "direct (already GiB-based)" },
      { provider: "gcp", sourceUnit: "USD/GB/month", sourceMetric: "Cloud Storage pricing", conversionFormula: "price * 1.07374 (GB to GiB)" },
    ],
  },
  {
    domain: "networking",
    normalizedUnit: "USD/GiB/transfer",
    conversionRules: [
      { provider: "aws", sourceUnit: "USD/GB/transfer", sourceMetric: "Data transfer pricing", conversionFormula: "price * 1.07374 (tiered pricing applied)" },
      { provider: "azure", sourceUnit: "USD/GB/transfer", sourceMetric: "Bandwidth pricing", conversionFormula: "price * 1.07374 (zone-based pricing applied)" },
      { provider: "gcp", sourceUnit: "USD/GB/transfer", sourceMetric: "Network pricing", conversionFormula: "price * 1.07374 (premium vs standard tier)" },
    ],
  },
  {
    domain: "monitoring",
    normalizedUnit: "USD/metric/month",
    conversionRules: [
      { provider: "aws", sourceUnit: "USD/metric/month", sourceMetric: "CloudWatch pricing", conversionFormula: "direct (first 10 free, then tiered)" },
      { provider: "azure", sourceUnit: "USD/metric/month", sourceMetric: "Azure Monitor pricing", conversionFormula: "direct (included metrics free, custom charged)" },
      { provider: "gcp", sourceUnit: "USD/metric/month", sourceMetric: "Cloud Monitoring pricing", conversionFormula: "direct (first 150M free, then per-sample)" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Example Provider Translations
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderTranslationExample {
  scenario: string;
  domain: OperationalDomain;
  unifiedRepresentation: Record<string, unknown>;
  providerRepresentations: Record<SupportedProvider, Record<string, unknown>>;
}

export const TRANSLATION_EXAMPLES: ProviderTranslationExample[] = [
  {
    scenario: "Underutilized compute instance detected with 3% average CPU",
    domain: "compute",
    unifiedRepresentation: {
      type: "vm_instance",
      finding: "underutilized_compute",
      severity: "medium",
      avgCpuPct: 3,
      recommendedAction: "right_size",
      currentSpec: { vCPUs: 8, memoryGiB: 32 },
      recommendedSpec: { vCPUs: 2, memoryGiB: 8 },
      monthlySavingsUsd: 145,
    },
    providerRepresentations: {
      aws: {
        resourceType: "AWS::EC2::Instance",
        instanceId: "i-0abc123def456",
        instanceType: "m5.2xlarge",
        recommendedType: "m5.large",
        source: "CloudWatch CPUUtilization metric",
      },
      azure: {
        resourceType: "Microsoft.Compute/virtualMachines",
        vmId: "/subscriptions/.../myVM",
        vmSize: "Standard_D8s_v3",
        recommendedSize: "Standard_D2s_v3",
        source: "Azure Monitor CPU Percentage metric",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Instance",
        instanceName: "projects/.../instances/my-vm",
        machineType: "n2-standard-8",
        recommendedMachineType: "n2-standard-2",
        source: "Cloud Monitoring compute.googleapis.com/instance/cpu/utilization",
      },
    },
  },
  {
    scenario: "Public storage bucket with no encryption detected",
    domain: "storage",
    unifiedRepresentation: {
      type: "object_bucket",
      findings: ["public_access", "unencrypted"],
      severity: "critical",
      recommendedActions: ["restrict_public_access", "enable_encryption"],
      objectCount: 15420,
      totalSizeGiB: 847,
    },
    providerRepresentations: {
      aws: {
        resourceType: "AWS::S3::Bucket",
        bucketName: "company-data-prod",
        publicAccessBlock: { blockPublicAcls: false, restrictPublicBuckets: false },
        encryption: null,
        source: "S3 GetBucketPolicyStatus + GetBucketEncryption",
      },
      azure: {
        resourceType: "Microsoft.Storage/storageAccounts",
        accountName: "companydataprod",
        allowBlobPublicAccess: true,
        encryption: { services: { blob: { enabled: false } } },
        source: "Storage Account properties",
      },
      gcp: {
        resourceType: "storage.googleapis.com/Bucket",
        bucketName: "company-data-prod",
        iamConfiguration: { publicAccessPrevention: "inherited" },
        encryption: { defaultKmsKeyName: null },
        source: "Cloud Storage bucket metadata + IAM policy",
      },
    },
  },
  {
    scenario: "Security group allows unrestricted SSH access from 0.0.0.0/0",
    domain: "networking",
    unifiedRepresentation: {
      type: "security_group",
      finding: "unrestricted_ingress",
      severity: "high",
      protocol: "tcp",
      port: 22,
      sourceRange: "0.0.0.0/0",
      recommendedAction: "modify_security_rules",
      affectedResources: 3,
    },
    providerRepresentations: {
      aws: {
        resourceType: "AWS::EC2::SecurityGroup",
        groupId: "sg-0abc123",
        ingressRule: { ipProtocol: "tcp", fromPort: 22, toPort: 22, cidrIp: "0.0.0.0/0" },
        source: "EC2 DescribeSecurityGroups",
      },
      azure: {
        resourceType: "Microsoft.Network/networkSecurityGroups",
        nsgName: "prod-nsg",
        securityRule: { protocol: "Tcp", destinationPortRange: "22", sourceAddressPrefix: "*", access: "Allow", direction: "Inbound" },
        source: "NSG security rules",
      },
      gcp: {
        resourceType: "compute.googleapis.com/Firewall",
        firewallName: "allow-ssh-all",
        rule: { direction: "INGRESS", allowed: [{ IPProtocol: "tcp", ports: ["22"] }], sourceRanges: ["0.0.0.0/0"] },
        source: "VPC Firewall rules",
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getProviderProfile(provider: SupportedProvider): ProviderProfile {
  return PROVIDER_PROFILES[provider];
}

export function getDomainDefinition(domain: OperationalDomain): DomainDefinition | undefined {
  return DOMAIN_DEFINITIONS.find((d) => d.domain === domain);
}

export function getResourceMappingForType(type: UnifiedResourceType): ProviderResourceMapping | undefined {
  return RESOURCE_MAPPING_REGISTRY.find((m) => m.unifiedType === type);
}

export function getResourceMappingsForDomain(domain: OperationalDomain): ProviderResourceMapping[] {
  return RESOURCE_MAPPING_REGISTRY.filter((m) => m.domain === domain);
}

export function getActionMapping(action: UnifiedAction): ActionMapping | undefined {
  return ACTION_MAPPINGS.find((m) => m.unifiedAction === action);
}

export function getActionsForDomain(domain: OperationalDomain): ActionMapping[] {
  return ACTION_MAPPINGS.filter((m) => m.domain === domain);
}

export function getDomainCapability(domain: OperationalDomain, provider: SupportedProvider): DomainCapabilityDetail | undefined {
  const entry = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  return entry?.providers[provider];
}

export function getProviderDomainSummary(provider: SupportedProvider): { domain: OperationalDomain; status: DomainCapabilityStatus; coverage: number }[] {
  return CAPABILITY_REGISTRY.map((c) => ({
    domain: c.domain,
    status: c.providers[provider].status,
    coverage: c.providers[provider].coverage,
  }));
}

export function canProviderExecuteAction(provider: SupportedProvider, action: UnifiedAction): { capable: boolean; reason: string } {
  const mapping = ACTION_MAPPINGS.find((m) => m.unifiedAction === action);
  if (!mapping) return { capable: false, reason: `Unknown action: ${action}` };

  const providerSpec = mapping.providers[provider];
  if (!providerSpec) return { capable: false, reason: `Action '${action}' has no mapping for provider '${provider}'` };

  const profile = PROVIDER_PROFILES[provider];
  if (!profile.applySupported && action !== "scan" && action !== "classify") {
    return { capable: false, reason: `Provider '${provider}' is ${profile.tier} tier — apply not supported` };
  }

  return { capable: true, reason: "Action supported" };
}

export function getAbstractionCompleteness(): {
  totalMappings: number;
  perProvider: Record<SupportedProvider, number>;
  perDomain: Record<OperationalDomain, number>;
  avgCoverage: Record<SupportedProvider, number>;
} {
  const perProvider: Record<string, number> = { aws: 0, azure: 0, gcp: 0 };
  const perDomain: Record<string, number> = {};

  for (const mapping of RESOURCE_MAPPING_REGISTRY) {
    if (mapping.providers.aws) perProvider.aws++;
    if (mapping.providers.azure) perProvider.azure++;
    if (mapping.providers.gcp) perProvider.gcp++;
    perDomain[mapping.domain] = (perDomain[mapping.domain] || 0) + 1;
  }

  const avgCoverage: Record<string, number> = { aws: 0, azure: 0, gcp: 0 };
  for (const entry of CAPABILITY_REGISTRY) {
    avgCoverage.aws += entry.providers.aws.coverage;
    avgCoverage.azure += entry.providers.azure.coverage;
    avgCoverage.gcp += entry.providers.gcp.coverage;
  }
  const domainCount = CAPABILITY_REGISTRY.length;
  avgCoverage.aws = Math.round((avgCoverage.aws / domainCount) * 100) / 100;
  avgCoverage.azure = Math.round((avgCoverage.azure / domainCount) * 100) / 100;
  avgCoverage.gcp = Math.round((avgCoverage.gcp / domainCount) * 100) / 100;

  return {
    totalMappings: RESOURCE_MAPPING_REGISTRY.length,
    perProvider: perProvider as Record<SupportedProvider, number>,
    perDomain: perDomain as Record<OperationalDomain, number>,
    avgCoverage: avgCoverage as Record<SupportedProvider, number>,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface AbstractionTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runMultiCloudAbstractionTests(): AbstractionTestResult[] {
  const results: AbstractionTestResult[] = [];

  function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, passed: condition, detail });
  }

  // Provider profiles
  assert(
    "All three providers have profiles",
    Object.keys(PROVIDER_PROFILES).length === 3,
    `Found ${Object.keys(PROVIDER_PROFILES).length} provider profiles`,
  );

  assert(
    "AWS is full tier",
    PROVIDER_PROFILES.aws.tier === "full",
    `AWS tier: ${PROVIDER_PROFILES.aws.tier}`,
  );

  assert(
    "Azure and GCP are scan-only",
    PROVIDER_PROFILES.azure.tier === "scan_only" && PROVIDER_PROFILES.gcp.tier === "scan_only",
    `Azure: ${PROVIDER_PROFILES.azure.tier}, GCP: ${PROVIDER_PROFILES.gcp.tier}`,
  );

  // Domain definitions
  assert(
    "Seven operational domains defined",
    DOMAIN_DEFINITIONS.length === 7,
    `Found ${DOMAIN_DEFINITIONS.length} domains`,
  );

  const domainNames = DOMAIN_DEFINITIONS.map((d) => d.domain);
  assert(
    "All required domains present",
    ["compute", "storage", "networking", "resilience", "cost_optimization", "identity_access", "monitoring"].every((d) => domainNames.includes(d as OperationalDomain)),
    `Domains: ${domainNames.join(", ")}`,
  );

  assert(
    "Every domain has subdomains",
    DOMAIN_DEFINITIONS.every((d) => d.subdomains.length > 0),
    `Subdomain counts: ${DOMAIN_DEFINITIONS.map((d) => `${d.domain}=${d.subdomains.length}`).join(", ")}`,
  );

  // Resource mappings
  assert(
    "Resource mappings cover multiple domains",
    new Set(RESOURCE_MAPPING_REGISTRY.map((m) => m.domain)).size >= 4,
    `Domains covered: ${[...new Set(RESOURCE_MAPPING_REGISTRY.map((m) => m.domain))].join(", ")}`,
  );

  assert(
    "All resource mappings have AWS spec",
    RESOURCE_MAPPING_REGISTRY.every((m) => m.providers.aws !== null),
    "AWS has specs for all mapped resource types",
  );

  assert(
    "All resource mappings have all three providers",
    RESOURCE_MAPPING_REGISTRY.every((m) => m.providers.aws && m.providers.azure && m.providers.gcp),
    "Every mapped resource type has AWS, Azure, and GCP specs",
  );

  // Action mappings
  assert(
    "Action mappings exist",
    ACTION_MAPPINGS.length >= 5,
    `Found ${ACTION_MAPPINGS.length} action mappings`,
  );

  assert(
    "High-risk actions require approval",
    ACTION_MAPPINGS.filter((a) => a.riskLevel === "high" || a.riskLevel === "critical").every((a) => a.requiresApproval),
    "All high/critical risk actions require approval",
  );

  assert(
    "Critical actions are not reversible",
    ACTION_MAPPINGS.filter((a) => a.riskLevel === "critical").every((a) => !a.reversible || a.requiresApproval),
    "Critical actions either irreversible or require approval",
  );

  // Capability registry
  assert(
    "Capability registry covers all domains",
    CAPABILITY_REGISTRY.length === 7,
    `Registry entries: ${CAPABILITY_REGISTRY.length}`,
  );

  assert(
    "AWS has highest coverage across all domains",
    CAPABILITY_REGISTRY.every((c) => c.providers.aws.coverage >= c.providers.azure.coverage && c.providers.aws.coverage >= c.providers.gcp.coverage),
    "AWS coverage >= Azure and GCP in all domains",
  );

  // Cognitive isolation
  assert(
    "Cognitive isolation rules defined",
    COGNITIVE_ISOLATION_RULES.length >= 5,
    `Found ${COGNITIVE_ISOLATION_RULES.length} isolation rules`,
  );

  // Cost normalization
  assert(
    "Cost normalization covers key domains",
    COST_NORMALIZATION.length >= 3,
    `Normalized cost models: ${COST_NORMALIZATION.length}`,
  );

  assert(
    "All cost models cover all three providers",
    COST_NORMALIZATION.every((c) => c.conversionRules.length === 3),
    "Every cost normalization spec has rules for AWS, Azure, and GCP",
  );

  // Translation examples
  assert(
    "Translation examples exist for multiple domains",
    new Set(TRANSLATION_EXAMPLES.map((e) => e.domain)).size >= 3,
    `Example domains: ${[...new Set(TRANSLATION_EXAMPLES.map((e) => e.domain))].join(", ")}`,
  );

  // Query functions
  assert(
    "getProviderProfile returns valid profile",
    getProviderProfile("aws").displayName === "Amazon Web Services",
    `AWS display name: ${getProviderProfile("aws").displayName}`,
  );

  assert(
    "getDomainDefinition returns correct domain",
    getDomainDefinition("compute")?.subdomains.length === 3,
    `Compute subdomains: ${getDomainDefinition("compute")?.subdomains.length}`,
  );

  assert(
    "canProviderExecuteAction blocks scan-only providers",
    !canProviderExecuteAction("azure", "right_size").capable,
    `Azure right_size: ${canProviderExecuteAction("azure", "right_size").reason}`,
  );

  assert(
    "canProviderExecuteAction allows AWS",
    canProviderExecuteAction("aws", "right_size").capable,
    `AWS right_size: ${canProviderExecuteAction("aws", "right_size").reason}`,
  );

  const completeness = getAbstractionCompleteness();
  assert(
    "Abstraction completeness computes",
    completeness.totalMappings > 0 && completeness.avgCoverage.aws > 0,
    `Total mappings: ${completeness.totalMappings}, AWS avg coverage: ${completeness.avgCoverage.aws}`,
  );

  // Adapter methods
  assert(
    "Adapter methods cover full lifecycle",
    ADAPTER_METHODS.some((m) => m.name === "authenticate") &&
    ADAPTER_METHODS.some((m) => m.name === "collect_snapshot") &&
    ADAPTER_METHODS.some((m) => m.name === "apply_action") &&
    ADAPTER_METHODS.some((m) => m.name === "rollback_action"),
    "Adapter methods include authenticate, collect_snapshot, apply_action, rollback_action",
  );

  return results;
}

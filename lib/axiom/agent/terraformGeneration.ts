// ─────────────────────────────────────────────────────────────────────────────
// Terraform Generation Engine
// Translates execution plans into safe, reviewable infrastructure-as-code
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Generation Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type IaCBackend = "terraform" | "cloudformation" | "arm_template" | "deployment_manager";

export type GenerationMode =
  | "plan_only"
  | "generate_and_validate"
  | "generate_and_dry_run"
  | "generate_for_review"
  | "generate_for_apply";

export type ChangeAction = "create" | "update" | "delete" | "replace" | "import" | "no_op";

export type ResourceLifecycleAction =
  | "scale_up"
  | "scale_down"
  | "resize"
  | "migrate"
  | "rotate_credentials"
  | "enable_encryption"
  | "update_policy"
  | "modify_network"
  | "add_monitoring"
  | "update_tags"
  | "modify_iam"
  | "update_storage"
  | "change_region"
  | "enable_backup"
  | "update_dns"
  | "modify_security_group"
  | "custom";

export interface TerraformGenerationContext {
  orgId: string;
  planId: string;
  operationId: string;
  provider: "aws" | "azure" | "gcp";
  backend: IaCBackend;
  mode: GenerationMode;
  region: string;
  environment: string;
  dryRun: boolean;
  maxBlastRadius: BlastRadiusThreshold;
  governanceGateId: string | null;
  approvalRequired: boolean;
  rollbackRequired: boolean;
  stateBackend: StateBackendConfig;
  variableSource: VariableSourceConfig;
  constraints: GenerationConstraint[];
  metadata: Record<string, unknown>;
}

export interface StateBackendConfig {
  type: "s3" | "azure_blob" | "gcs" | "local" | "remote";
  bucket: string | null;
  key: string | null;
  region: string | null;
  lockTable: string | null;
  encrypted: boolean;
  workspaceIsolation: boolean;
}

export interface VariableSourceConfig {
  source: "vault" | "ssm" | "env" | "secrets_manager" | "key_vault" | "secret_manager";
  sensitiveHandling: "reference_only" | "encrypted_in_state" | "never_in_state";
  rotationAware: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Infrastructure Change Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface InfrastructureChangeSet {
  id: string;
  orgId: string;
  planId: string;
  provider: "aws" | "azure" | "gcp";
  changes: ResourceChange[];
  dependencies: ChangeDependency[];
  blastRadius: ComputedBlastRadius;
  rollbackPlan: RollbackPlan;
  estimatedDuration: DurationEstimate;
  generatedAt: string;
  validUntil: string;
  status: ChangeSetStatus;
  validationResults: ChangeSetValidation[];
  governanceApproval: GovernanceApprovalState;
}

export type ChangeSetStatus =
  | "draft"
  | "validating"
  | "validated"
  | "awaiting_approval"
  | "approved"
  | "applying"
  | "applied"
  | "rolling_back"
  | "rolled_back"
  | "failed"
  | "expired"
  | "cancelled";

export interface ResourceChange {
  id: string;
  action: ChangeAction;
  lifecycleAction: ResourceLifecycleAction;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  currentState: Record<string, unknown> | null;
  desiredState: Record<string, unknown>;
  changedAttributes: AttributeChange[];
  blastRadius: ChangeBlastRadius;
  reversible: boolean;
  requiresDowntime: boolean;
  requiresReplacement: boolean;
  estimatedDurationMs: number;
  dependsOn: string[];
  blockedBy: string[];
  rollbackAction: RollbackAction | null;
  tags: Record<string, string>;
}

export interface AttributeChange {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  sensitive: boolean;
  forceReplacement: boolean;
  description: string;
}

export interface ChangeDependency {
  fromChangeId: string;
  toChangeId: string;
  dependencyType: "must_complete_before" | "must_exist" | "must_not_conflict" | "soft_ordering";
  reason: string;
}

export interface DurationEstimate {
  optimisticMs: number;
  expectedMs: number;
  pessimisticMs: number;
  providerLatencyFactor: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Blast Radius Computation
// ═══════════════════════════════════════════════════════════════════════════════

export type BlastRadiusSeverity = "minimal" | "low" | "moderate" | "high" | "critical";

export interface BlastRadiusThreshold {
  maxAffectedResources: number;
  maxAffectedServices: number;
  maxDowntimeMs: number;
  maxCostImpactDollars: number;
  forbiddenSeverities: BlastRadiusSeverity[];
}

export interface ChangeBlastRadius {
  severity: BlastRadiusSeverity;
  affectedResources: number;
  affectedServices: string[];
  downstreamImpact: DownstreamImpact[];
  estimatedDowntimeMs: number;
  estimatedCostImpact: CostImpact;
  dataLossRisk: DataLossRisk;
  serviceDisruptionRisk: number;
  explanation: string;
}

export interface ComputedBlastRadius {
  aggregateSeverity: BlastRadiusSeverity;
  totalAffectedResources: number;
  totalAffectedServices: string[];
  totalEstimatedDowntimeMs: number;
  totalCostImpact: CostImpact;
  withinThreshold: boolean;
  thresholdViolations: ThresholdViolation[];
  riskFactors: BlastRadiusRiskFactor[];
}

export interface DownstreamImpact {
  resourceId: string;
  resourceType: string;
  impactType: "degraded" | "unavailable" | "reconfigured" | "orphaned";
  severity: BlastRadiusSeverity;
  recoveryTimeMs: number;
}

export interface CostImpact {
  monthlyCostDelta: number;
  oneTimeCost: number;
  savingsPerMonth: number;
  paybackPeriodDays: number | null;
  currency: "USD";
}

export interface DataLossRisk {
  level: "none" | "low" | "medium" | "high" | "certain";
  affectedDataStores: string[];
  backupAvailable: boolean;
  recoveryPointObjective: string | null;
  mitigations: string[];
}

export interface ThresholdViolation {
  threshold: string;
  limit: number;
  actual: number;
  severity: BlastRadiusSeverity;
  blocking: boolean;
}

export interface BlastRadiusRiskFactor {
  factor: string;
  weight: number;
  score: number;
  explanation: string;
}

export const BLAST_RADIUS_WEIGHTS: Record<string, number> = {
  affected_resources: 0.20,
  affected_services: 0.15,
  downtime_risk: 0.25,
  data_loss_risk: 0.20,
  cost_impact: 0.10,
  reversibility: 0.10,
};

export const BLAST_RADIUS_THRESHOLDS: Record<BlastRadiusSeverity, number> = {
  minimal: 0.1,
  low: 0.3,
  moderate: 0.5,
  high: 0.7,
  critical: 0.85,
};

export function computeBlastRadiusSeverity(score: number): BlastRadiusSeverity {
  if (score >= BLAST_RADIUS_THRESHOLDS.critical) return "critical";
  if (score >= BLAST_RADIUS_THRESHOLDS.high) return "high";
  if (score >= BLAST_RADIUS_THRESHOLDS.moderate) return "moderate";
  if (score >= BLAST_RADIUS_THRESHOLDS.low) return "low";
  return "minimal";
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Terraform HCL Builder
// ═══════════════════════════════════════════════════════════════════════════════

export type HCLBlockType =
  | "resource"
  | "data"
  | "variable"
  | "output"
  | "locals"
  | "provider"
  | "terraform"
  | "module";

export interface HCLBlock {
  blockType: HCLBlockType;
  resourceType: string | null;
  name: string;
  attributes: HCLAttribute[];
  nestedBlocks: HCLNestedBlock[];
  lifecycle: HCLLifecycle | null;
  dependsOn: string[];
  count: string | null;
  forEach: string | null;
  condition: string | null;
  comments: string[];
}

export interface HCLAttribute {
  key: string;
  value: HCLValue;
  sensitive: boolean;
  description: string | null;
}

export type HCLValue =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "reference"; value: string }
  | { type: "expression"; value: string }
  | { type: "list"; value: HCLValue[] }
  | { type: "map"; value: Record<string, HCLValue> }
  | { type: "null" };

export interface HCLNestedBlock {
  blockType: string;
  attributes: HCLAttribute[];
  nestedBlocks: HCLNestedBlock[];
}

export interface HCLLifecycle {
  createBeforeDestroy: boolean;
  preventDestroy: boolean;
  ignoreChanges: string[];
  replaceTriggeredBy: string[];
}

export interface TerraformModule {
  name: string;
  description: string;
  provider: "aws" | "azure" | "gcp";
  blocks: HCLBlock[];
  variables: TerraformVariable[];
  outputs: TerraformOutput[];
  requiredProviders: RequiredProvider[];
  backendConfig: HCLBlock | null;
}

export interface TerraformVariable {
  name: string;
  type: string;
  description: string;
  defaultValue: HCLValue | null;
  sensitive: boolean;
  validation: VariableValidation | null;
  nullable: boolean;
}

export interface VariableValidation {
  condition: string;
  errorMessage: string;
}

export interface TerraformOutput {
  name: string;
  value: string;
  description: string;
  sensitive: boolean;
  dependsOn: string[];
}

export interface RequiredProvider {
  name: string;
  source: string;
  versionConstraint: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Generation Templates
// ═══════════════════════════════════════════════════════════════════════════════

export type TemplateCategory =
  | "compute"
  | "storage"
  | "networking"
  | "security"
  | "database"
  | "monitoring"
  | "iam"
  | "cost_optimization"
  | "compliance"
  | "backup";

export interface GenerationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  provider: "aws" | "azure" | "gcp" | "any";
  lifecycleAction: ResourceLifecycleAction;
  applicableResourceTypes: string[];
  parameters: TemplateParameter[];
  blocks: HCLBlock[];
  safetyChecks: TemplateSafetyCheck[];
  rollbackTemplate: string | null;
  estimatedDurationMs: number;
  blastRadiusDefault: BlastRadiusSeverity;
  requiresApproval: boolean;
}

export interface TemplateParameter {
  name: string;
  type: "string" | "number" | "boolean" | "list" | "map";
  required: boolean;
  defaultValue: unknown;
  description: string;
  validation: string | null;
}

export interface TemplateSafetyCheck {
  id: string;
  description: string;
  checkType: "pre_generation" | "post_generation" | "pre_apply";
  severity: "warning" | "error" | "blocking";
  condition: string;
  remediationHint: string;
}

export const GENERATION_TEMPLATES: GenerationTemplate[] = [
  {
    id: "aws-ec2-resize",
    name: "EC2 Instance Resize",
    description: "Safely resize an EC2 instance with stop/start cycle",
    category: "compute",
    provider: "aws",
    lifecycleAction: "resize",
    applicableResourceTypes: ["aws_instance"],
    parameters: [
      { name: "instance_id", type: "string", required: true, defaultValue: null, description: "EC2 instance ID", validation: "^i-[a-f0-9]+$" },
      { name: "target_type", type: "string", required: true, defaultValue: null, description: "Target instance type", validation: null },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_instance",
      name: "resized",
      attributes: [
        { key: "instance_type", value: { type: "reference", value: "var.target_type" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: { createBeforeDestroy: false, preventDestroy: false, ignoreChanges: [], replaceTriggeredBy: [] },
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "ec2-resize-check-1", description: "Verify instance is not in ASG", checkType: "pre_generation", severity: "blocking", condition: "instance.auto_scaling_group == null", remediationHint: "Resize via ASG launch template instead" },
      { id: "ec2-resize-check-2", description: "Verify target type is available in AZ", checkType: "pre_generation", severity: "blocking", condition: "target_type in available_types", remediationHint: "Choose a type available in the instance AZ" },
    ],
    rollbackTemplate: "aws-ec2-resize",
    estimatedDurationMs: 180_000,
    blastRadiusDefault: "low",
    requiresApproval: true,
  },
  {
    id: "aws-rds-resize",
    name: "RDS Instance Resize",
    description: "Resize RDS instance with optional Multi-AZ failover",
    category: "database",
    provider: "aws",
    lifecycleAction: "resize",
    applicableResourceTypes: ["aws_db_instance"],
    parameters: [
      { name: "db_instance_id", type: "string", required: true, defaultValue: null, description: "RDS instance identifier", validation: null },
      { name: "target_class", type: "string", required: true, defaultValue: null, description: "Target DB instance class", validation: "^db\\." },
      { name: "apply_immediately", type: "boolean", required: false, defaultValue: false, description: "Apply during next maintenance window or immediately", validation: null },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_db_instance",
      name: "resized",
      attributes: [
        { key: "instance_class", value: { type: "reference", value: "var.target_class" }, sensitive: false, description: null },
        { key: "apply_immediately", value: { type: "reference", value: "var.apply_immediately" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: { createBeforeDestroy: false, preventDestroy: true, ignoreChanges: [], replaceTriggeredBy: [] },
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "rds-resize-check-1", description: "Verify automated backup is enabled", checkType: "pre_generation", severity: "blocking", condition: "backup_retention_period > 0", remediationHint: "Enable automated backups before resize" },
      { id: "rds-resize-check-2", description: "Verify no active connections exceed threshold", checkType: "pre_apply", severity: "warning", condition: "active_connections < max_threshold", remediationHint: "Consider scheduling during low-traffic period" },
    ],
    rollbackTemplate: "aws-rds-resize",
    estimatedDurationMs: 600_000,
    blastRadiusDefault: "moderate",
    requiresApproval: true,
  },
  {
    id: "aws-sg-update",
    name: "Security Group Rule Update",
    description: "Safely modify security group ingress/egress rules",
    category: "security",
    provider: "aws",
    lifecycleAction: "modify_security_group",
    applicableResourceTypes: ["aws_security_group", "aws_security_group_rule"],
    parameters: [
      { name: "sg_id", type: "string", required: true, defaultValue: null, description: "Security group ID", validation: "^sg-[a-f0-9]+$" },
      { name: "rules", type: "list", required: true, defaultValue: null, description: "List of ingress/egress rules", validation: null },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_security_group_rule",
      name: "managed",
      attributes: [
        { key: "security_group_id", value: { type: "reference", value: "var.sg_id" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: "var.rules",
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "sg-check-1", description: "Reject 0.0.0.0/0 on sensitive ports", checkType: "pre_generation", severity: "blocking", condition: "no_open_world_on_sensitive_ports", remediationHint: "Restrict CIDR range for ports 22, 3389, 3306, 5432, 27017" },
      { id: "sg-check-2", description: "Verify not removing rules that active services depend on", checkType: "pre_apply", severity: "blocking", condition: "removed_rules_not_in_active_use", remediationHint: "Audit dependent ENIs before removing rules" },
    ],
    rollbackTemplate: "aws-sg-update",
    estimatedDurationMs: 30_000,
    blastRadiusDefault: "high",
    requiresApproval: true,
  },
  {
    id: "aws-s3-encryption",
    name: "S3 Bucket Encryption Enable",
    description: "Enable or upgrade encryption on S3 buckets",
    category: "compliance",
    provider: "aws",
    lifecycleAction: "enable_encryption",
    applicableResourceTypes: ["aws_s3_bucket", "aws_s3_bucket_server_side_encryption_configuration"],
    parameters: [
      { name: "bucket_name", type: "string", required: true, defaultValue: null, description: "S3 bucket name", validation: null },
      { name: "kms_key_arn", type: "string", required: false, defaultValue: null, description: "KMS key ARN for SSE-KMS", validation: "^arn:aws:kms:" },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_s3_bucket_server_side_encryption_configuration",
      name: "encryption",
      attributes: [
        { key: "bucket", value: { type: "reference", value: "var.bucket_name" }, sensitive: false, description: null },
      ],
      nestedBlocks: [{
        blockType: "rule",
        attributes: [],
        nestedBlocks: [{
          blockType: "apply_server_side_encryption_by_default",
          attributes: [
            { key: "sse_algorithm", value: { type: "string", value: "aws:kms" }, sensitive: false, description: null },
            { key: "kms_master_key_id", value: { type: "reference", value: "var.kms_key_arn" }, sensitive: false, description: null },
          ],
          nestedBlocks: [],
        }],
      }],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "s3-enc-check-1", description: "Verify KMS key exists and is enabled", checkType: "pre_generation", severity: "blocking", condition: "kms_key_state == enabled", remediationHint: "Ensure KMS key is in Enabled state" },
    ],
    rollbackTemplate: null,
    estimatedDurationMs: 15_000,
    blastRadiusDefault: "minimal",
    requiresApproval: false,
  },
  {
    id: "aws-iam-policy-update",
    name: "IAM Policy Update",
    description: "Safely update IAM policies with least-privilege validation",
    category: "iam",
    provider: "aws",
    lifecycleAction: "modify_iam",
    applicableResourceTypes: ["aws_iam_policy", "aws_iam_role_policy", "aws_iam_role_policy_attachment"],
    parameters: [
      { name: "policy_arn", type: "string", required: true, defaultValue: null, description: "IAM policy ARN", validation: "^arn:aws:iam:" },
      { name: "policy_document", type: "string", required: true, defaultValue: null, description: "New policy JSON document", validation: null },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_iam_policy",
      name: "updated",
      attributes: [
        { key: "policy", value: { type: "reference", value: "var.policy_document" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "iam-check-1", description: "Reject wildcard resource on destructive actions", checkType: "pre_generation", severity: "blocking", condition: "no_star_resource_on_write_actions", remediationHint: "Scope resource ARN to specific resources" },
      { id: "iam-check-2", description: "Reject privilege escalation patterns", checkType: "pre_generation", severity: "blocking", condition: "no_privilege_escalation_paths", remediationHint: "Remove iam:CreateRole, iam:AttachRolePolicy, sts:AssumeRole combinations" },
      { id: "iam-check-3", description: "Verify policy size within AWS limits", checkType: "post_generation", severity: "error", condition: "policy_size < 6144", remediationHint: "Split into multiple policies or use managed policies" },
    ],
    rollbackTemplate: "aws-iam-policy-update",
    estimatedDurationMs: 10_000,
    blastRadiusDefault: "high",
    requiresApproval: true,
  },
  {
    id: "aws-asg-scale",
    name: "Auto Scaling Group Scale",
    description: "Adjust ASG desired/min/max capacity",
    category: "compute",
    provider: "aws",
    lifecycleAction: "scale_up",
    applicableResourceTypes: ["aws_autoscaling_group"],
    parameters: [
      { name: "asg_name", type: "string", required: true, defaultValue: null, description: "ASG name", validation: null },
      { name: "desired_capacity", type: "number", required: true, defaultValue: null, description: "Desired instance count", validation: null },
      { name: "min_size", type: "number", required: true, defaultValue: null, description: "Minimum instance count", validation: null },
      { name: "max_size", type: "number", required: true, defaultValue: null, description: "Maximum instance count", validation: null },
    ],
    blocks: [{
      blockType: "resource",
      resourceType: "aws_autoscaling_group",
      name: "scaled",
      attributes: [
        { key: "desired_capacity", value: { type: "reference", value: "var.desired_capacity" }, sensitive: false, description: null },
        { key: "min_size", value: { type: "reference", value: "var.min_size" }, sensitive: false, description: null },
        { key: "max_size", value: { type: "reference", value: "var.max_size" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    }],
    safetyChecks: [
      { id: "asg-check-1", description: "Reject scale-to-zero in production", checkType: "pre_generation", severity: "blocking", condition: "min_size > 0 || environment != production", remediationHint: "Minimum 1 instance in production ASGs" },
      { id: "asg-check-2", description: "Reject >3x current capacity increase", checkType: "pre_generation", severity: "warning", condition: "desired_capacity <= current_capacity * 3", remediationHint: "Scale incrementally to avoid resource exhaustion" },
    ],
    rollbackTemplate: "aws-asg-scale",
    estimatedDurationMs: 300_000,
    blastRadiusDefault: "moderate",
    requiresApproval: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Generation Constraints & Safety
// ═══════════════════════════════════════════════════════════════════════════════

export type ConstraintSeverity = "advisory" | "warning" | "blocking" | "absolute";

export interface GenerationConstraint {
  id: string;
  name: string;
  description: string;
  severity: ConstraintSeverity;
  scope: ConstraintScope;
  condition: ConstraintCondition;
  enforcedAt: ("generation" | "validation" | "apply")[];
  overridable: boolean;
  overrideRequires: "org_admin" | "security_admin" | "platform_admin" | null;
}

export type ConstraintScope =
  | { type: "global" }
  | { type: "provider"; provider: "aws" | "azure" | "gcp" }
  | { type: "resource_type"; resourceType: string }
  | { type: "environment"; environment: string }
  | { type: "region"; region: string };

export type ConstraintCondition =
  | { type: "forbidden_action"; action: ChangeAction; resourceType: string }
  | { type: "max_blast_radius"; severity: BlastRadiusSeverity }
  | { type: "requires_approval"; action: ChangeAction }
  | { type: "requires_backup"; resourceType: string }
  | { type: "forbidden_attribute_value"; attribute: string; forbiddenValues: unknown[] }
  | { type: "max_changes_per_changeset"; limit: number }
  | { type: "forbidden_in_environment"; environment: string; action: ChangeAction }
  | { type: "time_window_restriction"; allowedWindows: TimeWindow[] }
  | { type: "custom"; expression: string };

export interface TimeWindow {
  dayOfWeek: number[];
  startHourUTC: number;
  endHourUTC: number;
  timezone: string;
}

export const SAFETY_CONSTRAINTS: GenerationConstraint[] = [
  {
    id: "no-delete-production-db",
    name: "Forbid Production Database Deletion",
    description: "Prevent deletion of any database resource in production environments",
    severity: "absolute",
    scope: { type: "environment", environment: "production" },
    condition: { type: "forbidden_action", action: "delete", resourceType: "aws_db_instance" },
    enforcedAt: ["generation", "validation", "apply"],
    overridable: false,
    overrideRequires: null,
  },
  {
    id: "no-delete-production-s3",
    name: "Forbid Production S3 Bucket Deletion",
    description: "Prevent deletion of S3 buckets in production",
    severity: "absolute",
    scope: { type: "environment", environment: "production" },
    condition: { type: "forbidden_action", action: "delete", resourceType: "aws_s3_bucket" },
    enforcedAt: ["generation", "validation", "apply"],
    overridable: false,
    overrideRequires: null,
  },
  {
    id: "max-blast-radius-auto",
    name: "Blast Radius Limit for Autonomous Actions",
    description: "Autonomous operations cannot exceed moderate blast radius",
    severity: "blocking",
    scope: { type: "global" },
    condition: { type: "max_blast_radius", severity: "moderate" },
    enforcedAt: ["generation", "validation"],
    overridable: false,
    overrideRequires: null,
  },
  {
    id: "all-deletes-require-approval",
    name: "Deletion Requires Human Approval",
    description: "All resource deletions require explicit human approval",
    severity: "absolute",
    scope: { type: "global" },
    condition: { type: "requires_approval", action: "delete" },
    enforcedAt: ["generation", "apply"],
    overridable: false,
    overrideRequires: null,
  },
  {
    id: "all-iam-requires-approval",
    name: "IAM Changes Require Approval",
    description: "All IAM modifications require security review",
    severity: "absolute",
    scope: { type: "global" },
    condition: { type: "requires_approval", action: "update" },
    enforcedAt: ["generation", "apply"],
    overridable: false,
    overrideRequires: null,
  },
  {
    id: "max-changes-per-set",
    name: "Changeset Size Limit",
    description: "Limit changes per changeset to reduce risk",
    severity: "blocking",
    scope: { type: "global" },
    condition: { type: "max_changes_per_changeset", limit: 25 },
    enforcedAt: ["generation"],
    overridable: true,
    overrideRequires: "platform_admin",
  },
  {
    id: "production-change-window",
    name: "Production Change Window",
    description: "Production changes only during maintenance windows",
    severity: "blocking",
    scope: { type: "environment", environment: "production" },
    condition: {
      type: "time_window_restriction",
      allowedWindows: [
        { dayOfWeek: [2, 3, 4], startHourUTC: 6, endHourUTC: 14, timezone: "UTC" },
      ],
    },
    enforcedAt: ["apply"],
    overridable: true,
    overrideRequires: "org_admin",
  },
  {
    id: "rds-requires-backup",
    name: "RDS Changes Require Backup",
    description: "Any RDS modification requires verified backup",
    severity: "blocking",
    scope: { type: "global" },
    condition: { type: "requires_backup", resourceType: "aws_db_instance" },
    enforcedAt: ["validation", "apply"],
    overridable: false,
    overrideRequires: null,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Rollback Plan Generation
// ═══════════════════════════════════════════════════════════════════════════════

export type RollbackStrategy = "reverse_apply" | "state_restore" | "snapshot_restore" | "manual" | "no_rollback";

export interface RollbackPlan {
  id: string;
  changeSetId: string;
  strategy: RollbackStrategy;
  steps: RollbackStep[];
  estimatedDurationMs: number;
  automaticTriggers: RollbackTrigger[];
  manualTriggerAvailable: boolean;
  preRollbackChecks: RollbackPreCheck[];
  stateSnapshot: StateSnapshotRef | null;
  resourceSnapshots: ResourceSnapshotRef[];
  expiresAt: string;
  tested: boolean;
}

export interface RollbackStep {
  id: string;
  order: number;
  description: string;
  action: RollbackAction;
  resourceId: string;
  estimatedDurationMs: number;
  requiresApproval: boolean;
  canFail: boolean;
  failureAction: "abort_rollback" | "continue" | "escalate";
}

export interface RollbackAction {
  type: "revert_attribute" | "recreate_resource" | "restore_snapshot" | "restore_state" | "manual_intervention";
  targetResourceId: string;
  previousState: Record<string, unknown>;
  description: string;
}

export interface RollbackTrigger {
  id: string;
  condition: "health_check_failed" | "error_rate_exceeded" | "latency_exceeded" | "cost_exceeded" | "manual";
  thresholdValue: number | null;
  thresholdUnit: string | null;
  evaluationWindowMs: number;
  autoExecute: boolean;
  cooldownMs: number;
}

export interface RollbackPreCheck {
  id: string;
  description: string;
  checkType: "state_exists" | "snapshot_exists" | "resource_accessible" | "no_concurrent_changes";
  required: boolean;
}

export interface StateSnapshotRef {
  snapshotId: string;
  backend: string;
  key: string;
  takenAt: string;
  verified: boolean;
}

export interface ResourceSnapshotRef {
  resourceId: string;
  resourceType: string;
  snapshotId: string;
  snapshotType: "ebs_snapshot" | "rds_snapshot" | "ami" | "s3_versioned" | "state_backup";
  takenAt: string;
  verified: boolean;
  expiresAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Dry-Run & Validation
// ═══════════════════════════════════════════════════════════════════════════════

export type ValidationSeverity = "info" | "warning" | "error" | "critical";

export interface ChangeSetValidation {
  id: string;
  validatorId: string;
  validatorName: string;
  severity: ValidationSeverity;
  passed: boolean;
  message: string;
  affectedChangeIds: string[];
  remediationHint: string | null;
  autoRemediable: boolean;
}

export interface DryRunResult {
  changeSetId: string;
  success: boolean;
  planOutput: TerraformPlanSummary;
  validations: ChangeSetValidation[];
  constraintViolations: ConstraintViolationResult[];
  blastRadiusAssessment: ComputedBlastRadius;
  estimatedCost: CostImpact;
  warnings: string[];
  errors: string[];
  executedAt: string;
  durationMs: number;
}

export interface TerraformPlanSummary {
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
  resourcesReplaced: number;
  resourcesUnchanged: number;
  dataSourcesRead: number;
  outputChanges: number;
  planFile: string | null;
}

export interface ConstraintViolationResult {
  constraintId: string;
  constraintName: string;
  severity: ConstraintSeverity;
  violated: boolean;
  message: string;
  affectedResources: string[];
  overrideApplied: boolean;
  overrideApprovedBy: string | null;
}

export type ValidatorId =
  | "syntax_validator"
  | "provider_schema_validator"
  | "blast_radius_validator"
  | "safety_constraint_validator"
  | "governance_policy_validator"
  | "cost_validator"
  | "dependency_validator"
  | "state_validator"
  | "security_validator"
  | "idempotency_validator";

export interface ValidationPipeline {
  validators: ValidatorDefinition[];
  failFast: boolean;
  parallelizable: string[][];
  requiredPassCount: number;
}

export interface ValidatorDefinition {
  id: ValidatorId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeout: number;
  retryable: boolean;
}

export const VALIDATION_PIPELINE: ValidationPipeline = {
  validators: [
    { id: "syntax_validator", name: "HCL Syntax Validator", description: "Validates HCL syntax correctness", order: 1, required: true, timeout: 10_000, retryable: false },
    { id: "provider_schema_validator", name: "Provider Schema Validator", description: "Validates against provider resource schemas", order: 2, required: true, timeout: 30_000, retryable: true },
    { id: "safety_constraint_validator", name: "Safety Constraint Validator", description: "Checks all safety constraints", order: 3, required: true, timeout: 10_000, retryable: false },
    { id: "security_validator", name: "Security Validator", description: "Checks for security anti-patterns", order: 4, required: true, timeout: 15_000, retryable: false },
    { id: "governance_policy_validator", name: "Governance Policy Validator", description: "Validates against organizational governance policies", order: 5, required: true, timeout: 20_000, retryable: true },
    { id: "dependency_validator", name: "Dependency Validator", description: "Validates resource dependency graph is acyclic", order: 6, required: true, timeout: 10_000, retryable: false },
    { id: "blast_radius_validator", name: "Blast Radius Validator", description: "Computes and validates blast radius", order: 7, required: true, timeout: 30_000, retryable: false },
    { id: "cost_validator", name: "Cost Validator", description: "Estimates cost impact of changes", order: 8, required: false, timeout: 30_000, retryable: true },
    { id: "state_validator", name: "State Validator", description: "Validates state backend accessibility and consistency", order: 9, required: true, timeout: 15_000, retryable: true },
    { id: "idempotency_validator", name: "Idempotency Validator", description: "Ensures changes are idempotent", order: 10, required: false, timeout: 20_000, retryable: false },
  ],
  failFast: false,
  parallelizable: [
    ["syntax_validator"],
    ["provider_schema_validator", "safety_constraint_validator", "security_validator"],
    ["governance_policy_validator", "dependency_validator"],
    ["blast_radius_validator", "cost_validator"],
    ["state_validator", "idempotency_validator"],
  ],
  requiredPassCount: 8,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Governance Approval State
// ═══════════════════════════════════════════════════════════════════════════════

export type GovernanceApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "auto_approved";

export interface GovernanceApprovalState {
  status: GovernanceApprovalStatus;
  requiredApprovers: ApproverRequirement[];
  approvals: ApprovalRecord[];
  rejections: RejectionRecord[];
  autoApprovalEligible: boolean;
  autoApprovalReason: string | null;
  expiresAt: string | null;
  escalationPath: string[];
}

export interface ApproverRequirement {
  role: string;
  count: number;
  satisfied: boolean;
}

export interface ApprovalRecord {
  approverId: string;
  approverRole: string;
  approvedAt: string;
  comment: string | null;
  conditions: string[];
}

export interface RejectionRecord {
  rejecterId: string;
  rejectedAt: string;
  reason: string;
  suggestedChanges: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Provider-Specific Generation Profiles
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderGenerationProfile {
  provider: "aws" | "azure" | "gcp";
  preferredBackend: IaCBackend;
  supportedBackends: IaCBackend[];
  providerBlock: HCLBlock;
  commonTags: Record<string, string>;
  namingConvention: NamingConvention;
  resourceTypeMapping: Record<string, string>;
  stateManagement: ProviderStateManagement;
  rateLimits: ProviderRateLimits;
}

export interface NamingConvention {
  prefix: string;
  separator: string;
  caseStyle: "snake_case" | "kebab-case" | "camelCase";
  maxLength: number;
  requiredSuffixes: Record<string, string>;
}

export interface ProviderStateManagement {
  recommendedBackend: string;
  lockingMechanism: string;
  encryptionDefault: boolean;
  versioningEnabled: boolean;
}

export interface ProviderRateLimits {
  maxConcurrentOperations: number;
  apiCallsPerSecond: number;
  maxResourcesPerOperation: number;
  cooldownBetweenOperationsMs: number;
}

export const PROVIDER_GENERATION_PROFILES: ProviderGenerationProfile[] = [
  {
    provider: "aws",
    preferredBackend: "terraform",
    supportedBackends: ["terraform", "cloudformation"],
    providerBlock: {
      blockType: "provider",
      resourceType: null,
      name: "aws",
      attributes: [
        { key: "region", value: { type: "reference", value: "var.aws_region" }, sensitive: false, description: null },
        { key: "default_tags", value: { type: "map", value: {} }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    },
    commonTags: {
      "managed-by": "axiom-agent",
      "automation": "terraform",
    },
    namingConvention: {
      prefix: "axiom",
      separator: "-",
      caseStyle: "kebab-case",
      maxLength: 63,
      requiredSuffixes: {},
    },
    resourceTypeMapping: {
      "compute_instance": "aws_instance",
      "database_instance": "aws_db_instance",
      "storage_bucket": "aws_s3_bucket",
      "load_balancer": "aws_lb",
      "security_group": "aws_security_group",
      "iam_role": "aws_iam_role",
      "iam_policy": "aws_iam_policy",
      "vpc": "aws_vpc",
      "subnet": "aws_subnet",
      "auto_scaling_group": "aws_autoscaling_group",
      "lambda_function": "aws_lambda_function",
      "ecs_service": "aws_ecs_service",
      "eks_cluster": "aws_eks_cluster",
      "elasticache_cluster": "aws_elasticache_cluster",
      "cloudfront_distribution": "aws_cloudfront_distribution",
      "route53_record": "aws_route53_record",
      "sns_topic": "aws_sns_topic",
      "sqs_queue": "aws_sqs_queue",
      "dynamodb_table": "aws_dynamodb_table",
      "kms_key": "aws_kms_key",
    },
    stateManagement: {
      recommendedBackend: "s3",
      lockingMechanism: "dynamodb",
      encryptionDefault: true,
      versioningEnabled: true,
    },
    rateLimits: {
      maxConcurrentOperations: 5,
      apiCallsPerSecond: 10,
      maxResourcesPerOperation: 50,
      cooldownBetweenOperationsMs: 5_000,
    },
  },
  {
    provider: "azure",
    preferredBackend: "terraform",
    supportedBackends: ["terraform", "arm_template"],
    providerBlock: {
      blockType: "provider",
      resourceType: null,
      name: "azurerm",
      attributes: [
        { key: "subscription_id", value: { type: "reference", value: "var.azure_subscription_id" }, sensitive: false, description: null },
      ],
      nestedBlocks: [{
        blockType: "features",
        attributes: [],
        nestedBlocks: [],
      }],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    },
    commonTags: {
      "managed-by": "axiom-agent",
      "automation": "terraform",
    },
    namingConvention: {
      prefix: "axiom",
      separator: "-",
      caseStyle: "kebab-case",
      maxLength: 80,
      requiredSuffixes: {},
    },
    resourceTypeMapping: {
      "compute_instance": "azurerm_virtual_machine",
      "database_instance": "azurerm_mssql_database",
      "storage_bucket": "azurerm_storage_account",
      "load_balancer": "azurerm_lb",
      "security_group": "azurerm_network_security_group",
      "iam_role": "azurerm_role_definition",
      "vpc": "azurerm_virtual_network",
      "subnet": "azurerm_subnet",
    },
    stateManagement: {
      recommendedBackend: "azurerm",
      lockingMechanism: "blob_lease",
      encryptionDefault: true,
      versioningEnabled: true,
    },
    rateLimits: {
      maxConcurrentOperations: 3,
      apiCallsPerSecond: 8,
      maxResourcesPerOperation: 40,
      cooldownBetweenOperationsMs: 8_000,
    },
  },
  {
    provider: "gcp",
    preferredBackend: "terraform",
    supportedBackends: ["terraform", "deployment_manager"],
    providerBlock: {
      blockType: "provider",
      resourceType: null,
      name: "google",
      attributes: [
        { key: "project", value: { type: "reference", value: "var.gcp_project_id" }, sensitive: false, description: null },
        { key: "region", value: { type: "reference", value: "var.gcp_region" }, sensitive: false, description: null },
      ],
      nestedBlocks: [],
      lifecycle: null,
      dependsOn: [],
      count: null,
      forEach: null,
      condition: null,
      comments: [],
    },
    commonTags: {
      "managed-by": "axiom-agent",
      "automation": "terraform",
    },
    namingConvention: {
      prefix: "axiom",
      separator: "-",
      caseStyle: "kebab-case",
      maxLength: 63,
      requiredSuffixes: {},
    },
    resourceTypeMapping: {
      "compute_instance": "google_compute_instance",
      "database_instance": "google_sql_database_instance",
      "storage_bucket": "google_storage_bucket",
      "load_balancer": "google_compute_forwarding_rule",
      "security_group": "google_compute_firewall",
      "iam_role": "google_project_iam_custom_role",
      "vpc": "google_compute_network",
      "subnet": "google_compute_subnetwork",
    },
    stateManagement: {
      recommendedBackend: "gcs",
      lockingMechanism: "object_versioning",
      encryptionDefault: true,
      versioningEnabled: true,
    },
    rateLimits: {
      maxConcurrentOperations: 4,
      apiCallsPerSecond: 10,
      maxResourcesPerOperation: 40,
      cooldownBetweenOperationsMs: 6_000,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Generation Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type GenerationStageId =
  | "plan_intake"
  | "constraint_check"
  | "template_selection"
  | "hcl_generation"
  | "dependency_resolution"
  | "safety_validation"
  | "blast_radius_computation"
  | "rollback_generation"
  | "dry_run"
  | "governance_gate"
  | "final_packaging"
  | "audit_recording";

export interface GenerationStageDefinition {
  id: GenerationStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  dependsOn: GenerationStageId[];
  produces: string[];
  canSkipIf: string | null;
}

export const GENERATION_PIPELINE: GenerationStageDefinition[] = [
  { id: "plan_intake", name: "Plan Intake", description: "Parse and validate incoming execution plan", order: 1, required: true, timeoutMs: 10_000, retryable: false, maxRetries: 0, dependsOn: [], produces: ["parsed_plan"], canSkipIf: null },
  { id: "constraint_check", name: "Constraint Check", description: "Evaluate all generation constraints", order: 2, required: true, timeoutMs: 15_000, retryable: false, maxRetries: 0, dependsOn: ["plan_intake"], produces: ["constraint_results"], canSkipIf: null },
  { id: "template_selection", name: "Template Selection", description: "Match plan actions to generation templates", order: 3, required: true, timeoutMs: 10_000, retryable: false, maxRetries: 0, dependsOn: ["constraint_check"], produces: ["selected_templates"], canSkipIf: null },
  { id: "hcl_generation", name: "HCL Generation", description: "Generate Terraform HCL blocks from templates and plan", order: 4, required: true, timeoutMs: 60_000, retryable: true, maxRetries: 2, dependsOn: ["template_selection"], produces: ["hcl_blocks", "terraform_module"], canSkipIf: null },
  { id: "dependency_resolution", name: "Dependency Resolution", description: "Resolve and order resource dependencies", order: 5, required: true, timeoutMs: 15_000, retryable: false, maxRetries: 0, dependsOn: ["hcl_generation"], produces: ["dependency_graph", "ordered_changes"], canSkipIf: null },
  { id: "safety_validation", name: "Safety Validation", description: "Run full validation pipeline", order: 6, required: true, timeoutMs: 120_000, retryable: true, maxRetries: 1, dependsOn: ["dependency_resolution"], produces: ["validation_results"], canSkipIf: null },
  { id: "blast_radius_computation", name: "Blast Radius Computation", description: "Compute aggregate blast radius", order: 7, required: true, timeoutMs: 30_000, retryable: false, maxRetries: 0, dependsOn: ["safety_validation"], produces: ["blast_radius"], canSkipIf: null },
  { id: "rollback_generation", name: "Rollback Generation", description: "Generate rollback plan for every change", order: 8, required: true, timeoutMs: 30_000, retryable: true, maxRetries: 1, dependsOn: ["blast_radius_computation"], produces: ["rollback_plan"], canSkipIf: "context.rollbackRequired == false" },
  { id: "dry_run", name: "Dry Run", description: "Execute terraform plan to validate", order: 9, required: false, timeoutMs: 300_000, retryable: true, maxRetries: 2, dependsOn: ["rollback_generation"], produces: ["dry_run_result"], canSkipIf: "context.mode == plan_only" },
  { id: "governance_gate", name: "Governance Gate", description: "Submit for governance approval if required", order: 10, required: true, timeoutMs: 0, retryable: false, maxRetries: 0, dependsOn: ["dry_run"], produces: ["governance_approval"], canSkipIf: "context.approvalRequired == false" },
  { id: "final_packaging", name: "Final Packaging", description: "Package changeset with all artifacts", order: 11, required: true, timeoutMs: 15_000, retryable: false, maxRetries: 0, dependsOn: ["governance_gate"], produces: ["changeset"], canSkipIf: null },
  { id: "audit_recording", name: "Audit Recording", description: "Record generation event in audit trail", order: 12, required: true, timeoutMs: 10_000, retryable: true, maxRetries: 3, dependsOn: ["final_packaging"], produces: ["audit_entry"], canSkipIf: null },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Security Anti-Pattern Detection
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityAntiPatternId =
  | "open_ingress"
  | "wildcard_iam"
  | "unencrypted_storage"
  | "public_database"
  | "hardcoded_secret"
  | "overprivileged_role"
  | "disabled_logging"
  | "insecure_protocol"
  | "missing_mfa"
  | "cross_account_trust";

export interface SecurityAntiPattern {
  id: SecurityAntiPatternId;
  name: string;
  description: string;
  severity: "high" | "critical";
  applicableResourceTypes: string[];
  detectionLogic: string;
  remediationTemplate: string | null;
  cweReference: string | null;
  complianceFrameworks: string[];
}

export const SECURITY_ANTI_PATTERNS: SecurityAntiPattern[] = [
  {
    id: "open_ingress",
    name: "Open Ingress (0.0.0.0/0)",
    description: "Security group allows unrestricted inbound access on sensitive ports",
    severity: "critical",
    applicableResourceTypes: ["aws_security_group", "aws_security_group_rule", "azurerm_network_security_rule", "google_compute_firewall"],
    detectionLogic: "cidr_blocks contains '0.0.0.0/0' AND port in [22, 3389, 3306, 5432, 27017, 6379, 9200]",
    remediationTemplate: "Restrict to specific CIDR ranges or use VPN/bastion",
    cweReference: "CWE-284",
    complianceFrameworks: ["SOC2", "PCI-DSS", "HIPAA", "CIS"],
  },
  {
    id: "wildcard_iam",
    name: "Wildcard IAM Permissions",
    description: "IAM policy grants * permissions on * resources",
    severity: "critical",
    applicableResourceTypes: ["aws_iam_policy", "aws_iam_role_policy", "azurerm_role_definition", "google_project_iam_custom_role"],
    detectionLogic: "statement.action == '*' AND statement.resource == '*'",
    remediationTemplate: "Scope permissions to specific actions and resource ARNs",
    cweReference: "CWE-250",
    complianceFrameworks: ["SOC2", "PCI-DSS", "CIS", "NIST"],
  },
  {
    id: "unencrypted_storage",
    name: "Unencrypted Storage",
    description: "Storage resources without server-side encryption",
    severity: "high",
    applicableResourceTypes: ["aws_s3_bucket", "aws_ebs_volume", "aws_rds_cluster", "azurerm_storage_account", "google_storage_bucket"],
    detectionLogic: "encryption_configuration is null OR sse_algorithm is null",
    remediationTemplate: "Enable SSE-KMS or SSE-S3 encryption",
    cweReference: "CWE-311",
    complianceFrameworks: ["SOC2", "PCI-DSS", "HIPAA", "GDPR"],
  },
  {
    id: "public_database",
    name: "Publicly Accessible Database",
    description: "Database instance is publicly accessible",
    severity: "critical",
    applicableResourceTypes: ["aws_db_instance", "aws_rds_cluster", "azurerm_mssql_database", "google_sql_database_instance"],
    detectionLogic: "publicly_accessible == true",
    remediationTemplate: "Set publicly_accessible to false and use VPC endpoints",
    cweReference: "CWE-284",
    complianceFrameworks: ["SOC2", "PCI-DSS", "HIPAA", "CIS"],
  },
  {
    id: "hardcoded_secret",
    name: "Hardcoded Secret in Configuration",
    description: "Sensitive values embedded directly in HCL rather than referenced from vault",
    severity: "critical",
    applicableResourceTypes: [],
    detectionLogic: "attribute.value matches password|secret|key|token pattern AND value.type != reference",
    remediationTemplate: "Use var references with sensitive=true or data sources for secrets",
    cweReference: "CWE-798",
    complianceFrameworks: ["SOC2", "PCI-DSS", "OWASP"],
  },
  {
    id: "overprivileged_role",
    name: "Overprivileged Service Role",
    description: "Service role has more permissions than needed for its function",
    severity: "high",
    applicableResourceTypes: ["aws_iam_role", "aws_iam_role_policy_attachment", "azurerm_role_assignment"],
    detectionLogic: "role has AdministratorAccess or PowerUserAccess attached",
    remediationTemplate: "Create custom policy with minimum required permissions",
    cweReference: "CWE-250",
    complianceFrameworks: ["SOC2", "CIS", "NIST"],
  },
  {
    id: "disabled_logging",
    name: "Disabled Audit Logging",
    description: "Resource has audit logging disabled",
    severity: "high",
    applicableResourceTypes: ["aws_s3_bucket", "aws_cloudtrail", "aws_rds_cluster", "azurerm_storage_account"],
    detectionLogic: "logging_configuration is null OR enabled == false",
    remediationTemplate: "Enable access logging and ship to centralized log store",
    cweReference: "CWE-778",
    complianceFrameworks: ["SOC2", "PCI-DSS", "HIPAA", "NIST"],
  },
  {
    id: "insecure_protocol",
    name: "Insecure Protocol Allowed",
    description: "Resource allows HTTP or other unencrypted protocols",
    severity: "high",
    applicableResourceTypes: ["aws_lb_listener", "aws_cloudfront_distribution", "azurerm_application_gateway"],
    detectionLogic: "protocol == HTTP AND redirect_to_https == false",
    remediationTemplate: "Enforce HTTPS and add HTTP-to-HTTPS redirect",
    cweReference: "CWE-319",
    complianceFrameworks: ["SOC2", "PCI-DSS", "OWASP"],
  },
  {
    id: "missing_mfa",
    name: "MFA Not Required",
    description: "IAM policy does not enforce MFA for sensitive operations",
    severity: "high",
    applicableResourceTypes: ["aws_iam_policy", "aws_iam_role"],
    detectionLogic: "condition does not include aws:MultiFactorAuthPresent for destructive actions",
    remediationTemplate: "Add MFA condition to policy for delete/modify actions",
    cweReference: "CWE-308",
    complianceFrameworks: ["SOC2", "PCI-DSS", "CIS", "NIST"],
  },
  {
    id: "cross_account_trust",
    name: "Unrestricted Cross-Account Trust",
    description: "IAM role trusts external accounts without conditions",
    severity: "critical",
    applicableResourceTypes: ["aws_iam_role"],
    detectionLogic: "assume_role_policy allows Principal from external account without ExternalId condition",
    remediationTemplate: "Add ExternalId condition and restrict to specific role ARNs",
    cweReference: "CWE-284",
    complianceFrameworks: ["SOC2", "CIS", "NIST"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type TerraformIntegrationTarget =
  | "planning_engine"
  | "execution_engine"
  | "governance_engine"
  | "simulation_engine"
  | "memory_system"
  | "monitoring_agent"
  | "rbac_engine"
  | "observability"
  | "audit_trail"
  | "org_intelligence";

export interface TerraformIntegrationContract {
  target: TerraformIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
  requiredPhase: string;
}

export const TERRAFORM_INTEGRATION_CONTRACTS: TerraformIntegrationContract[] = [
  { target: "planning_engine", direction: "consumes", description: "Receives execution plans to translate into IaC", dataFlow: "ExecutionPlan → InfrastructureChangeSet", requiredPhase: "plan_intake" },
  { target: "execution_engine", direction: "produces", description: "Delivers validated changesets for safe apply", dataFlow: "InfrastructureChangeSet → ApplyContext", requiredPhase: "final_packaging" },
  { target: "governance_engine", direction: "bidirectional", description: "Submits for approval, receives decisions", dataFlow: "ChangeSet ↔ GovernanceDecision", requiredPhase: "governance_gate" },
  { target: "simulation_engine", direction: "consumes", description: "Uses simulation results for blast radius", dataFlow: "SimulationResult → BlastRadiusInput", requiredPhase: "blast_radius_computation" },
  { target: "memory_system", direction: "produces", description: "Records generation outcomes for learning", dataFlow: "GenerationOutcome → OperationalMemory", requiredPhase: "audit_recording" },
  { target: "monitoring_agent", direction: "produces", description: "Provides rollback triggers post-apply", dataFlow: "RollbackTrigger → MonitoringConfig", requiredPhase: "rollback_generation" },
  { target: "rbac_engine", direction: "consumes", description: "Validates operator permissions for generation", dataFlow: "OperatorContext → PermissionCheck", requiredPhase: "constraint_check" },
  { target: "observability", direction: "produces", description: "Emits generation metrics and traces", dataFlow: "GenerationEvent → ObservabilityPipeline", requiredPhase: "audit_recording" },
  { target: "audit_trail", direction: "produces", description: "Records full generation audit trail", dataFlow: "GenerationAudit → AuditStore", requiredPhase: "audit_recording" },
  { target: "org_intelligence", direction: "consumes", description: "Applies org preferences to generation", dataFlow: "OrgPreferences → GenerationConstraints", requiredPhase: "constraint_check" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getGenerationTemplate(id: string): GenerationTemplate | undefined {
  return GENERATION_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): GenerationTemplate[] {
  return GENERATION_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByProvider(provider: "aws" | "azure" | "gcp"): GenerationTemplate[] {
  return GENERATION_TEMPLATES.filter((t) => t.provider === provider || t.provider === "any");
}

export function getTemplateForAction(provider: "aws" | "azure" | "gcp", action: ResourceLifecycleAction, resourceType: string): GenerationTemplate | undefined {
  return GENERATION_TEMPLATES.find(
    (t) =>
      (t.provider === provider || t.provider === "any") &&
      t.lifecycleAction === action &&
      t.applicableResourceTypes.includes(resourceType)
  );
}

export function getSafetyConstraint(id: string): GenerationConstraint | undefined {
  return SAFETY_CONSTRAINTS.find((c) => c.id === id);
}

export function getBlockingConstraints(): GenerationConstraint[] {
  return SAFETY_CONSTRAINTS.filter((c) => c.severity === "blocking" || c.severity === "absolute");
}

export function getAbsoluteConstraints(): GenerationConstraint[] {
  return SAFETY_CONSTRAINTS.filter((c) => c.severity === "absolute");
}

export function getSecurityAntiPattern(id: SecurityAntiPatternId): SecurityAntiPattern | undefined {
  return SECURITY_ANTI_PATTERNS.find((p) => p.id === id);
}

export function getCriticalAntiPatterns(): SecurityAntiPattern[] {
  return SECURITY_ANTI_PATTERNS.filter((p) => p.severity === "critical");
}

export function getAntiPatternsByCompliance(framework: string): SecurityAntiPattern[] {
  return SECURITY_ANTI_PATTERNS.filter((p) => p.complianceFrameworks.includes(framework));
}

export function getProviderGenerationProfile(provider: "aws" | "azure" | "gcp"): ProviderGenerationProfile | undefined {
  return PROVIDER_GENERATION_PROFILES.find((p) => p.provider === provider);
}

export function getGenerationPipelineStage(id: GenerationStageId): GenerationStageDefinition | undefined {
  return GENERATION_PIPELINE.find((s) => s.id === id);
}

export function getGenerationPipelineOrder(): GenerationStageId[] {
  return [...GENERATION_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getValidatorDefinition(id: ValidatorId): ValidatorDefinition | undefined {
  return VALIDATION_PIPELINE.validators.find((v) => v.id === id);
}

export function getRequiredValidators(): ValidatorDefinition[] {
  return VALIDATION_PIPELINE.validators.filter((v) => v.required);
}

export function getTerraformIntegration(target: TerraformIntegrationTarget): TerraformIntegrationContract | undefined {
  return TERRAFORM_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

export function mapUnifiedResourceToProvider(unifiedType: string, provider: "aws" | "azure" | "gcp"): string | undefined {
  const profile = getProviderGenerationProfile(provider);
  return profile?.resourceTypeMapping[unifiedType];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §15 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface TerraformGenerationTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runTerraformGenerationTests(): TerraformGenerationTestResult[] {
  const results: TerraformGenerationTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Generation Architecture
  assert("generation-modes-exist", (["plan_only", "generate_and_validate", "generate_and_dry_run", "generate_for_review", "generate_for_apply"] as GenerationMode[]).length === 5, "Should have 5 generation modes");
  assert("change-actions-exist", (["create", "update", "delete", "replace", "import", "no_op"] as ChangeAction[]).length === 6, "Should have 6 change actions");
  assert("lifecycle-actions-exist", (["scale_up", "resize", "enable_encryption", "modify_iam"] as ResourceLifecycleAction[]).length === 4, "Should have lifecycle actions");

  // §3 — Blast Radius
  assert("blast-radius-weights-sum", Math.abs(Object.values(BLAST_RADIUS_WEIGHTS).reduce((s, w) => s + w, 0) - 1.0) < 0.01, "Blast radius weights should sum to 1.0");
  assert("blast-radius-thresholds-ordered", BLAST_RADIUS_THRESHOLDS.minimal < BLAST_RADIUS_THRESHOLDS.low && BLAST_RADIUS_THRESHOLDS.low < BLAST_RADIUS_THRESHOLDS.moderate && BLAST_RADIUS_THRESHOLDS.moderate < BLAST_RADIUS_THRESHOLDS.high && BLAST_RADIUS_THRESHOLDS.high < BLAST_RADIUS_THRESHOLDS.critical, "Thresholds should be ordered");
  assert("blast-severity-minimal", computeBlastRadiusSeverity(0.05) === "minimal", "Score 0.05 should be minimal");
  assert("blast-severity-critical", computeBlastRadiusSeverity(0.90) === "critical", "Score 0.90 should be critical");
  assert("blast-severity-moderate", computeBlastRadiusSeverity(0.55) === "moderate", "Score 0.55 should be moderate");

  // §5 — Templates
  assert("templates-exist", GENERATION_TEMPLATES.length >= 6, "Should have at least 6 templates");
  assert("template-lookup-works", getGenerationTemplate("aws-ec2-resize") !== undefined, "Should find EC2 resize template");
  assert("template-by-category", getTemplatesByCategory("compute").length >= 2, "Should find compute templates");
  assert("template-by-provider", getTemplatesByProvider("aws").length >= 6, "Should find AWS templates");
  assert("template-for-action", getTemplateForAction("aws", "resize", "aws_instance") !== undefined, "Should find resize template for EC2");
  assert("all-templates-have-safety", GENERATION_TEMPLATES.every((t) => t.safetyChecks.length > 0), "Every template must have safety checks");
  assert("all-templates-have-blast-radius", GENERATION_TEMPLATES.every((t) => t.blastRadiusDefault !== undefined), "Every template must have default blast radius");

  // §6 — Safety Constraints
  assert("safety-constraints-exist", SAFETY_CONSTRAINTS.length >= 8, "Should have at least 8 safety constraints");
  assert("absolute-constraints-not-overridable", getAbsoluteConstraints().every((c) => !c.overridable), "Absolute constraints must not be overridable");
  assert("blocking-constraints-exist", getBlockingConstraints().length >= 4, "Should have at least 4 blocking constraints");
  assert("no-delete-production-db", getSafetyConstraint("no-delete-production-db")?.severity === "absolute", "Production DB deletion must be absolute severity");
  assert("all-deletes-require-approval", getSafetyConstraint("all-deletes-require-approval")?.severity === "absolute", "Delete approval must be absolute");

  // §8 — Validation Pipeline
  assert("validation-pipeline-has-10-validators", VALIDATION_PIPELINE.validators.length === 10, "Should have 10 validators");
  assert("required-validators-count", getRequiredValidators().length === 8, "Should have 8 required validators");
  assert("validators-ordered", VALIDATION_PIPELINE.validators.every((v, i) => i === 0 || v.order >= VALIDATION_PIPELINE.validators[i - 1].order), "Validators should be ordered");

  // §10 — Provider Profiles
  assert("three-provider-profiles", PROVIDER_GENERATION_PROFILES.length === 3, "Should have profiles for all 3 providers");
  assert("aws-profile-lookup", getProviderGenerationProfile("aws")?.preferredBackend === "terraform", "AWS should prefer Terraform");
  assert("azure-profile-lookup", getProviderGenerationProfile("azure") !== undefined, "Azure profile should exist");
  assert("gcp-profile-lookup", getProviderGenerationProfile("gcp") !== undefined, "GCP profile should exist");
  assert("aws-has-resource-mappings", Object.keys(getProviderGenerationProfile("aws")?.resourceTypeMapping ?? {}).length >= 15, "AWS should map 15+ resource types");
  assert("resource-mapping-works", mapUnifiedResourceToProvider("compute_instance", "aws") === "aws_instance", "Should map compute_instance to aws_instance");

  // §11 — Generation Pipeline
  assert("pipeline-has-12-stages", GENERATION_PIPELINE.length === 12, "Should have 12 pipeline stages");
  assert("pipeline-ordered", GENERATION_PIPELINE.every((s, i) => i === 0 || s.order >= GENERATION_PIPELINE[i - 1].order), "Pipeline stages should be ordered");
  assert("pipeline-stage-lookup", getGenerationPipelineStage("hcl_generation")?.order === 4, "HCL generation should be stage 4");

  // §12 — Security Anti-Patterns
  assert("anti-patterns-exist", SECURITY_ANTI_PATTERNS.length === 10, "Should have 10 security anti-patterns");
  assert("critical-anti-patterns", getCriticalAntiPatterns().length >= 5, "Should have at least 5 critical anti-patterns");
  assert("soc2-anti-patterns", getAntiPatternsByCompliance("SOC2").length >= 8, "SOC2 should cover 8+ patterns");
  assert("anti-pattern-lookup", getSecurityAntiPattern("wildcard_iam")?.severity === "critical", "Wildcard IAM should be critical");

  // §13 — Integration Contracts
  assert("integration-contracts-exist", TERRAFORM_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("planning-integration", getTerraformIntegration("planning_engine")?.direction === "consumes", "Should consume from planning engine");
  assert("governance-integration-bidirectional", getTerraformIntegration("governance_engine")?.direction === "bidirectional", "Governance should be bidirectional");

  return results;
}

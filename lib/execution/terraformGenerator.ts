/**
 * Terraform preview generator — produces safe, reviewable Terraform from
 * reasoned recommendations. Generated artifacts include explicit warnings,
 * rollback notes, and assumptions so reviewers see exactly what the plan does.
 *
 * Initial safe use cases:
 *   - tagging (idempotent, low risk)
 *   - storage lifecycle policy
 *   - security group review (read-only — flagged for manual review)
 *   - backup policy suggestion
 *   - rightsizing preview (modify instance_type)
 *
 * Destructive operations (terraform destroy, force_delete) are blocked by
 * default and require explicit risk acknowledgement upstream.
 */

import type { ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export interface TerraformArtifact {
  /** Suggested filename (e.g., "plan_rec_001_main.tf"). */
  filename: string;
  /** Full Terraform content. */
  content: string;
  /** A short list of every Terraform resource block emitted. */
  blocksEmitted: string[];
  /** Honest assumptions baked into the preview. */
  assumptions: string[];
  /** Warnings the reviewer should read before applying. */
  warnings: string[];
  /** Commands to verify the apply succeeded. */
  verificationCommands: string[];
  /** Whether this preview includes destructive intent (delete, force_destroy). */
  hasDestructiveIntent: boolean;
  /** Total bytes of the artifact. */
  bytes: number;
}

export interface TerraformGenerationOptions {
  /** Force generation even if the action class is destructive. */
  allowDestructive?: boolean;
  /** AWS provider region default if none provided in the resource ref. */
  defaultRegion?: string;
}

/**
 * Generate a Terraform preview from a reasoned recommendation.
 * Returns a typed artifact suitable for download or inline review.
 */
export function generateTerraformPreview(
  rec: ReasonedRecommendation,
  affectedResources: ResourceRef[],
  options: TerraformGenerationOptions = {}
): TerraformArtifact {
  const action = rec.action.toLowerCase();
  const provider = affectedResources[0]?.provider ?? "aws";
  const region = affectedResources[0]?.region ?? options.defaultRegion ?? "us-east-1";

  // Block destructive intent by default
  const isDestructive = /destroy|delete|terminate|drop|remove/.test(action) && !options.allowDestructive;
  if (isDestructive) {
    return buildBlockedArtifact(rec, affectedResources, "Destructive intent — requires explicit risk acknowledgement.");
  }

  // Dispatch by action class
  if (/right-?size/.test(action)) return generateRightsizing(rec, affectedResources, region);
  if (/tag/.test(action)) return generateTagging(rec, affectedResources, region);
  if (/lifecycle/.test(action) || /backup/.test(action)) return generateLifecyclePolicy(rec, affectedResources, region);
  if (/security group|firewall|public access/.test(action)) return generateSecurityGroupReview(rec, affectedResources, region);
  if (/idle/.test(action)) return generateIdleResourceReview(rec, affectedResources, region);

  // Default — generic header + manual-review note
  return generateGeneric(rec, affectedResources, region, provider);
}

// ---------------------------------------------------------------------------
// Specific generators
// ---------------------------------------------------------------------------

function generateRightsizing(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): TerraformArtifact {
  const targetType = inferTargetInstanceType(rec.action);
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";

  for (const ref of refs) {
    blocks.push(`aws_instance.${tfId(ref.id)}`);
    content += `# Right-size ${ref.id} (was: existing instance type — see scan snapshot)\n`;
    content += `resource "aws_instance" "${tfId(ref.id)}" {\n`;
    content += `  instance_type = "${targetType}"  # axiom-rightsized · review before apply\n`;
    content += `  # All other attributes inherited via terraform import or pre-flight state\n`;
    content += `\n`;
    content += `  tags = {\n`;
    content += `    Axiom_Rightsized  = "${new Date().toISOString().slice(0, 10)}"\n`;
    content += `    Axiom_Plan_Id     = "${rec.id}"\n`;
    content += `  }\n`;
    content += `}\n\n`;
  }

  return {
    filename: `${rec.id}_rightsize.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: [
      `Target instance type: ${targetType}.`,
      "Resources are imported from existing state — no new resource creation.",
      "Right-sizing is sequenced one-at-a-time via separate apply phases.",
    ],
    warnings: [
      "Stop / modify / start cycle takes ~2 minutes per instance.",
      "ALB target health check must succeed before the next instance is right-sized.",
    ],
    verificationCommands: [
      "aws ec2 describe-instances --instance-ids <id> --query 'Reservations[].Instances[].InstanceType'",
      "aws elbv2 describe-target-health --target-group-arn <tg-arn>",
    ],
    hasDestructiveIntent: false,
    bytes: content.length,
  };
}

function generateTagging(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): TerraformArtifact {
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";

  for (const ref of refs) {
    blocks.push(`aws_resource_tag.${tfId(ref.id)}`);
    content += `# Tag ${ref.id} with Axiom audit metadata\n`;
    content += `# Idempotent — re-applying produces no change.\n`;
    content += `resource "aws_ec2_tag" "${tfId(ref.id)}" {\n`;
    content += `  resource_id = "${ref.id}"\n`;
    content += `  key         = "Managed_By"\n`;
    content += `  value       = "axiom-agent"\n`;
    content += `}\n\n`;
  }

  return {
    filename: `${rec.id}_tag.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: [
      "Tags use Axiom's canonical tag taxonomy.",
      "Existing tags are preserved.",
    ],
    warnings: [],
    verificationCommands: [
      "aws ec2 describe-tags --filters Name=resource-id,Values=<id>",
    ],
    hasDestructiveIntent: false,
    bytes: content.length,
  };
}

function generateLifecyclePolicy(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): TerraformArtifact {
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";

  for (const ref of refs) {
    blocks.push(`aws_s3_bucket_lifecycle_configuration.${tfId(ref.id)}`);
    content += `# Lifecycle policy suggestion for ${ref.id}\n`;
    content += `resource "aws_s3_bucket_lifecycle_configuration" "${tfId(ref.id)}" {\n`;
    content += `  bucket = "${ref.id}"\n`;
    content += `\n`;
    content += `  rule {\n`;
    content += `    id     = "axiom-suggested-lifecycle"\n`;
    content += `    status = "Enabled"\n`;
    content += `\n`;
    content += `    transition {\n`;
    content += `      days          = 30\n`;
    content += `      storage_class = "STANDARD_IA"\n`;
    content += `    }\n`;
    content += `    transition {\n`;
    content += `      days          = 90\n`;
    content += `      storage_class = "GLACIER"\n`;
    content += `    }\n`;
    content += `  }\n`;
    content += `}\n\n`;
  }

  return {
    filename: `${rec.id}_lifecycle.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: [
      "30-day STANDARD_IA + 90-day GLACIER is a reasonable default.",
      "Existing object-level overrides are preserved.",
      "No object expiration is added — manual review required for delete-on-expire.",
    ],
    warnings: [
      "Lifecycle policies affect all objects in the bucket.",
      "Glacier-tier retrieval has cost + latency implications.",
    ],
    verificationCommands: [
      "aws s3api get-bucket-lifecycle-configuration --bucket <bucket-name>",
    ],
    hasDestructiveIntent: false,
    bytes: content.length,
  };
}

function generateSecurityGroupReview(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): TerraformArtifact {
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";
  content += `# Security group review — read-only preview\n`;
  content += `# Axiom is NOT modifying SG rules in this plan. Review evidence,\n`;
  content += `# then create the modification plan as a separate, approval-gated step.\n\n`;

  for (const ref of refs) {
    blocks.push(`# review:aws_security_group.${tfId(ref.id)}`);
    content += `# Resource: ${ref.id}\n`;
    content += `# Action: manual review required before mutation plan is generated.\n\n`;
  }

  return {
    filename: `${rec.id}_security_review.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: ["Read-only review — no mutations in this artifact."],
    warnings: [
      "SG rule changes can cause production outages.",
      "A separate, approval-gated mutation plan must be generated and reviewed before any apply.",
    ],
    verificationCommands: [
      "aws ec2 describe-security-group-rules --filters Name=group-id,Values=<sg-id>",
    ],
    hasDestructiveIntent: false,
    bytes: content.length,
  };
}

function generateIdleResourceReview(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): TerraformArtifact {
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";
  content += `# Idle resource review — read-only preview\n`;
  content += `# Decommissioning is destructive. Confirm intent and rollback strategy\n`;
  content += `# before generating the destroy plan as a separate step.\n\n`;

  for (const ref of refs) {
    blocks.push(`# review:idle.${tfId(ref.id)}`);
    content += `# Resource: ${ref.id} — flagged as idle\n`;
    content += `# Confirm with resource owner before generating destroy.\n\n`;
  }

  return {
    filename: `${rec.id}_idle_review.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: [
      "Idle detection used the past 14 days of CloudWatch utilization data.",
      "Resources are not in an Auto Scaling Group that re-creates them.",
    ],
    warnings: [
      "Destroying a resource is irreversible without backups.",
      "Confirm with resource owner before generating destroy plan.",
    ],
    verificationCommands: [
      "aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --dimensions Name=InstanceId,Value=<id> --statistics Average --period 3600 --start-time <14d-ago> --end-time <now>",
    ],
    hasDestructiveIntent: false, // It's a review, not a destroy
    bytes: content.length,
  };
}

function generateGeneric(rec: ReasonedRecommendation, refs: ResourceRef[], region: string, provider: string): TerraformArtifact {
  const blocks: string[] = [];
  let content = buildHeader(rec, region) + "\n";
  content += `# Generic preview for: ${rec.action}\n`;
  content += `# Provider: ${provider}\n`;
  content += `# Manual review required — no automated generator for this action class.\n\n`;

  for (const ref of refs) {
    blocks.push(`# ${ref.id}`);
    content += `# Affected: ${ref.id}\n`;
  }

  return {
    filename: `${rec.id}_review.tf`,
    content,
    blocksEmitted: blocks,
    assumptions: ["Axiom does not yet auto-generate Terraform for this action class."],
    warnings: ["Manual Terraform authoring required before apply."],
    verificationCommands: [],
    hasDestructiveIntent: false,
    bytes: content.length,
  };
}

function buildBlockedArtifact(rec: ReasonedRecommendation, refs: ResourceRef[], reason: string): TerraformArtifact {
  const content =
    `# BLOCKED · ${reason}\n` +
    `# Plan: ${rec.id}\n` +
    `# Action: ${rec.action}\n` +
    `# Affected: ${refs.map((r) => r.id).join(", ")}\n\n` +
    `# No Terraform emitted. To proceed:\n` +
    `#   1. Acknowledge destructive risk in the approval form.\n` +
    `#   2. Provide explicit rollback strategy.\n` +
    `#   3. Multi-party approval required (high-risk path).\n`;

  return {
    filename: `${rec.id}_blocked.tf`,
    content,
    blocksEmitted: [],
    assumptions: [],
    warnings: [reason],
    verificationCommands: [],
    hasDestructiveIntent: true,
    bytes: content.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeader(rec: ReasonedRecommendation, region: string): string {
  return (
    `# Generated by Axiom Agent\n` +
    `# Plan: ${rec.id}\n` +
    `# Action: ${rec.action}\n` +
    `# Risk: ${rec.risk} · Approval required: ${rec.approvalRequired ? "yes" : "no"} · Confidence: ${(rec.confidence * 100).toFixed(0)}%\n` +
    `# Region: ${region}\n` +
    `# Rollback: ${rec.rollback}\n`
  );
}

function inferTargetInstanceType(action: string): string {
  // Try to extract "m5.xlarge" style hint from the action; default to t3.medium.
  const match = action.match(/m\d?\.[a-z]+|t\d?\.[a-z]+|r\d?\.[a-z]+|c\d?\.[a-z]+/i);
  return match ? match[0] : "t3.medium";
}

function tfId(resourceId: string): string {
  return resourceId.replace(/[^a-zA-Z0-9]/g, "_");
}

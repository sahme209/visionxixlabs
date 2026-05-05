import type { ExecutionPlan, ExecutionPlanItem } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerraformOutput = {
  provider: CloudProvider;
  filename: string;
  hcl: string;
  actionCount: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function generateTerraform(plan: ExecutionPlan): TerraformOutput {
  const warnings: string[] = [];
  const blocks: string[] = [];

  blocks.push(header(plan));

  for (const item of plan.items) {
    const gen = GENERATORS[item.actionType];
    if (!gen) {
      warnings.push(`Unsupported action type: ${item.actionType}`);
      continue;
    }
    const result = gen(item, plan.provider);
    blocks.push(result.hcl);
    if (result.warning) warnings.push(result.warning);
  }

  const hcl = blocks.join("\n");
  const safeName = plan.accountId.replace(/[^a-z0-9-]/gi, "-");

  return {
    provider: plan.provider,
    filename: `axiom-optimization-${safeName}.tf`,
    hcl,
    actionCount: plan.items.length,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function header(plan: ExecutionPlan): string {
  return `# =============================================================================
# Axiom Cloud Optimizer — Generated Execution Plan
# Provider:  ${plan.provider.toUpperCase()}
# Account:   ${plan.accountId}
# Generated: ${plan.generatedAt}
# Actions:   ${plan.items.length}
# Est. savings: $${plan.totalEstimatedSavings.monthly.toLocaleString()}/mo ($${plan.totalEstimatedSavings.yearly.toLocaleString()}/yr)
#
# IMPORTANT: Review every change before applying.
#   terraform plan -out=axiom.tfplan
#   terraform apply axiom.tfplan
# =============================================================================
`;
}

// ---------------------------------------------------------------------------
// Generator registry
// ---------------------------------------------------------------------------

type GeneratorResult = { hcl: string; warning?: string };
type Generator = (item: ExecutionPlanItem, provider: CloudProvider) => GeneratorResult;

const GENERATORS: Record<string, Generator> = {
  resize_compute: genResizeCompute,
  apply_storage_policy: genStoragePolicy,
  purchase_commitment: genCommitment,
  decommission_compute: genDecommission,
};

// ---------------------------------------------------------------------------
// 1. Compute resize
// ---------------------------------------------------------------------------

function genResizeCompute(item: ExecutionPlanItem, provider: CloudProvider): GeneratorResult {
  const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
  const blocks: string[] = [];

  switch (provider) {
    case "aws":
      for (const id of item.resourceIds) {
        const safeName = sanitize(id);
        blocks.push(`# Resize ${id} in ${item.region}
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: ${item.riskLevel} | Requires stop/start (brief interruption)
#
# This uses an aws_ec2_instance_state + null_resource pattern to avoid
# recreating the instance. Terraform cannot resize a running EC2 in-place —
# it must be stopped first.

resource "aws_ec2_instance_state" "stop_${safeName}" {
  instance_id = "${id}"
  state       = "stopped"
}

resource "null_resource" "resize_${safeName}" {
  depends_on = [aws_ec2_instance_state.stop_${safeName}]

  provisioner "local-exec" {
    command = "aws ec2 modify-instance-attribute --instance-id ${id} --instance-type '{\\"Value\\": \\"${recommended}\\"}' --region ${item.region}"
  }
}

resource "aws_ec2_instance_state" "start_${safeName}" {
  depends_on  = [null_resource.resize_${safeName}]
  instance_id = "${id}"
  state       = "running"
}
`);
      }
      return { hcl: blocks.join("\n") };

    case "azure":
      for (const id of item.resourceIds) {
        const safeName = sanitize(id);
        blocks.push(`# Resize ${id} in ${item.region}
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: ${item.riskLevel} | Requires deallocation (downtime)
#
# azurerm_virtual_machine resize triggers deallocation automatically.
# Ensure no availability set constraints block the target size.

resource "azurerm_virtual_machine" "resize_${safeName}" {
  # Import existing VM first:
  #   terraform import azurerm_virtual_machine.resize_${safeName} /subscriptions/.../virtualMachines/${id}

  name     = "${id}"
  location = "${item.region}"

  vm_size = "${recommended}"

  lifecycle {
    ignore_changes = [
      os_profile,
      storage_os_disk,
      storage_data_disk,
      network_interface_ids,
      tags,
    ]
  }
}
`);
      }
      return {
        hcl: blocks.join("\n"),
        warning: "Azure VM resize requires deallocation. Schedule during maintenance window.",
      };

    case "gcp":
      for (const id of item.resourceIds) {
        const safeName = sanitize(id);
        const zone = item.region + "-a";
        blocks.push(`# Resize ${id} in ${item.region}
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: ${item.riskLevel} | Requires stop (brief interruption)
#
# GCP allows machine type change on stopped instances.
# This stops the instance, changes the type, and restarts it.

resource "null_resource" "resize_${safeName}" {
  provisioner "local-exec" {
    command = <<-EOT
      gcloud compute instances stop ${id} --zone=${zone} --quiet
      gcloud compute instances set-machine-type ${id} --zone=${zone} --machine-type=${recommended}
      gcloud compute instances start ${id} --zone=${zone}
    EOT
  }
}
`);
      }
      return { hcl: blocks.join("\n") };
  }
}

// ---------------------------------------------------------------------------
// 2. Storage lifecycle policy
// ---------------------------------------------------------------------------

function genStoragePolicy(item: ExecutionPlanItem, provider: CloudProvider): GeneratorResult {
  const blocks: string[] = [];

  switch (provider) {
    case "aws":
      for (const id of item.resourceIds) {
        const safeName = sanitize(id);
        blocks.push(`# Enable Intelligent-Tiering on bucket "${id}"
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo across ${item.resourceIds.length} buckets
# Risk: low | Fully reversible, no data movement on apply
#
# Intelligent-Tiering automatically moves objects between access tiers.
# No retrieval fees. Safe for any access pattern.

resource "aws_s3_bucket_intelligent_tiering_configuration" "tier_${safeName}" {
  bucket = "${id}"
  name   = "axiom-auto-tier"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lifecycle_${safeName}" {
  bucket = "${id}"

  rule {
    id     = "axiom-transition-infrequent"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
  }
}
`);
      }
      return { hcl: blocks.join("\n") };

    case "azure": {
      const safeName = sanitize(item.resourceIds[0] ?? "storage");
      blocks.push(`# Apply tiering policy to ${item.resourceIds.length} storage account(s) in ${item.region}
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: low | Reversible by removing the management policy
#
# Azure Blob lifecycle moves blobs to Cool after 30 days, Archive after 90.
# Only applies to block blobs.

${item.resourceIds.map((id, i) => `resource "azurerm_storage_management_policy" "tier_${sanitize(id)}" {
  storage_account_id = azurerm_storage_account.${sanitize(id)}.id
  # If importing existing account:
  #   terraform import azurerm_storage_management_policy.tier_${sanitize(id)} /subscriptions/.../storageAccounts/${id}/managementPolicies/default

  rule {
    name    = "axiom-auto-tier"
    enabled = true

    filters {
      blob_types = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 30
        tier_to_archive_after_days_since_modification_greater_than = 90
      }
    }
  }
}`).join("\n\n")}
`);
      return { hcl: blocks.join("\n") };
    }

    case "gcp":
      for (const id of item.resourceIds) {
        const safeName = sanitize(id);
        blocks.push(`# Apply lifecycle rule to bucket "${id}"
# ${item.currentState} → ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: low | Reversible by removing the lifecycle rule
#
# Moves objects to Nearline after 30 days, Coldline after 90.
# No retrieval fees for Nearline within the same region.

resource "google_storage_bucket" "lifecycle_${safeName}" {
  # Import existing bucket first:
  #   terraform import google_storage_bucket.lifecycle_${safeName} ${id}

  name     = "${id}"
  location = upper("${item.region}")

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle {
    ignore_changes = [
      labels,
      versioning,
      cors,
      uniform_bucket_level_access,
    ]
  }
}
`);
      }
      return { hcl: blocks.join("\n") };
  }
}

// ---------------------------------------------------------------------------
// 3. Commitment plan (advisory — not automatable via Terraform)
// ---------------------------------------------------------------------------

function genCommitment(item: ExecutionPlanItem, provider: CloudProvider): GeneratorResult {
  const lines: string[] = [];

  lines.push(`# =============================================================================
# COMMITMENT PLAN — Manual Action Required
# =============================================================================
# ${item.currentState}
# Recommended: ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo ($${item.estimatedSavings.yearly}/yr)
# Risk: ${item.riskLevel}
#
# Commitment purchases cannot be automated via Terraform.
# Follow these steps in the ${provider.toUpperCase()} console:`);

  switch (provider) {
    case "aws":
      lines.push(`#
#   1. Open AWS Cost Explorer → Savings Plans → Purchase Savings Plan
#   2. Select "Compute Savings Plan" → 1 Year → No Upfront
#   3. Set hourly commitment to the value in recommendedState above
#   4. Review coverage estimate → Purchase
#   5. Monitor via Cost Explorer → Savings Plans → Utilization
`);
      break;
    case "azure":
      lines.push(`#
#   1. Open Azure Portal → Reservations → Add
#   2. Select "Virtual Machine" → 1 Year → No Upfront
#   3. Choose region: ${item.region}, VM size family matching your workload
#   4. Set quantity to cover ${item.resourceIds.length} instances
#   5. Review → Purchase
#   6. Monitor via Cost Management → Reservations
`);
      break;
    case "gcp":
      lines.push(`#
#   1. Open GCP Console → Compute Engine → Committed Use Discounts
#   2. Select "Create Commitment" → 1 Year
#   3. Set vCPU and memory quantities matching your baseline
#   4. Review discount → Purchase
#   5. Monitor via Billing → Committed Use Discounts
`);
      break;
  }

  return { hcl: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// 4. Decommission stopped instances (advisory with optional cleanup)
// ---------------------------------------------------------------------------

function genDecommission(item: ExecutionPlanItem, provider: CloudProvider): GeneratorResult {
  const lines: string[] = [];

  lines.push(`# =============================================================================
# DECOMMISSION — Stopped/Deallocated Instances
# =============================================================================
# ${item.currentState}
# Recommended: ${item.recommendedState}
# Estimated savings: $${item.estimatedSavings.monthly}/mo
# Risk: ${item.riskLevel} — verify no data on attached volumes before deleting
#`);

  switch (provider) {
    case "aws":
      for (const id of item.resourceIds) {
        lines.push(`# Snapshot + terminate ${id}:
#   aws ec2 create-snapshot --instance-id ${id} --description "axiom-backup-before-decommission"
#   aws ec2 terminate-instances --instance-ids ${id} --region ${item.region}
#`);
      }
      break;
    case "azure":
      for (const id of item.resourceIds) {
        lines.push(`# Snapshot + delete ${id}:
#   az snapshot create --resource-group <rg> --source /subscriptions/.../virtualMachines/${id} --name ${id}-axiom-backup
#   az vm delete --name ${id} --resource-group <rg> --yes
#`);
      }
      break;
    case "gcp":
      for (const id of item.resourceIds) {
        const zone = item.region + "-a";
        lines.push(`# Snapshot + delete ${id}:
#   gcloud compute disks snapshot ${id} --zone=${zone} --snapshot-names=${id}-axiom-backup
#   gcloud compute instances delete ${id} --zone=${zone} --quiet
#`);
      }
      break;
  }

  return {
    hcl: lines.join("\n") + "\n",
    warning: `${item.resourceIds.length} instance(s) marked for decommission — verify no critical data before deleting.`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
}

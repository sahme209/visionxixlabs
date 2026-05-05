import type { ExecutionPlan, ExecutionPlanItem } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CLICommandBlock = {
  label: string;
  itemId: string;
  actionType: string;
  provider: CloudProvider;
  region: string;
  warnings: string[];
  commands: string;
};

export type CLIOutput = {
  provider: CloudProvider;
  script: string;
  blockCount: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function generateCLICommands(plan: ExecutionPlan): CLIOutput {
  const allWarnings: string[] = [];
  const blocks: CLICommandBlock[] = [];

  for (const item of plan.items) {
    const gen = GENERATORS[item.actionType];
    if (!gen) {
      allWarnings.push(`Unsupported action type: ${item.actionType}`);
      continue;
    }
    const block = gen(item);
    blocks.push(block);
    allWarnings.push(...block.warnings);
  }

  const script = [
    scriptHeader(plan),
    ...blocks.map((b) => b.commands),
    scriptFooter(plan),
  ].join("\n");

  return {
    provider: plan.provider,
    script,
    blockCount: blocks.length,
    warnings: allWarnings,
  };
}

// ---------------------------------------------------------------------------
// Header / footer
// ---------------------------------------------------------------------------

function scriptHeader(plan: ExecutionPlan): string {
  const shell = plan.provider === "azure" ? "bash" : "bash";
  return `#!/usr/bin/env ${shell}
# =============================================================================
# Axiom Cloud Optimizer — CLI Execution Script
# Provider:    ${plan.provider.toUpperCase()}
# Account:     ${plan.accountId}
# Generated:   ${plan.generatedAt}
# Actions:     ${plan.items.length}
# Est. savings: $${plan.totalEstimatedSavings.monthly.toLocaleString()}/mo
#
# IMPORTANT: Review every command before running.
# Run with --dry-run flags first where available.
# =============================================================================

set -euo pipefail

`;
}

function scriptFooter(plan: ExecutionPlan): string {
  return `
# =============================================================================
# Done — ${plan.items.length} action(s) scripted
# Estimated savings: $${plan.totalEstimatedSavings.monthly.toLocaleString()}/mo ($${plan.totalEstimatedSavings.yearly.toLocaleString()}/yr)
# =============================================================================
echo "Axiom optimization complete."
`;
}

// ---------------------------------------------------------------------------
// Generator registry
// ---------------------------------------------------------------------------

type Generator = (item: ExecutionPlanItem) => CLICommandBlock;

const GENERATORS: Record<string, Generator> = {
  resize_compute: genResizeCompute,
  apply_storage_policy: genStoragePolicy,
  purchase_commitment: genCommitment,
  decommission_compute: genDecommission,
};

// ---------------------------------------------------------------------------
// 1. Compute resize
// ---------------------------------------------------------------------------

function genResizeCompute(item: ExecutionPlanItem): CLICommandBlock {
  const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
  const warnings: string[] = [];
  const lines: string[] = [];

  lines.push(sectionComment(item, "COMPUTE RESIZE"));

  if (item.requiresDowntime) {
    warnings.push(`Resize in ${item.region} requires instance stop — schedule during maintenance window.`);
    lines.push(`# ⚠️  WARNING: Instances will be stopped during resize. Plan for downtime.`);
  }

  switch (item.provider) {
    case "aws":
      lines.push(`# AWS EC2: stop → modify instance type → start`);
      lines.push(`# Downtime: ~2-5 min per instance\n`);
      for (const id of item.resourceIds) {
        lines.push(`# --- ${id} ---`);
        lines.push(`aws ec2 stop-instances \\`);
        lines.push(`  --instance-ids "${id}" \\`);
        lines.push(`  --region "${item.region}"\n`);
        lines.push(`aws ec2 wait instance-stopped \\`);
        lines.push(`  --instance-ids "${id}" \\`);
        lines.push(`  --region "${item.region}"\n`);
        lines.push(`aws ec2 modify-instance-attribute \\`);
        lines.push(`  --instance-id "${id}" \\`);
        lines.push(`  --instance-type '{"Value": "${recommended}"}' \\`);
        lines.push(`  --region "${item.region}"\n`);
        lines.push(`aws ec2 start-instances \\`);
        lines.push(`  --instance-ids "${id}" \\`);
        lines.push(`  --region "${item.region}"\n`);
        lines.push(`aws ec2 wait instance-running \\`);
        lines.push(`  --instance-ids "${id}" \\`);
        lines.push(`  --region "${item.region}"\n`);
        lines.push(`echo "✓ Resized ${id} to ${recommended}"\n`);
      }
      break;

    case "azure":
      warnings.push("Azure VM resize requires deallocation — longer downtime than stop/start.");
      lines.push(`# Azure: deallocate → resize → start`);
      lines.push(`# Downtime: ~5-10 min per instance\n`);
      for (const id of item.resourceIds) {
        lines.push(`# --- ${id} ---`);
        lines.push(`# Replace <resource-group> with the actual resource group name`);
        lines.push(`az vm deallocate \\`);
        lines.push(`  --name "${id}" \\`);
        lines.push(`  --resource-group "<resource-group>" \\`);
        lines.push(`  --no-wait false\n`);
        lines.push(`az vm resize \\`);
        lines.push(`  --name "${id}" \\`);
        lines.push(`  --resource-group "<resource-group>" \\`);
        lines.push(`  --size "${recommended}"\n`);
        lines.push(`az vm start \\`);
        lines.push(`  --name "${id}" \\`);
        lines.push(`  --resource-group "<resource-group>"\n`);
        lines.push(`echo "✓ Resized ${id} to ${recommended}"\n`);
      }
      break;

    case "gcp":
      lines.push(`# GCP: stop → set-machine-type → start`);
      lines.push(`# Downtime: ~2-5 min per instance\n`);
      for (const id of item.resourceIds) {
        const zone = item.region + "-a";
        lines.push(`# --- ${id} ---`);
        lines.push(`gcloud compute instances stop "${id}" \\`);
        lines.push(`  --zone="${zone}" \\`);
        lines.push(`  --quiet\n`);
        lines.push(`gcloud compute instances set-machine-type "${id}" \\`);
        lines.push(`  --zone="${zone}" \\`);
        lines.push(`  --machine-type="${recommended}"\n`);
        lines.push(`gcloud compute instances start "${id}" \\`);
        lines.push(`  --zone="${zone}"\n`);
        lines.push(`echo "✓ Resized ${id} to ${recommended}"\n`);
      }
      break;
  }

  return {
    label: `Resize compute in ${item.region}`,
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    warnings,
    commands: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 2. Storage lifecycle policy
// ---------------------------------------------------------------------------

function genStoragePolicy(item: ExecutionPlanItem): CLICommandBlock {
  const warnings: string[] = [];
  const lines: string[] = [];

  lines.push(sectionComment(item, "STORAGE LIFECYCLE POLICY"));
  lines.push(`# No downtime — policies apply asynchronously\n`);

  switch (item.provider) {
    case "aws":
      for (const id of item.resourceIds) {
        lines.push(`# --- Bucket: ${id} ---`);
        lines.push(`# Enable Intelligent-Tiering`);
        lines.push(`aws s3api put-bucket-intelligent-tiering-configuration \\`);
        lines.push(`  --bucket "${id}" \\`);
        lines.push(`  --id "axiom-auto-tier" \\`);
        lines.push(`  --intelligent-tiering-configuration '{`);
        lines.push(`    "Id": "axiom-auto-tier",`);
        lines.push(`    "Status": "Enabled",`);
        lines.push(`    "Tierings": [`);
        lines.push(`      {"AccessTier": "ARCHIVE_ACCESS", "Days": 90},`);
        lines.push(`      {"AccessTier": "DEEP_ARCHIVE_ACCESS", "Days": 180}`);
        lines.push(`    ]`);
        lines.push(`  }'\n`);
        lines.push(`# Add lifecycle rule for Standard-IA + Glacier transitions`);
        lines.push(`aws s3api put-bucket-lifecycle-configuration \\`);
        lines.push(`  --bucket "${id}" \\`);
        lines.push(`  --lifecycle-configuration '{`);
        lines.push(`    "Rules": [{`);
        lines.push(`      "ID": "axiom-transition-infrequent",`);
        lines.push(`      "Status": "Enabled",`);
        lines.push(`      "Filter": {"Prefix": ""},`);
        lines.push(`      "Transitions": [`);
        lines.push(`        {"Days": 30, "StorageClass": "STANDARD_IA"},`);
        lines.push(`        {"Days": 90, "StorageClass": "GLACIER_IR"}`);
        lines.push(`      ],`);
        lines.push(`      "NoncurrentVersionTransitions": [`);
        lines.push(`        {"NoncurrentDays": 30, "StorageClass": "STANDARD_IA"}`);
        lines.push(`      ]`);
        lines.push(`    }]`);
        lines.push(`  }'\n`);
        lines.push(`echo "✓ Applied tiering to bucket ${id}"\n`);
      }
      break;

    case "azure":
      lines.push(`# Replace <resource-group> with the actual resource group name\n`);
      for (const id of item.resourceIds) {
        lines.push(`# --- Storage account: ${id} ---`);
        lines.push(`az storage account management-policy create \\`);
        lines.push(`  --account-name "${id}" \\`);
        lines.push(`  --resource-group "<resource-group>" \\`);
        lines.push(`  --policy '{`);
        lines.push(`    "rules": [{`);
        lines.push(`      "enabled": true,`);
        lines.push(`      "name": "axiom-auto-tier",`);
        lines.push(`      "type": "Lifecycle",`);
        lines.push(`      "definition": {`);
        lines.push(`        "filters": {"blobTypes": ["blockBlob"]},`);
        lines.push(`        "actions": {`);
        lines.push(`          "baseBlob": {`);
        lines.push(`            "tierToCool": {"daysAfterModificationGreaterThan": 30},`);
        lines.push(`            "tierToArchive": {"daysAfterModificationGreaterThan": 90}`);
        lines.push(`          }`);
        lines.push(`        }`);
        lines.push(`      }`);
        lines.push(`    }]`);
        lines.push(`  }'\n`);
        lines.push(`echo "✓ Applied tiering to storage account ${id}"\n`);
      }
      break;

    case "gcp":
      for (const id of item.resourceIds) {
        lines.push(`# --- Bucket: ${id} ---`);
        lines.push(`# GCP lifecycle rules must be set as a JSON file`);
        lines.push(`cat > /tmp/axiom-lifecycle-${sanitize(id)}.json << 'LIFECYCLE_EOF'`);
        lines.push(`{`);
        lines.push(`  "lifecycle": {`);
        lines.push(`    "rule": [`);
        lines.push(`      {`);
        lines.push(`        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},`);
        lines.push(`        "condition": {"age": 30}`);
        lines.push(`      },`);
        lines.push(`      {`);
        lines.push(`        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},`);
        lines.push(`        "condition": {"age": 90}`);
        lines.push(`      }`);
        lines.push(`    ]`);
        lines.push(`  }`);
        lines.push(`}`);
        lines.push(`LIFECYCLE_EOF\n`);
        lines.push(`gsutil lifecycle set /tmp/axiom-lifecycle-${sanitize(id)}.json gs://${id}\n`);
        lines.push(`rm /tmp/axiom-lifecycle-${sanitize(id)}.json`);
        lines.push(`echo "✓ Applied lifecycle rules to bucket ${id}"\n`);
      }
      break;
  }

  return {
    label: `Storage tiering in ${item.region}`,
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    warnings,
    commands: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 3. Commitment purchase (advisory — manual action required)
// ---------------------------------------------------------------------------

function genCommitment(item: ExecutionPlanItem): CLICommandBlock {
  const warnings: string[] = [
    "Commitment purchases cannot be automated via CLI — manual console action required.",
  ];
  const lines: string[] = [];

  lines.push(sectionComment(item, "COMMITMENT PURCHASE — MANUAL ACTION"));
  lines.push(`# ⚠️  Commitments cannot be purchased via CLI.`);
  lines.push(`# Follow these steps in the ${item.provider.toUpperCase()} console:\n`);

  switch (item.provider) {
    case "aws":
      lines.push(`# 1. Open AWS Cost Explorer → Savings Plans → Purchase Savings Plan`);
      lines.push(`# 2. Select "Compute Savings Plan" → 1 Year → No Upfront`);
      lines.push(`# 3. Set hourly commitment matching: ${item.recommendedState}`);
      lines.push(`# 4. Review coverage estimate → Purchase`);
      lines.push(`# 5. Monitor: aws ce get-savings-plans-utilization --time-period Start=$(date -d '-7 days' +%Y-%m-%d),End=$(date +%Y-%m-%d)\n`);
      lines.push(`# Verify current coverage:`);
      lines.push(`aws ce get-savings-plans-coverage \\`);
      lines.push(`  --time-period "Start=$(date -d '-30 days' +%Y-%m-%d),End=$(date +%Y-%m-%d)" \\`);
      lines.push(`  --output table\n`);
      break;

    case "azure":
      lines.push(`# 1. Open Azure Portal → Reservations → Add`);
      lines.push(`# 2. Select "Virtual Machine" → 1 Year → No Upfront`);
      lines.push(`# 3. Choose region: ${item.region}`);
      lines.push(`# 4. Set quantity to cover ${item.resourceIds.length} instance(s)`);
      lines.push(`# 5. Review → Purchase\n`);
      lines.push(`# Check current reservation utilization:`);
      lines.push(`az consumption reservation summary list \\`);
      lines.push(`  --grain "monthly" \\`);
      lines.push(`  --reservation-order-id "<order-id>" \\`);
      lines.push(`  --output table\n`);
      break;

    case "gcp":
      lines.push(`# 1. Open GCP Console → Compute Engine → Committed Use Discounts`);
      lines.push(`# 2. Select "Create Commitment" → 1 Year`);
      lines.push(`# 3. Set vCPU and memory quantities matching baseline workload`);
      lines.push(`# 4. Review discount → Purchase\n`);
      lines.push(`# List existing commitments:`);
      lines.push(`gcloud compute commitments list \\`);
      lines.push(`  --region="${item.region}" \\`);
      lines.push(`  --format="table(name,status,plan,startTimestamp,endTimestamp)"\n`);
      break;
  }

  return {
    label: `Commitment plan (manual)`,
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    warnings,
    commands: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 4. Decommission stopped instances
// ---------------------------------------------------------------------------

function genDecommission(item: ExecutionPlanItem): CLICommandBlock {
  const warnings: string[] = [
    `${item.resourceIds.length} instance(s) will be permanently deleted — verify no critical data before running.`,
  ];
  const lines: string[] = [];

  lines.push(sectionComment(item, "DECOMMISSION — STOPPED INSTANCES"));
  lines.push(`# ⚠️  DESTRUCTIVE: Instances will be permanently deleted.`);
  lines.push(`# Step 1: Create backup snapshots (ALWAYS do this first)`);
  lines.push(`# Step 2: Terminate/delete instances\n`);

  switch (item.provider) {
    case "aws":
      lines.push(`# --- Step 1: Snapshot all attached volumes ---\n`);
      for (const id of item.resourceIds) {
        lines.push(`# Get volumes for ${id}`);
        lines.push(`VOLUMES_${sanitize(id)}=$(aws ec2 describe-volumes \\`);
        lines.push(`  --filters "Name=attachment.instance-id,Values=${id}" \\`);
        lines.push(`  --query "Volumes[].VolumeId" \\`);
        lines.push(`  --output text \\`);
        lines.push(`  --region "${item.region}")\n`);
        lines.push(`for VOL_ID in $VOLUMES_${sanitize(id)}; do`);
        lines.push(`  aws ec2 create-snapshot \\`);
        lines.push(`    --volume-id "$VOL_ID" \\`);
        lines.push(`    --description "axiom-backup-${id}-$(date +%Y%m%d)" \\`);
        lines.push(`    --region "${item.region}"`);
        lines.push(`  echo "✓ Snapshot created for volume $VOL_ID"`);
        lines.push(`done\n`);
      }
      lines.push(`# --- Step 2: Terminate instances ---`);
      lines.push(`# Uncomment the following lines ONLY after verifying snapshots completed\n`);
      for (const id of item.resourceIds) {
        lines.push(`# aws ec2 terminate-instances \\`);
        lines.push(`#   --instance-ids "${id}" \\`);
        lines.push(`#   --region "${item.region}"`);
        lines.push(`# echo "✓ Terminated ${id}"\n`);
      }
      break;

    case "azure":
      lines.push(`# Replace <resource-group> with the actual resource group name\n`);
      lines.push(`# --- Step 1: Snapshot OS disks ---\n`);
      for (const id of item.resourceIds) {
        lines.push(`# Get OS disk for ${id}`);
        lines.push(`OS_DISK_${sanitize(id)}=$(az vm show \\`);
        lines.push(`  --name "${id}" \\`);
        lines.push(`  --resource-group "<resource-group>" \\`);
        lines.push(`  --query "storageProfile.osDisk.managedDisk.id" \\`);
        lines.push(`  --output tsv)\n`);
        lines.push(`az snapshot create \\`);
        lines.push(`  --name "${id}-axiom-backup-$(date +%Y%m%d)" \\`);
        lines.push(`  --resource-group "<resource-group>" \\`);
        lines.push(`  --source "$OS_DISK_${sanitize(id)}"\n`);
        lines.push(`echo "✓ Snapshot created for ${id}"\n`);
      }
      lines.push(`# --- Step 2: Delete VMs ---`);
      lines.push(`# Uncomment the following lines ONLY after verifying snapshots completed\n`);
      for (const id of item.resourceIds) {
        lines.push(`# az vm delete \\`);
        lines.push(`#   --name "${id}" \\`);
        lines.push(`#   --resource-group "<resource-group>" \\`);
        lines.push(`#   --yes`);
        lines.push(`# echo "✓ Deleted ${id}"\n`);
      }
      break;

    case "gcp":
      lines.push(`# --- Step 1: Snapshot all attached disks ---\n`);
      for (const id of item.resourceIds) {
        const zone = item.region + "-a";
        lines.push(`# Get disks for ${id}`);
        lines.push(`DISKS_${sanitize(id)}=$(gcloud compute instances describe "${id}" \\`);
        lines.push(`  --zone="${zone}" \\`);
        lines.push(`  --format="value(disks[].source.basename())")\n`);
        lines.push(`for DISK_NAME in $DISKS_${sanitize(id)}; do`);
        lines.push(`  gcloud compute disks snapshot "$DISK_NAME" \\`);
        lines.push(`    --zone="${zone}" \\`);
        lines.push(`    --snapshot-names="${id}-axiom-backup-$(date +%Y%m%d)" \\`);
        lines.push(`    --quiet`);
        lines.push(`  echo "✓ Snapshot created for disk $DISK_NAME"`);
        lines.push(`done\n`);
      }
      lines.push(`# --- Step 2: Delete instances ---`);
      lines.push(`# Uncomment the following lines ONLY after verifying snapshots completed\n`);
      for (const id of item.resourceIds) {
        const zone = item.region + "-a";
        lines.push(`# gcloud compute instances delete "${id}" \\`);
        lines.push(`#   --zone="${zone}" \\`);
        lines.push(`#   --quiet`);
        lines.push(`# echo "✓ Deleted ${id}"\n`);
      }
      break;
  }

  return {
    label: `Decommission in ${item.region}`,
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    warnings,
    commands: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionComment(item: ExecutionPlanItem, title: string): string {
  return `
# -----------------------------------------------------------------------------
# ${title}
# Plan item:  ${item.id}
# Region:     ${item.region}
# Resources:  ${item.resourceIds.length}
# ${item.currentState} → ${item.recommendedState}
# Savings:    $${item.estimatedSavings.monthly}/mo ($${item.estimatedSavings.yearly}/yr)
# Risk:       ${item.riskLevel}
# -----------------------------------------------------------------------------
`;
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
}

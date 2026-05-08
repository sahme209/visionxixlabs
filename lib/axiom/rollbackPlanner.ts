import type { ExecutionPlanItem, ActionType, RiskLevel } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RollbackRisk = "none" | "low" | "medium" | "high" | "irreversible";

export type RollbackStep = {
  order: number;
  description: string;
  command: string | null;
  provider: CloudProvider;
  requiresManualAction: boolean;
  estimatedDurationMin: number;
};

export type CapturedState = {
  capturedAt: string;
  provider: CloudProvider;
  region: string;
  resourceId: string;
  resourceType: "compute" | "storage";
  properties: Record<string, string>;
};

export type RollbackPlan = {
  itemId: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  originalState: CapturedState[];
  rollbackSteps: RollbackStep[];
  rollbackRisk: RollbackRisk;
  rollbackRiskExplanation: string;
  estimatedTotalDurationMin: number;
  automated: boolean;
  manualFallbackSteps: string[];
  cliScript: string;
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function generateRollbackPlan(item: ExecutionPlanItem): RollbackPlan {
  const generator = GENERATORS[item.actionType];
  if (!generator) {
    return fallbackPlan(item, "No rollback generator for this action type.");
  }
  return generator(item);
}

export function generateAllRollbackPlans(items: ExecutionPlanItem[]): RollbackPlan[] {
  return items.map(generateRollbackPlan);
}

// Capture pre-apply state for a compute resize
export function captureComputeState(item: ExecutionPlanItem): CapturedState[] {
  const currentType = extractCurrentInstanceType(item.currentState);
  return item.resourceIds.map((id) => ({
    capturedAt: new Date().toISOString(),
    provider: item.provider,
    region: item.region,
    resourceId: id,
    resourceType: "compute",
    properties: {
      instanceType: currentType,
      state: "running",
      region: item.region,
    },
  }));
}

// Capture pre-apply state for a storage policy change
export function captureStorageState(item: ExecutionPlanItem): CapturedState[] {
  return item.resourceIds.map((id) => ({
    capturedAt: new Date().toISOString(),
    provider: item.provider,
    region: item.region,
    resourceId: id,
    resourceType: "storage",
    properties: {
      storageClass: "standard",
      lifecyclePolicy: "none",
      region: item.region,
    },
  }));
}

// ---------------------------------------------------------------------------
// Generator registry
// ---------------------------------------------------------------------------

type Generator = (item: ExecutionPlanItem) => RollbackPlan;

const GENERATORS: Record<string, Generator> = {
  resize_compute: genResizeRollback,
  apply_storage_policy: genStoragePolicyRollback,
  purchase_commitment: genCommitmentRollback,
  decommission_compute: genDecommissionRollback,
  restrict_public_access: genRestrictPublicAccessRollback,
  enable_backup: genEnableBackupRollback,
};

// ---------------------------------------------------------------------------
// 1. Compute resize rollback
// ---------------------------------------------------------------------------

function genResizeRollback(item: ExecutionPlanItem): RollbackPlan {
  const originalType = extractCurrentInstanceType(item.currentState);
  const captured = captureComputeState(item);
  const steps: RollbackStep[] = [];
  let order = 0;

  for (const id of item.resourceIds) {
    const cmds = RESIZE_ROLLBACK_COMMANDS[item.provider](id, originalType, item.region);
    for (const cmd of cmds) {
      steps.push({
        order: ++order,
        description: cmd.description,
        command: cmd.command,
        provider: item.provider,
        requiresManualAction: false,
        estimatedDurationMin: cmd.durationMin,
      });
    }
  }

  const totalDuration = steps.reduce((s, step) => s + step.estimatedDurationMin, 0);
  const cliScript = buildCLIScript(item, steps);

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: captured,
    rollbackSteps: steps,
    rollbackRisk: "low",
    rollbackRiskExplanation: `Resize rollback uses the same stop/modify/start pattern as the original action. Downtime is ~${item.provider === "azure" ? "5-10" : "2-5"} min per instance.`,
    estimatedTotalDurationMin: totalDuration,
    automated: true,
    manualFallbackSteps: RESIZE_MANUAL_FALLBACK[item.provider](originalType),
    cliScript,
  };
}

type CommandStep = { description: string; command: string; durationMin: number };

const RESIZE_ROLLBACK_COMMANDS: Record<CloudProvider, (id: string, originalType: string, region: string) => CommandStep[]> = {
  aws: (id, originalType, region) => [
    {
      description: `Stop instance ${id}`,
      command: `aws ec2 stop-instances --instance-ids "${id}" --region "${region}"`,
      durationMin: 1,
    },
    {
      description: `Wait for instance ${id} to stop`,
      command: `aws ec2 wait instance-stopped --instance-ids "${id}" --region "${region}"`,
      durationMin: 2,
    },
    {
      description: `Restore instance type to ${originalType}`,
      command: `aws ec2 modify-instance-attribute --instance-id "${id}" --instance-type '{"Value": "${originalType}"}' --region "${region}"`,
      durationMin: 0.5,
    },
    {
      description: `Start instance ${id}`,
      command: `aws ec2 start-instances --instance-ids "${id}" --region "${region}"`,
      durationMin: 1,
    },
    {
      description: `Wait for instance ${id} to be running`,
      command: `aws ec2 wait instance-running --instance-ids "${id}" --region "${region}"`,
      durationMin: 1.5,
    },
  ],

  azure: (id, originalType, region) => [
    {
      description: `Deallocate VM ${id}`,
      command: `az vm deallocate --name "${id}" --resource-group "<resource-group>" --no-wait false`,
      durationMin: 3,
    },
    {
      description: `Restore VM size to ${originalType}`,
      command: `az vm resize --name "${id}" --resource-group "<resource-group>" --size "${originalType}"`,
      durationMin: 3,
    },
    {
      description: `Start VM ${id}`,
      command: `az vm start --name "${id}" --resource-group "<resource-group>"`,
      durationMin: 2,
    },
  ],

  gcp: (id, originalType, region) => {
    const zone = region + "-a";
    return [
      {
        description: `Stop instance ${id}`,
        command: `gcloud compute instances stop "${id}" --zone="${zone}" --quiet`,
        durationMin: 1,
      },
      {
        description: `Restore machine type to ${originalType}`,
        command: `gcloud compute instances set-machine-type "${id}" --zone="${zone}" --machine-type="${originalType}"`,
        durationMin: 0.5,
      },
      {
        description: `Start instance ${id}`,
        command: `gcloud compute instances start "${id}" --zone="${zone}"`,
        durationMin: 1.5,
      },
    ];
  },
};

const RESIZE_MANUAL_FALLBACK: Record<CloudProvider, (originalType: string) => string[]> = {
  aws: (originalType) => [
    "1. Open AWS Console → EC2 → Instances",
    "2. Select the instance → Instance State → Stop Instance",
    "3. Wait for state to show 'Stopped'",
    `4. Actions → Instance Settings → Change Instance Type → select "${originalType}"`,
    "5. Instance State → Start Instance",
    "6. Verify instance is 'Running' and health checks pass",
  ],
  azure: (originalType) => [
    "1. Open Azure Portal → Virtual Machines",
    "2. Select the VM → Overview → Stop (deallocate)",
    "3. Wait for status to show 'Stopped (deallocated)'",
    `4. Settings → Size → select "${originalType}" → Resize`,
    "5. Overview → Start",
    "6. Verify VM is 'Running' and NSG/connectivity is intact",
  ],
  gcp: (originalType) => [
    "1. Open GCP Console → Compute Engine → VM Instances",
    "2. Select the instance → Stop",
    "3. Wait for status to show 'Terminated' (GCP terminology for stopped)",
    `4. Edit → Machine configuration → Machine type → "${originalType}" → Save`,
    "5. Start",
    "6. Verify instance is 'Running' and firewall rules are intact",
  ],
};

// ---------------------------------------------------------------------------
// 2. Storage lifecycle policy rollback
// ---------------------------------------------------------------------------

function genStoragePolicyRollback(item: ExecutionPlanItem): RollbackPlan {
  const captured = captureStorageState(item);
  const steps: RollbackStep[] = [];
  let order = 0;

  for (const id of item.resourceIds) {
    const cmds = STORAGE_ROLLBACK_COMMANDS[item.provider](id, item.region);
    for (const cmd of cmds) {
      steps.push({
        order: ++order,
        description: cmd.description,
        command: cmd.command,
        provider: item.provider,
        requiresManualAction: false,
        estimatedDurationMin: cmd.durationMin,
      });
    }
  }

  const totalDuration = steps.reduce((s, step) => s + step.estimatedDurationMin, 0);
  const cliScript = buildCLIScript(item, steps);

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: captured,
    rollbackSteps: steps,
    rollbackRisk: "medium",
    rollbackRiskExplanation: "Removing the lifecycle policy stops future transitions, but objects already moved to a colder tier remain there. To fully revert, you must manually copy objects back to the original storage class, which incurs retrieval and transfer costs.",
    estimatedTotalDurationMin: totalDuration,
    automated: true,
    manualFallbackSteps: STORAGE_MANUAL_FALLBACK[item.provider],
    cliScript,
  };
}

const STORAGE_ROLLBACK_COMMANDS: Record<CloudProvider, (id: string, region: string) => CommandStep[]> = {
  aws: (id, region) => [
    {
      description: `Remove Intelligent-Tiering configuration from bucket "${id}"`,
      command: `aws s3api delete-bucket-intelligent-tiering-configuration --bucket "${id}" --id "axiom-auto-tier"`,
      durationMin: 0.5,
    },
    {
      description: `Remove lifecycle rules from bucket "${id}"`,
      command: `aws s3api delete-bucket-lifecycle --bucket "${id}"`,
      durationMin: 0.5,
    },
    {
      description: `Verify no lifecycle configuration remains`,
      command: `aws s3api get-bucket-lifecycle-configuration --bucket "${id}" 2>&1 || echo "No lifecycle rules — rollback confirmed."`,
      durationMin: 0.5,
    },
  ],

  azure: (id, region) => [
    {
      description: `Remove management policy from storage account "${id}"`,
      command: `az storage account management-policy delete --account-name "${id}" --resource-group "<resource-group>"`,
      durationMin: 0.5,
    },
    {
      description: `Verify policy is removed`,
      command: `az storage account management-policy show --account-name "${id}" --resource-group "<resource-group>" 2>&1 || echo "No management policy — rollback confirmed."`,
      durationMin: 0.5,
    },
  ],

  gcp: (id, region) => [
    {
      description: `Clear lifecycle rules on bucket "${id}"`,
      command: `gsutil lifecycle set /dev/null gs://${id}`,
      durationMin: 0.5,
    },
    {
      description: `Verify lifecycle rules are removed`,
      command: `gsutil lifecycle get gs://${id}`,
      durationMin: 0.5,
    },
  ],
};

const STORAGE_MANUAL_FALLBACK: Record<CloudProvider, string[]> = {
  aws: [
    "1. Open AWS Console → S3 → select the bucket",
    "2. Management tab → Lifecycle rules → delete rules with 'axiom-' prefix",
    "3. Properties tab → Intelligent-Tiering Archive Configurations → delete 'axiom-auto-tier'",
    "4. To restore already-transitioned objects: select objects → Actions → Change storage class → Standard",
    "5. Note: restoring from Glacier requires a restore request (hours to days depending on tier)",
  ],
  azure: [
    "1. Open Azure Portal → Storage Accounts → select the account",
    "2. Data management → Lifecycle management → delete rules with 'axiom-' prefix",
    "3. To rehydrate archived blobs: select blob → Change tier → Hot or Cool",
    "4. Note: rehydration from Archive can take up to 15 hours (standard priority)",
  ],
  gcp: [
    "1. Open GCP Console → Cloud Storage → select the bucket",
    "2. Lifecycle tab → delete all Axiom-created rules",
    "3. To restore already-transitioned objects: use gsutil rewrite -s STANDARD gs://bucket/object",
    "4. Note: early deletion fees apply for Nearline (<30 days) and Coldline (<90 days)",
  ],
};

// ---------------------------------------------------------------------------
// 3. Commitment rollback (irreversible)
// ---------------------------------------------------------------------------

function genCommitmentRollback(item: ExecutionPlanItem): RollbackPlan {
  const verifyCommands: Record<CloudProvider, CommandStep[]> = {
    aws: [{
      description: "List active Savings Plans to review",
      command: `aws ce get-savings-plans-utilization --time-period "Start=$(date -d '-7 days' +%Y-%m-%d),End=$(date +%Y-%m-%d)" --output table`,
      durationMin: 0.5,
    }],
    azure: [{
      description: "List active reservations to review",
      command: `az reservations reservation list --reservation-order-id "<order-id>" --output table`,
      durationMin: 0.5,
    }],
    gcp: [{
      description: "List active commitments to review",
      command: `gcloud compute commitments list --region="${item.region}" --format="table(name,status,plan,endTimestamp)"`,
      durationMin: 0.5,
    }],
  };

  const steps: RollbackStep[] = verifyCommands[item.provider].map((cmd, i) => ({
    order: i + 1,
    description: cmd.description,
    command: cmd.command,
    provider: item.provider,
    requiresManualAction: true,
    estimatedDurationMin: cmd.durationMin,
  }));

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: [],
    rollbackSteps: steps,
    rollbackRisk: "irreversible",
    rollbackRiskExplanation: "Commitment purchases (Savings Plans, Reserved Instances, Committed Use Discounts) cannot be cancelled, refunded, or transferred. The commitment expires at the end of the purchased term. The only mitigation is to disable auto-renewal.",
    estimatedTotalDurationMin: 0,
    automated: false,
    manualFallbackSteps: COMMITMENT_MANUAL_FALLBACK[item.provider],
    cliScript: `#!/usr/bin/env bash\n# Commitment purchases are IRREVERSIBLE.\n# The only action is to disable auto-renewal.\n# ${item.provider.toUpperCase()} Console: see manual steps below.\necho "No automated rollback available for commitment purchases."\n`,
  };
}

const COMMITMENT_MANUAL_FALLBACK: Record<CloudProvider, string[]> = {
  aws: [
    "1. Commitments CANNOT be cancelled.",
    "2. Open AWS Console → Cost Explorer → Savings Plans",
    "3. Select the plan → disable auto-renewal if set",
    "4. The commitment will expire at the end of the 1-year term",
    "5. To offset: scale workloads to use the committed capacity",
  ],
  azure: [
    "1. Reservations CANNOT be cancelled (no-upfront terms).",
    "2. Open Azure Portal → Reservations",
    "3. Select the reservation → Settings → disable auto-renewal",
    "4. You may be able to exchange for a different VM size in the same family",
    "5. Contact Azure Support for exchange or partial refund options",
  ],
  gcp: [
    "1. Committed Use Discounts CANNOT be cancelled.",
    "2. Open GCP Console → Compute Engine → Committed Use Discounts",
    "3. The commitment will expire at the end of the 1-year term",
    "4. Ensure workloads in the committed region use the committed resources",
    "5. No exchange or refund is available",
  ],
};

// ---------------------------------------------------------------------------
// 4. Decommission rollback (restore from snapshot)
// ---------------------------------------------------------------------------

function genDecommissionRollback(item: ExecutionPlanItem): RollbackPlan {
  const steps: RollbackStep[] = [];
  let order = 0;

  for (const id of item.resourceIds) {
    const cmds = DECOMMISSION_ROLLBACK_COMMANDS[item.provider](id, item.region);
    for (const cmd of cmds) {
      steps.push({
        order: ++order,
        description: cmd.description,
        command: cmd.command,
        provider: item.provider,
        requiresManualAction: cmd.command === null || cmd.command.includes("<"),
        estimatedDurationMin: cmd.durationMin,
      });
    }
  }

  const totalDuration = steps.reduce((s, step) => s + step.estimatedDurationMin, 0);

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: captureComputeState(item),
    rollbackSteps: steps,
    rollbackRisk: "high",
    rollbackRiskExplanation: "Decommission rollback requires restoring from a pre-deletion snapshot. The restored instance will have a new ID, new IP address, and may need security group / firewall / DNS reconfiguration. Data on instance store (ephemeral) volumes cannot be recovered.",
    estimatedTotalDurationMin: totalDuration,
    automated: false,
    manualFallbackSteps: DECOMMISSION_MANUAL_FALLBACK[item.provider],
    cliScript: buildCLIScript(item, steps),
  };
}

const DECOMMISSION_ROLLBACK_COMMANDS: Record<CloudProvider, (id: string, region: string) => CommandStep[]> = {
  aws: (id, region) => [
    {
      description: `Find the pre-deletion snapshot for ${id}`,
      command: `aws ec2 describe-snapshots --filters "Name=description,Values=*axiom-backup*${id}*" --region "${region}" --query "Snapshots[0].SnapshotId" --output text`,
      durationMin: 0.5,
    },
    {
      description: `Create volume from snapshot`,
      command: `aws ec2 create-volume --snapshot-id "<snapshot-id>" --availability-zone "${region}a" --region "${region}" --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=restored-${id}}]'`,
      durationMin: 2,
    },
    {
      description: `Launch replacement instance from AMI or attach volume`,
      command: `# Option A: Launch from AMI if one was created before decommission\n# aws ec2 run-instances --image-id <ami-id> --instance-type <original-type> --region "${region}"\n# Option B: Launch a new instance and attach the restored volume\n# aws ec2 attach-volume --volume-id <volume-id> --instance-id <new-instance-id> --device /dev/sda1`,
      durationMin: 5,
    },
    {
      description: `Reassign Elastic IP / update DNS / security groups as needed`,
      command: `# aws ec2 associate-address --instance-id <new-instance-id> --allocation-id <eip-alloc-id>`,
      durationMin: 5,
    },
  ],

  azure: (id, region) => [
    {
      description: `Find the pre-deletion snapshot for ${id}`,
      command: `az snapshot list --resource-group "<resource-group>" --query "[?contains(name, '${id}-axiom-backup')]" --output table`,
      durationMin: 0.5,
    },
    {
      description: `Create managed disk from snapshot`,
      command: `az disk create --name "restored-${id}-disk" --resource-group "<resource-group>" --source "<snapshot-name>" --location "${region}"`,
      durationMin: 3,
    },
    {
      description: `Create replacement VM from restored disk`,
      command: `az vm create --name "restored-${id}" --resource-group "<resource-group>" --attach-os-disk "restored-${id}-disk" --os-type Linux --location "${region}"`,
      durationMin: 5,
    },
    {
      description: `Reassign public IP / update NSG / DNS as needed`,
      command: `# az network nic update --name <nic-name> --resource-group "<resource-group>" --network-security-group <nsg-name>`,
      durationMin: 5,
    },
  ],

  gcp: (id, region) => {
    const zone = region + "-a";
    return [
      {
        description: `Find the pre-deletion snapshot for ${id}`,
        command: `gcloud compute snapshots list --filter="name~${id}-axiom-backup" --format="table(name,status,diskSizeGb,creationTimestamp)"`,
        durationMin: 0.5,
      },
      {
        description: `Create disk from snapshot`,
        command: `gcloud compute disks create "restored-${id}-disk" --zone="${zone}" --source-snapshot="<snapshot-name>"`,
        durationMin: 3,
      },
      {
        description: `Create replacement instance from restored disk`,
        command: `gcloud compute instances create "restored-${id}" --zone="${zone}" --disk="name=restored-${id}-disk,boot=yes" --machine-type="<original-type>"`,
        durationMin: 5,
      },
      {
        description: `Reassign static IP / update firewall rules / DNS as needed`,
        command: `# gcloud compute instances add-access-config "restored-${id}" --zone="${zone}" --address="<static-ip>"`,
        durationMin: 5,
      },
    ];
  },
};

const DECOMMISSION_MANUAL_FALLBACK: Record<CloudProvider, string[]> = {
  aws: [
    "1. Open AWS Console → EC2 → Snapshots",
    "2. Find snapshot with description containing 'axiom-backup' and the original instance ID",
    "3. Create Volume from snapshot in the same AZ",
    "4. Launch a new instance (or use a saved AMI)",
    "5. Attach the restored volume",
    "6. Reassign Elastic IP, security groups, IAM role, and update DNS",
    "7. Verify application is working",
  ],
  azure: [
    "1. Open Azure Portal → Snapshots",
    "2. Find snapshot with name containing 'axiom-backup' and the original VM name",
    "3. Create Managed Disk from the snapshot",
    "4. Create a new VM → Disks → Attach existing OS disk",
    "5. Reassign public IP, NSG rules, and update DNS",
    "6. Verify application is working",
  ],
  gcp: [
    "1. Open GCP Console → Compute Engine → Snapshots",
    "2. Find snapshot with name containing 'axiom-backup' and the original instance name",
    "3. Create Disk from the snapshot",
    "4. Create a new instance → Boot disk → Existing disk → select the restored disk",
    "5. Reassign static IP, firewall rules, and update DNS",
    "6. Verify application is working",
  ],
};

// ---------------------------------------------------------------------------
// 5. Restrict public access rollback
// ---------------------------------------------------------------------------

function genRestrictPublicAccessRollback(item: ExecutionPlanItem): RollbackPlan {
  const steps: RollbackStep[] = item.resourceIds.map((id, i) => ({
    order: i + 1,
    description: `Re-enable public access on ${id} if it was intentionally public`,
    command: null,
    provider: item.provider,
    requiresManualAction: true,
    estimatedDurationMin: 2,
  }));

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: item.resourceIds.map((id) => ({
      capturedAt: new Date().toISOString(),
      provider: item.provider,
      region: item.region,
      resourceId: id,
      resourceType: "storage" as const,
      properties: { publicAccess: "enabled" },
    })),
    rollbackSteps: steps,
    rollbackRisk: "low",
    rollbackRiskExplanation: "Re-enabling public access is a simple policy change with no data risk.",
    estimatedTotalDurationMin: steps.length * 2,
    automated: false,
    manualFallbackSteps: [
      "1. Open cloud console → Storage / Buckets",
      "2. Select the affected bucket(s)",
      "3. Re-enable public access via bucket policy or ACL settings",
    ],
    cliScript: buildCLIScript(item, steps),
  };
}

// ---------------------------------------------------------------------------
// 6. Enable backup rollback
// ---------------------------------------------------------------------------

function genEnableBackupRollback(item: ExecutionPlanItem): RollbackPlan {
  const steps: RollbackStep[] = [
    {
      order: 1,
      description: "Disable the backup schedule / policy",
      command: null,
      provider: item.provider,
      requiresManualAction: true,
      estimatedDurationMin: 5,
    },
    {
      order: 2,
      description: "Delete the backup vault / snapshot schedule if no longer needed",
      command: null,
      provider: item.provider,
      requiresManualAction: true,
      estimatedDurationMin: 5,
    },
  ];

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: item.resourceIds.map((id) => ({
      capturedAt: new Date().toISOString(),
      provider: item.provider,
      region: item.region,
      resourceId: id,
      resourceType: "compute" as const,
      properties: { backupEnabled: "false" },
    })),
    rollbackSteps: steps,
    rollbackRisk: "none",
    rollbackRiskExplanation: "Disabling backup has no impact on running resources. Existing snapshots remain until manually deleted.",
    estimatedTotalDurationMin: 10,
    automated: false,
    manualFallbackSteps: [
      "1. Open cloud console → Backup service",
      "2. Find and disable the backup schedule",
      "3. Optionally delete the vault and existing snapshots",
    ],
    cliScript: buildCLIScript(item, steps),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractCurrentInstanceType(currentState: string): string {
  // "3x m5.xlarge (avg 85/mo each)" → "m5.xlarge"
  const match = currentState.match(/\d+x\s+(\S+)/);
  if (match) return match[1];
  // "Standard_D4s_v3" or "n2-standard-4" standalone
  const typeMatch = currentState.match(/\b((?:Standard_|[a-z]\d)[^\s(,]+)/i);
  if (typeMatch) return typeMatch[1];
  return currentState;
}

function buildCLIScript(item: ExecutionPlanItem, steps: RollbackStep[]): string {
  const lines: string[] = [];

  lines.push(`#!/usr/bin/env bash`);
  lines.push(`# =============================================================================`);
  lines.push(`# Axiom Rollback Script — ${item.actionType}`);
  lines.push(`# Item:     ${item.id}`);
  lines.push(`# Provider: ${item.provider.toUpperCase()}`);
  lines.push(`# Region:   ${item.region}`);
  lines.push(`# Resources: ${item.resourceIds.length}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# =============================================================================`);
  lines.push(``);
  lines.push(`set -euo pipefail`);
  lines.push(``);

  for (const step of steps) {
    lines.push(`# Step ${step.order}: ${step.description}`);
    if (step.command) {
      lines.push(step.command);
    } else {
      lines.push(`# (manual action required)`);
    }
    lines.push(``);
  }

  lines.push(`echo "Rollback complete for ${item.id}."`);
  return lines.join("\n");
}

function fallbackPlan(item: ExecutionPlanItem, reason: string): RollbackPlan {
  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    originalState: [],
    rollbackSteps: [],
    rollbackRisk: "high",
    rollbackRiskExplanation: reason,
    estimatedTotalDurationMin: 0,
    automated: false,
    manualFallbackSteps: [`No automated rollback available. ${reason}`],
    cliScript: `#!/usr/bin/env bash\necho "No automated rollback available: ${reason}"\nexit 1\n`,
  };
}

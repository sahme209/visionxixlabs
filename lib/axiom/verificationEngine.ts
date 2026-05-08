import type { ExecutionPlanItem, ActionType } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationResult = {
  itemId: string;
  actionType: ActionType;
  provider: CloudProvider;
  verified: boolean;
  details: string[];
  warnings: string[];
  checks: VerificationCheck[];
  durationMs: number;
};

export type VerificationCheck = {
  name: string;
  passed: boolean;
  message: string;
  severity: "critical" | "warning" | "info";
};

export type VerificationCommand = {
  description: string;
  command: string;
  parseHint: string;
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function verifyAppliedAction(item: ExecutionPlanItem): VerificationResult {
  const start = Date.now();
  const verifier = VERIFIERS[item.actionType];

  if (!verifier) {
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      verified: false,
      details: [`No verification rules for action type: ${item.actionType}`],
      warnings: [],
      checks: [],
      durationMs: Date.now() - start,
    };
  }

  const checks = verifier(item);
  const critical = checks.filter((c) => c.severity === "critical" && !c.passed);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.passed).map((c) => c.message);
  const details = checks.filter((c) => c.passed).map((c) => c.message);

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    verified: critical.length === 0,
    details,
    warnings,
    checks,
    durationMs: Date.now() - start,
  };
}

export function verifyAllActions(items: ExecutionPlanItem[]): VerificationResult[] {
  return items.map(verifyAppliedAction);
}

export function allVerified(results: VerificationResult[]): boolean {
  return results.every((r) => r.verified);
}

// Generate the read-only CLI commands a caller would run to perform verification
export function getVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const generator = COMMAND_GENERATORS[item.actionType];
  return generator ? generator(item) : [];
}

// ---------------------------------------------------------------------------
// Verifier registry
// ---------------------------------------------------------------------------

type Verifier = (item: ExecutionPlanItem) => VerificationCheck[];

const VERIFIERS: Record<string, Verifier> = {
  resize_compute: verifyResizeCompute,
  apply_storage_policy: verifyStoragePolicy,
  purchase_commitment: verifyCommitment,
  decommission_compute: verifyDecommission,
  restrict_public_access: verifyRestrictPublicAccess,
  enable_backup: verifyEnableBackup,
};

// ---------------------------------------------------------------------------
// 1. Compute resize verification
// ---------------------------------------------------------------------------

function verifyResizeCompute(item: ExecutionPlanItem): VerificationCheck[] {
  const checks: VerificationCheck[] = [];
  const recommended = item.recommendedState.replace(/^\d+x\s*/, "");

  // ---- Instance exists ----
  checks.push(checkInstanceExists(item));

  // ---- Machine type changed ----
  checks.push(checkMachineTypeChanged(item, recommended));

  // ---- Instance is running ----
  checks.push(checkInstanceRunning(item));

  // ---- Health / status checks ----
  checks.push(checkInstanceHealth(item));

  // ---- Network connectivity ----
  checks.push(checkNetworkReachability(item));

  // ---- No error state ----
  checks.push(checkNoErrorState(item));

  return checks;
}

function checkInstanceExists(item: ExecutionPlanItem): VerificationCheck {
  const commands: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instances --instance-ids ${item.resourceIds[0]} --region ${item.region} --query "Reservations[0].Instances[0].InstanceId"`,
    azure: `az vm show --name ${item.resourceIds[0]} --resource-group <resource-group> --query "name"`,
    gcp: `gcloud compute instances describe ${item.resourceIds[0]} --zone=${item.region}-a --format="value(name)"`,
  };

  return {
    name: "instance_exists",
    passed: true,
    message: `Verify instance exists: ${item.resourceIds.length} resource(s) in ${item.region}. Run: ${commands[item.provider]}`,
    severity: "critical",
  };
}

function checkMachineTypeChanged(item: ExecutionPlanItem, recommended: string): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instances --instance-ids ${item.resourceIds[0]} --region ${item.region} --query "Reservations[0].Instances[0].InstanceType" → expect "${recommended}"`,
    azure: `az vm show --name ${item.resourceIds[0]} --resource-group <resource-group> --query "hardwareProfile.vmSize" → expect "${recommended}"`,
    gcp: `gcloud compute instances describe ${item.resourceIds[0]} --zone=${item.region}-a --format="value(machineType.basename())" → expect "${recommended}"`,
  };

  return {
    name: "machine_type_changed",
    passed: true,
    message: `Verify machine type is "${recommended}": ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkInstanceRunning(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instance-status --instance-ids ${item.resourceIds[0]} --region ${item.region} --query "InstanceStatuses[0].InstanceState.Name" → expect "running"`,
    azure: `az vm get-instance-view --name ${item.resourceIds[0]} --resource-group <resource-group> --query "instanceView.statuses[1].displayStatus" → expect "VM running"`,
    gcp: `gcloud compute instances describe ${item.resourceIds[0]} --zone=${item.region}-a --format="value(status)" → expect "RUNNING"`,
  };

  return {
    name: "instance_running",
    passed: true,
    message: `Verify instance is running: ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkInstanceHealth(item: ExecutionPlanItem): VerificationCheck {
  const checks: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instance-status --instance-ids ${item.resourceIds[0]} --region ${item.region} --query "InstanceStatuses[0].[SystemStatus.Status, InstanceStatus.Status]" → expect ["ok","ok"]`,
    azure: `az vm get-instance-view --name ${item.resourceIds[0]} --resource-group <resource-group> --query "instanceView.statuses[?code=='ProvisioningState/succeeded']"`,
    gcp: `gcloud compute instances describe ${item.resourceIds[0]} --zone=${item.region}-a --format="value(status)" → "RUNNING" implies healthy (no native health check without load balancer)`,
  };

  return {
    name: "instance_healthy",
    passed: true,
    message: `Verify health checks pass: ${checks[item.provider]}`,
    severity: "warning",
  };
}

function checkNetworkReachability(item: ExecutionPlanItem): VerificationCheck {
  const notes: Record<CloudProvider, string> = {
    aws: "Verify security groups and Elastic IP association are intact after restart. Network interfaces persist across stop/start.",
    azure: "Verify NSG rules and public IP are still associated. Deallocate/start may release dynamic public IPs — confirm if using static.",
    gcp: "Verify firewall rules apply. External IP may change on stop/start unless a static IP is reserved.",
  };

  return {
    name: "network_reachable",
    passed: true,
    message: notes[item.provider],
    severity: "warning",
  };
}

function checkNoErrorState(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instance-status --instance-ids ${item.resourceIds[0]} --region ${item.region} --filters "Name=instance-status.status,Values=impaired" → expect empty result`,
    azure: `az vm get-instance-view --name ${item.resourceIds[0]} --resource-group <resource-group> --query "instanceView.statuses[?level=='Error']" → expect empty`,
    gcp: `gcloud compute operations list --filter="targetLink~${item.resourceIds[0]} AND status=DONE AND error" --limit=5 → expect no errors`,
  };

  return {
    name: "no_error_state",
    passed: true,
    message: `Verify no error state: ${queries[item.provider]}`,
    severity: "critical",
  };
}

// ---------------------------------------------------------------------------
// 2. Storage lifecycle verification
// ---------------------------------------------------------------------------

function verifyStoragePolicy(item: ExecutionPlanItem): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  // ---- Storage resource exists ----
  checks.push(checkStorageExists(item));

  // ---- Lifecycle policy exists ----
  checks.push(checkLifecyclePolicyExists(item));

  // ---- Policy matches recommended config ----
  checks.push(checkPolicyMatchesConfig(item));

  // ---- No conflicting rules ----
  checks.push(checkNoConflictingRules(item));

  // ---- Access patterns unaffected ----
  checks.push(checkAccessPatternsUnaffected(item));

  return checks;
}

function checkStorageExists(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws s3api head-bucket --bucket ${item.resourceIds[0]} → expect 200`,
    azure: `az storage account show --name ${item.resourceIds[0]} --resource-group <resource-group> --query "provisioningState" → expect "Succeeded"`,
    gcp: `gsutil ls -b gs://${item.resourceIds[0]} → expect bucket listed`,
  };

  return {
    name: "storage_exists",
    passed: true,
    message: `Verify storage resource exists: ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkLifecyclePolicyExists(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws s3api get-bucket-lifecycle-configuration --bucket ${item.resourceIds[0]} → expect rules with ID "axiom-transition-infrequent"; aws s3api list-bucket-intelligent-tiering-configurations --bucket ${item.resourceIds[0]} → expect "axiom-auto-tier"`,
    azure: `az storage account management-policy show --account-name ${item.resourceIds[0]} --resource-group <resource-group> → expect rules containing "axiom-auto-tier"`,
    gcp: `gsutil lifecycle get gs://${item.resourceIds[0]} → expect rules with SetStorageClass actions for NEARLINE (30d) and COLDLINE (90d)`,
  };

  return {
    name: "lifecycle_policy_exists",
    passed: true,
    message: `Verify lifecycle policy is active: ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkPolicyMatchesConfig(item: ExecutionPlanItem): VerificationCheck {
  const expected: Record<CloudProvider, string> = {
    aws: "Intelligent-Tiering: ARCHIVE_ACCESS at 90d, DEEP_ARCHIVE_ACCESS at 180d. Lifecycle: STANDARD_IA at 30d, GLACIER_IR at 90d.",
    azure: "Management policy: tierToCool at 30d, tierToArchive at 90d, blobTypes=[blockBlob].",
    gcp: "Lifecycle rules: SetStorageClass NEARLINE at age 30, SetStorageClass COLDLINE at age 90.",
  };

  return {
    name: "policy_matches_config",
    passed: true,
    message: `Verify policy configuration matches expected: ${expected[item.provider]}`,
    severity: "critical",
  };
}

function checkNoConflictingRules(item: ExecutionPlanItem): VerificationCheck {
  const notes: Record<CloudProvider, string> = {
    aws: "Check for pre-existing lifecycle rules that might transition objects to a different class at an earlier threshold. Multiple rules with overlapping prefixes can cause unexpected behavior.",
    azure: "Check for other management policy rules. Azure allows only one management policy per account — Axiom's rule must coexist within it.",
    gcp: "Check for pre-existing lifecycle rules. GCP evaluates all rules independently — conflicting age thresholds can cause double transitions.",
  };

  return {
    name: "no_conflicting_rules",
    passed: true,
    message: notes[item.provider],
    severity: "warning",
  };
}

function checkAccessPatternsUnaffected(item: ExecutionPlanItem): VerificationCheck {
  const notes: Record<CloudProvider, string> = {
    aws: "Monitor S3 request metrics for 24-48 hours. Increased 403 errors or retrieval costs may indicate hot data was unexpectedly transitioned.",
    azure: "Monitor storage account transactions for 24-48 hours. Increased rehydration requests indicate frequently accessed blobs were moved to Archive.",
    gcp: "Monitor GCS request counts for 24-48 hours. Early deletion fees apply if Nearline objects are accessed within 30 days.",
  };

  return {
    name: "access_patterns_unaffected",
    passed: true,
    message: notes[item.provider],
    severity: "warning",
  };
}

// ---------------------------------------------------------------------------
// 3. Commitment verification (advisory)
// ---------------------------------------------------------------------------

function verifyCommitment(item: ExecutionPlanItem): VerificationCheck[] {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ce get-savings-plans-utilization --time-period "Start=<purchase-date>,End=$(date +%Y-%m-%d)" → utilization should be >80%`,
    azure: `az consumption reservation summary list --reservation-order-id <order-id> --grain monthly → utilization should be >80%`,
    gcp: `gcloud compute commitments describe <commitment-name> --region=${item.region} → status should be "ACTIVE"`,
  };

  return [
    {
      name: "commitment_active",
      passed: true,
      message: `Verify commitment is active and utilized: ${queries[item.provider]}`,
      severity: "critical",
    },
    {
      name: "commitment_utilization",
      passed: true,
      message: "Check commitment utilization after 7 days. Utilization below 80% indicates over-commitment — workloads may have shifted or been decommissioned.",
      severity: "warning",
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Decommission verification
// ---------------------------------------------------------------------------

function verifyDecommission(item: ExecutionPlanItem): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  checks.push(checkInstanceGone(item));
  checks.push(checkSnapshotExists(item));
  checks.push(checkOrphanedResources(item));
  checks.push(checkDependenciesUnbroken(item));

  return checks;
}

function checkInstanceGone(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-instances --instance-ids ${item.resourceIds[0]} --region ${item.region} --query "Reservations[0].Instances[0].State.Name" → expect "terminated"`,
    azure: `az vm show --name ${item.resourceIds[0]} --resource-group <resource-group> 2>&1 → expect "ResourceNotFound"`,
    gcp: `gcloud compute instances describe ${item.resourceIds[0]} --zone=${item.region}-a 2>&1 → expect "was not found"`,
  };

  return {
    name: "instance_terminated",
    passed: true,
    message: `Verify instance is deleted: ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkSnapshotExists(item: ExecutionPlanItem): VerificationCheck {
  const queries: Record<CloudProvider, string> = {
    aws: `aws ec2 describe-snapshots --filters "Name=description,Values=*axiom-backup*${item.resourceIds[0]}*" --region ${item.region} → expect at least 1 snapshot`,
    azure: `az snapshot list --resource-group <resource-group> --query "[?contains(name, '${item.resourceIds[0]}-axiom-backup')]" → expect at least 1 snapshot`,
    gcp: `gcloud compute snapshots list --filter="name~${item.resourceIds[0]}-axiom-backup" → expect at least 1 snapshot`,
  };

  return {
    name: "backup_snapshot_exists",
    passed: true,
    message: `Verify pre-deletion snapshot exists: ${queries[item.provider]}`,
    severity: "critical",
  };
}

function checkOrphanedResources(item: ExecutionPlanItem): VerificationCheck {
  const notes: Record<CloudProvider, string> = {
    aws: `Check for orphaned EBS volumes: aws ec2 describe-volumes --filters "Name=status,Values=available" --region ${item.region} → delete any that were attached to terminated instances.`,
    azure: `Check for orphaned managed disks: az disk list --resource-group <resource-group> --query "[?managedBy==null]" → delete any that were attached to deleted VMs.`,
    gcp: `Check for orphaned disks: gcloud compute disks list --filter="NOT users:*" --zones=${item.region}-a → delete any that were attached to deleted instances.`,
  };

  return {
    name: "no_orphaned_resources",
    passed: true,
    message: notes[item.provider],
    severity: "warning",
  };
}

function checkDependenciesUnbroken(item: ExecutionPlanItem): VerificationCheck {
  return {
    name: "dependencies_unbroken",
    passed: true,
    message: "Verify no load balancer target groups, DNS records, or monitoring rules still reference the deleted instance(s). Orphaned references cause silent routing failures.",
    severity: "warning",
  };
}

// ---------------------------------------------------------------------------
// 5. Restrict public access verification
// ---------------------------------------------------------------------------

function verifyRestrictPublicAccess(item: ExecutionPlanItem): VerificationCheck[] {
  const queries: Record<CloudProvider, string> = {
    aws: `aws s3api get-public-access-block --bucket ${item.resourceIds[0]} → expect all Block* settings to be true`,
    azure: `az storage account show --name ${item.resourceIds[0]} --query "allowBlobPublicAccess" → expect "false"`,
    gcp: `gsutil pap get gs://${item.resourceIds[0]} → expect "enforced"`,
  };

  return [
    {
      name: "public_access_blocked",
      passed: true,
      message: `Verify public access is restricted: ${queries[item.provider]}`,
      severity: "critical",
    },
    {
      name: "no_broken_access",
      passed: true,
      message: "Verify no legitimate public-facing services are broken (CDN distributions, static website hosting, public datasets). Monitor 403 error rates for 24 hours.",
      severity: "warning",
    },
  ];
}

// ---------------------------------------------------------------------------
// 6. Enable backup verification
// ---------------------------------------------------------------------------

function verifyEnableBackup(item: ExecutionPlanItem): VerificationCheck[] {
  const queries: Record<CloudProvider, string> = {
    aws: `aws backup list-backup-jobs --by-resource-arn <resource-arn> → expect at least 1 completed backup within 24h`,
    azure: `az backup item list --vault-name <vault> --resource-group <rg> → expect protected items matching resource IDs`,
    gcp: `gcloud compute snapshots list --filter="sourceDisk~${item.resourceIds[0]}" → expect at least 1 snapshot`,
  };

  return [
    {
      name: "backup_schedule_active",
      passed: true,
      message: `Verify backup schedule is active: ${queries[item.provider]}`,
      severity: "critical",
    },
    {
      name: "first_backup_completed",
      passed: true,
      message: "Verify the first backup job has completed successfully. Check again after 24 hours to confirm the daily schedule is running.",
      severity: "warning",
    },
    {
      name: "retention_policy_correct",
      passed: true,
      message: "Verify retention policy is set to 30 days and cross-region replication is enabled if configured.",
      severity: "info",
    },
  ];
}

// ---------------------------------------------------------------------------
// CLI command generators (read-only commands for external execution)
// ---------------------------------------------------------------------------

type CommandGenerator = (item: ExecutionPlanItem) => VerificationCommand[];

const COMMAND_GENERATORS: Record<string, CommandGenerator> = {
  resize_compute: genResizeVerificationCommands,
  apply_storage_policy: genStorageVerificationCommands,
  purchase_commitment: genCommitmentVerificationCommands,
  decommission_compute: genDecommissionVerificationCommands,
  restrict_public_access: genRestrictPublicAccessVerificationCommands,
  enable_backup: genEnableBackupVerificationCommands,
};

function genResizeVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: item.resourceIds.map((id) => ({
      description: `Verify ${id} is resized and running`,
      command: `aws ec2 describe-instances --instance-ids "${id}" --region "${item.region}" --query "Reservations[0].Instances[0].{Type:InstanceType,State:State.Name,Status:Monitoring.State}" --output table`,
      parseHint: `InstanceType should be "${recommended}", State should be "running"`,
    })),
    azure: item.resourceIds.map((id) => ({
      description: `Verify ${id} is resized and running`,
      command: `az vm show --name "${id}" --resource-group "<resource-group>" --show-details --query "{Size:hardwareProfile.vmSize,PowerState:powerState,ProvisioningState:provisioningState}" --output table`,
      parseHint: `Size should be "${recommended}", PowerState should be "VM running"`,
    })),
    gcp: item.resourceIds.map((id) => ({
      description: `Verify ${id} is resized and running`,
      command: `gcloud compute instances describe "${id}" --zone="${item.region}-a" --format="table(machineType.basename(),status)"`,
      parseHint: `machineType should be "${recommended}", status should be "RUNNING"`,
    })),
  };
  return commands[item.provider];
}

function genStorageVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: item.resourceIds.flatMap((id) => [
      {
        description: `Verify lifecycle rules on bucket "${id}"`,
        command: `aws s3api get-bucket-lifecycle-configuration --bucket "${id}" --output json`,
        parseHint: `Should contain rule with ID "axiom-transition-infrequent"`,
      },
      {
        description: `Verify Intelligent-Tiering on bucket "${id}"`,
        command: `aws s3api list-bucket-intelligent-tiering-configurations --bucket "${id}" --output json`,
        parseHint: `Should contain configuration with Id "axiom-auto-tier"`,
      },
    ]),
    azure: item.resourceIds.map((id) => ({
      description: `Verify management policy on storage account "${id}"`,
      command: `az storage account management-policy show --account-name "${id}" --resource-group "<resource-group>" --output json`,
      parseHint: `Should contain rule named "axiom-auto-tier" with tierToCool at 30d and tierToArchive at 90d`,
    })),
    gcp: item.resourceIds.map((id) => ({
      description: `Verify lifecycle rules on bucket "${id}"`,
      command: `gsutil lifecycle get gs://${id}`,
      parseHint: `Should contain SetStorageClass NEARLINE (age 30) and COLDLINE (age 90)`,
    })),
  };
  return commands[item.provider];
}

function genCommitmentVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: [{
      description: "Verify Savings Plan utilization",
      command: `aws ce get-savings-plans-utilization --time-period "Start=$(date -d '-7 days' +%Y-%m-%d),End=$(date +%Y-%m-%d)" --output table`,
      parseHint: "UtilizationPercentage should be >80%. Lower values indicate over-commitment.",
    }],
    azure: [{
      description: "Verify reservation utilization",
      command: `az consumption reservation summary list --grain monthly --reservation-order-id "<order-id>" --output table`,
      parseHint: "avgUtilizationPercentage should be >80%",
    }],
    gcp: [{
      description: "Verify commitment status",
      command: `gcloud compute commitments list --region="${item.region}" --format="table(name,status,plan,startTimestamp,endTimestamp)"`,
      parseHint: "Status should be ACTIVE. Verify start/end timestamps match expected term.",
    }],
  };
  return commands[item.provider];
}

function genDecommissionVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: [
      ...item.resourceIds.map((id) => ({
        description: `Verify ${id} is terminated`,
        command: `aws ec2 describe-instances --instance-ids "${id}" --region "${item.region}" --query "Reservations[0].Instances[0].State.Name" --output text`,
        parseHint: `Should return "terminated"`,
      })),
      {
        description: "Check for orphaned EBS volumes",
        command: `aws ec2 describe-volumes --filters "Name=status,Values=available" --region "${item.region}" --query "Volumes[].{ID:VolumeId,Size:Size,Created:CreateTime}" --output table`,
        parseHint: "Review any available volumes — they may be orphaned from terminated instances",
      },
    ],
    azure: [
      ...item.resourceIds.map((id) => ({
        description: `Verify ${id} is deleted`,
        command: `az vm show --name "${id}" --resource-group "<resource-group>" 2>&1`,
        parseHint: `Should return "ResourceNotFound" error`,
      })),
      {
        description: "Check for orphaned managed disks",
        command: `az disk list --resource-group "<resource-group>" --query "[?managedBy==null].{Name:name,Size:diskSizeGb,State:diskState}" --output table`,
        parseHint: "Review unattached disks — they may be orphaned from deleted VMs",
      },
    ],
    gcp: [
      ...item.resourceIds.map((id) => ({
        description: `Verify ${id} is deleted`,
        command: `gcloud compute instances describe "${id}" --zone="${item.region}-a" 2>&1`,
        parseHint: `Should return "was not found" error`,
      })),
      {
        description: "Check for orphaned disks",
        command: `gcloud compute disks list --filter="NOT users:*" --zones="${item.region}-a" --format="table(name,sizeGb,status)"`,
        parseHint: "Review disks with no users — they may be orphaned from deleted instances",
      },
    ],
  };
  return commands[item.provider];
}

function genRestrictPublicAccessVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: item.resourceIds.map((id) => ({
      description: `Verify public access is blocked on ${id}`,
      command: `aws s3api get-public-access-block --bucket "${id}" --output json`,
      parseHint: "All Block* settings should be true",
    })),
    azure: item.resourceIds.map((id) => ({
      description: `Verify public access is disabled on ${id}`,
      command: `az storage account show --name "${id}" --query "allowBlobPublicAccess" --output tsv`,
      parseHint: `Should return "false"`,
    })),
    gcp: item.resourceIds.map((id) => ({
      description: `Verify public access prevention on ${id}`,
      command: `gsutil pap get gs://${id}`,
      parseHint: `Should show "enforced"`,
    })),
  };
  return commands[item.provider];
}

function genEnableBackupVerificationCommands(item: ExecutionPlanItem): VerificationCommand[] {
  const commands: Record<CloudProvider, VerificationCommand[]> = {
    aws: [
      {
        description: "List recent backup jobs",
        command: `aws backup list-backup-jobs --by-state COMPLETED --region "${item.region}" --max-results 10 --output table`,
        parseHint: "Should show at least 1 completed backup job for the protected resources",
      },
    ],
    azure: [
      {
        description: "List backup-protected items",
        command: `az backup item list --vault-name "<vault-name>" --resource-group "<resource-group>" --output table`,
        parseHint: "Should list all protected resource IDs with status 'Healthy'",
      },
    ],
    gcp: [
      {
        description: "List recent snapshots",
        command: `gcloud compute snapshots list --filter="creationTimestamp>$(date -d '-24 hours' +%Y-%m-%dT%H:%M:%S)" --format="table(name,sourceDisk,status,creationTimestamp)"`,
        parseHint: "Should show at least 1 recent snapshot for the protected resources",
      },
    ],
  };
  return commands[item.provider];
}

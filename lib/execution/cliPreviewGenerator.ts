/**
 * CLI Preview Generator.
 *
 * Produces typed CLI snippets a remediation *would* run. Never executes.
 * Each preview carries dry-run availability, required permission, risk
 * warning, and approval requirement so the operator can review safely.
 */

import type { RemediationCandidate } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderCli = "aws" | "az" | "gcloud" | "gh" | "kubectl" | "manual";

export interface CliPreview {
  id: string;
  candidateId: string;
  cli: ProviderCli;
  command: string;
  explanation: string;
  requiredPermission: string[];
  dryRunAvailable: boolean;
  dryRunCommand?: string;
  riskWarning: string;
  approvalRequirement: "single_approver" | "two_approvers" | "policy_blocked" | "none";
  manualReviewRequired: boolean;
  sourceMode: "live" | "preview" | "planned" | "blocked";
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

interface CliTemplate {
  cli: ProviderCli;
  command: string;
  explanation: string;
  requiredPermission: string[];
  dryRunAvailable: boolean;
  dryRunCommand?: string;
  riskWarning: string;
}

function awsS3BlockPublicAccess(bucket: string): CliTemplate {
  return {
    cli: "aws",
    command: `aws s3api put-public-access-block --bucket ${shellSafe(bucket)} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true`,
    explanation: "Blocks public access at the bucket boundary.",
    requiredPermission: ["s3:PutBucketPublicAccessBlock"],
    dryRunAvailable: false,
    riskWarning: "Existing anonymous consumers will lose access. Validate origin-access-identity / signed URL alternatives first.",
  };
}

function awsS3EnableEncryption(bucket: string): CliTemplate {
  return {
    cli: "aws",
    command: `aws s3api put-bucket-encryption --bucket ${shellSafe(bucket)} --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'`,
    explanation: "Enables default server-side encryption (AES256) on the bucket.",
    requiredPermission: ["s3:PutEncryptionConfiguration"],
    dryRunAvailable: false,
    riskWarning: "Existing unencrypted objects are not rewritten. Run a copy-in-place job to upgrade them if required.",
  };
}

function awsSgRevokeWideIngress(sgId: string): CliTemplate {
  return {
    cli: "aws",
    command: `aws ec2 revoke-security-group-ingress --group-id ${shellSafe(sgId)} --protocol tcp --port 443 --cidr 0.0.0.0/0`,
    explanation: "Revokes the wide 0.0.0.0/0 ingress on port 443. Replace cidr with the tightened value when re-authorising.",
    requiredPermission: ["ec2:RevokeSecurityGroupIngress"],
    dryRunAvailable: true,
    dryRunCommand: `aws ec2 revoke-security-group-ingress --group-id ${shellSafe(sgId)} --protocol tcp --port 443 --cidr 0.0.0.0/0 --dry-run`,
    riskWarning: "Any external caller relying on the wide rule will be denied. Confirm load-balancer + bastion paths first.",
  };
}

function azureStorageDisablePublicAccess(account: string): CliTemplate {
  return {
    cli: "az",
    command: `az storage account update --name ${shellSafe(account)} --allow-blob-public-access false`,
    explanation: "Disables public blob access for the storage account.",
    requiredPermission: ["Microsoft.Storage/storageAccounts/write"],
    dryRunAvailable: false,
    riskWarning: "Any consumer relying on anonymous blob URLs will lose access.",
  };
}

function gcpBucketRemovePublicReader(bucket: string): CliTemplate {
  return {
    cli: "gcloud",
    command: `gcloud storage buckets remove-iam-policy-binding gs://${shellSafe(bucket)} --member=allUsers --role=roles/storage.objectViewer`,
    explanation: "Removes the `allUsers` viewer binding from the bucket.",
    requiredPermission: ["storage.buckets.setIamPolicy"],
    dryRunAvailable: false,
    riskWarning: "Any anonymous reader will lose access immediately.",
  };
}

function githubProtectBranch(repoId: string, branch: string): CliTemplate {
  return {
    cli: "gh",
    command: `gh api -X PUT repos/${shellSafe(repoId)}/branches/${shellSafe(branch)}/protection --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "required_signatures": true
}
EOF`,
    explanation: "Applies a 2-approver protection ruleset with required signatures + status checks.",
    requiredPermission: ["repo_admin"],
    dryRunAvailable: false,
    riskWarning: "Tightens the merge flow — confirm hotfix path is documented.",
  };
}

function shellSafe(input: string): string {
  // Drop any characters that aren't safe in an unquoted shell arg; the
  // operator will substitute their real value before running.
  return input.replace(/[^a-zA-Z0-9_./:-]/g, "_");
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

function selectTemplate(candidate: RemediationCandidate): CliTemplate | null {
  const resourceId = candidate.resourceIds[0] ?? "resource";
  const connector = candidate.connector;

  if (connector.includes("aws.network_exposure")) {
    if (connector.includes("s3")) return awsS3BlockPublicAccess(resourceId);
    return awsSgRevokeWideIngress(resourceId);
  }
  if (connector.includes("aws.encryption_at_rest")) return awsS3EnableEncryption(resourceId);
  if (connector.includes("azure")) return azureStorageDisablePublicAccess(resourceId);
  if (connector.includes("gcp"))   return gcpBucketRemovePublicReader(resourceId);
  if (connector.startsWith("github.")) {
    const branch = candidate.proposedChange.payload?.branch || "main";
    return githubProtectBranch(resourceId, branch);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function generateCliPreview(candidate: RemediationCandidate): CliPreview {
  const now = new Date().toISOString();
  const tpl = selectTemplate(candidate);
  const approval =
    candidate.approvalRequirement === "two_approvers"   ? "two_approvers"  :
    candidate.approvalRequirement === "single_approver" ? "single_approver" :
    candidate.approvalRequirement === "policy_blocked"  ? "policy_blocked"  : "none";

  if (!tpl) {
    return {
      id: `cli.${candidate.id}`,
      candidateId: candidate.id,
      cli: "manual",
      command: "# Manual review required — no canonical CLI template available.",
      explanation: "Axiom does not yet ship a CLI template for this remediation. Apply via the provider console or Terraform.",
      requiredPermission: candidate.requiredPermissions,
      dryRunAvailable: false,
      riskWarning: "Treat as manual review only.",
      approvalRequirement: approval,
      manualReviewRequired: true,
      sourceMode: candidate.sourceMode,
      generatedAt: now,
    };
  }

  return {
    id: `cli.${candidate.id}`,
    candidateId: candidate.id,
    cli: tpl.cli,
    command: tpl.command,
    explanation: tpl.explanation,
    requiredPermission: tpl.requiredPermission,
    dryRunAvailable: tpl.dryRunAvailable,
    dryRunCommand: tpl.dryRunCommand,
    riskWarning: tpl.riskWarning,
    approvalRequirement: approval,
    manualReviewRequired: false,
    sourceMode: candidate.sourceMode,
    generatedAt: now,
  };
}

export function generateCliPreviews(candidates: RemediationCandidate[]): CliPreview[] {
  return candidates.map(generateCliPreview);
}
